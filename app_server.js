const express = require('express');
const multer = require('multer');
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const upload = multer({ dest: 'uploads/' });

const client = new textToSpeech.TextToSpeechClient({
    keyFilename: path.join(__dirname, 'keyfile.json')
});

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
const ALLOW_ALL_ORIGINS = CORS_ORIGINS_RAW.trim() === '*';
const ALLOWED_ORIGINS = ALLOW_ALL_ORIGINS
    ? []
    : CORS_ORIGINS_RAW
        ? CORS_ORIGINS_RAW.split(',').map(origin => origin.trim())
        : [];  // Empty array = same-origin only (no cross-origin requests allowed)

// Rate limiting: max requests per IP per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;     // 10 requests per minute per IP

// Quota limits (monthly) - same as client-side FREE_TIER_LIMITS
const QUOTA_LIMITS = {
    'Neural2': 1000000,      // 1 million bytes
    'Studio': 100000,        // 100,000 bytes
    'Polyglot': 100000,      // 100,000 bytes
    'Standard': 4000000,     // 4 million characters
    'WaveNet': 1000000,      // 1 million characters
    'Journey': 1000000       // 1 million bytes
};

// File cleanup: delete audio files older than this
const AUDIO_FILE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// =============================================================================
// SECURITY: API KEY AUTHENTICATION
// =============================================================================

function apiKeyAuthMiddleware(req, res, next) {
    // Check for API key in header (preferred) or query parameter (fallback)
    const providedKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!providedKey) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required. Provide API key via X-API-Key header.'
        });
    }

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(ACTIVE_API_KEY))) {
        return res.status(403).json({
            success: false,
            error: 'Invalid API key.'
        });
    }

    next();
}

// =============================================================================
// SECURITY: ERROR SANITIZATION
// =============================================================================

// Known safe error patterns that can be shown to users
const SAFE_ERROR_PATTERNS = [
    /No text provided/i,
    /Text is too long/i,
    /No file uploaded/i,
    /Rate limit exceeded/i,
    /Monthly quota exceeded/i,
    /Invalid API key/i,
    /Authentication required/i,
];

function sanitizeError(error) {
    const message = error instanceof Error ? error.message : String(error);

    // Check if this is a known safe error message
    for (const pattern of SAFE_ERROR_PATTERNS) {
        if (pattern.test(message)) {
            return message;
        }
    }

    // For Google API errors, extract only the safe part
    if (message.includes('INVALID_ARGUMENT')) {
        return 'Invalid request parameters. Please check your input.';
    }
    if (message.includes('PERMISSION_DENIED')) {
        return 'Service configuration error. Please contact the administrator.';
    }
    if (message.includes('RESOURCE_EXHAUSTED')) {
        return 'Service quota exceeded. Please try again later.';
    }

    // Log the actual error for debugging (server-side only)
    console.error('Sanitized error (original):', message);

    // Return generic error to client
    return 'An unexpected error occurred. Please try again.';
}

// Helper to send sanitized error responses
function sendError(res, statusCode, error) {
    return res.status(statusCode).json({
        success: false,
        error: sanitizeError(error)
    });
}

// =============================================================================
// RATE LIMITING
// =============================================================================

const rateLimitStore = new Map(); // IP -> { count, resetTime }

function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    let record = rateLimitStore.get(ip);

    // Clean up or create new record if expired
    if (!record || now > record.resetTime) {
        record = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
        rateLimitStore.set(ip, record);
    }

    record.count++;

    if (record.count > RATE_LIMIT_MAX_REQUESTS) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        res.set('Retry-After', retryAfter);
        return res.status(429).json({
            success: false,
            error: `Rate limit exceeded. Try again in ${retryAfter} seconds.`
        });
    }

    next();
}

// Periodically clean up old entries from rate limit store (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitStore.entries()) {
        if (now > record.resetTime) {
            rateLimitStore.delete(ip);
        }
    }
}, 5 * 60 * 1000);

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
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (same-origin, Postman, curl, etc.)
        if (!origin) {
            return callback(null, true);
        }

        // Allow all origins if configured with "*"
        if (ALLOW_ALL_ORIGINS) {
            return callback(null, true);
        }

        // Check if origin is in the allowed list
        if (ALLOWED_ORIGINS.length === 0) {
            // No origins configured = reject all cross-origin requests
            return callback(new Error('Cross-origin requests not allowed'), false);
        }

        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Origin not allowed by CORS policy'), false);
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-API-Key'],
    credentials: false,
    maxAge: 86400 // Cache preflight for 24 hours
};

app.use(cors(corsOptions));
app.use(express.static('public'));
app.use(express.json());

// **1. Voice Type Mapping Function**
function getVoiceCategory(voiceName) {
    // Define mapping based on known voice name patterns or specific names
    // This mapping may need to be updated as new voices are introduced
    if (/Standard/i.test(voiceName)) {
        return 'Standard';
    } else if (/WaveNet/i.test(voiceName)) {
        return 'WaveNet';
    } else if (/Neural2/i.test(voiceName)) {
        return 'Neural2';
    } else if (/Polyglot/i.test(voiceName)) {
        return 'Polyglot';
    } else if (/Journey/i.test(voiceName)) {
        return 'Journey';
    } else if (/Studio/i.test(voiceName)) {
        return 'Studio';
    } else {
        // Default category for any new or unknown voice types
        return 'Standard';
    }
}

// **2. Count Characters Function**
function countCharacters(text) {
    // Remove SSML mark tags
    const textWithoutMarks = text.replace(/<mark name=['"].*?['"]\/>/g, '');
    // Count remaining characters (including other SSML tags, spaces, and line breaks)
    return textWithoutMarks.length;
}

// **3. Count Bytes Function**
function countBytes(text) {
    return Buffer.byteLength(text, 'utf8');
}

// **4. Mutex for Quota Updates (prevents race conditions)**
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
        const [result] = await client.listVoices({});
        console.log(`Total voices received: ${result.voices.length}`);

        // Supported Languages: English, Dutch, Spanish, German, Japanese, Australian English, French, Italian, Portuguese and Portuguese
		const supportedLanguages = ['en-GB', 'en-US', 'en-AU', 'nl-NL', 'es-ES', 'es-US', 'de-DE', 'ja-JP', 'it-IT', 'fr-FR', 'pt-PT', 'pt-BR', 'tr-TR'];

        const voices = result.voices.filter(voice =>
            voice.languageCodes.some(code => supportedLanguages.includes(code))
        );

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

        // Build input based on whether SSML is used
        let input;
        if (useCustomSsml) {
            input = { ssml: testText };
        } else {
            input = { text: testText };
        }

        const request = {
            input: input,
            voice: { languageCode: language, name: voice },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: parseFloat(speakingRate) || 1.0,
                pitch: parseFloat(pitch) || 0.0
            },
        };

        const [response] = await client.synthesizeSpeech(request);
        console.log("Audio synthesized successfully for test voice.");

        // Convert audio content to Base64
        const audioBase64 = response.audioContent.toString('base64');
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

        // **Set Input Type Based on useSsml**
        let input;
        if (useSsml) {
            input = { ssml: text };
        } else {
            input = { text: text };
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

        const request = {
            input: input,
            voice: { languageCode: language, name: voice },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: speakingRate,
                pitch: pitch
            },
        };

        const [response] = await client.synthesizeSpeech(request);
        console.log("Audio synthesized successfully.");

        // Update quota (voiceCategory already determined above)
        await updateQuota(voiceCategory, count);
        console.log("Quota updated.");

        // Generate unique output filename based on the original file name
        const sanitizedFileName = path.parse(originalFileName).name.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
        const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const outputFileName = `${sanitizedFileName}_${uniqueId}_audio.mp3`;
        const outputFile = path.join(__dirname, 'public', outputFileName);

        await fs.writeFile(outputFile, response.audioContent, 'binary');
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
function countCharactersInSsml(ssmlText) {
    // Remove SSML tags
    const strippedText = ssmlText.replace(/<[^>]+>/g, '');
    return strippedText.length;
}

// **Function to Extract Text from SSML (for byte counting)**
function countCharactersInSsmlText(ssmlText) {
    // Remove SSML tags and return the plain text
    return ssmlText.replace(/<[^>]+>/g, '');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
