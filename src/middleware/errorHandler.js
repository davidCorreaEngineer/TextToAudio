/**
 * Error Handler Middleware
 * Sanitizes and formats error responses
 */

const { sanitizeError: sanitizeErrorUtil } = require('../utils');

/**
 * Sanitizes error and adds server-side logging
 * @param {Error|string} error - The error to sanitize
 * @returns {string} Sanitized error message safe for client display
 */
function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const sanitized = sanitizeErrorUtil(error);

  // Log the actual error for debugging (server-side only)
  if (sanitized === 'An unexpected error occurred. Please try again.') {
    console.error('Sanitized error (original):', message);
  }

  return sanitized;
}

/**
 * Helper to send sanitized error responses
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {Error|string} error - Error to send
 * @returns {Object} Express response
 */
function sendError(res, statusCode, error) {
  return res.status(statusCode).json({
    success: false,
    error: sanitizeError(error)
  });
}

module.exports = {
  sanitizeError,
  sendError,
};
