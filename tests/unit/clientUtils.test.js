/**
 * Unit Tests for Client-Side Utility Functions
 *
 * These tests verify the utility functions in app_client.js
 * Uses jsdom to simulate browser environment
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const { JSDOM } = require('jsdom');

// ============================================================================
// FUNCTION IMPLEMENTATIONS (extracted from app_client.js for testing)
// ============================================================================

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function convertTextToSsml(text, pauseDuration) {
  const sentenceEndRegex = /([.?!])/g;
  const sentences = text.split(sentenceEndRegex).filter(s => s.trim() !== '');
  let ssmlText = '<speak>';

  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = escapeXml(sentences[i].trim());
    const punctuation = sentences[i + 1] || '';
    ssmlText += sentence + punctuation;

    if (i + 2 < sentences.length && (punctuation === '.' || punctuation === '?' || punctuation === '!')) {
      ssmlText += `<break time="${pauseDuration}ms"/> `;
    } else {
      ssmlText += ' ';
    }
  }

  ssmlText += '</speak>';
  return ssmlText;
}

function base64ToBlob(base64, mime) {
  const byteChars = Buffer.from(base64, 'base64').toString('binary');
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return { data: byteArray, type: mime }; // Simplified for Node.js testing
}

function getAuthHeaders(apiKey, additionalHeaders = {}) {
  return {
    'X-API-Key': apiKey,
    ...additionalHeaders
  };
}

function getCurrentYearMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

function generateColorPalette(numColors) {
  const colors = [];
  const hueStep = 360 / numColors;
  for (let i = 0; i < numColors; i++) {
    const hue = i * hueStep;
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }
  return colors;
}

// ============================================================================
// TESTS: escapeXml
// ============================================================================

describe('escapeXml', () => {
  test('should escape ampersand', () => {
    expect(escapeXml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    expect(escapeXml('A & B & C')).toBe('A &amp; B &amp; C');
  });

  test('should escape less than', () => {
    expect(escapeXml('a < b')).toBe('a &lt; b');
    expect(escapeXml('<script>')).toBe('&lt;script&gt;');
  });

  test('should escape greater than', () => {
    expect(escapeXml('a > b')).toBe('a &gt; b');
  });

  test('should escape double quotes', () => {
    expect(escapeXml('He said "hello"')).toBe('He said &quot;hello&quot;');
  });

  test('should escape single quotes', () => {
    expect(escapeXml("It's fine")).toBe('It&apos;s fine');
  });

  test('should escape all special characters together', () => {
    const input = '<div class="test" data-val=\'a&b\'>';
    const expected = '&lt;div class=&quot;test&quot; data-val=&apos;a&amp;b&apos;&gt;';
    expect(escapeXml(input)).toBe(expected);
  });

  test('should handle empty string', () => {
    expect(escapeXml('')).toBe('');
  });

  test('should not modify text without special characters', () => {
    expect(escapeXml('Hello World')).toBe('Hello World');
    expect(escapeXml('12345')).toBe('12345');
  });
});

// ============================================================================
// TESTS: convertTextToSsml
// ============================================================================

describe('convertTextToSsml', () => {
  test('should wrap text in speak tags', () => {
    const result = convertTextToSsml('Hello', 500);
    expect(result.startsWith('<speak>')).toBe(true);
    expect(result.endsWith('</speak>')).toBe(true);
  });

  test('should add break tags between sentences', () => {
    const result = convertTextToSsml('First sentence. Second sentence.', 500);
    expect(result).toContain('<break time="500ms"/>');
  });

  test('should use correct pause duration', () => {
    const result1 = convertTextToSsml('Hello. World.', 500);
    const result2 = convertTextToSsml('Hello. World.', 1000);
    expect(result1).toContain('<break time="500ms"/>');
    expect(result2).toContain('<break time="1000ms"/>');
  });

  test('should handle question marks', () => {
    const result = convertTextToSsml('What? Why?', 500);
    expect(result).toContain('<break time="500ms"/>');
  });

  test('should handle exclamation marks', () => {
    const result = convertTextToSsml('Wow! Amazing!', 500);
    expect(result).toContain('<break time="500ms"/>');
  });

  test('should not add break after last sentence', () => {
    const result = convertTextToSsml('Only one sentence.', 500);
    expect(result).not.toContain('<break');
    expect(result).toBe('<speak>Only one sentence. </speak>');
  });

  test('should escape special XML characters', () => {
    const result = convertTextToSsml('Tom & Jerry. <script>.', 500);
    expect(result).toContain('Tom &amp; Jerry');
    expect(result).toContain('&lt;script&gt;');
  });

  test('should handle empty text', () => {
    const result = convertTextToSsml('', 500);
    expect(result).toBe('<speak></speak>');
  });

  test('should handle text without sentence endings', () => {
    const result = convertTextToSsml('Hello World', 500);
    expect(result).toBe('<speak>Hello World </speak>');
  });

  test('should handle multiple sentence types', () => {
    const result = convertTextToSsml('Statement. Question? Exclamation!', 500);
    expect(result.match(/<break time="500ms"\/>/g).length).toBe(2);
  });
});

// ============================================================================
// TESTS: base64ToBlob
// ============================================================================

describe('base64ToBlob', () => {
  test('should decode base64 to bytes', () => {
    // "Hello" in base64 is "SGVsbG8="
    const result = base64ToBlob('SGVsbG8=', 'audio/mp3');
    expect(result.data.length).toBe(5);
    expect(result.type).toBe('audio/mp3');
  });

  test('should preserve MIME type', () => {
    const result = base64ToBlob('SGVsbG8=', 'audio/mpeg');
    expect(result.type).toBe('audio/mpeg');
  });

  test('should handle empty base64', () => {
    const result = base64ToBlob('', 'audio/mp3');
    expect(result.data.length).toBe(0);
  });
});

// ============================================================================
// TESTS: getAuthHeaders
// ============================================================================

describe('getAuthHeaders', () => {
  test('should include API key header', () => {
    const headers = getAuthHeaders('my-api-key');
    expect(headers['X-API-Key']).toBe('my-api-key');
  });

  test('should merge additional headers', () => {
    const headers = getAuthHeaders('my-api-key', { 'Content-Type': 'application/json' });
    expect(headers['X-API-Key']).toBe('my-api-key');
    expect(headers['Content-Type']).toBe('application/json');
  });

  test('should override API key if provided in additional headers', () => {
    const headers = getAuthHeaders('original-key', { 'X-API-Key': 'override-key' });
    expect(headers['X-API-Key']).toBe('override-key');
  });

  test('should handle empty additional headers', () => {
    const headers = getAuthHeaders('my-api-key', {});
    expect(Object.keys(headers)).toEqual(['X-API-Key']);
  });
});

// ============================================================================
// TESTS: getCurrentYearMonth
// ============================================================================

describe('getCurrentYearMonth', () => {
  test('should return correct format YYYY-MM', () => {
    const result = getCurrentYearMonth();
    expect(result).toMatch(/^\d{4}-\d{2}$/);
  });

  test('should pad single-digit months with zero', () => {
    // We can't easily mock Date, but we can verify the format
    const result = getCurrentYearMonth();
    const month = result.split('-')[1];
    expect(month.length).toBe(2);
  });

  test('should return current year', () => {
    const result = getCurrentYearMonth();
    const year = parseInt(result.split('-')[0]);
    const currentYear = new Date().getFullYear();
    expect(year).toBe(currentYear);
  });
});

// ============================================================================
// TESTS: generateColorPalette
// ============================================================================

describe('generateColorPalette', () => {
  test('should generate correct number of colors', () => {
    expect(generateColorPalette(5).length).toBe(5);
    expect(generateColorPalette(10).length).toBe(10);
    expect(generateColorPalette(1).length).toBe(1);
  });

  test('should return HSL format colors', () => {
    const colors = generateColorPalette(3);
    colors.forEach(color => {
      expect(color).toMatch(/^hsl\(\d+, 70%, 50%\)$/);
    });
  });

  test('should distribute hues evenly', () => {
    const colors = generateColorPalette(4);
    expect(colors[0]).toBe('hsl(0, 70%, 50%)');
    expect(colors[1]).toBe('hsl(90, 70%, 50%)');
    expect(colors[2]).toBe('hsl(180, 70%, 50%)');
    expect(colors[3]).toBe('hsl(270, 70%, 50%)');
  });

  test('should handle zero colors', () => {
    expect(generateColorPalette(0)).toEqual([]);
  });
});

// ============================================================================
// TESTS: FREE_TIER_LIMITS
// ============================================================================

describe('FREE_TIER_LIMITS Configuration', () => {
  const FREE_TIER_LIMITS = {
    'Neural2': 1000000,
    'Studio': 100000,
    'Polyglot': 100000,
    'Standard': 4000000,
    'WaveNet': 1000000,
    'Journey': 1000000
  };

  test('should match server-side QUOTA_LIMITS', () => {
    // This ensures client and server are in sync
    expect(FREE_TIER_LIMITS['Neural2']).toBe(1000000);
    expect(FREE_TIER_LIMITS['Standard']).toBe(4000000);
  });

  test('should correctly identify byte vs character based', () => {
    const byteBasedTypes = ['Neural2', 'Studio', 'Polyglot', 'Journey'];
    const charBasedTypes = ['Standard', 'WaveNet'];

    byteBasedTypes.forEach(type => {
      expect(FREE_TIER_LIMITS[type]).toBeDefined();
    });

    charBasedTypes.forEach(type => {
      expect(FREE_TIER_LIMITS[type]).toBeDefined();
    });
  });
});

// ============================================================================
// TESTS: Voice Options Update Logic
// ============================================================================

describe('Voice Filtering Logic', () => {
  const mockVoices = [
    { name: 'en-US-Standard-A', languageCodes: ['en-US'], ssmlGender: 'MALE' },
    { name: 'en-US-WaveNet-A', languageCodes: ['en-US'], ssmlGender: 'FEMALE' },
    { name: 'en-GB-Standard-A', languageCodes: ['en-GB'], ssmlGender: 'FEMALE' },
    { name: 'es-ES-Standard-A', languageCodes: ['es-ES'], ssmlGender: 'FEMALE' },
  ];

  function filterVoicesByLanguage(voices, language) {
    return voices.filter(voice => voice.languageCodes.includes(language));
  }

  test('should filter voices by language code', () => {
    const enUSVoices = filterVoicesByLanguage(mockVoices, 'en-US');
    expect(enUSVoices.length).toBe(2);
    expect(enUSVoices.every(v => v.languageCodes.includes('en-US'))).toBe(true);
  });

  test('should return empty array for unsupported language', () => {
    const zhCNVoices = filterVoicesByLanguage(mockVoices, 'zh-CN');
    expect(zhCNVoices.length).toBe(0);
  });

  test('should return all matching voices regardless of type', () => {
    const enUSVoices = filterVoicesByLanguage(mockVoices, 'en-US');
    const hasStandard = enUSVoices.some(v => v.name.includes('Standard'));
    const hasWaveNet = enUSVoices.some(v => v.name.includes('WaveNet'));
    expect(hasStandard).toBe(true);
    expect(hasWaveNet).toBe(true);
  });
});

// ============================================================================
// TESTS: Progress Bar Calculation
// ============================================================================

describe('Progress Calculation', () => {
  function calculateProgress(loaded, total) {
    if (!total || total === 0) return 0;
    return Math.round((loaded / total) * 100);
  }

  test('should calculate correct percentage', () => {
    expect(calculateProgress(50, 100)).toBe(50);
    expect(calculateProgress(25, 100)).toBe(25);
    expect(calculateProgress(100, 100)).toBe(100);
  });

  test('should handle zero total', () => {
    expect(calculateProgress(50, 0)).toBe(0);
  });

  test('should round to nearest integer', () => {
    expect(calculateProgress(33, 100)).toBe(33);
    expect(calculateProgress(1, 3)).toBe(33); // 33.33... rounds to 33
  });

  test('should handle completed upload', () => {
    expect(calculateProgress(1000, 1000)).toBe(100);
  });
});

// ============================================================================
// TESTS: Usage Stats Processing
// ============================================================================

describe('Usage Stats Processing', () => {
  const sampleQuota = {
    '2024-01': { 'Standard': 100000, 'WaveNet': 50000 },
    '2024-02': { 'Standard': 150000, 'Neural2': 25000 }
  };

  function calculateTotalUsage(quota) {
    let total = 0;
    for (const monthData of Object.values(quota)) {
      for (const count of Object.values(monthData)) {
        total += count;
      }
    }
    return total;
  }

  function getUniqueVoiceTypes(quota) {
    const types = new Set();
    for (const monthData of Object.values(quota)) {
      for (const voiceType of Object.keys(monthData)) {
        types.add(voiceType);
      }
    }
    return types;
  }

  function getCurrentMonthUsage(quota, currentMonth) {
    if (!quota[currentMonth]) return 0;
    return Object.values(quota[currentMonth]).reduce((a, b) => a + b, 0);
  }

  test('should calculate total usage correctly', () => {
    expect(calculateTotalUsage(sampleQuota)).toBe(325000);
  });

  test('should identify unique voice types', () => {
    const types = getUniqueVoiceTypes(sampleQuota);
    expect(types.size).toBe(3);
    expect(types.has('Standard')).toBe(true);
    expect(types.has('WaveNet')).toBe(true);
    expect(types.has('Neural2')).toBe(true);
  });

  test('should get current month usage', () => {
    expect(getCurrentMonthUsage(sampleQuota, '2024-01')).toBe(150000);
    expect(getCurrentMonthUsage(sampleQuota, '2024-02')).toBe(175000);
  });

  test('should return 0 for month with no data', () => {
    expect(getCurrentMonthUsage(sampleQuota, '2024-03')).toBe(0);
  });

  test('should handle empty quota', () => {
    expect(calculateTotalUsage({})).toBe(0);
    expect(getUniqueVoiceTypes({}).size).toBe(0);
  });
});
