/**
 * API Key Authentication Middleware
 * Validates API key from request headers or query parameters
 */

const crypto = require('crypto');

/**
 * Creates an authentication middleware that validates API keys
 * @param {string} apiKey - The valid API key to check against
 * @returns {Function} Express middleware function
 */
function createApiKeyAuthMiddleware(apiKey) {
  return function apiKeyAuthMiddleware(req, res, next) {
    // Check for API key in header (preferred) or query parameter (fallback)
    const providedKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!providedKey) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Provide API key via X-API-Key header.'
      });
    }

    // Constant-time comparison to prevent timing attacks
    try {
      const providedBuffer = Buffer.from(providedKey);
      const expectedBuffer = Buffer.from(apiKey);

      if (!crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
        return res.status(403).json({
          success: false,
          error: 'Invalid API key.'
        });
      }
    } catch (error) {
      // Buffer creation or comparison failed (likely different lengths)
      return res.status(403).json({
        success: false,
        error: 'Invalid API key.'
      });
    }

    next();
  };
}

module.exports = { createApiKeyAuthMiddleware };
