const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');

// Middleware
const { createApiKeyAuthMiddleware } = require('./src/middleware/auth');
const { createRateLimitMiddleware } = require('./src/middleware/rateLimit');
const { createCorsOptions, parseCorsConfig } = require('./src/middleware/cors');

// Services
const { createTtsClient } = require('./src/services/ttsService');

// Routers
const { createGermanLessonsRouter } = require('./src/routes/germanLessonsRouter');
const { createSynthesizeRouter } = require('./src/routes/synthesizeRouter');
const { createVoicesRouter } = require('./src/routes/voicesRouter');

const app = express();

// =============================================================================
// CONFIGURATION
// =============================================================================

// TTS Client
const client = createTtsClient(path.join(__dirname, 'keyfile.json'));

// Paths
const PUBLIC_DIR = path.join(__dirname, 'public');
const QUOTA_FILE_PATH = path.join(__dirname, 'quota.json');
const GERMAN_LESSONS_PATH = path.join(__dirname, '..', 'german', 'lessons');

// API Key Authentication
const API_KEY = process.env.TTS_API_KEY || null;
if (!API_KEY) {
    const generatedKey = crypto.randomBytes(32).toString('hex');
    console.warn('='.repeat(70));
    console.warn('WARNING: No API key configured!');
    console.warn('A temporary key has been generated for this session.');
    console.warn('Set TTS_API_KEY environment variable for production use.');
    console.warn('='.repeat(70));
    process.env.TTS_API_KEY = generatedKey;
}
const ACTIVE_API_KEY = process.env.TTS_API_KEY;

// CORS Configuration
const CORS_ORIGINS_RAW = process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS || '';
const { allowAll: ALLOW_ALL_ORIGINS, allowedOrigins: ALLOWED_ORIGINS } = parseCorsConfig(CORS_ORIGINS_RAW);

// Rate limiting
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;     // 10 requests per minute per IP

// File cleanup
const AUDIO_FILE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

// =============================================================================
// MIDDLEWARE INSTANCES
// =============================================================================

const apiKeyAuthMiddleware = createApiKeyAuthMiddleware(ACTIVE_API_KEY);

const rateLimitMiddleware = createRateLimitMiddleware({
    windowMs: RATE_LIMIT_WINDOW_MS,
    maxRequests: RATE_LIMIT_MAX_REQUESTS
});

const corsOptions = createCorsOptions({
    allowAll: ALLOW_ALL_ORIGINS,
    allowedOrigins: ALLOWED_ORIGINS
});

// File upload configuration
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB per file
        files: 20                    // Max 20 files per request
    },
    fileFilter: (req, file, cb) => {
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

// =============================================================================
// FILE CLEANUP
// =============================================================================

async function cleanupOldAudioFiles() {
    try {
        const files = await fs.readdir(PUBLIC_DIR);
        const now = Date.now();

        for (const file of files) {
            if (!file.endsWith('_audio.mp3')) continue;

            const filePath = path.join(PUBLIC_DIR, file);
            try {
                const stats = await fs.stat(filePath);
                if (now - stats.mtimeMs > AUDIO_FILE_MAX_AGE_MS) {
                    await fs.unlink(filePath);
                    console.log(`Cleaned up old audio file: ${file}`);
                }
            } catch (err) {
                // File may have been deleted already
            }
        }
    } catch (error) {
        console.error('Error during audio file cleanup:', error);
    }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldAudioFiles, 10 * 60 * 1000).unref();
cleanupOldAudioFiles();

// =============================================================================
// MIDDLEWARE SETUP
// =============================================================================

app.use(cors(corsOptions));
app.use(express.static('public'));
app.use(express.json({ limit: '100kb' }));

// =============================================================================
// ROUTES
// =============================================================================

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Mount voices router (GET /voices, GET /dashboard)
const voicesRouter = createVoicesRouter({
    ttsClient: client,
    authMiddleware: apiKeyAuthMiddleware,
    quotaFilePath: QUOTA_FILE_PATH
});
app.use('/', voicesRouter);

// Mount synthesize router (POST /test-voice, /check-file-size, /synthesize, /synthesize-batch)
const synthesizeRouter = createSynthesizeRouter({
    ttsClient: client,
    authMiddleware: apiKeyAuthMiddleware,
    rateLimitMiddleware,
    upload,
    quotaFilePath: QUOTA_FILE_PATH,
    publicDir: PUBLIC_DIR
});
app.use('/', synthesizeRouter);

// Mount German lessons router
const germanLessonsRouter = createGermanLessonsRouter({
    lessonsPath: GERMAN_LESSONS_PATH,
    authMiddleware: apiKeyAuthMiddleware,
});
app.use('/german-lessons', germanLessonsRouter);

// =============================================================================
// SERVER
// =============================================================================

module.exports = app;

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
