module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],

  // Coverage thresholds (increased to 65% - 2025-12-06)
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 65,
      lines: 65,
      statements: 65
    }
  },

  // Coverage output directory
  coverageDirectory: 'coverage',

  // Setup files
  setupFilesAfterEnv: ['./tests/setup.js'],

  // Module paths
  moduleDirectories: ['node_modules', 'src'],

  // Timeout for async tests (Google API mocks may need more time)
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true
};
