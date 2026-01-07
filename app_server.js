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
} = require('./src/utils');
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

// =============================================================================
// INPUT VALIDATION
// =============================================================================

// Supported languages for TTS
const SUPPORTED_LANGUAGES = ['en-GB', 'en-US', 'en-AU', 'nl-NL', 'es-ES', 'es-US', 'de-DE', 'ja-JP', 'it-IT', 'fr-FR', 'pt-PT', 'pt-BR', 'tr-TR'];

// Voice name pattern: language-region-VoiceType-Letter (e.g., en-US-Standard-A)
const VOICE_NAME_PATTERN = /^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9]+-[A-Z]$/;

/**
 * Validates and sanitizes voice parameters
 * @param {Object} params - Raw parameters from request
 * @returns {Object} - { valid: boolean, errors: string[], sanitized: Object }
 */
function validateVoiceParams({ language, voice, speakingRate, pitch }) {
    const errors = [];
    const sanitized = {};

    // Validate language
    if (!language || typeof language !== 'string') {
        errors.push('Language is required');
    } else if (!SUPPORTED_LANGUAGES.includes(language)) {
        errors.push(`Unsupported language: ${language}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
    } else {
        sanitized.language = language;
    }

    // Validate voice name format
    if (!voice || typeof voice !== 'string') {
        errors.push('Voice is required');
    } else if (!VOICE_NAME_PATTERN.test(voice)) {
        errors.push(`Invalid voice name format: ${voice}`);
    } else {
        sanitized.voice = voice;
    }

    // Validate and clamp speaking rate (0.25 to 4.0)
    const rate = parseFloat(speakingRate);
    if (isNaN(rate)) {
        sanitized.speakingRate = 1.0;
    } else {
        sanitized.speakingRate = Math.max(0.25, Math.min(4.0, rate));
    }

    // Validate and clamp pitch (-20.0 to 20.0)
    const pitchVal = parseFloat(pitch);
    if (isNaN(pitchVal)) {
        sanitized.pitch = 0.0;
    } else {
        sanitized.pitch = Math.max(-20.0, Math.min(20.0, pitchVal));
    }

    return {
        valid: errors.length === 0,
        errors,
        sanitized
    };
}

/**
 * Basic SSML validation - checks for well-formed structure
 * @param {string} text - Text that may contain SSML
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validateSsml(text) {
    if (!text || typeof text !== 'string') {
        return { valid: false, error: 'Text is required' };
    }

    // Check for potentially malicious patterns
    const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,  // onclick, onerror, etc.
        /<iframe/i,
        /<object/i,
        /<embed/i
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(text)) {
            return { valid: false, error: 'Text contains disallowed content' };
        }
    }

    // If text looks like SSML, do basic structure check
    if (text.includes('<speak>') || text.includes('</speak>')) {
        // Check for balanced speak tags
        const speakOpen = (text.match(/<speak>/g) || []).length;
        const speakClose = (text.match(/<\/speak>/g) || []).length;
        if (speakOpen !== speakClose) {
            return { valid: false, error: 'Unbalanced <speak> tags in SSML' };
        }
    }

    return { valid: true, error: null };
}

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

// Run cleanup every 10 minutes
setInterval(cleanupOldAudioFiles, 10 * 60 * 1000);

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

// **Mutex for Quota Updates (prevents race conditions)**
let quotaLock = Promise.resolve();

// **5. Update Quota Function with Mutex Lock**
async function updateQuota(voiceType, count) {
    // Acquire lock by chaining onto the previous operation
    const releaseLock = new Promise(resolve => {
        quotaLock = quotaLock.then(async () => {
            const quotaFile = path.join(__dirname, 'quota.json');
            let quota = {};

            try {
                const data = await fs.readFile(quotaFile, 'utf8');
                quota = JSON.parse(data);
                console.log("Quota data loaded:", quota);
            } catch (error) {
                // File doesn't exist or is empty, start with an empty object
                console.log("Quota file not found or empty. Starting fresh.");
            }

            const currentDate = new Date();
            const yearMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;

            if (!quota[yearMonth]) {
                quota[yearMonth] = {};
            }

            if (!quota[yearMonth][voiceType]) {
                quota[yearMonth][voiceType] = 0;
            }

            quota[yearMonth][voiceType] += count;

            await fs.writeFile(quotaFile, JSON.stringify(quota, null, 2));
            console.log(`Quota updated for ${voiceType} in ${yearMonth}: ${quota[yearMonth][voiceType]}`);
            resolve();
        });
    });

    await releaseLock;
}

// **6. Check Quota Before API Call**
async function checkQuotaAllows(voiceType, requestedCount) {
    const quotaFile = path.join(__dirname, 'quota.json');
    const limit = QUOTA_LIMITS[voiceType];

    // If no limit defined for this voice type, allow (but log warning)
    if (limit === undefined) {
        console.warn(`No quota limit defined for voice type: ${voiceType}`);
        return { allowed: true };
    }

    let quota = {};
    try {
        const data = await fs.readFile(quotaFile, 'utf8');
        quota = JSON.parse(data);
    } catch (error) {
        // File doesn't exist, no usage yet
        return { allowed: true, currentUsage: 0, limit };
    }

    const currentDate = new Date();
    const yearMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;

    const currentUsage = (quota[yearMonth] && quota[yearMonth][voiceType]) || 0;
    const projectedUsage = currentUsage + requestedCount;

    if (projectedUsage > limit) {
        return {
            allowed: false,
            currentUsage,
            limit,
            requested: requestedCount,
            remaining: Math.max(0, limit - currentUsage)
        };
    }

    return { allowed: true, currentUsage, limit };
}

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

        // **Determine voice category first for correct quota counting**
        const voiceCategory = getVoiceCategory(validation.sanitized.voice);

        // **Adjust Counting for Quota Based on Voice Type**
        // Neural2, Studio, Polyglot, and Journey are billed by bytes
        // Standard and WaveNet are billed by characters
        const byteBasedVoices = ['Neural2', 'Studio', 'Polyglot', 'Journey'];
        let count;

        if (byteBasedVoices.includes(voiceCategory)) {
            // Count bytes for byte-based voices
            if (useSsml) {
                count = countBytes(countCharactersInSsmlText(text));
            } else {
                count = countBytes(text);
            }
            console.log(`Byte count for quota (${voiceCategory}): ${count}`);
        } else {
            // Count characters for character-based voices (Standard, WaveNet)
            if (useSsml) {
                count = countCharactersInSsml(text);
            } else {
                count = countCharacters(text);
            }
            console.log(`Character count for quota (${voiceCategory}): ${count}`);
        }

        // **Check Text Length**
        if (count > MAX_TEXT_LENGTH) {
            console.log(`Text exceeds maximum allowed size of ${MAX_TEXT_LENGTH} characters.`);
            return res.status(400).json({
                success: false,
                error: `Text is too long (${count} characters). Maximum allowed is ${MAX_TEXT_LENGTH} characters.`
            });
        }

        // **Check Quota BEFORE Making API Call**
        const quotaCheck = await checkQuotaAllows(voiceCategory, count);
        if (!quotaCheck.allowed) {
            const unit = byteBasedVoices.includes(voiceCategory) ? 'bytes' : 'characters';
            console.log(`Quota exceeded for ${voiceCategory}: ${quotaCheck.currentUsage}/${quotaCheck.limit} ${unit}`);
            return res.status(429).json({
                success: false,
                error: `Monthly quota exceeded for ${voiceCategory} voices. ` +
                       `Used: ${quotaCheck.currentUsage.toLocaleString()} / ${quotaCheck.limit.toLocaleString()} ${unit}. ` +
                       `Remaining: ${quotaCheck.remaining.toLocaleString()} ${unit}. ` +
                       `Try a shorter text or different voice type.`
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
        await updateQuota(voiceCategory, count);
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
        const quotaFile = path.join(__dirname, 'quota.json');
        let quota = {};

        try {
            const data = await fs.readFile(quotaFile, 'utf8');
            quota = JSON.parse(data);
            console.log("Quota data loaded for dashboard:", quota);
        } catch (error) {
            console.log("Quota file not found or empty. Sending empty quota data.");
        }

        res.json({ quota: quota });
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

// **13. List German Lessons Endpoint**
// Protected by API key authentication
app.get('/german-lessons', apiKeyAuthMiddleware, async (req, res) => {
    try {
        const files = await fs.readdir(GERMAN_LESSONS_PATH);
        const lessonFiles = files
            .filter(f => f.endsWith('.txt'))
            .map(f => {
                // Extract lesson number or name for display
                const name = f.replace('.txt', '');
                let displayName = name;

                // Format display names nicely
                if (name.match(/^\d+_stackable$/)) {
                    displayName = `Lesson ${name.split('_')[0]}`;
                } else if (name === 'a2_capstone_stackable') {
                    displayName = 'A2 Capstone Review';
                } else if (name.match(/lesson_\d+_generated/)) {
                    displayName = `Generated Lesson ${name.match(/\d+/)[0]}`;
                }

                return { filename: f, displayName };
            })
            .sort((a, b) => {
                // Sort numerically where possible
                const matchA = a.filename.match(/\d+/);
                const matchB = b.filename.match(/\d+/);
                const numA = matchA ? parseInt(matchA[0]) : 999;
                const numB = matchB ? parseInt(matchB[0]) : 999;
                return numA - numB;
            });

        console.log(`Found ${lessonFiles.length} German lesson files`);
        res.json({ success: true, lessons: lessonFiles });
    } catch (error) {
        console.error("Error listing German lessons:", error);
        // Return empty list if directory doesn't exist
        if (error.code === 'ENOENT') {
            return res.json({ success: true, lessons: [], message: 'German lessons directory not found' });
        }
        return sendError(res, 500, error);
    }
});

// **14. Get German Lesson Content Endpoint**
// Protected by API key authentication
app.get('/german-lessons/:filename', apiKeyAuthMiddleware, async (req, res) => {
    try {
        const filename = req.params.filename;

        // Security: prevent directory traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({ success: false, error: 'Invalid filename' });
        }

        // Only allow .txt files
        if (!filename.endsWith('.txt')) {
            return res.status(400).json({ success: false, error: 'Only .txt files are allowed' });
        }

        const filePath = path.join(GERMAN_LESSONS_PATH, filename);
        const content = await fs.readFile(filePath, 'utf8');

        console.log(`Loaded German lesson: ${filename} (${content.length} characters)`);
        res.json({ success: true, filename, content });
    } catch (error) {
        console.error("Error loading German lesson:", error);
        if (error.code === 'ENOENT') {
            return res.status(404).json({ success: false, error: 'Lesson file not found' });
        }
        return sendError(res, 500, error);
    }
});

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
        const voiceCategory = getVoiceCategory(validation.sanitized.voice);
        const byteBasedVoices = ['Neural2', 'Studio', 'Polyglot', 'Journey'];

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

                // Count for quota
                let count;
                if (byteBasedVoices.includes(voiceCategory)) {
                    count = useSsml ? countBytes(countCharactersInSsmlText(text)) : countBytes(text);
                } else {
                    count = useSsml ? countCharactersInSsml(text) : countCharacters(text);
                }

                // Check text length
                if (count > MAX_TEXT_LENGTH) {
                    results.push({
                        success: false,
                        fileName: file.originalname,
                        error: `Text too long (${count} characters). Max: ${MAX_TEXT_LENGTH}`
                    });
                    await fs.unlink(file.path);
                    continue;
                }

                // Check quota
                const quotaCheck = await checkQuotaAllows(voiceCategory, count);
                if (!quotaCheck.allowed) {
                    const unit = byteBasedVoices.includes(voiceCategory) ? 'bytes' : 'characters';
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
                await updateQuota(voiceCategory, count);

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
