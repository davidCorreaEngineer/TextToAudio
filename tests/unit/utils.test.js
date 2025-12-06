/**
 * Unit Tests for Utility Functions
 * Tests the extracted utility module from src/utils.js
 */

const { describe, test, expect } = require('@jest/globals');
const {
  getVoiceCategory,
  countCharacters,
  countBytes,
  countCharactersInSsml,
  countCharactersInSsmlText,
  sanitizeError,
  QUOTA_LIMITS,
  BYTE_BASED_VOICES,
  CHARACTER_BASED_VOICES,
} = require('../../src/utils');

describe('getVoiceCategory', () => {
  test('returns Standard for Standard voices', () => {
    expect(getVoiceCategory('en-US-Standard-A')).toBe('Standard');
    expect(getVoiceCategory('en-GB-Standard-B')).toBe('Standard');
    expect(getVoiceCategory('es-ES-Standard-C')).toBe('Standard');
  });

  test('returns WaveNet for WaveNet voices', () => {
    expect(getVoiceCategory('en-US-WaveNet-A')).toBe('WaveNet');
    expect(getVoiceCategory('de-DE-WaveNet-B')).toBe('WaveNet');
  });

  test('returns Neural2 for Neural2 voices', () => {
    expect(getVoiceCategory('en-US-Neural2-A')).toBe('Neural2');
    expect(getVoiceCategory('ja-JP-Neural2-B')).toBe('Neural2');
  });

  test('returns Polyglot for Polyglot voices', () => {
    expect(getVoiceCategory('en-US-Polyglot-1')).toBe('Polyglot');
  });

  test('returns Journey for Journey voices', () => {
    expect(getVoiceCategory('en-US-Journey-F')).toBe('Journey');
    expect(getVoiceCategory('en-GB-Journey-D')).toBe('Journey');
  });

  test('returns Studio for Studio voices', () => {
    expect(getVoiceCategory('en-US-Studio-M')).toBe('Studio');
    expect(getVoiceCategory('en-US-Studio-O')).toBe('Studio');
  });

  test('returns Standard for unknown voice types', () => {
    expect(getVoiceCategory('en-US-Unknown-X')).toBe('Standard');
    expect(getVoiceCategory('random-voice-name')).toBe('Standard');
    expect(getVoiceCategory('')).toBe('Standard');
  });

  test('is case insensitive', () => {
    expect(getVoiceCategory('en-US-STANDARD-A')).toBe('Standard');
    expect(getVoiceCategory('en-US-wavenet-A')).toBe('WaveNet');
    expect(getVoiceCategory('en-US-NEURAL2-A')).toBe('Neural2');
  });
});

describe('countCharacters', () => {
  test('counts characters in plain text', () => {
    expect(countCharacters('Hello')).toBe(5);
    expect(countCharacters('Hello World')).toBe(11);
    expect(countCharacters('')).toBe(0);
  });

  test('includes spaces and punctuation', () => {
    expect(countCharacters('Hello, World!')).toBe(13);
    expect(countCharacters('   ')).toBe(3);
  });

  test('removes SSML mark tags', () => {
    expect(countCharacters('Hello<mark name="test"/>World')).toBe(10);
    expect(countCharacters('<mark name="start"/>Text<mark name="end"/>')).toBe(4);
  });

  test('handles multi-byte characters', () => {
    expect(countCharacters('こんにちは')).toBe(5);
    expect(countCharacters('Hello 世界')).toBe(8);
  });

  test('handles line breaks', () => {
    expect(countCharacters('Hello\nWorld')).toBe(11);
    expect(countCharacters('Line1\r\nLine2')).toBe(12);
  });
});

describe('countBytes', () => {
  test('counts bytes for ASCII text', () => {
    expect(countBytes('Hello')).toBe(5);
    expect(countBytes('Hello World')).toBe(11);
    expect(countBytes('')).toBe(0);
  });

  test('counts more bytes for multi-byte characters', () => {
    expect(countBytes('こんにちは')).toBe(15); // 5 chars × 3 bytes
    expect(countBytes('Hello 世界')).toBe(12); // 6 ASCII + 2 × 3 bytes
  });

  test('counts bytes for emojis', () => {
    expect(countBytes('😀')).toBe(4);
    expect(countBytes('Hello 😀')).toBe(10);
  });
});

describe('countCharactersInSsml', () => {
  test('strips SSML tags and counts remaining characters', () => {
    expect(countCharactersInSsml('<speak>Hello</speak>')).toBe(5);
    expect(countCharactersInSsml('<speak>Hello <break time="500ms"/> World</speak>')).toBe(12);
  });

  test('handles nested tags', () => {
    expect(countCharactersInSsml('<speak><prosody rate="slow">Hello</prosody></speak>')).toBe(5);
  });

  test('handles empty SSML', () => {
    expect(countCharactersInSsml('<speak></speak>')).toBe(0);
    expect(countCharactersInSsml('<speak>   </speak>')).toBe(3);
  });

  test('handles self-closing tags', () => {
    expect(countCharactersInSsml('<speak>A<break/>B</speak>')).toBe(2);
  });
});

describe('countCharactersInSsmlText', () => {
  test('returns plain text from SSML', () => {
    expect(countCharactersInSsmlText('<speak>Hello World</speak>')).toBe('Hello World');
  });

  test('removes all tags including break tags', () => {
    expect(countCharactersInSsmlText('<speak>Hello<break time="500ms"/>World</speak>')).toBe('HelloWorld');
  });

  test('preserves whitespace between text', () => {
    expect(countCharactersInSsmlText('<speak>Hello World</speak>')).toBe('Hello World');
  });
});

describe('sanitizeError', () => {
  test('passes through known safe error messages', () => {
    expect(sanitizeError('No text provided')).toBe('No text provided');
    expect(sanitizeError('Text is too long')).toBe('Text is too long');
    expect(sanitizeError('Rate limit exceeded')).toBe('Rate limit exceeded');
    expect(sanitizeError('Invalid API key')).toBe('Invalid API key');
  });

  test('handles Error objects', () => {
    expect(sanitizeError(new Error('No text provided'))).toBe('No text provided');
    expect(sanitizeError(new Error('Some internal error'))).toBe('An unexpected error occurred. Please try again.');
  });

  test('sanitizes Google API errors', () => {
    expect(sanitizeError('INVALID_ARGUMENT: bad request')).toBe('Invalid request parameters. Please check your input.');
    expect(sanitizeError('PERMISSION_DENIED: access denied')).toBe('Service configuration error. Please contact the administrator.');
    expect(sanitizeError('RESOURCE_EXHAUSTED: quota limit')).toBe('Service quota exceeded. Please try again later.');
  });

  test('returns generic message for unknown errors', () => {
    expect(sanitizeError('Database connection failed')).toBe('An unexpected error occurred. Please try again.');
    expect(sanitizeError('Internal server error at line 42')).toBe('An unexpected error occurred. Please try again.');
    expect(sanitizeError('/home/user/secret/path/file.js')).toBe('An unexpected error occurred. Please try again.');
  });

  test('is case insensitive for safe patterns', () => {
    expect(sanitizeError('NO TEXT PROVIDED')).toBe('NO TEXT PROVIDED');
    expect(sanitizeError('no text provided')).toBe('no text provided');
  });
});

describe('QUOTA_LIMITS', () => {
  test('has correct byte-based limits', () => {
    expect(QUOTA_LIMITS['Neural2']).toBe(1000000);
    expect(QUOTA_LIMITS['Studio']).toBe(100000);
    expect(QUOTA_LIMITS['Polyglot']).toBe(100000);
    expect(QUOTA_LIMITS['Journey']).toBe(1000000);
  });

  test('has correct character-based limits', () => {
    expect(QUOTA_LIMITS['Standard']).toBe(4000000);
    expect(QUOTA_LIMITS['WaveNet']).toBe(1000000);
  });

  test('has all voice types defined', () => {
    const voiceTypes = ['Neural2', 'Studio', 'Polyglot', 'Standard', 'WaveNet', 'Journey'];
    voiceTypes.forEach(type => {
      expect(QUOTA_LIMITS).toHaveProperty(type);
      expect(typeof QUOTA_LIMITS[type]).toBe('number');
    });
  });
});

describe('Voice Type Classification', () => {
  test('correctly identifies byte-based voice types', () => {
    BYTE_BASED_VOICES.forEach(voiceType => {
      expect(BYTE_BASED_VOICES.includes(voiceType)).toBe(true);
      expect(CHARACTER_BASED_VOICES.includes(voiceType)).toBe(false);
    });
  });

  test('correctly identifies character-based voice types', () => {
    CHARACTER_BASED_VOICES.forEach(voiceType => {
      expect(CHARACTER_BASED_VOICES.includes(voiceType)).toBe(true);
      expect(BYTE_BASED_VOICES.includes(voiceType)).toBe(false);
    });
  });

  test('byte count is >= character count for any text', () => {
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
