/**
 * Mock for @google-cloud/text-to-speech
 *
 * This mock simulates the Google Cloud TTS API responses
 * without making actual API calls.
 */

// Sample voice data matching Google's format
const mockVoices = [
  {
    name: 'en-US-Standard-A',
    languageCodes: ['en-US'],
    ssmlGender: 'MALE',
    naturalSampleRateHertz: 24000
  },
  {
    name: 'en-US-Standard-B',
    languageCodes: ['en-US'],
    ssmlGender: 'FEMALE',
    naturalSampleRateHertz: 24000
  },
  {
    name: 'en-US-WaveNet-A',
    languageCodes: ['en-US'],
    ssmlGender: 'MALE',
    naturalSampleRateHertz: 24000
  },
  {
    name: 'en-US-Neural2-A',
    languageCodes: ['en-US'],
    ssmlGender: 'MALE',
    naturalSampleRateHertz: 24000
  },
  {
    name: 'en-GB-Standard-A',
    languageCodes: ['en-GB'],
    ssmlGender: 'FEMALE',
    naturalSampleRateHertz: 24000
  },
  {
    name: 'es-ES-Standard-A',
    languageCodes: ['es-ES'],
    ssmlGender: 'FEMALE',
    naturalSampleRateHertz: 24000
  },
  {
    name: 'de-DE-WaveNet-A',
    languageCodes: ['de-DE'],
    ssmlGender: 'FEMALE',
    naturalSampleRateHertz: 24000
  },
  {
    name: 'ja-JP-Neural2-B',
    languageCodes: ['ja-JP'],
    ssmlGender: 'FEMALE',
    naturalSampleRateHertz: 24000
  },
  {
    name: 'fr-FR-Standard-A',
    languageCodes: ['fr-FR'],
    ssmlGender: 'FEMALE',
    naturalSampleRateHertz: 24000
  },
  // Unsupported language (should be filtered out)
  {
    name: 'zh-CN-Standard-A',
    languageCodes: ['zh-CN'],
    ssmlGender: 'FEMALE',
    naturalSampleRateHertz: 24000
  }
];

// Generate fake MP3 audio content (a simple buffer)
const generateMockAudioContent = () => {
  // This is a minimal valid MP3 header + some data
  // In real tests, you could use a small actual MP3 file
  return Buffer.from('mock-audio-content-mp3-data');
};

// Mock TextToSpeechClient class
class MockTextToSpeechClient {
  constructor(options = {}) {
    this.options = options;
    this.synthesizeSpeechCalls = [];
    this.listVoicesCalls = [];
  }

  async listVoices(request = {}) {
    this.listVoicesCalls.push(request);
    return [{ voices: mockVoices }];
  }

  async synthesizeSpeech(request) {
    this.synthesizeSpeechCalls.push(request);

    // Simulate API errors for specific test cases
    if (request.input?.text === 'TRIGGER_ERROR') {
      throw new Error('INVALID_ARGUMENT: Invalid request');
    }

    if (request.input?.text === 'TRIGGER_PERMISSION_ERROR') {
      throw new Error('PERMISSION_DENIED: Access denied');
    }

    if (request.input?.text === 'TRIGGER_QUOTA_ERROR') {
      throw new Error('RESOURCE_EXHAUSTED: Quota exceeded');
    }

    // Return successful response
    return [{
      audioContent: generateMockAudioContent()
    }];
  }

  // Helper method to get call history (useful for assertions)
  getSynthesizeCalls() {
    return this.synthesizeSpeechCalls;
  }

  getListVoicesCalls() {
    return this.listVoicesCalls;
  }

  // Reset call history
  resetCalls() {
    this.synthesizeSpeechCalls = [];
    this.listVoicesCalls = [];
  }
}

// Factory function to create mock client
const createMockClient = (options) => new MockTextToSpeechClient(options);

// Export for use in tests
module.exports = {
  TextToSpeechClient: MockTextToSpeechClient,
  createMockClient,
  mockVoices,
  generateMockAudioContent
};
