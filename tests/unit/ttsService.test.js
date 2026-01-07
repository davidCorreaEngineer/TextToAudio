const {
    createTtsClient,
    buildSynthesisRequest,
    generateSpeech,
    listVoices
} = require('../../src/services/ttsService');

describe('TTS Service', () => {
    describe('createTtsClient', () => {
        it('should create TTS client with keyfile path', () => {
            const client = createTtsClient('/path/to/keyfile.json');
            expect(client).toBeDefined();
            expect(client.synthesizeSpeech).toBeDefined();
            expect(client.listVoices).toBeDefined();
        });
    });

    describe('buildSynthesisRequest', () => {
        it('should build request with plain text', () => {
            const params = {
                text: 'Hello world',
                languageCode: 'en-US',
                voiceName: 'en-US-Standard-A',
                speakingRate: 1.0,
                pitch: 0.0,
                useSsml: false
            };

            const request = buildSynthesisRequest(params);

            expect(request).toEqual({
                input: { text: 'Hello world' },
                voice: { languageCode: 'en-US', name: 'en-US-Standard-A' },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: 1.0,
                    pitch: 0.0
                }
            });
        });

        it('should build request with SSML', () => {
            const params = {
                text: '<speak>Hello <break time="1s"/> world</speak>',
                languageCode: 'en-US',
                voiceName: 'en-US-Neural2-A',
                speakingRate: 1.2,
                pitch: 2.0,
                useSsml: true
            };

            const request = buildSynthesisRequest(params);

            expect(request).toEqual({
                input: { ssml: '<speak>Hello <break time="1s"/> world</speak>' },
                voice: { languageCode: 'en-US', name: 'en-US-Neural2-A' },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: 1.2,
                    pitch: 2.0
                }
            });
        });

        it('should use default values for speakingRate and pitch', () => {
            const params = {
                text: 'Test',
                languageCode: 'en-US',
                voiceName: 'en-US-Standard-A'
            };

            const request = buildSynthesisRequest(params);

            expect(request.audioConfig.speakingRate).toBe(1.0);
            expect(request.audioConfig.pitch).toBe(0.0);
        });

        it('should parse string numbers to float', () => {
            const params = {
                text: 'Test',
                languageCode: 'en-US',
                voiceName: 'en-US-Standard-A',
                speakingRate: '1.5',
                pitch: '-2.0'
            };

            const request = buildSynthesisRequest(params);

            expect(request.audioConfig.speakingRate).toBe(1.5);
            expect(request.audioConfig.pitch).toBe(-2.0);
        });
    });

    describe('generateSpeech', () => {
        it('should generate speech and return audio buffer', async () => {
            const mockAudioContent = Buffer.from('fake-audio-data');
            const mockClient = {
                synthesizeSpeech: jest.fn().mockResolvedValue([{ audioContent: mockAudioContent }])
            };

            const params = {
                text: 'Test speech',
                languageCode: 'en-US',
                voiceName: 'en-US-Standard-A'
            };

            const result = await generateSpeech(mockClient, params);

            expect(mockClient.synthesizeSpeech).toHaveBeenCalledWith({
                input: { text: 'Test speech' },
                voice: { languageCode: 'en-US', name: 'en-US-Standard-A' },
                audioConfig: {
                    audioEncoding: 'MP3',
                    speakingRate: 1.0,
                    pitch: 0.0
                }
            });
            expect(result).toEqual(mockAudioContent);
        });

        it('should throw error on API failure', async () => {
            const mockClient = {
                synthesizeSpeech: jest.fn().mockRejectedValue(new Error('API Error'))
            };

            const params = {
                text: 'Test',
                languageCode: 'en-US',
                voiceName: 'en-US-Standard-A'
            };

            await expect(generateSpeech(mockClient, params)).rejects.toThrow('API Error');
        });

        it('should handle empty text', async () => {
            const mockClient = {
                synthesizeSpeech: jest.fn().mockResolvedValue([{ audioContent: Buffer.from('') }])
            };

            const params = {
                text: '',
                languageCode: 'en-US',
                voiceName: 'en-US-Standard-A'
            };

            const result = await generateSpeech(mockClient, params);
            expect(result).toEqual(Buffer.from(''));
        });

        it('should timeout after 30 seconds', async () => {
            jest.useFakeTimers();

            const mockClient = {
                synthesizeSpeech: jest.fn().mockImplementation(() =>
                    new Promise(() => {}) // Never resolves
                )
            };

            const params = {
                text: 'Test',
                languageCode: 'en-US',
                voiceName: 'en-US-Standard-A'
            };

            const promise = generateSpeech(mockClient, params);

            jest.advanceTimersByTime(30000);

            await expect(promise).rejects.toThrow('Speech synthesis timed out after 30000ms');

            jest.useRealTimers();
        });

        it('should retry on 429 quota exceeded error', async () => {
            jest.useFakeTimers();
            const mockAudioContent = Buffer.from('success-audio');
            const quotaError = new Error('Quota exceeded');
            quotaError.code = 429;

            const mockClient = {
                synthesizeSpeech: jest.fn()
                    .mockRejectedValueOnce(quotaError)
                    .mockResolvedValueOnce([{ audioContent: mockAudioContent }])
            };

            const params = {
                text: 'Test',
                languageCode: 'en-US',
                voiceName: 'en-US-Standard-A'
            };

            const promise = generateSpeech(mockClient, params);

            // First attempt fails, wait for retry delay (1000ms)
            await jest.advanceTimersByTimeAsync(1000);

            const result = await promise;

            expect(mockClient.synthesizeSpeech).toHaveBeenCalledTimes(2);
            expect(result).toEqual(mockAudioContent);

            jest.useRealTimers();
        });

        it('should retry on 503 service unavailable error', async () => {
            jest.useFakeTimers();
            const mockAudioContent = Buffer.from('success-audio');
            const serviceError = new Error('Service unavailable');
            serviceError.code = 503;

            const mockClient = {
                synthesizeSpeech: jest.fn()
                    .mockRejectedValueOnce(serviceError)
                    .mockResolvedValueOnce([{ audioContent: mockAudioContent }])
            };

            const params = {
                text: 'Test',
                languageCode: 'en-US',
                voiceName: 'en-US-Standard-A'
            };

            const promise = generateSpeech(mockClient, params);
            await jest.advanceTimersByTimeAsync(1000);

            const result = await promise;

            expect(mockClient.synthesizeSpeech).toHaveBeenCalledTimes(2);
            expect(result).toEqual(mockAudioContent);

            jest.useRealTimers();
        });

        it('should retry on RESOURCE_EXHAUSTED error', async () => {
            jest.useFakeTimers();
            const mockAudioContent = Buffer.from('success-audio');
            const resourceError = new Error('RESOURCE_EXHAUSTED: quota limit');

            const mockClient = {
                synthesizeSpeech: jest.fn()
                    .mockRejectedValueOnce(resourceError)
                    .mockResolvedValueOnce([{ audioContent: mockAudioContent }])
            };

            const params = {
                text: 'Test',
                languageCode: 'en-US',
                voiceName: 'en-US-Standard-A'
            };

            const promise = generateSpeech(mockClient, params);
            await jest.advanceTimersByTimeAsync(1000);

            const result = await promise;

            expect(mockClient.synthesizeSpeech).toHaveBeenCalledTimes(2);
            expect(result).toEqual(mockAudioContent);

            jest.useRealTimers();
        });

        it('should not retry on non-retryable errors', async () => {
            const authError = new Error('Invalid credentials');
            authError.code = 401;

            const mockClient = {
                synthesizeSpeech: jest.fn().mockRejectedValue(authError)
            };

            const params = {
                text: 'Test',
                languageCode: 'en-US',
                voiceName: 'en-US-Standard-A'
            };

            await expect(generateSpeech(mockClient, params)).rejects.toThrow('Invalid credentials');
            expect(mockClient.synthesizeSpeech).toHaveBeenCalledTimes(1);
        });

        it('should fail after max retries exceeded', async () => {
            jest.useFakeTimers();
            const quotaError = new Error('Quota exceeded');
            quotaError.code = 429;

            const mockClient = {
                synthesizeSpeech: jest.fn().mockRejectedValue(quotaError)
            };

            const params = {
                text: 'Test',
                languageCode: 'en-US',
                voiceName: 'en-US-Standard-A'
            };

            let caughtError;
            const promise = generateSpeech(mockClient, params).catch(err => {
                caughtError = err;
            });

            // Advance through all retry delays: 1s, 2s, 4s (total 7s)
            await jest.advanceTimersByTimeAsync(7000);
            await promise;

            expect(caughtError).toBeDefined();
            expect(caughtError.message).toBe('Quota exceeded');
            // Initial attempt + 3 retries = 4 calls
            expect(mockClient.synthesizeSpeech).toHaveBeenCalledTimes(4);

            jest.useRealTimers();
        });

        it('should use exponential backoff delays', async () => {
            jest.useFakeTimers();
            const mockAudioContent = Buffer.from('success');
            const quotaError = new Error('Quota exceeded');
            quotaError.code = 429;

            const mockClient = {
                synthesizeSpeech: jest.fn()
                    .mockRejectedValueOnce(quotaError)
                    .mockRejectedValueOnce(quotaError)
                    .mockRejectedValueOnce(quotaError)
                    .mockResolvedValueOnce([{ audioContent: mockAudioContent }])
            };

            const params = {
                text: 'Test',
                languageCode: 'en-US',
                voiceName: 'en-US-Standard-A'
            };

            const promise = generateSpeech(mockClient, params);

            // First retry after 1s
            expect(mockClient.synthesizeSpeech).toHaveBeenCalledTimes(1);
            await jest.advanceTimersByTimeAsync(1000);
            expect(mockClient.synthesizeSpeech).toHaveBeenCalledTimes(2);

            // Second retry after 2s
            await jest.advanceTimersByTimeAsync(2000);
            expect(mockClient.synthesizeSpeech).toHaveBeenCalledTimes(3);

            // Third retry after 4s
            await jest.advanceTimersByTimeAsync(4000);
            expect(mockClient.synthesizeSpeech).toHaveBeenCalledTimes(4);

            const result = await promise;
            expect(result).toEqual(mockAudioContent);

            jest.useRealTimers();
        });
    });

    describe('listVoices', () => {
        const mockVoices = [
            { name: 'en-US-Standard-A', languageCodes: ['en-US'], ssmlGender: 'FEMALE' },
            { name: 'en-GB-Standard-B', languageCodes: ['en-GB'], ssmlGender: 'MALE' },
            { name: 'es-ES-Standard-A', languageCodes: ['es-ES'], ssmlGender: 'FEMALE' },
            { name: 'de-DE-Standard-A', languageCodes: ['de-DE'], ssmlGender: 'MALE' }
        ];

        it('should list all voices when no filter provided', async () => {
            const mockClient = {
                listVoices: jest.fn().mockResolvedValue([{ voices: mockVoices }])
            };

            const result = await listVoices(mockClient);

            expect(mockClient.listVoices).toHaveBeenCalledWith({});
            expect(result).toEqual(mockVoices);
            expect(result).toHaveLength(4);
        });

        it('should filter voices by language codes', async () => {
            const mockClient = {
                listVoices: jest.fn().mockResolvedValue([{ voices: mockVoices }])
            };

            const result = await listVoices(mockClient, ['en-US', 'en-GB']);

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('en-US-Standard-A');
            expect(result[1].name).toBe('en-GB-Standard-B');
        });

        it('should return empty array when no voices match filter', async () => {
            const mockClient = {
                listVoices: jest.fn().mockResolvedValue([{ voices: mockVoices }])
            };

            const result = await listVoices(mockClient, ['fr-FR']);

            expect(result).toEqual([]);
        });

        it('should handle empty language codes filter', async () => {
            const mockClient = {
                listVoices: jest.fn().mockResolvedValue([{ voices: mockVoices }])
            };

            const result = await listVoices(mockClient, []);

            expect(result).toEqual(mockVoices);
        });

        it('should throw error on API failure', async () => {
            const mockClient = {
                listVoices: jest.fn().mockRejectedValue(new Error('API Error'))
            };

            await expect(listVoices(mockClient)).rejects.toThrow('API Error');
        });
    });
});
