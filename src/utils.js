/**
 * Utility Functions for Text-to-Speech Application
 * Extracted from app_server.js for testability and reusability
 */

/**
 * Determines the voice category from a voice name
 * @param {string} voiceName - The full voice name (e.g., 'en-US-Neural2-A')
 * @returns {string} Voice category (Standard, WaveNet, Neural2, etc.)
 */
function getVoiceCategory(voiceName) {
  if (/Standard/i.test(voiceName)) {
    return 'Standard';
  } else if (/WaveNet/i.test(voiceName)) {
    return 'WaveNet';
  } else if (/Neural2/i.test(voiceName)) {
    return 'Neural2';
  } else if (/Polyglot/i.test(voiceName)) {
    return 'Polyglot';
  } else if (/Journey/i.test(voiceName)) {
    return 'Journey';
  } else if (/Studio/i.test(voiceName)) {
    return 'Studio';
  } else {
    return 'Standard';
  }
}

/**
 * Counts characters in text, excluding SSML mark tags
 * @param {string} text - The text to count
 * @returns {number} Character count
 */
function countCharacters(text) {
  const textWithoutMarks = text.replace(/<mark name=['"].*?['"]\/>/g, '');
  return textWithoutMarks.length;
}

/**
 * Counts bytes in text (UTF-8 encoding)
 * @param {string} text - The text to count
 * @returns {number} Byte count
 */
function countBytes(text) {
  return Buffer.byteLength(text, 'utf8');
}

/**
 * Counts characters in SSML text by stripping all tags
 * @param {string} ssmlText - SSML-formatted text
 * @returns {number} Character count after removing tags
 */
function countCharactersInSsml(ssmlText) {
  const strippedText = ssmlText.replace(/<[^>]+>/g, '');
  return strippedText.length;
}

/**
 * Extracts plain text from SSML by removing all tags
 * @param {string} ssmlText - SSML-formatted text
 * @returns {string} Plain text without tags
 */
function countCharactersInSsmlText(ssmlText) {
  return ssmlText.replace(/<[^>]+>/g, '');
}

/**
 * Known safe error patterns that can be shown to users
 */
const SAFE_ERROR_PATTERNS = [
  /No text provided/i,
  /Text is too long/i,
  /No file uploaded/i,
  /Rate limit exceeded/i,
  /Monthly quota exceeded/i,
  /Invalid API key/i,
  /Authentication required/i,
];

/**
 * Sanitizes error messages to prevent information leakage
 * @param {Error|string} error - The error to sanitize
 * @returns {string} Safe error message for user display
 */
function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);

  // Check against known safe patterns
  for (const pattern of SAFE_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return message;
    }
  }

  // Map Google API errors to safe messages
  if (message.includes('INVALID_ARGUMENT')) {
    return 'Invalid request parameters. Please check your input.';
  }
  if (message.includes('PERMISSION_DENIED')) {
    return 'Service configuration error. Please contact the administrator.';
  }
  if (message.includes('RESOURCE_EXHAUSTED')) {
    return 'Service quota exceeded. Please try again later.';
  }

  // Default safe message for unknown errors
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Quota limits for different voice types (Google Cloud TTS Free Tier)
 */
const QUOTA_LIMITS = {
  'Neural2': 1000000,      // 1 million bytes
  'Studio': 100000,        // 100,000 bytes
  'Polyglot': 100000,      // 100,000 bytes
  'Standard': 4000000,     // 4 million characters
  'WaveNet': 1000000,      // 1 million characters
  'Journey': 1000000       // 1 million bytes
};

/**
 * Voice types that use byte-based quota
 */
const BYTE_BASED_VOICES = ['Neural2', 'Studio', 'Polyglot', 'Journey'];

/**
 * Voice types that use character-based quota
 */
const CHARACTER_BASED_VOICES = ['Standard', 'WaveNet'];

module.exports = {
  getVoiceCategory,
  countCharacters,
  countBytes,
  countCharactersInSsml,
  countCharactersInSsmlText,
  sanitizeError,
  SAFE_ERROR_PATTERNS,
  QUOTA_LIMITS,
  BYTE_BASED_VOICES,
  CHARACTER_BASED_VOICES,
};
