/**
 * Test Fixtures
 * Reusable test data for all test suites
 */

// Valid API key (matches setup.js)
const VALID_API_KEY = 'test-api-key-12345';
const INVALID_API_KEY = 'wrong-api-key';

// Sample text content
const sampleTexts = {
  short: 'Hello, this is a test.',
  medium: 'This is a medium length text. It contains multiple sentences. Each sentence should be properly handled.',
  long: 'A'.repeat(5001), // Exceeds MAX_TEXT_LENGTH
  withSpecialChars: 'Test with <special> & "characters" that need escaping.',
  withSsml: '<speak>Hello <break time="500ms"/> world</speak>',
  japanese: 'こんにちは、これはテストです。',
  empty: '',
  whitespaceOnly: '   \n\t   '
};

// Valid request bodies
const validSynthesizeRequest = {
  textContent: 'Hello, this is a test.',
  language: 'en-US',
  voice: 'en-US-Standard-A',
  speakingRate: '1.0',
  pitch: '0',
  originalFileName: 'test.txt',
  useSsml: 'false'
};

const validTestVoiceRequest = {
  language: 'en-US',
  voice: 'en-US-Standard-A',
  speakingRate: '1.0',
  pitch: '0'
};

// Invalid request bodies for testing validation
const invalidRequests = {
  missingText: {
    language: 'en-US',
    voice: 'en-US-Standard-A',
    speakingRate: '1.0',
    pitch: '0'
  },
  textTooLong: {
    textContent: 'A'.repeat(5001),
    language: 'en-US',
    voice: 'en-US-Standard-A',
    speakingRate: '1.0',
    pitch: '0',
    originalFileName: 'test.txt',
    useSsml: 'false'
  },
  invalidSpeakingRate: {
    textContent: 'Test',
    language: 'en-US',
    voice: 'en-US-Standard-A',
    speakingRate: 'not-a-number',
    pitch: '0'
  }
};

// Sample quota data
const sampleQuota = {
  '2024-01': {
    'Standard': 100000,
    'WaveNet': 50000
  },
  '2024-02': {
    'Standard': 150000,
    'Neural2': 25000
  }
};

// Expected voice categories
const voiceCategories = {
  'en-US-Standard-A': 'Standard',
  'en-US-WaveNet-A': 'WaveNet',
  'en-US-Neural2-A': 'Neural2',
  'en-US-Polyglot-1': 'Polyglot',
  'en-US-Journey-F': 'Journey',
  'en-US-Studio-M': 'Studio',
  'en-US-Unknown-X': 'Standard' // Default
};

// Supported languages (should match server config)
const supportedLanguages = [
  'en-GB', 'en-US', 'en-AU',
  'nl-NL',
  'es-ES', 'es-US',
  'de-DE',
  'ja-JP',
  'it-IT',
  'fr-FR',
  'pt-PT', 'pt-BR',
  'tr-TR'
];

// Test sentences by language (should match server config)
const testSentences = {
  'en-US': "How can I improve my English pronunciation?",
  'en-GB': "It's important to drink water regularly throughout the day.",
  'es-ES': "¿Dónde puedo encontrar una farmacia cercana?",
  'de-DE': "Wie komme ich am besten zum Hauptbahnhof?",
  'ja-JP': "この近くにおいしいレストランはありますか？"
};

module.exports = {
  VALID_API_KEY,
  INVALID_API_KEY,
  sampleTexts,
  validSynthesizeRequest,
  validTestVoiceRequest,
  invalidRequests,
  sampleQuota,
  voiceCategories,
  supportedLanguages,
  testSentences
};
