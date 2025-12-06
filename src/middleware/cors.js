/**
 * CORS Configuration
 * Configures Cross-Origin Resource Sharing based on allowed origins
 */

/**
 * Creates CORS options for the cors middleware
 * @param {Object} config - Configuration object
 * @param {boolean} config.allowAll - Allow all origins (*)
 * @param {string[]} config.allowedOrigins - List of allowed origins
 * @returns {Object} CORS options object for cors middleware
 */
function createCorsOptions(config = {}) {
  const allowAll = config.allowAll || false;
  const allowedOrigins = config.allowedOrigins || [];

  return {
    origin: function (origin, callback) {
      // Allow requests with no origin (same-origin, Postman, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Allow all origins if configured with "*"
      if (allowAll) {
        return callback(null, true);
      }

      // Check if origin is in the allowed list
      if (allowedOrigins.length === 0) {
        // No origins configured = reject all cross-origin requests
        return callback(new Error('Cross-origin requests not allowed'), false);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS policy'), false);
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-API-Key'],
    credentials: false,
    maxAge: 86400 // Cache preflight for 24 hours
  };
}

/**
 * Parse CORS configuration from environment variables
 * @param {string} corsOriginsRaw - Comma-separated list of origins or "*"
 * @returns {Object} Parsed configuration { allowAll, allowedOrigins }
 */
function parseCorsConfig(corsOriginsRaw = '') {
  const trimmed = corsOriginsRaw.trim();
  const allowAll = trimmed === '*';
  const allowedOrigins = allowAll
    ? []
    : trimmed
      ? trimmed.split(',').map(origin => origin.trim())
      : [];

  return { allowAll, allowedOrigins };
}

module.exports = {
  createCorsOptions,
  parseCorsConfig,
};
