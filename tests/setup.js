/**
 * Jest Test Setup
 * This file runs before each test file
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TTS_API_KEY = 'test-api-key-12345';
process.env.CORS_ORIGINS = 'http://localhost:3000,http://test.example.com';

// Suppress console.log during tests (optional - comment out for debugging)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

// Global test utilities
global.testUtils = {
  // Generate a valid API key header
  getAuthHeader: () => ({
    'X-API-Key': process.env.TTS_API_KEY
  }),

  // Wait for a specified time
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate random string
  randomString: (length = 10) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
};

// Increase timeout for integration tests
jest.setTimeout(10000);
