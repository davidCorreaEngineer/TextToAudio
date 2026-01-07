/**
 * Rate Limiting Middleware
 * Prevents abuse by limiting requests per IP address
 */

/**
 * Creates a rate limiting middleware
 * @param {Object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.maxRequests - Maximum requests per window
 * @returns {Function} Express middleware function
 */
function createRateLimitMiddleware(options = {}) {
  const windowMs = options.windowMs || 60 * 1000; // Default: 1 minute
  const maxRequests = options.maxRequests || 10;   // Default: 10 requests
  const store = new Map(); // IP -> { count, resetTime }

  // Cleanup function to remove expired entries
  const cleanup = () => {
    const now = Date.now();
    for (const [ip, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(ip);
      }
    }
  };

  // Run cleanup every 5 minutes (unref allows Node to exit)
  const cleanupInterval = setInterval(cleanup, 5 * 60 * 1000);
  cleanupInterval.unref();

  // Middleware function
  function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    let record = store.get(ip);

    // Clean up or create new record if expired
    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      store.set(ip, record);
    }

    record.count++;

    if (record.count > maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.set('Retry-After', retryAfter);
      return res.status(429).json({
        success: false,
        error: `Rate limit exceeded. Try again in ${retryAfter} seconds.`
      });
    }

    next();
  }

  // Attach cleanup function for testing/shutdown
  rateLimitMiddleware.cleanup = cleanup;
  rateLimitMiddleware.clearInterval = () => clearInterval(cleanupInterval);
  rateLimitMiddleware.getStore = () => store; // For testing

  return rateLimitMiddleware;
}

module.exports = { createRateLimitMiddleware };
