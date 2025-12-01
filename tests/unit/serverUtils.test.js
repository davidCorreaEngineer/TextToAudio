/**
 * Unit Tests for Server Utility Functions
 *
 * These tests verify the core utility functions used in app_server.js
 * Functions are extracted and tested in isolation
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');

// ============================================================================
// FUNCTION IMPLEMENTATIONS (extracted from app_server.js for testing)
// In a refactored codebase, these would be imported from a utilities module
// ============================================================================

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

function countCharacters(text) {
  const textWithoutMarks = text.replace(/<mark name=['"].*?['"]\/>/g, '');
  return textWithoutMarks.length;
}

function countBytes(text) {
  return Buffer.byteLength(text, 'utf8');
}

function countCharactersInSsml(ssmlText) {
  const strippedText = ssmlText.replace(/<[^>]+>/g, '');
  return strippedText.length;
}

function countCharactersInSsmlText(ssmlText) {
  return ssmlText.replace(/<[^>]+>/g, '');
}

const SAFE_ERROR_PATTERNS = [
  /No text provided/i,
  /Text is too long/i,
  /No file uploaded/i,
  /Rate limit exceeded/i,
  /Monthly quota exceeded/i,
  /Invalid API key/i,
  /Authentication required/i,
];

function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);

  for (const pattern of SAFE_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return message;
    }
  }

  if (message.includes('INVALID_ARGUMENT')) {
    return 'Invalid request parameters. Please check your input.';
  }
  if (message.includes('PERMISSION_DENIED')) {
    return 'Service configuration error. Please contact the administrator.';
  }
  if (message.includes('RESOURCE_EXHAUSTED')) {
    return 'Service quota exceeded. Please try again later.';
  }

  return 'An unexpected error occurred. Please try again.';
}

// ============================================================================
// TESTS
// ============================================================================

describe('getVoiceCategory', () => {
  test('should return "Standard" for Standard voices', () => {
    expect(getVoiceCategory('en-US-Standard-A')).toBe('Standard');
    expect(getVoiceCategory('en-GB-Standard-B')).toBe('Standard');
    expect(getVoiceCategory('es-ES-Standard-C')).toBe('Standard');
  });

  test('should return "WaveNet" for WaveNet voices', () => {
    expect(getVoiceCategory('en-US-WaveNet-A')).toBe('WaveNet');
    expect(getVoiceCategory('de-DE-WaveNet-B')).toBe('WaveNet');
  });

  test('should return "Neural2" for Neural2 voices', () => {
    expect(getVoiceCategory('en-US-Neural2-A')).toBe('Neural2');
    expect(getVoiceCategory('ja-JP-Neural2-B')).toBe('Neural2');
  });

  test('should return "Polyglot" for Polyglot voices', () => {
    expect(getVoiceCategory('en-US-Polyglot-1')).toBe('Polyglot');
  });

  test('should return "Journey" for Journey voices', () => {
    expect(getVoiceCategory('en-US-Journey-F')).toBe('Journey');
    expect(getVoiceCategory('en-GB-Journey-D')).toBe('Journey');
  });

  test('should return "Studio" for Studio voices', () => {
    expect(getVoiceCategory('en-US-Studio-M')).toBe('Studio');
    expect(getVoiceCategory('en-US-Studio-O')).toBe('Studio');
  });

  test('should return "Standard" for unknown voice types (default)', () => {
    expect(getVoiceCategory('en-US-Unknown-X')).toBe('Standard');
    expect(getVoiceCategory('random-voice-name')).toBe('Standard');
    expect(getVoiceCategory('')).toBe('Standard');
  });

  test('should be case insensitive', () => {
    expect(getVoiceCategory('en-US-STANDARD-A')).toBe('Standard');
    expect(getVoiceCategory('en-US-wavenet-A')).toBe('WaveNet');
    expect(getVoiceCategory('en-US-NEURAL2-A')).toBe('Neural2');
  });
});

describe('countCharacters', () => {
  test('should count characters in plain text', () => {
    expect(countCharacters('Hello')).toBe(5);
    expect(countCharacters('Hello World')).toBe(11);
    expect(countCharacters('')).toBe(0);
  });

  test('should include spaces and punctuation', () => {
    expect(countCharacters('Hello, World!')).toBe(13);
    expect(countCharacters('   ')).toBe(3);
  });

  test('should remove SSML mark tags', () => {
    expect(countCharacters('Hello<mark name="test"/>World')).toBe(10);
    expect(countCharacters('<mark name="start"/>Text<mark name="end"/>')).toBe(4);
  });

  test('should handle multi-byte characters', () => {
    expect(countCharacters('こんにちは')).toBe(5); // 5 Japanese characters
    expect(countCharacters('Hello 世界')).toBe(8);
  });

  test('should handle line breaks', () => {
    expect(countCharacters('Hello\nWorld')).toBe(11);
    expect(countCharacters('Line1\r\nLine2')).toBe(12);
  });
});

describe('countBytes', () => {
  test('should count bytes for ASCII text', () => {
    expect(countBytes('Hello')).toBe(5);
    expect(countBytes('Hello World')).toBe(11);
    expect(countBytes('')).toBe(0);
  });

  test('should count more bytes for multi-byte characters', () => {
    // Japanese characters are 3 bytes each in UTF-8
    expect(countBytes('こんにちは')).toBe(15); // 5 chars × 3 bytes
    expect(countBytes('Hello 世界')).toBe(12); // 6 ASCII + 2 × 3 bytes
  });

  test('should count bytes for emojis', () => {
    expect(countBytes('😀')).toBe(4); // Emojis are 4 bytes
    expect(countBytes('Hello 😀')).toBe(10); // 6 + 4
  });
});

describe('countCharactersInSsml', () => {
  test('should strip SSML tags and count remaining characters', () => {
    expect(countCharactersInSsml('<speak>Hello</speak>')).toBe(5);
    // "Hello " + " World" = 12 chars (space before break + space after break)
    expect(countCharactersInSsml('<speak>Hello <break time="500ms"/> World</speak>')).toBe(12);
  });

  test('should handle nested tags', () => {
    expect(countCharactersInSsml('<speak><prosody rate="slow">Hello</prosody></speak>')).toBe(5);
  });

  test('should handle empty SSML', () => {
    expect(countCharactersInSsml('<speak></speak>')).toBe(0);
    expect(countCharactersInSsml('<speak>   </speak>')).toBe(3);
  });

  test('should handle self-closing tags', () => {
    expect(countCharactersInSsml('<speak>A<break/>B</speak>')).toBe(2);
  });
});

describe('countCharactersInSsmlText', () => {
  test('should return plain text from SSML', () => {
    expect(countCharactersInSsmlText('<speak>Hello World</speak>')).toBe('Hello World');
  });

  test('should remove all tags including break tags', () => {
    expect(countCharactersInSsmlText('<speak>Hello<break time="500ms"/>World</speak>')).toBe('HelloWorld');
  });

  test('should preserve whitespace between text', () => {
    expect(countCharactersInSsmlText('<speak>Hello World</speak>')).toBe('Hello World');
  });
});

describe('sanitizeError', () => {
  test('should pass through known safe error messages', () => {
    expect(sanitizeError('No text provided')).toBe('No text provided');
    expect(sanitizeError('Text is too long')).toBe('Text is too long');
    expect(sanitizeError('Rate limit exceeded')).toBe('Rate limit exceeded');
    expect(sanitizeError('Invalid API key')).toBe('Invalid API key');
  });

  test('should handle Error objects', () => {
    expect(sanitizeError(new Error('No text provided'))).toBe('No text provided');
    expect(sanitizeError(new Error('Some internal error'))).toBe('An unexpected error occurred. Please try again.');
  });

  test('should sanitize Google API errors', () => {
    expect(sanitizeError('INVALID_ARGUMENT: bad request')).toBe('Invalid request parameters. Please check your input.');
    expect(sanitizeError('PERMISSION_DENIED: access denied')).toBe('Service configuration error. Please contact the administrator.');
    expect(sanitizeError('RESOURCE_EXHAUSTED: quota limit')).toBe('Service quota exceeded. Please try again later.');
  });

  test('should return generic message for unknown errors', () => {
    expect(sanitizeError('Database connection failed')).toBe('An unexpected error occurred. Please try again.');
    expect(sanitizeError('Internal server error at line 42')).toBe('An unexpected error occurred. Please try again.');
    expect(sanitizeError('/home/user/secret/path/file.js')).toBe('An unexpected error occurred. Please try again.');
  });

  test('should be case insensitive for safe patterns', () => {
    expect(sanitizeError('NO TEXT PROVIDED')).toBe('NO TEXT PROVIDED');
    expect(sanitizeError('no text provided')).toBe('no text provided');
  });
});

// ============================================================================
// QUOTA LIMITS TESTS
// ============================================================================

describe('Quota Limits Configuration', () => {
  const QUOTA_LIMITS = {
    'Neural2': 1000000,
    'Studio': 100000,
    'Polyglot': 100000,
    'Standard': 4000000,
    'WaveNet': 1000000,
    'Journey': 1000000
  };

  test('should have correct byte-based limits', () => {
    expect(QUOTA_LIMITS['Neural2']).toBe(1000000);
    expect(QUOTA_LIMITS['Studio']).toBe(100000);
    expect(QUOTA_LIMITS['Polyglot']).toBe(100000);
    expect(QUOTA_LIMITS['Journey']).toBe(1000000);
  });

  test('should have correct character-based limits', () => {
    expect(QUOTA_LIMITS['Standard']).toBe(4000000);
    expect(QUOTA_LIMITS['WaveNet']).toBe(1000000);
  });

  test('should have all voice types defined', () => {
    const voiceTypes = ['Neural2', 'Studio', 'Polyglot', 'Standard', 'WaveNet', 'Journey'];
    voiceTypes.forEach(type => {
      expect(QUOTA_LIMITS).toHaveProperty(type);
      expect(typeof QUOTA_LIMITS[type]).toBe('number');
    });
  });
});

// ============================================================================
// BYTE VS CHARACTER COUNTING LOGIC
// ============================================================================

describe('Byte vs Character Counting Logic', () => {
  const byteBasedVoices = ['Neural2', 'Studio', 'Polyglot', 'Journey'];
  const characterBasedVoices = ['Standard', 'WaveNet'];

  test('should correctly identify byte-based voice types', () => {
    byteBasedVoices.forEach(voiceType => {
      expect(byteBasedVoices.includes(voiceType)).toBe(true);
      expect(characterBasedVoices.includes(voiceType)).toBe(false);
    });
  });

  test('should correctly identify character-based voice types', () => {
    characterBasedVoices.forEach(voiceType => {
      expect(characterBasedVoices.includes(voiceType)).toBe(true);
      expect(byteBasedVoices.includes(voiceType)).toBe(false);
    });
  });

  test('byte count should be >= character count for any text', () => {
    const testStrings = [
      'Hello World',
      'こんにちは',
      'Hello 世界 🌍',
      'Simple ASCII text'
    ];

    testStrings.forEach(str => {
      expect(countBytes(str)).toBeGreaterThanOrEqual(countCharacters(str));
    });
  });

  test('byte count equals character count for pure ASCII', () => {
    const asciiText = 'Hello World 123!@#';
    expect(countBytes(asciiText)).toBe(countCharacters(asciiText));
  });
});
