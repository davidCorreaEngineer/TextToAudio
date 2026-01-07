const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const {
    getVoiceCategory,
    countCharacters,
    countBytes,
    countCharactersInSsml,
    countCharactersInSsmlText,
    QUOTA_LIMITS,
    BYTE_BASED_VOICES,
} = require('./src/utils');
const {
    calculateQuotaCount,
    updateQuota,
    checkQuotaAllows,
    getQuotaData,
    formatQuotaExceededError,
} = require('./src/services/quotaService');
const { createGermanLessonsRouter } = require('./src/routes/germanLessonsRouter');
const {
    SUPPORTED_LANGUAGES,
    validateVoiceParams,
    validateSsml,
} = require('./src/validators/inputValidation');
const { createApiKeyAuthMiddleware } = require('./src/middleware/auth');
const { createRateLimitMiddleware } = require('./src/middleware/rateLimit');
const { createCorsOptions, parseCorsConfig } = require('./src/middleware/cors');
const { sanitizeError, sendError } = require('./src/middleware/errorHandler');
const {
    createTtsClient,
    generateSpeech,
    listVoices
} = require('./src/services/ttsService');

const app = express();

// File upload configuration with security limits
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 20                    // Max 20 files per request
    },
    fileFilter: (req, file, cb) => {
        // Only allow text files
        const allowedMimes = ['text/plain', 'application/xml', 'text/xml'];
        const allowedExts = ['.txt', '.ssml', '.xml'];
        const ext = path.extname(file.originalname).toLowerCase();

        if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only text files (.txt, .ssml, .xml) are allowed'));
        }
    }
});

const client = createTtsClient(path.join(__dirname, 'keyfile.json'));

const MAX_TEXT_LENGTH = 5000; // Maximum allowed bytes

// =============================================================================
// CONFIGURATION
// =============================================================================

// API Key Authentication
// Set via environment variable or generate a secure default for first run
// IMPORTANT: In production, always set TTS_API_KEY environment variable
const API_KEY = process.env.TTS_API_KEY || null;

// If no API key is configured, generate one (first run only)
if (!API_KEY) {
    const generatedKey = crypto.randomBytes(32).toString('hex');
    console.warn('='.repeat(70));
    console.warn('WARNING: No API key configured!');
    console.warn('A temporary key has been generated for this session.');
    console.warn('Set TTS_API_KEY environment variable for production use.');
    console.warn('To retrieve the generated key, check .env or restart with TTS_API_KEY set.');
    console.warn('='.repeat(70));
    // Store for this session (key not logged for security)
    process.env.TTS_API_KEY = generatedKey;
}

const ACTIVE_API_KEY = process.env.TTS_API_KEY;

// CORS Configuration
// Set allowed origins via environment variable (comma-separated) or default to same-origin only
// Use "*" to allow all origins (not recommended for production)
const CORS_ORIGINS_RAW = process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS || '';
const { allowAll: ALLOW_ALL_ORIGINS, allowedOrigins: ALLOWED_ORIGINS } = parseCorsConfig(CORS_ORIGINS_RAW);

// Rate limiting: max requests per IP per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;     // 10 requests per minute per IP

// Quota limits imported from src/utils.js

// File cleanup: delete audio files older than this
const AUDIO_FILE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// Quota file path
const QUOTA_FILE_PATH = path.join(__dirname, 'quota.json');

// =============================================================================
// INPUT VALIDATION
// =============================================================================
// Validation functions (validateVoiceParams, validateSsml) imported from src/validators/inputValidation.js

// =============================================================================
// SECURITY: API KEY AUTHENTICATION
// =============================================================================

// Create authentication middleware with the active API key
const apiKeyAuthMiddleware = createApiKeyAuthMiddleware(ACTIVE_API_KEY);

// =============================================================================
// SECURITY: ERROR SANITIZATION
// =============================================================================

// Error sanitization functions imported from src/middleware/errorHandler.js

// =============================================================================
// RATE LIMITING
// =============================================================================

// Create rate limiting middleware with configured limits
const rateLimitMiddleware = createRateLimitMiddleware({
    windowMs: RATE_LIMIT_WINDOW_MS,
    maxRequests: RATE_LIMIT_MAX_REQUESTS
});

// =============================================================================
// FILE CLEANUP
// =============================================================================

async function cleanupOldAudioFiles() {
    try {
        const publicDir = path.join(__dirname, 'public');
        const files = await fs.readdir(publicDir);
        const now = Date.now();

        for (const file of files) {
            if (!file.endsWith('_audio.mp3')) continue;

            const filePath = path.join(publicDir, file);
            try {
                const stats = await fs.stat(filePath);
                const age = now - stats.mtimeMs;

                if (age > AUDIO_FILE_MAX_AGE_MS) {
                    await fs.unlink(filePath);
                    console.log(`Cleaned up old audio file: ${file}`);
                }
            } catch (err) {
                // File may have been deleted already, ignore
            }
        }
    } catch (error) {
        console.error('Error during audio file cleanup:', error);
    }
}

// Run cleanup every 10 minutes (unref allows Node to exit)
setInterval(cleanupOldAudioFiles, 10 * 60 * 1000).unref();

// Run cleanup once on startup
cleanupOldAudioFiles();

// =============================================================================
// MIDDLEWARE
// =============================================================================

// CORS with restricted origins
const corsOptions = createCorsOptions({
    allowAll: ALLOW_ALL_ORIGINS,
    allowedOrigins: ALLOWED_ORIGINS
});

app.use(cors(corsOptions));
app.use(express.static('public'));
app.use(express.json({ limit: '100kb' }));

// **1. Voice Type Mapping Function**
// Utility functions (getVoiceCategory, countCharacters, countBytes) imported from src/utils.js
// Quota functions (updateQuota, checkQuotaAllows) imported from src/services/quotaService.js

// **7. Root Route**
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// **8. Voices Endpoint**
// Protected by API key authentication
app.get('/voices', apiKeyAuthMiddleware, async (req, res) => {
    try {
        console.log('Fetching voices from Google TTS API...');

        // Use the centralized SUPPORTED_LANGUAGES constant
        const voices = await listVoices(client, SUPPORTED_LANGUAGES);

        console.log(`Filtered voices: ${voices.length}`);

        res.json(voices);
    } catch (error) {
        console.error("Error fetching voices:", error);
        return sendError(res, 500, error);
    }
});

// **9. Test Voice Endpoint (Do Not Save Audio Files)**
// Protected by API key authentication and rate limited
// Supports both default test sentences and custom text preview
app.post('/test-voice', apiKeyAuthMiddleware, rateLimitMiddleware, express.json(), async (req, res) => {
    try {
        const { language, voice, speakingRate, pitch, customText, useSsml } = req.body;
        console.log(`Received test-voice request: Language=${language}, Voice=${voice}, SpeakingRate=${speakingRate}, Pitch=${pitch}, CustomText=${customText ? 'provided' : 'not provided'}, UseSsml=${useSsml}`);

        // Validate voice parameters
        const validation = validateVoiceParams({ language, voice, speakingRate, pitch });
        if (!validation.valid) {
            console.log(`Validation failed: ${validation.errors.join(', ')}`);
            return res.status(400).json({ success: false, error: validation.errors.join('; ') });
        }

        // Validate custom text if SSML mode
        if (customText && (useSsml === true || useSsml === 'true')) {
            const ssmlValidation = validateSsml(customText);
            if (!ssmlValidation.valid) {
                return res.status(400).json({ success: false, error: ssmlValidation.error });
            }
        }

        const testSentences = {
			'en-US': "How can I improve my English pronunciation?",
			'en-GB': "It's important to drink water regularly throughout the day.",
			'en-AU': "What time does the next bus arrive at the station?",
			'es-ES': "¿Dónde puedo encontrar una farmacia cercana?",
			'es-US': "¿Cuál es el mejor lugar para comer tacos en la ciudad?",
			'de-DE': "Wie komme ich am besten zum Hauptbahnhof?",
			'nl-NL': "Waar is de dichtstbijzijnde supermarkt?",
			'ja-JP': "この近くにおいしいレストランはありますか？",
			'pt-PT': "Qual é o caminho mais rápido para chegar ao centro da cidade?",
			'pt-BR': "Qual é o caminho mais rápido para chegar ao centro da cidade?",
			'fr-FR': "Pouvez-vous me recommander un bon café à proximité?",
			'it-IT': "Qual è il miglior ristorante di questa zona?",
			'tr-TR': "Hızlı kahverengi tilki tembel köpeğin üstünden atlar."
		};

        // Use custom text if provided, otherwise use default test sentence
        let testText;
        let useCustomSsml = false;

        if (customText && customText.trim()) {
            testText = customText.trim();
            useCustomSsml = useSsml === true || useSsml === 'true';
            // Limit preview text length to prevent abuse
            const maxPreviewLength = 500;
            if (testText.length > maxPreviewLength) {
                testText = testText.substring(0, maxPreviewLength);
                console.log(`Custom text truncated to ${maxPreviewLength} characters for preview.`);
            }
        } else {
            testText = testSentences[validation.sanitized.language] || "This is a test of the selected voice.";
        }
        console.log(`Test sentence: "${testText.substring(0, 100)}${testText.length > 100 ? '...' : ''}"`);

        const audioContent = await generateSpeech(client, {
            text: testText,
            languageCode: validation.sanitized.language,
            voiceName: validation.sanitized.voice,
            speakingRate: validation.sanitized.speakingRate,
            pitch: validation.sanitized.pitch,
            useSsml: useCustomSsml
        });
        console.log("Audio synthesized successfully for test voice.");

        // Convert audio content to Base64
        const audioBase64 = audioContent.toString('base64');
        res.json({ success: true, audioContent: audioBase64, testText: testText });
        console.log("Test voice audio data sent to client.");
    } catch (error) {
        console.error("Error testing voice:", error);
        return sendError(res, 500, error);
    }
});

// **10. Check File Size Endpoint**
// Protected by API key authentication
app.post('/check-file-size', apiKeyAuthMiddleware, upload.single('textFile'), async (req, res) => {
    try {
        if (!req.file) {
            console.log("No file uploaded for size check.");
            return res.status(400).json({ success: false, error: 'No file uploaded.' });
        }
        const stats = await fs.stat(req.file.path);
        const fileSizeInBytes = stats.size;
        await fs.unlink(req.file.path); // Clean up the uploaded file
        console.log(`File size checked: ${fileSizeInBytes} bytes`);
        res.json({ byteLength: fileSizeInBytes });
    } catch (error) {
        console.error("Error checking file size:", error);
        return sendError(res, 500, error);
    }
});

// **11. Synthesize Endpoint (Name Audio Files Based on Original Text File)**
// Protected by API key authentication and rate limited
app.post('/synthesize', apiKeyAuthMiddleware, rateLimitMiddleware, upload.none(), async (req, res) => {
    try {
        let text = req.body.textContent || '';
        const language = req.body.language;
        const voice = req.body.voice;
        const speakingRate = req.body.speakingRate;
        const pitch = req.body.pitch;
        const originalFileName = req.body.originalFileName || `audio_${Date.now()}`;
        const useSsml = req.body.useSsml === 'true';

        console.log(`Received synthesize request: Language=${language}, Voice=${voice}, SpeakingRate=${speakingRate}, Pitch=${pitch}, OriginalFileName=${originalFileName}, UseSsml=${useSsml}`);

        if (!text) {
            console.log("No text provided for synthesis.");
            return res.status(400).json({ success: false, error: 'No text provided.' });
        }

        // Validate voice parameters
        const validation = validateVoiceParams({ language, voice, speakingRate, pitch });
        if (!validation.valid) {
            console.log(`Validation failed: ${validation.errors.join(', ')}`);
            return res.status(400).json({ success: false, error: validation.errors.join('; ') });
        }

        // Validate text content (especially if SSML)
        if (useSsml) {
            const ssmlValidation = validateSsml(text);
            if (!ssmlValidation.valid) {
                return res.status(400).json({ success: false, error: ssmlValidation.error });
            }
        }

        // **Calculate quota count using quota service**
        const { count, voiceCategory, unit } = calculateQuotaCount(text, validation.sanitized.voice, useSsml);
        console.log(`${unit.charAt(0).toUpperCase() + unit.slice(1)} count for quota (${voiceCategory}): ${count}`);

        // **Check Text Length**
        if (count > MAX_TEXT_LENGTH) {
            console.log(`Text exceeds maximum allowed size of ${MAX_TEXT_LENGTH} characters.`);
            return res.status(400).json({
                success: false,
                error: `Text is too long (${count} ${unit}). Maximum allowed is ${MAX_TEXT_LENGTH}.`
            });
        }

        // **Check Quota BEFORE Making API Call**
        const quotaCheck = await checkQuotaAllows(voiceCategory, count, QUOTA_FILE_PATH);
        if (!quotaCheck.allowed) {
            console.log(`Quota exceeded for ${voiceCategory}: ${quotaCheck.currentUsage}/${quotaCheck.limit} ${unit}`);
            return res.status(429).json({
                success: false,
                error: formatQuotaExceededError(voiceCategory, quotaCheck)
            });
        }

        const audioContent = await generateSpeech(client, {
            text,
            languageCode: validation.sanitized.language,
            voiceName: validation.sanitized.voice,
            speakingRate: validation.sanitized.speakingRate,
            pitch: validation.sanitized.pitch,
            useSsml
        });
        console.log("Audio synthesized successfully.");

        // Update quota (voiceCategory already determined above)
        await updateQuota(voiceCategory, count, QUOTA_FILE_PATH);
        console.log("Quota updated.");

        // Generate output filename based on input source
        let outputFileName;
        const sanitizedFileName = path.parse(originalFileName).name.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');

        // If originalFileName looks like a real file (not default pattern), use it directly
        if (sanitizedFileName && !sanitizedFileName.startsWith('audio_')) {
            outputFileName = `${sanitizedFileName}.mp3`;
        } else {
            // For text editor input, generate name from first words or timestamp
            const uniqueId = `text_${Date.now()}`;
            outputFileName = `${uniqueId}.mp3`;
        }

        const outputFile = path.join(__dirname, 'public', outputFileName);

        await fs.writeFile(outputFile, audioContent, 'binary');
        console.log(`Audio file saved as ${outputFileName}`);

        res.json({ success: true, file: outputFileName, fileName: outputFileName });
        console.log("Synthesize response sent to client.");
    } catch (error) {
        console.error("Error generating speech:", error);
        return sendError(res, 500, error);
    }
});

// **12. Dashboard Endpoint**
// Protected by API key authentication
app.get('/dashboard', apiKeyAuthMiddleware, async (req, res) => {
    try {
        const quota = await getQuotaData(QUOTA_FILE_PATH);
        console.log("Quota data loaded for dashboard:", quota);
        res.json({ quota });
        console.log("Quota data sent to dashboard.");
    } catch (error) {
        console.error("Error fetching quota for dashboard:", error);
        return sendError(res, 500, error);
    }
});

// =============================================================================
// GERMAN LESSONS INTEGRATION
// =============================================================================

// Path to German lessons directory (sibling project)
const GERMAN_LESSONS_PATH = path.join(__dirname, '..', 'german', 'lessons');

// Mount German lessons router
const germanLessonsRouter = createGermanLessonsRouter({
    lessonsPath: GERMAN_LESSONS_PATH,
    authMiddleware: apiKeyAuthMiddleware,
});
app.use('/german-lessons', germanLessonsRouter);

// **Function to Count Characters in SSML Input**
// SSML utility functions (countCharactersInSsml, countCharactersInSsmlText) imported from src/utils.js

// **15. Batch Synthesize Endpoint (Process Multiple Text Files)**
// Protected by API key authentication and rate limited
app.post('/synthesize-batch', apiKeyAuthMiddleware, rateLimitMiddleware, upload.array('textFiles', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            console.log("No files uploaded for batch synthesis.");
            return res.status(400).json({ success: false, error: 'No files uploaded.' });
        }

        const language = req.body.language;
        const voice = req.body.voice;
        const speakingRate = req.body.speakingRate;
        const pitch = req.body.pitch;
        const useSsml = req.body.useSsml === 'true';

        console.log(`Received batch synthesize request: ${req.files.length} files, Language=${language}, Voice=${voice}`);

        // Validate voice parameters before processing any files
        const validation = validateVoiceParams({ language, voice, speakingRate, pitch });
        if (!validation.valid) {
            console.log(`Batch validation failed: ${validation.errors.join(', ')}`);
            // Clean up uploaded files before returning error
            for (const file of req.files) {
                try { await fs.unlink(file.path); } catch (e) { /* ignore */ }
            }
            return res.status(400).json({ success: false, error: validation.errors.join('; ') });
        }

        const results = [];

        // Process each file sequentially
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const fileName = path.parse(file.originalname).name;

            try {
                // Read file content
                const text = await fs.readFile(file.path, 'utf8');

                if (!text.trim()) {
                    results.push({
                        success: false,
                        fileName: file.originalname,
                        error: 'File is empty'
                    });
                    await fs.unlink(file.path); // Clean up uploaded file
                    continue;
                }

                // Calculate quota count using quota service
                const { count, voiceCategory, unit } = calculateQuotaCount(text, validation.sanitized.voice, useSsml);

                // Check text length
                if (count > MAX_TEXT_LENGTH) {
                    results.push({
                        success: false,
                        fileName: file.originalname,
                        error: `Text too long (${count} ${unit}). Max: ${MAX_TEXT_LENGTH}`
                    });
                    await fs.unlink(file.path);
                    continue;
                }

                // Check quota
                const quotaCheck = await checkQuotaAllows(voiceCategory, count, QUOTA_FILE_PATH);
                if (!quotaCheck.allowed) {
                    results.push({
                        success: false,
                        fileName: file.originalname,
                        error: `Quota exceeded for ${voiceCategory}. Remaining: ${quotaCheck.remaining} ${unit}`
                    });
                    await fs.unlink(file.path);
                    continue;
                }

                // Generate speech
                const audioContent = await generateSpeech(client, {
                    text,
                    languageCode: validation.sanitized.language,
                    voiceName: validation.sanitized.voice,
                    speakingRate: validation.sanitized.speakingRate,
                    pitch: validation.sanitized.pitch,
                    useSsml
                });

                // Update quota
                await updateQuota(voiceCategory, count, QUOTA_FILE_PATH);

                // Save audio file
                const sanitizedFileName = fileName.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
                const outputFileName = `${sanitizedFileName}.mp3`;
                const outputFile = path.join(__dirname, 'public', outputFileName);
                await fs.writeFile(outputFile, audioContent, 'binary');

                results.push({
                    success: true,
                    fileName: file.originalname,
                    audioFile: outputFileName
                });

                console.log(`Processed ${i + 1}/${req.files.length}: ${file.originalname} -> ${outputFileName}`);

                // Clean up uploaded file
                await fs.unlink(file.path);

            } catch (error) {
                console.error(`Error processing file ${file.originalname}:`, error);
                results.push({
                    success: false,
                    fileName: file.originalname,
                    error: error.message || 'Processing failed'
                });

                // Clean up uploaded file
                try {
                    await fs.unlink(file.path);
                } catch (unlinkError) {
                    // Ignore if already deleted
                }
            }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`Batch processing complete: ${successCount}/${req.files.length} succeeded`);

        res.json({
            success: true,
            totalFiles: req.files.length,
            successCount,
            results
        });

    } catch (error) {
        console.error("Error in batch synthesis:", error);
        return sendError(res, 500, error);
    }
});

// Export app for testing
module.exports = app;

// Only start server if not in test environment
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
