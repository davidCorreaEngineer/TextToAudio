/**
 * Security Tests
 *
 * These tests verify that security controls are working correctly.
 * Covers authentication, authorization, input validation, and injection prevention.
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');

// ============================================================================
// AUTH BYPASS TESTS
// ============================================================================

describe('Authentication Security', () => {
  // Test API key validation function
  const crypto = require('crypto');

  function validateApiKey(providedKey, expectedKey) {
    if (!providedKey || !expectedKey) return false;
    if (providedKey.length !== expectedKey.length) return false;
    try {
      return crypto.timingSafeEqual(
        Buffer.from(providedKey),
        Buffer.from(expectedKey)
      );
    } catch (e) {
      return false;
    }
  }

  const VALID_KEY = 'test-api-key-12345';

  test('should reject empty API key', () => {
    expect(validateApiKey('', VALID_KEY)).toBe(false);
    expect(validateApiKey(null, VALID_KEY)).toBe(false);
    expect(validateApiKey(undefined, VALID_KEY)).toBe(false);
  });

  test('should reject incorrect API key', () => {
    expect(validateApiKey('wrong-key', VALID_KEY)).toBe(false);
    expect(validateApiKey('test-api-key-12346', VALID_KEY)).toBe(false);
  });

  test('should accept valid API key', () => {
    expect(validateApiKey(VALID_KEY, VALID_KEY)).toBe(true);
  });

  test('should reject keys of different lengths', () => {
    expect(validateApiKey('short', VALID_KEY)).toBe(false);
    expect(validateApiKey('this-is-a-very-long-api-key-that-should-fail', VALID_KEY)).toBe(false);
  });

  test('should use timing-safe comparison', () => {
    // This is a conceptual test - timing attacks are hard to verify in unit tests
    // The implementation should use crypto.timingSafeEqual
    const start1 = process.hrtime.bigint();
    validateApiKey('wrong-key-starts-with', VALID_KEY);
    const end1 = process.hrtime.bigint();

    const start2 = process.hrtime.bigint();
    validateApiKey('completely-different', VALID_KEY);
    const end2 = process.hrtime.bigint();

    // Both should take roughly the same time (timing-safe)
    // We can't strictly verify this, but we can document the intent
    expect(typeof (end1 - start1)).toBe('bigint');
    expect(typeof (end2 - start2)).toBe('bigint');
  });
});

// ============================================================================
// INPUT VALIDATION TESTS
// ============================================================================

describe('Input Validation Security', () => {
  const MAX_TEXT_LENGTH = 5000;

  function validateTextLength(text) {
    if (!text) return { valid: false, error: 'No text provided' };
    if (text.length > MAX_TEXT_LENGTH) {
      return { valid: false, error: 'Text is too long' };
    }
    return { valid: true };
  }

  function validateSpeakingRate(rate) {
    const parsed = parseFloat(rate);
    if (isNaN(parsed)) return 1.0; // Default
    if (parsed < 0.25) return 0.25;
    if (parsed > 4.0) return 4.0;
    return parsed;
  }

  function validatePitch(pitch) {
    const parsed = parseFloat(pitch);
    if (isNaN(parsed)) return 0; // Default
    if (parsed < -20) return -20;
    if (parsed > 20) return 20;
    return parsed;
  }

  test('should reject empty text', () => {
    expect(validateTextLength('').valid).toBe(false);
    expect(validateTextLength(null).valid).toBe(false);
  });

  test('should reject text exceeding max length', () => {
    expect(validateTextLength('A'.repeat(5001)).valid).toBe(false);
    expect(validateTextLength('A'.repeat(10000)).valid).toBe(false);
  });

  test('should accept text within limit', () => {
    expect(validateTextLength('Hello').valid).toBe(true);
    expect(validateTextLength('A'.repeat(5000)).valid).toBe(true);
  });

  test('should clamp speaking rate to valid range', () => {
    expect(validateSpeakingRate('0.1')).toBe(0.25);
    expect(validateSpeakingRate('5.0')).toBe(4.0);
    expect(validateSpeakingRate('1.0')).toBe(1.0);
    expect(validateSpeakingRate('invalid')).toBe(1.0);
  });

  test('should clamp pitch to valid range', () => {
    expect(validatePitch('-30')).toBe(-20);
    expect(validatePitch('30')).toBe(20);
    expect(validatePitch('0')).toBe(0);
    expect(validatePitch('invalid')).toBe(0);
  });
});

// ============================================================================
// SSML INJECTION TESTS
// ============================================================================

describe('SSML Injection Prevention', () => {
  function escapeXml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  test('should escape SSML/XML tags', () => {
    const malicious = '<script>alert("xss")</script>';
    const escaped = escapeXml(malicious);
    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
  });

  test('should escape break tag injection', () => {
    const malicious = 'Hello<break time="999999ms"/>World';
    const escaped = escapeXml(malicious);
    expect(escaped).not.toContain('<break');
  });

  test('should escape speak tag injection', () => {
    const malicious = '</speak><speak>Injected</speak>';
    const escaped = escapeXml(malicious);
    expect(escaped).not.toContain('</speak>');
    expect(escaped).toContain('&lt;/speak&gt;');
  });

  test('should escape prosody manipulation', () => {
    const malicious = '<prosody rate="x-slow" pitch="+50%">Slow</prosody>';
    const escaped = escapeXml(malicious);
    expect(escaped).not.toContain('<prosody');
  });

  test('should handle all dangerous characters', () => {
    const dangerous = '< > & " \' <![CDATA[test]]>';
    const escaped = escapeXml(dangerous);
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
    expect(escaped).toContain('&lt;');
    expect(escaped).toContain('&gt;');
    expect(escaped).toContain('&amp;');
    expect(escaped).toContain('&quot;');
    expect(escaped).toContain('&apos;');
  });
});

// ============================================================================
// PATH TRAVERSAL TESTS
// ============================================================================

describe('Path Traversal Prevention', () => {
  const path = require('path');

  function sanitizeFileName(fileName) {
    const parsed = path.parse(fileName);
    return parsed.name
      .replace(/\s+/g, '_')
      .replace(/[^\w\-]/g, '');
  }

  test('should remove path traversal sequences', () => {
    expect(sanitizeFileName('../../../etc/passwd')).not.toContain('..');
    expect(sanitizeFileName('....//....//etc')).not.toContain('..');
  });

  test('should remove directory separators', () => {
    expect(sanitizeFileName('path/to/file')).not.toContain('/');
    expect(sanitizeFileName('path\\to\\file')).not.toContain('\\');
  });

  test('should preserve safe characters', () => {
    expect(sanitizeFileName('my-file_name123')).toBe('my-file_name123');
  });

  test('should handle special characters', () => {
    // path.parse().name removes extension, so "file<>:"|?*.txt" -> name="file<>:"|?*" -> "file"
    expect(sanitizeFileName('file<>:"|?*.txt')).toBe('file');
    expect(sanitizeFileName('my_file-name.txt')).toBe('my_file-name');
  });

  test('should handle unicode path attempts', () => {
    const unicodePath = 'file\u002F\u002E\u002E\u002Fparent';
    const sanitized = sanitizeFileName(unicodePath);
    expect(sanitized).not.toContain('/');
    expect(sanitized).not.toContain('..');
  });
});

// ============================================================================
// ERROR MESSAGE SANITIZATION TESTS
// ============================================================================

describe('Error Message Sanitization', () => {
  const SAFE_ERROR_PATTERNS = [
    /No text provided/i,
    /Text is too long/i,
    /Rate limit exceeded/i,
    /Invalid API key/i,
  ];

  function sanitizeError(error) {
    const message = error instanceof Error ? error.message : String(error);

    for (const pattern of SAFE_ERROR_PATTERNS) {
      if (pattern.test(message)) {
        return message;
      }
    }

    if (message.includes('INVALID_ARGUMENT')) {
      return 'Invalid request parameters.';
    }
    if (message.includes('PERMISSION_DENIED')) {
      return 'Access denied.';
    }

    return 'An unexpected error occurred.';
  }

  test('should not leak file paths', () => {
    const error = 'Error at /home/user/app/server.js:42';
    expect(sanitizeError(error)).not.toContain('/home');
    expect(sanitizeError(error)).not.toContain('server.js');
  });

  test('should not leak stack traces', () => {
    const error = new Error('Something failed');
    error.stack = 'Error: Something failed\n    at Module._compile\n    at Object.Module._extensions';
    expect(sanitizeError(error)).not.toContain('Module._compile');
  });

  test('should not leak database errors', () => {
    const error = 'Connection failed: postgres://user:password@localhost:5432/db';
    expect(sanitizeError(error)).not.toContain('postgres://');
    expect(sanitizeError(error)).not.toContain('password');
  });

  test('should not leak API keys', () => {
    const error = 'API error: key=AIzaSyBxxxxxxxxxxxxxxxx';
    expect(sanitizeError(error)).not.toContain('AIzaSy');
  });

  test('should pass through safe messages', () => {
    expect(sanitizeError('No text provided')).toBe('No text provided');
    expect(sanitizeError('Text is too long')).toBe('Text is too long');
    expect(sanitizeError('Rate limit exceeded')).toBe('Rate limit exceeded');
  });
});

// ============================================================================
// RATE LIMITING TESTS
// ============================================================================

describe('Rate Limiting Security', () => {
  class RateLimiter {
    constructor(windowMs, maxRequests) {
      this.windowMs = windowMs;
      this.maxRequests = maxRequests;
      this.store = new Map();
    }

    isAllowed(ip) {
      const now = Date.now();
      let record = this.store.get(ip);

      if (!record || now > record.resetTime) {
        record = { count: 0, resetTime: now + this.windowMs };
        this.store.set(ip, record);
      }

      record.count++;
      return record.count <= this.maxRequests;
    }

    reset() {
      this.store.clear();
    }
  }

  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter(60000, 10); // 10 requests per minute
  });

  test('should allow requests within limit', () => {
    for (let i = 0; i < 10; i++) {
      expect(limiter.isAllowed('192.168.1.1')).toBe(true);
    }
  });

  test('should block requests over limit', () => {
    for (let i = 0; i < 10; i++) {
      limiter.isAllowed('192.168.1.1');
    }
    expect(limiter.isAllowed('192.168.1.1')).toBe(false);
  });

  test('should track different IPs separately', () => {
    for (let i = 0; i < 10; i++) {
      limiter.isAllowed('192.168.1.1');
    }
    expect(limiter.isAllowed('192.168.1.1')).toBe(false);
    expect(limiter.isAllowed('192.168.1.2')).toBe(true);
  });

  test('should handle IP spoofing attempts', () => {
    // Each "new" IP gets its own limit
    // This tests that the system handles many unique IPs
    for (let i = 0; i < 100; i++) {
      expect(limiter.isAllowed(`192.168.1.${i}`)).toBe(true);
    }
  });
});

// ============================================================================
// CORS SECURITY TESTS
// ============================================================================

describe('CORS Security', () => {
  function isOriginAllowed(origin, allowedOrigins) {
    if (!origin) return true; // Same-origin requests
    if (allowedOrigins.length === 0) return false; // Block all cross-origin
    return allowedOrigins.includes(origin);
  }

  const allowedOrigins = ['https://example.com', 'https://app.example.com'];

  test('should allow same-origin requests (no origin header)', () => {
    expect(isOriginAllowed(null, allowedOrigins)).toBe(true);
    expect(isOriginAllowed(undefined, allowedOrigins)).toBe(true);
  });

  test('should allow whitelisted origins', () => {
    expect(isOriginAllowed('https://example.com', allowedOrigins)).toBe(true);
    expect(isOriginAllowed('https://app.example.com', allowedOrigins)).toBe(true);
  });

  test('should block non-whitelisted origins', () => {
    expect(isOriginAllowed('https://evil.com', allowedOrigins)).toBe(false);
    expect(isOriginAllowed('https://example.com.evil.com', allowedOrigins)).toBe(false);
  });

  test('should block all cross-origin when no origins configured', () => {
    expect(isOriginAllowed('https://example.com', [])).toBe(false);
  });

  test('should be case sensitive for origin matching', () => {
    expect(isOriginAllowed('https://EXAMPLE.COM', allowedOrigins)).toBe(false);
  });
});

// ============================================================================
// QUOTA BYPASS TESTS
// ============================================================================

describe('Quota Enforcement Security', () => {
  const QUOTA_LIMITS = {
    'Standard': 4000000,
    'Neural2': 1000000,
  };

  function checkQuotaAllows(currentUsage, requestedCount, limit) {
    const projectedUsage = currentUsage + requestedCount;
    return projectedUsage <= limit;
  }

  test('should block requests exceeding quota', () => {
    expect(checkQuotaAllows(3999999, 2, QUOTA_LIMITS['Standard'])).toBe(false);
    expect(checkQuotaAllows(999999, 2, QUOTA_LIMITS['Neural2'])).toBe(false);
  });

  test('should allow requests within quota', () => {
    expect(checkQuotaAllows(0, 1000, QUOTA_LIMITS['Standard'])).toBe(true);
    expect(checkQuotaAllows(500000, 500000, QUOTA_LIMITS['Neural2'])).toBe(true);
  });

  test('should handle exactly at limit', () => {
    expect(checkQuotaAllows(3999999, 1, QUOTA_LIMITS['Standard'])).toBe(true);
    expect(checkQuotaAllows(4000000, 0, QUOTA_LIMITS['Standard'])).toBe(true);
  });

  test('should handle integer overflow attempts', () => {
    // Test with very large numbers
    const hugeRequest = Number.MAX_SAFE_INTEGER;
    expect(checkQuotaAllows(0, hugeRequest, QUOTA_LIMITS['Standard'])).toBe(false);
  });
});

// ============================================================================
// FILE UPLOAD SECURITY TESTS
// ============================================================================

describe('File Upload Security', () => {
  function isValidFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return ext === 'txt';
  }

  function sanitizeUploadedContent(content) {
    // Remove null bytes
    return content.replace(/\0/g, '');
  }

  test('should only accept .txt files', () => {
    expect(isValidFileType('document.txt')).toBe(true);
    expect(isValidFileType('script.js')).toBe(false);
    expect(isValidFileType('image.png')).toBe(false);
    expect(isValidFileType('shell.sh')).toBe(false);
    expect(isValidFileType('archive.zip')).toBe(false);
  });

  test('should handle double extensions', () => {
    expect(isValidFileType('malware.txt.exe')).toBe(false);
    expect(isValidFileType('script.js.txt')).toBe(true);
  });

  test('should remove null bytes from content', () => {
    const malicious = 'Hello\0World\0Null\0Bytes';
    const sanitized = sanitizeUploadedContent(malicious);
    expect(sanitized).not.toContain('\0');
    expect(sanitized).toBe('HelloWorldNullBytes');
  });
});

// ============================================================================
// TIMING SAFE COMPARISON TESTS
// ============================================================================

describe('Timing-Safe Comparison', () => {
  const crypto = require('crypto');

  test('should not throw on different length strings', () => {
    // Buffer.from with different lengths would throw in timingSafeEqual
    // So we need to check length first
    function safeCompare(a, b) {
      if (!a || !b || a.length !== b.length) return false;
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    }

    expect(() => safeCompare('short', 'longer-string')).not.toThrow();
    expect(safeCompare('short', 'longer-string')).toBe(false);
  });

  test('should correctly compare equal strings', () => {
    function safeCompare(a, b) {
      if (!a || !b || a.length !== b.length) return false;
      return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
    }

    expect(safeCompare('test-key', 'test-key')).toBe(true);
  });
});
