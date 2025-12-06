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
const upload = multer({ dest: 'uploads/' });

const client = createTtsClient(path.join(__dirname, 'keyfile.json'));

const MAX_TEXT_LENGTH = 5000; // Maximum allowed bytes

// =============================================================================
// CONFIGURATION
// =============================================================================

// API Key Authentication
// Set via environment variable or generate a secure default for first run
// IMPORTANT: In production, always set TTS_API_KEY environment variable
const API_KEY = process.env.TTS_API_KEY || null;

// If no API key is configured, generate one and log it (first run only)
if (!API_KEY) {
    const generatedKey = crypto.randomBytes(32).toString('hex');
    console.warn('='.repeat(70));
    console.warn('WARNING: No API key configured!');
    console.warn('Set the TTS_API_KEY environment variable for production use.');
    console.warn(`Generated temporary key for this session: ${generatedKey}`);
    console.warn('='.repeat(70));
    // Store for this session
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
app.use(express.json());

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

        // Supported Languages: English, Dutch, Spanish, German, Japanese, Australian English, French, Italian, Portuguese and Portuguese
		const supportedLanguages = ['en-GB', 'en-US', 'en-AU', 'nl-NL', 'es-ES', 'es-US', 'de-DE', 'ja-JP', 'it-IT', 'fr-FR', 'pt-PT', 'pt-BR', 'tr-TR'];

        const voices = await listVoices(client, supportedLanguages);

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
            testText = testSentences[language] || "This is a test of the selected voice.";
        }
        console.log(`Test sentence: "${testText.substring(0, 100)}${testText.length > 100 ? '...' : ''}"`);

        const audioContent = await generateSpeech(client, {
            text: testText,
            languageCode: language,
            voiceName: voice,
            speakingRate,
            pitch,
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
        const speakingRate = parseFloat(req.body.speakingRate) || 1.0;
        const pitch = parseFloat(req.body.pitch) || 0.0;
        const originalFileName = req.body.originalFileName || `audio_${Date.now()}`;
        const useSsml = req.body.useSsml === 'true';

        console.log(`Received synthesize request: Language=${language}, Voice=${voice}, SpeakingRate=${speakingRate}, Pitch=${pitch}, OriginalFileName=${originalFileName}, UseSsml=${useSsml}`);

        if (!text) {
            console.log("No text provided for synthesis.");
            return res.status(400).json({ success: false, error: 'No text provided.' });
        }

        // **Determine voice category first for correct quota counting**
        const voiceCategory = getVoiceCategory(voice);

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
            languageCode: language,
            voiceName: voice,
            speakingRate,
            pitch,
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
