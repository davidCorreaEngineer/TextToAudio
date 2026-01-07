/**
 * Voices Router
 * Handles voice listing and dashboard endpoints
 */

const express = require('express');
const { SUPPORTED_LANGUAGES } = require('../validators/inputValidation');
const { listVoices } = require('../services/ttsService');
const { getQuotaData } = require('../services/quotaService');
const { sendError } = require('../middleware/errorHandler');

/**
 * Creates the voices router
 * @param {Object} options
 * @param {Object} options.ttsClient - Google TTS client instance
 * @param {Function} options.authMiddleware - API key auth middleware
 * @param {string} options.quotaFilePath - Path to quota.json
 */
function createVoicesRouter({
    ttsClient,
    authMiddleware,
    quotaFilePath
}) {
    const router = express.Router();

    // GET /voices - List available voices
    router.get('/voices', authMiddleware, async (req, res) => {
        try {
            console.log('Fetching voices from Google TTS API...');
            const voices = await listVoices(ttsClient, SUPPORTED_LANGUAGES);
            console.log(`Filtered voices: ${voices.length}`);
            res.json(voices);
        } catch (error) {
            console.error("Error fetching voices:", error);
            return sendError(res, 500, error);
        }
    });

    // GET /dashboard - Get quota usage data
    router.get('/dashboard', authMiddleware, async (req, res) => {
        try {
            const quota = await getQuotaData(quotaFilePath);
            console.log("Quota data loaded for dashboard:", quota);
            res.json({ quota });
        } catch (error) {
            console.error("Error fetching quota for dashboard:", error);
            return sendError(res, 500, error);
        }
    });

    return router;
}

module.exports = { createVoicesRouter };
