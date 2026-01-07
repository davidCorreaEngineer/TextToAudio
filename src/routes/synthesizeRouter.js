/**
 * Synthesize Router
 * Handles text-to-speech synthesis endpoints
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { validateVoiceParams, validateSsml } = require('../validators/inputValidation');
const { calculateQuotaCount, updateQuota, checkQuotaAllows, formatQuotaExceededError } = require('../services/quotaService');
const { generateSpeech } = require('../services/ttsService');
const { sendError } = require('../middleware/errorHandler');

const MAX_TEXT_LENGTH = 5000;

// Test sentences for voice preview
const TEST_SENTENCES = {
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

/**
 * Creates the synthesize router
 * @param {Object} options
 * @param {Object} options.ttsClient - Google TTS client instance
 * @param {Function} options.authMiddleware - API key auth middleware
 * @param {Function} options.rateLimitMiddleware - Rate limiting middleware
 * @param {Object} options.upload - Multer upload instance
 * @param {string} options.quotaFilePath - Path to quota.json
 * @param {string} options.publicDir - Path to public directory for audio files
 */
function createSynthesizeRouter({
    ttsClient,
    authMiddleware,
    rateLimitMiddleware,
    upload,
    quotaFilePath,
    publicDir
}) {
    const router = express.Router();

    // POST /test-voice - Test voice without saving audio
    router.post('/test-voice', authMiddleware, rateLimitMiddleware, express.json(), async (req, res) => {
        try {
            const { language, voice, speakingRate, pitch, customText, useSsml } = req.body;
            console.log(`Received test-voice request: Language=${language}, Voice=${voice}`);

            const validation = validateVoiceParams({ language, voice, speakingRate, pitch });
            if (!validation.valid) {
                return res.status(400).json({ success: false, error: validation.errors.join('; ') });
            }

            if (customText && (useSsml === true || useSsml === 'true')) {
                const ssmlValidation = validateSsml(customText);
                if (!ssmlValidation.valid) {
                    return res.status(400).json({ success: false, error: ssmlValidation.error });
                }
            }

            let testText;
            let useCustomSsml = false;

            if (customText && customText.trim()) {
                testText = customText.trim();
                useCustomSsml = useSsml === true || useSsml === 'true';
                const maxPreviewLength = 500;
                if (testText.length > maxPreviewLength) {
                    testText = testText.substring(0, maxPreviewLength);
                }
            } else {
                testText = TEST_SENTENCES[validation.sanitized.language] || "This is a test of the selected voice.";
            }

            const audioContent = await generateSpeech(ttsClient, {
                text: testText,
                languageCode: validation.sanitized.language,
                voiceName: validation.sanitized.voice,
                speakingRate: validation.sanitized.speakingRate,
                pitch: validation.sanitized.pitch,
                useSsml: useCustomSsml
            });

            const audioBase64 = audioContent.toString('base64');
            res.json({ success: true, audioContent: audioBase64, testText });
        } catch (error) {
            console.error("Error testing voice:", error);
            return sendError(res, 500, error);
        }
    });

    // POST /check-file-size - Check uploaded file size
    router.post('/check-file-size', authMiddleware, upload.single('textFile'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'No file uploaded.' });
            }
            const stats = await fs.stat(req.file.path);
            const fileSizeInBytes = stats.size;
            await fs.unlink(req.file.path);
            res.json({ byteLength: fileSizeInBytes });
        } catch (error) {
            console.error("Error checking file size:", error);
            return sendError(res, 500, error);
        }
    });

    // POST /synthesize - Single text synthesis
    router.post('/synthesize', authMiddleware, rateLimitMiddleware, upload.none(), async (req, res) => {
        try {
            const text = req.body.textContent || '';
            const { language, voice, speakingRate, pitch } = req.body;
            const originalFileName = req.body.originalFileName || `audio_${Date.now()}`;
            const useSsml = req.body.useSsml === 'true';

            if (!text) {
                return res.status(400).json({ success: false, error: 'No text provided.' });
            }

            const validation = validateVoiceParams({ language, voice, speakingRate, pitch });
            if (!validation.valid) {
                return res.status(400).json({ success: false, error: validation.errors.join('; ') });
            }

            if (useSsml) {
                const ssmlValidation = validateSsml(text);
                if (!ssmlValidation.valid) {
                    return res.status(400).json({ success: false, error: ssmlValidation.error });
                }
            }

            const { count, voiceCategory, unit } = calculateQuotaCount(text, validation.sanitized.voice, useSsml);

            if (count > MAX_TEXT_LENGTH) {
                return res.status(400).json({
                    success: false,
                    error: `Text is too long (${count} ${unit}). Maximum allowed is ${MAX_TEXT_LENGTH}.`
                });
            }

            const quotaCheck = await checkQuotaAllows(voiceCategory, count, quotaFilePath);
            if (!quotaCheck.allowed) {
                return res.status(429).json({
                    success: false,
                    error: formatQuotaExceededError(voiceCategory, quotaCheck)
                });
            }

            const audioContent = await generateSpeech(ttsClient, {
                text,
                languageCode: validation.sanitized.language,
                voiceName: validation.sanitized.voice,
                speakingRate: validation.sanitized.speakingRate,
                pitch: validation.sanitized.pitch,
                useSsml
            });

            await updateQuota(voiceCategory, count, quotaFilePath);

            const sanitizedFileName = path.parse(originalFileName).name.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
            let outputFileName;
            if (sanitizedFileName && !sanitizedFileName.startsWith('audio_')) {
                outputFileName = `${sanitizedFileName}.mp3`;
            } else {
                outputFileName = `text_${Date.now()}.mp3`;
            }

            const outputFile = path.join(publicDir, outputFileName);
            await fs.writeFile(outputFile, audioContent, 'binary');

            res.json({ success: true, file: outputFileName, fileName: outputFileName });
        } catch (error) {
            console.error("Error generating speech:", error);
            return sendError(res, 500, error);
        }
    });

    // POST /synthesize-batch - Batch text synthesis
    router.post('/synthesize-batch', authMiddleware, rateLimitMiddleware, upload.array('textFiles', 20), async (req, res) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ success: false, error: 'No files uploaded.' });
            }

            const { language, voice, speakingRate, pitch } = req.body;
            const useSsml = req.body.useSsml === 'true';

            const validation = validateVoiceParams({ language, voice, speakingRate, pitch });
            if (!validation.valid) {
                for (const file of req.files) {
                    try { await fs.unlink(file.path); } catch (e) { /* ignore */ }
                }
                return res.status(400).json({ success: false, error: validation.errors.join('; ') });
            }

            const results = [];

            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const fileName = path.parse(file.originalname).name;

                try {
                    const text = await fs.readFile(file.path, 'utf8');

                    if (!text.trim()) {
                        results.push({ success: false, fileName: file.originalname, error: 'File is empty' });
                        await fs.unlink(file.path);
                        continue;
                    }

                    const { count, voiceCategory, unit } = calculateQuotaCount(text, validation.sanitized.voice, useSsml);

                    if (count > MAX_TEXT_LENGTH) {
                        results.push({ success: false, fileName: file.originalname, error: `Text too long (${count} ${unit}). Max: ${MAX_TEXT_LENGTH}` });
                        await fs.unlink(file.path);
                        continue;
                    }

                    const quotaCheck = await checkQuotaAllows(voiceCategory, count, quotaFilePath);
                    if (!quotaCheck.allowed) {
                        results.push({ success: false, fileName: file.originalname, error: `Quota exceeded for ${voiceCategory}. Remaining: ${quotaCheck.remaining} ${unit}` });
                        await fs.unlink(file.path);
                        continue;
                    }

                    const audioContent = await generateSpeech(ttsClient, {
                        text,
                        languageCode: validation.sanitized.language,
                        voiceName: validation.sanitized.voice,
                        speakingRate: validation.sanitized.speakingRate,
                        pitch: validation.sanitized.pitch,
                        useSsml
                    });

                    await updateQuota(voiceCategory, count, quotaFilePath);

                    const sanitizedFileName = fileName.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
                    const outputFileName = `${sanitizedFileName}.mp3`;
                    const outputFile = path.join(publicDir, outputFileName);
                    await fs.writeFile(outputFile, audioContent, 'binary');

                    results.push({ success: true, fileName: file.originalname, audioFile: outputFileName });
                    await fs.unlink(file.path);

                } catch (error) {
                    console.error(`Error processing file ${file.originalname}:`, error);
                    results.push({ success: false, fileName: file.originalname, error: error.message || 'Processing failed' });
                    try { await fs.unlink(file.path); } catch (e) { /* ignore */ }
                }
            }

            const successCount = results.filter(r => r.success).length;
            res.json({ success: true, totalFiles: req.files.length, successCount, results });

        } catch (error) {
            console.error("Error in batch synthesis:", error);
            return sendError(res, 500, error);
        }
    });

    return router;
}

module.exports = { createSynthesizeRouter };
