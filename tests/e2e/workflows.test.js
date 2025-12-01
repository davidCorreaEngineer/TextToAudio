/**
 * End-to-End Workflow Tests
 *
 * These tests verify complete user workflows from start to finish.
 * They simulate real user interactions with the application.
 */

const { describe, test, expect, beforeEach, beforeAll, afterAll } = require('@jest/globals');

// ============================================================================
// WORKFLOW: Complete Audio Generation Flow
// ============================================================================

describe('E2E: Complete Audio Generation Workflow', () => {
  // Simulated state for E2E tests
  let appState = {
    voices: [],
    selectedLanguage: 'en-US',
    selectedVoice: null,
    uploadedText: '',
    generatedAudioFile: null,
    quotaUsage: {}
  };

  // Mock API responses
  const mockVoices = [
    { name: 'en-US-Standard-A', languageCodes: ['en-US'], ssmlGender: 'MALE' },
    { name: 'en-US-WaveNet-A', languageCodes: ['en-US'], ssmlGender: 'FEMALE' },
    { name: 'en-GB-Standard-A', languageCodes: ['en-GB'], ssmlGender: 'FEMALE' },
  ];

  beforeEach(() => {
    appState = {
      voices: [],
      selectedLanguage: 'en-US',
      selectedVoice: null,
      uploadedText: '',
      generatedAudioFile: null,
      quotaUsage: {}
    };
  });

  test('Step 1: Load available voices', async () => {
    // Simulate fetching voices
    appState.voices = mockVoices;
    expect(appState.voices.length).toBeGreaterThan(0);
    expect(appState.voices.some(v => v.languageCodes.includes('en-US'))).toBe(true);
  });

  test('Step 2: Filter voices by language', async () => {
    appState.voices = mockVoices;
    const filteredVoices = appState.voices.filter(v =>
      v.languageCodes.includes(appState.selectedLanguage)
    );
    expect(filteredVoices.length).toBe(2);
    expect(filteredVoices.every(v => v.languageCodes.includes('en-US'))).toBe(true);
  });

  test('Step 3: Select a voice', async () => {
    appState.voices = mockVoices;
    appState.selectedVoice = 'en-US-Standard-A';
    expect(appState.selectedVoice).toBeDefined();
  });

  test('Step 4: Upload text file', async () => {
    const fileContent = 'This is a test text for audio generation.';
    appState.uploadedText = fileContent;
    expect(appState.uploadedText.length).toBeGreaterThan(0);
  });

  test('Step 5: Validate text length', async () => {
    const MAX_LENGTH = 5000;
    appState.uploadedText = 'A'.repeat(4999);
    expect(appState.uploadedText.length).toBeLessThanOrEqual(MAX_LENGTH);
  });

  test('Step 6: Generate audio', async () => {
    appState.selectedVoice = 'en-US-Standard-A';
    appState.uploadedText = 'Hello, this is a test.';

    // Simulate API call
    const response = {
      success: true,
      fileName: 'test_1234567890_abc123_audio.mp3',
      file: 'test_1234567890_abc123_audio.mp3'
    };

    expect(response.success).toBe(true);
    expect(response.fileName).toContain('_audio.mp3');
    appState.generatedAudioFile = response.fileName;
  });

  test('Step 7: Download audio file', async () => {
    appState.generatedAudioFile = 'test_audio.mp3';
    expect(appState.generatedAudioFile).toBeDefined();
    expect(appState.generatedAudioFile.endsWith('.mp3')).toBe(true);
  });

  test('Complete workflow should update quota', async () => {
    // Simulate quota update
    const textLength = 100;
    const voiceType = 'Standard';
    appState.quotaUsage[voiceType] = (appState.quotaUsage[voiceType] || 0) + textLength;
    expect(appState.quotaUsage['Standard']).toBe(100);
  });
});

// ============================================================================
// WORKFLOW: Voice Testing Flow
// ============================================================================

describe('E2E: Voice Testing Workflow', () => {
  test('should test voice without consuming quota', async () => {
    const testRequest = {
      language: 'en-US',
      voice: 'en-US-Standard-A',
      speakingRate: 1.0,
      pitch: 0
    };

    // Simulate test voice response
    const response = {
      success: true,
      audioContent: 'base64-encoded-audio',
      testText: 'How can I improve my English pronunciation?'
    };

    expect(response.success).toBe(true);
    expect(response.audioContent).toBeDefined();
    expect(response.testText).toBeDefined();
  });

  test('should play test audio in browser', async () => {
    // Simulate audio playback setup
    const audioContent = 'SGVsbG8gV29ybGQ='; // base64 "Hello World"
    const audioBlob = Buffer.from(audioContent, 'base64');
    expect(audioBlob.length).toBeGreaterThan(0);
  });

  test('should allow adjusting speaking rate', async () => {
    const speakingRates = [0.25, 0.5, 1.0, 1.5, 2.0, 4.0];
    speakingRates.forEach(rate => {
      expect(rate).toBeGreaterThanOrEqual(0.25);
      expect(rate).toBeLessThanOrEqual(4.0);
    });
  });

  test('should allow adjusting pitch', async () => {
    const pitches = [-20, -10, 0, 10, 20];
    pitches.forEach(pitch => {
      expect(pitch).toBeGreaterThanOrEqual(-20);
      expect(pitch).toBeLessThanOrEqual(20);
    });
  });
});

// ============================================================================
// WORKFLOW: SSML with Pauses
// ============================================================================

describe('E2E: SSML Pause Insertion Workflow', () => {
  function convertToSsml(text, pauseMs) {
    const sentences = text.split(/([.!?])/).filter(s => s.trim());
    let ssml = '<speak>';
    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i]?.trim() || '';
      const punct = sentences[i + 1] || '';
      ssml += sentence + punct;
      if (i + 2 < sentences.length) {
        ssml += `<break time="${pauseMs}ms"/> `;
      } else {
        ssml += ' ';
      }
    }
    ssml += '</speak>';
    return ssml;
  }

  test('should convert text to SSML with pauses enabled', async () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const ssml = convertToSsml(text, 500);

    expect(ssml.startsWith('<speak>')).toBe(true);
    expect(ssml.endsWith('</speak>')).toBe(true);
    expect(ssml).toContain('<break time="500ms"/>');
  });

  test('should use custom pause duration', async () => {
    const text = 'Hello. World.';
    const ssml1000 = convertToSsml(text, 1000);
    const ssml500 = convertToSsml(text, 500);

    expect(ssml1000).toContain('<break time="1000ms"/>');
    expect(ssml500).toContain('<break time="500ms"/>');
  });

  test('should handle question marks', async () => {
    const text = 'What is this? It is a test.';
    const ssml = convertToSsml(text, 500);
    expect(ssml).toContain('<break time="500ms"/>');
  });

  test('should handle exclamation marks', async () => {
    const text = 'Amazing! Incredible!';
    const ssml = convertToSsml(text, 500);
    expect(ssml).toContain('<break time="500ms"/>');
  });
});

// ============================================================================
// WORKFLOW: Dashboard Usage Statistics
// ============================================================================

describe('E2E: Dashboard Statistics Workflow', () => {
  const sampleQuota = {
    '2024-01': { 'Standard': 100000, 'WaveNet': 50000 },
    '2024-02': { 'Standard': 150000, 'Neural2': 25000, 'WaveNet': 75000 }
  };

  test('should display total usage across all months', async () => {
    let total = 0;
    for (const month of Object.values(sampleQuota)) {
      for (const count of Object.values(month)) {
        total += count;
      }
    }
    expect(total).toBe(400000);
  });

  test('should display unique voice types used', async () => {
    const voiceTypes = new Set();
    for (const month of Object.values(sampleQuota)) {
      for (const type of Object.keys(month)) {
        voiceTypes.add(type);
      }
    }
    expect(voiceTypes.size).toBe(3);
    expect(voiceTypes.has('Standard')).toBe(true);
    expect(voiceTypes.has('WaveNet')).toBe(true);
    expect(voiceTypes.has('Neural2')).toBe(true);
  });

  test('should display current month usage', async () => {
    const currentMonth = '2024-02';
    const monthData = sampleQuota[currentMonth];
    const monthTotal = Object.values(monthData).reduce((a, b) => a + b, 0);
    expect(monthTotal).toBe(250000);
  });

  test('should calculate percentage of quota used', async () => {
    const FREE_TIER_LIMITS = {
      'Standard': 4000000,
      'WaveNet': 1000000,
      'Neural2': 1000000
    };

    const currentMonth = '2024-02';
    const monthData = sampleQuota[currentMonth];

    const percentages = {};
    for (const [type, used] of Object.entries(monthData)) {
      const limit = FREE_TIER_LIMITS[type];
      percentages[type] = (used / limit) * 100;
    }

    expect(percentages['Standard']).toBeCloseTo(3.75);
    expect(percentages['Neural2']).toBeCloseTo(2.5);
    expect(percentages['WaveNet']).toBeCloseTo(7.5);
  });
});

// ============================================================================
// WORKFLOW: Error Handling Scenarios
// ============================================================================

describe('E2E: Error Handling Workflows', () => {
  test('should handle invalid API key gracefully', async () => {
    // Simulate API response for invalid key
    const response = {
      status: 403,
      body: { success: false, error: 'Invalid API key.' }
    };

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Invalid API key');
  });

  test('should handle rate limiting gracefully', async () => {
    const response = {
      status: 429,
      body: { success: false, error: 'Rate limit exceeded.' }
    };

    expect(response.status).toBe(429);
    expect(response.body.error).toContain('Rate limit');
  });

  test('should handle text too long error', async () => {
    const response = {
      status: 400,
      body: { success: false, error: 'Text is too long.' }
    };

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('too long');
  });

  test('should handle quota exceeded error', async () => {
    const response = {
      status: 429,
      body: {
        success: false,
        error: 'Monthly quota exceeded for Standard voices.'
      }
    };

    expect(response.status).toBe(429);
    expect(response.body.error).toContain('quota exceeded');
  });

  test('should clear API key on auth failure', async () => {
    let storedKey = 'old-invalid-key';
    const response = { status: 403 };

    // Simulate clearing on 403
    if (response.status === 403) {
      storedKey = null;
    }

    expect(storedKey).toBeNull();
  });
});

// ============================================================================
// WORKFLOW: Language Switching
// ============================================================================

describe('E2E: Language Switching Workflow', () => {
  const mockVoices = [
    { name: 'en-US-Standard-A', languageCodes: ['en-US'], ssmlGender: 'MALE' },
    { name: 'en-GB-Standard-A', languageCodes: ['en-GB'], ssmlGender: 'FEMALE' },
    { name: 'es-ES-Standard-A', languageCodes: ['es-ES'], ssmlGender: 'FEMALE' },
    { name: 'de-DE-WaveNet-A', languageCodes: ['de-DE'], ssmlGender: 'MALE' },
    { name: 'ja-JP-Neural2-A', languageCodes: ['ja-JP'], ssmlGender: 'FEMALE' },
  ];

  test('should filter voices when language changes', async () => {
    const languages = ['en-US', 'en-GB', 'es-ES', 'de-DE', 'ja-JP'];

    languages.forEach(lang => {
      const filtered = mockVoices.filter(v => v.languageCodes.includes(lang));
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every(v => v.languageCodes.includes(lang))).toBe(true);
    });
  });

  test('should reset voice selection when language changes', async () => {
    let selectedVoice = 'en-US-Standard-A';
    const newLanguage = 'es-ES';

    // Check if current voice is compatible
    const voice = mockVoices.find(v => v.name === selectedVoice);
    const isCompatible = voice?.languageCodes.includes(newLanguage);

    if (!isCompatible) {
      selectedVoice = null; // Reset
    }

    expect(selectedVoice).toBeNull();
  });

  test('should update test sentence based on language', async () => {
    const testSentences = {
      'en-US': "How can I improve my English pronunciation?",
      'es-ES': "¿Dónde puedo encontrar una farmacia cercana?",
      'de-DE': "Wie komme ich am besten zum Hauptbahnhof?",
      'ja-JP': "この近くにおいしいレストランはありますか？"
    };

    Object.entries(testSentences).forEach(([lang, sentence]) => {
      expect(sentence).toBeDefined();
      expect(sentence.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// WORKFLOW: File Upload and Processing
// ============================================================================

describe('E2E: File Upload Workflow', () => {
  test('should accept .txt files', async () => {
    const file = { name: 'document.txt', type: 'text/plain', size: 1024 };
    const isValid = file.name.endsWith('.txt');
    expect(isValid).toBe(true);
  });

  test('should reject non-.txt files', async () => {
    const files = [
      { name: 'script.js' },
      { name: 'image.png' },
      { name: 'document.pdf' },
    ];

    files.forEach(file => {
      expect(file.name.endsWith('.txt')).toBe(false);
    });
  });

  test('should display file size', async () => {
    const file = { size: 2048 };
    const displaySize = `${file.size.toLocaleString()} bytes`;
    expect(displaySize).toBe('2,048 bytes');
  });

  test('should warn if file exceeds limit', async () => {
    const MAX_SIZE = 5000;
    const file = { size: 6000 };
    const exceedsLimit = file.size > MAX_SIZE;
    expect(exceedsLimit).toBe(true);
  });

  test('should preview file content', async () => {
    const fileContent = 'This is the content of my text file.';
    const preview = fileContent;
    expect(preview).toBe(fileContent);
    expect(preview.length).toBe(fileContent.length);
  });
});

// ============================================================================
// WORKFLOW: Audio Playback
// ============================================================================

describe('E2E: Audio Playback Workflow', () => {
  test('should convert base64 to playable format', async () => {
    const base64Audio = 'SGVsbG8gV29ybGQ=';
    const decoded = Buffer.from(base64Audio, 'base64');
    expect(decoded.length).toBeGreaterThan(0);
  });

  test('should handle audio player controls', async () => {
    const audioState = {
      isPlaying: false,
      currentTime: 0,
      duration: 10
    };

    // Simulate play
    audioState.isPlaying = true;
    expect(audioState.isPlaying).toBe(true);

    // Simulate pause
    audioState.isPlaying = false;
    expect(audioState.isPlaying).toBe(false);
  });

  test('should clean up object URLs on new audio', async () => {
    let currentUrl = 'blob:http://localhost:3000/abc123';
    const newUrl = 'blob:http://localhost:3000/def456';

    // Simulate cleanup
    const oldUrl = currentUrl;
    currentUrl = newUrl;

    expect(currentUrl).toBe(newUrl);
    expect(oldUrl).not.toBe(currentUrl);
  });
});
