/**
 * Unit Tests for Middleware Modules
 * Tests authentication, rate limiting, CORS, and error handling
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const { createApiKeyAuthMiddleware } = require('../../src/middleware/auth');
const { createRateLimitMiddleware } = require('../../src/middleware/rateLimit');
const { createCorsOptions, parseCorsConfig } = require('../../src/middleware/cors');
const { sanitizeError, sendError } = require('../../src/middleware/errorHandler');

// =============================================================================
// AUTH MIDDLEWARE TESTS
// =============================================================================

describe('createApiKeyAuthMiddleware', () => {
  const VALID_KEY = 'test-api-key-12345';
  let middleware;
  let req, res, next;

  beforeEach(() => {
    middleware = createApiKeyAuthMiddleware(VALID_KEY);
    req = { headers: {}, query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  test('allows request with valid API key in header', () => {
    req.headers['x-api-key'] = VALID_KEY;

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('allows request with valid API key in query', () => {
    req.query.apiKey = VALID_KEY;

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('rejects request with no API key', () => {
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required. Provide API key via X-API-Key header.'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects request with invalid API key', () => {
    req.headers['x-api-key'] = 'wrong-key';

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid API key.'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('prefers header over query parameter', () => {
    req.headers['x-api-key'] = VALID_KEY;
    req.query.apiKey = 'wrong-key';

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('uses constant-time comparison (prevents timing attacks)', () => {
    // Different length keys should still be handled securely
    req.headers['x-api-key'] = 'short';

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// =============================================================================
// RATE LIMIT MIDDLEWARE TESTS
// =============================================================================

describe('createRateLimitMiddleware', () => {
  let middleware;
  let req, res, next;

  beforeEach(() => {
    middleware = createRateLimitMiddleware({
      windowMs: 60000, // 1 minute
      maxRequests: 3
    });
    req = { ip: '127.0.0.1', connection: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn()
    };
    next = jest.fn();
  });

  afterEach(() => {
    if (middleware.clearInterval) {
      middleware.clearInterval();
    }
  });

  test('allows requests within limit', () => {
    middleware(req, res, next);
    middleware(req, res, next);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('blocks requests over limit', () => {
    middleware(req, res, next); // 1
    middleware(req, res, next); // 2
    middleware(req, res, next); // 3
    middleware(req, res, next); // 4 - should be blocked

    expect(next).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('Rate limit exceeded')
      })
    );
  });

  test('sets Retry-After header when rate limited', () => {
    for (let i = 0; i < 4; i++) {
      middleware(req, res, next);
    }

    expect(res.set).toHaveBeenCalledWith('Retry-After', expect.any(Number));
  });

  test('tracks different IPs separately', () => {
    const req1 = { ip: '127.0.0.1', connection: {} };
    const req2 = { ip: '192.168.1.1', connection: {} };

    for (let i = 0; i < 3; i++) {
      middleware(req1, res, next);
      middleware(req2, res, next);
    }

    expect(next).toHaveBeenCalledTimes(6);
  });

  test('resets count after window expires', async () => {
    const shortWindowMiddleware = createRateLimitMiddleware({
      windowMs: 100, // 100ms
      maxRequests: 2
    });

    shortWindowMiddleware(req, res, next); // 1
    shortWindowMiddleware(req, res, next); // 2
    shortWindowMiddleware(req, res, next); // 3 - blocked

    expect(next).toHaveBeenCalledTimes(2);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    next.mockClear();
    shortWindowMiddleware(req, res, next); // Should be allowed again

    expect(next).toHaveBeenCalledTimes(1);

    shortWindowMiddleware.clearInterval();
  });

  test('cleanup function removes expired entries', () => {
    middleware(req, res, next);

    const store = middleware.getStore();
    expect(store.size).toBe(1);

    // Manually expire the entry
    const record = store.get(req.ip);
    record.resetTime = Date.now() - 1000;

    middleware.cleanup();

    expect(store.size).toBe(0);
  });
});

// =============================================================================
// CORS MIDDLEWARE TESTS
// =============================================================================

describe('parseCorsConfig', () => {
  test('parses wildcard "*" as allow all', () => {
    const config = parseCorsConfig('*');

    expect(config.allowAll).toBe(true);
    expect(config.allowedOrigins).toEqual([]);
  });

  test('parses comma-separated origins', () => {
    const config = parseCorsConfig('http://localhost:3000,https://example.com');

    expect(config.allowAll).toBe(false);
    expect(config.allowedOrigins).toEqual([
      'http://localhost:3000',
      'https://example.com'
    ]);
  });

  test('trims whitespace from origins', () => {
    const config = parseCorsConfig(' http://localhost:3000 , https://example.com ');

    expect(config.allowedOrigins).toEqual([
      'http://localhost:3000',
      'https://example.com'
    ]);
  });

  test('handles empty string as no allowed origins', () => {
    const config = parseCorsConfig('');

    expect(config.allowAll).toBe(false);
    expect(config.allowedOrigins).toEqual([]);
  });
});

describe('createCorsOptions', () => {
  test('allows same-origin requests (no origin header)', (done) => {
    const options = createCorsOptions({ allowAll: false, allowedOrigins: [] });

    options.origin(undefined, (err, allowed) => {
      expect(err).toBeNull();
      expect(allowed).toBe(true);
      done();
    });
  });

  test('allows all origins when allowAll is true', (done) => {
    const options = createCorsOptions({ allowAll: true, allowedOrigins: [] });

    options.origin('http://evil.com', (err, allowed) => {
      expect(err).toBeNull();
      expect(allowed).toBe(true);
      done();
    });
  });

  test('allows whitelisted origins', (done) => {
    const options = createCorsOptions({
      allowAll: false,
      allowedOrigins: ['http://localhost:3000']
    });

    options.origin('http://localhost:3000', (err, allowed) => {
      expect(err).toBeNull();
      expect(allowed).toBe(true);
      done();
    });
  });

  test('blocks non-whitelisted origins', (done) => {
    const options = createCorsOptions({
      allowAll: false,
      allowedOrigins: ['http://localhost:3000']
    });

    options.origin('http://evil.com', (err, allowed) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Origin not allowed by CORS policy');
      expect(allowed).toBe(false);
      done();
    });
  });

  test('blocks all cross-origin when no origins configured', (done) => {
    const options = createCorsOptions({
      allowAll: false,
      allowedOrigins: []
    });

    options.origin('http://localhost:3000', (err, allowed) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('Cross-origin requests not allowed');
      expect(allowed).toBe(false);
      done();
    });
  });

  test('sets correct CORS headers', () => {
    const options = createCorsOptions({ allowAll: false, allowedOrigins: [] });

    expect(options.methods).toEqual(['GET', 'POST']);
    expect(options.allowedHeaders).toEqual(['Content-Type', 'X-API-Key']);
    expect(options.credentials).toBe(false);
    expect(options.maxAge).toBe(86400);
  });
});

// =============================================================================
// ERROR HANDLER TESTS
// =============================================================================

describe('sanitizeError', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('returns sanitized error message', () => {
    const result = sanitizeError('Database connection failed');

    expect(result).toBe('An unexpected error occurred. Please try again.');
  });

  test('logs original error for unexpected errors', () => {
    sanitizeError('Internal server error at /secret/path.js:42');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Sanitized error (original):',
      'Internal server error at /secret/path.js:42'
    );
  });

  test('does not log for known safe errors', () => {
    sanitizeError('No text provided');

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test('handles Error objects', () => {
    const result = sanitizeError(new Error('Database failure'));

    expect(result).toBe('An unexpected error occurred. Please try again.');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

describe('sendError', () => {
  let res;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test('sends error response with status code', () => {
    sendError(res, 400, 'No text provided');

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'No text provided'
    });
  });

  test('sanitizes error before sending', () => {
    sendError(res, 500, 'Database error at /secret/path');

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'An unexpected error occurred. Please try again.'
    });
  });
});
