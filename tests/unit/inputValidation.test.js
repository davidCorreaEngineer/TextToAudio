const {
    SUPPORTED_LANGUAGES,
    VOICE_NAME_PATTERN,
    SPEAKING_RATE_MIN,
    SPEAKING_RATE_MAX,
    PITCH_MIN,
    PITCH_MAX,
    validateVoiceParams,
    validateSsml,
    validateTextContent,
    createVoiceParamsValidator,
    createSsmlValidator,
} = require('../../src/validators/inputValidation');

describe('Input Validation', () => {
    describe('Constants', () => {
        it('should have correct supported languages', () => {
            expect(SUPPORTED_LANGUAGES).toContain('en-US');
            expect(SUPPORTED_LANGUAGES).toContain('en-GB');
            expect(SUPPORTED_LANGUAGES).toContain('de-DE');
            expect(SUPPORTED_LANGUAGES).toContain('ja-JP');
            expect(SUPPORTED_LANGUAGES).toHaveLength(13);
        });

        it('should have valid voice name pattern', () => {
            expect(VOICE_NAME_PATTERN.test('en-US-Standard-A')).toBe(true);
            expect(VOICE_NAME_PATTERN.test('de-DE-Neural2-B')).toBe(true);
            expect(VOICE_NAME_PATTERN.test('invalid')).toBe(false);
        });

        it('should have correct rate limits', () => {
            expect(SPEAKING_RATE_MIN).toBe(0.25);
            expect(SPEAKING_RATE_MAX).toBe(4.0);
        });

        it('should have correct pitch limits', () => {
            expect(PITCH_MIN).toBe(-20.0);
            expect(PITCH_MAX).toBe(20.0);
        });
    });

    describe('validateVoiceParams', () => {
        it('should validate correct params', () => {
            const result = validateVoiceParams({
                language: 'en-US',
                voice: 'en-US-Standard-A',
                speakingRate: 1.0,
                pitch: 0.0,
            });

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.sanitized).toEqual({
                language: 'en-US',
                voice: 'en-US-Standard-A',
                speakingRate: 1.0,
                pitch: 0.0,
            });
        });

        it('should reject missing language', () => {
            const result = validateVoiceParams({
                voice: 'en-US-Standard-A',
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Language is required');
        });

        it('should reject unsupported language', () => {
            const result = validateVoiceParams({
                language: 'xx-XX',
                voice: 'en-US-Standard-A',
            });

            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Unsupported language');
        });

        it('should reject missing voice', () => {
            const result = validateVoiceParams({
                language: 'en-US',
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Voice is required');
        });

        it('should reject invalid voice format', () => {
            const result = validateVoiceParams({
                language: 'en-US',
                voice: 'invalid-voice',
            });

            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Invalid voice name format');
        });

        it('should default speaking rate when invalid', () => {
            const result = validateVoiceParams({
                language: 'en-US',
                voice: 'en-US-Standard-A',
                speakingRate: 'invalid',
            });

            expect(result.sanitized.speakingRate).toBe(1.0);
        });

        it('should clamp speaking rate to min', () => {
            const result = validateVoiceParams({
                language: 'en-US',
                voice: 'en-US-Standard-A',
                speakingRate: 0.1,
            });

            expect(result.sanitized.speakingRate).toBe(0.25);
        });

        it('should clamp speaking rate to max', () => {
            const result = validateVoiceParams({
                language: 'en-US',
                voice: 'en-US-Standard-A',
                speakingRate: 10.0,
            });

            expect(result.sanitized.speakingRate).toBe(4.0);
        });

        it('should default pitch when invalid', () => {
            const result = validateVoiceParams({
                language: 'en-US',
                voice: 'en-US-Standard-A',
                pitch: 'invalid',
            });

            expect(result.sanitized.pitch).toBe(0.0);
        });

        it('should clamp pitch to min', () => {
            const result = validateVoiceParams({
                language: 'en-US',
                voice: 'en-US-Standard-A',
                pitch: -30.0,
            });

            expect(result.sanitized.pitch).toBe(-20.0);
        });

        it('should clamp pitch to max', () => {
            const result = validateVoiceParams({
                language: 'en-US',
                voice: 'en-US-Standard-A',
                pitch: 30.0,
            });

            expect(result.sanitized.pitch).toBe(20.0);
        });

        it('should parse string numbers', () => {
            const result = validateVoiceParams({
                language: 'en-US',
                voice: 'en-US-Standard-A',
                speakingRate: '1.5',
                pitch: '-5.0',
            });

            expect(result.sanitized.speakingRate).toBe(1.5);
            expect(result.sanitized.pitch).toBe(-5.0);
        });

        it('should collect multiple errors', () => {
            const result = validateVoiceParams({});

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('validateSsml', () => {
        it('should accept valid SSML', () => {
            const result = validateSsml('<speak>Hello <break time="1s"/> world</speak>');

            expect(result.valid).toBe(true);
            expect(result.error).toBeNull();
        });

        it('should accept plain text', () => {
            const result = validateSsml('Hello world');

            expect(result.valid).toBe(true);
        });

        it('should reject empty text', () => {
            const result = validateSsml('');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Text is required');
        });

        it('should reject null text', () => {
            const result = validateSsml(null);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Text is required');
        });

        it('should reject script tags', () => {
            const result = validateSsml('<script>alert("xss")</script>');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Text contains disallowed content');
        });

        it('should reject javascript: URLs', () => {
            const result = validateSsml('javascript:alert(1)');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Text contains disallowed content');
        });

        it('should reject event handlers', () => {
            const result = validateSsml('<img onerror="alert(1)">');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Text contains disallowed content');
        });

        it('should reject iframes', () => {
            const result = validateSsml('<iframe src="evil.com">');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Text contains disallowed content');
        });

        it('should reject unbalanced speak tags', () => {
            const result = validateSsml('<speak>Hello</speak><speak>World');

            expect(result.valid).toBe(false);
            expect(result.error).toBe('Unbalanced <speak> tags in SSML');
        });

        it('should accept balanced speak tags', () => {
            const result = validateSsml('<speak>Hello</speak><speak>World</speak>');

            expect(result.valid).toBe(true);
        });

        it('should handle case-insensitive dangerous patterns', () => {
            const result = validateSsml('<SCRIPT>evil</SCRIPT>');

            expect(result.valid).toBe(false);
        });

        // Security: Enhanced SSML validation tests
        describe('enhanced SSML security', () => {
            it('should reject CDATA sections', () => {
                const result = validateSsml('<speak><![CDATA[<script>evil</script>]]></speak>');

                expect(result.valid).toBe(false);
                expect(result.error).toBe('Text contains disallowed content');
            });

            it('should reject entity declarations', () => {
                const result = validateSsml('<!ENTITY xxe SYSTEM "file:///etc/passwd">');

                expect(result.valid).toBe(false);
                expect(result.error).toBe('Text contains disallowed content');
            });

            it('should reject DOCTYPE declarations', () => {
                const result = validateSsml('<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>');

                expect(result.valid).toBe(false);
                expect(result.error).toBe('Text contains disallowed content');
            });

            it('should handle case-mismatched speak tags', () => {
                const result = validateSsml('<SPEAK>Hello</speak>');

                expect(result.valid).toBe(false);
                expect(result.error).toContain('tag');
            });

            it('should reject improperly nested speak tags (close before open)', () => {
                const result = validateSsml('</speak><speak>Hello</speak>');

                expect(result.valid).toBe(false);
                expect(result.error).toContain('structure');
            });

            it('should accept properly nested speak tags', () => {
                const result = validateSsml('<speak>Hello</speak>');

                expect(result.valid).toBe(true);
            });

            it('should accept speak with standard attributes', () => {
                const result = validateSsml('<speak version="1.0" xml:lang="en-US">Hello</speak>');

                expect(result.valid).toBe(true);
            });
        });
    });

    describe('validateTextContent', () => {
        it('should accept valid text', () => {
            const result = validateTextContent('Hello world', 5000);

            expect(result.valid).toBe(true);
        });

        it('should reject empty string', () => {
            const result = validateTextContent('', 5000);

            expect(result.valid).toBe(false);
            expect(result.error).toBe('No text provided.');
        });

        it('should reject whitespace only', () => {
            const result = validateTextContent('   ', 5000);

            expect(result.valid).toBe(false);
        });

        it('should reject null', () => {
            const result = validateTextContent(null, 5000);

            expect(result.valid).toBe(false);
        });

        it('should reject text exceeding max length', () => {
            const longText = 'a'.repeat(6000);
            const result = validateTextContent(longText, 5000);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('too long');
            expect(result.error).toContain('6000');
        });

        it('should accept text at exactly max length', () => {
            const text = 'a'.repeat(5000);
            const result = validateTextContent(text, 5000);

            expect(result.valid).toBe(true);
        });
    });

    describe('createVoiceParamsValidator middleware', () => {
        let mockReq, mockRes, mockNext;

        beforeEach(() => {
            mockReq = { body: {} };
            mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            mockNext = jest.fn();
        });

        it('should call next on valid params', () => {
            mockReq.body = {
                language: 'en-US',
                voice: 'en-US-Standard-A',
                speakingRate: 1.0,
                pitch: 0.0,
            };

            const middleware = createVoiceParamsValidator();
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockReq.validatedParams).toBeDefined();
            expect(mockReq.validatedParams.language).toBe('en-US');
        });

        it('should return 400 on invalid params', () => {
            mockReq.body = {};

            const middleware = createVoiceParamsValidator();
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
            }));
            expect(mockNext).not.toHaveBeenCalled();
        });
    });

    describe('createSsmlValidator middleware', () => {
        let mockReq, mockRes, mockNext;

        beforeEach(() => {
            mockReq = { body: {} };
            mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };
            mockNext = jest.fn();
        });

        it('should call next when SSML is disabled', () => {
            mockReq.body = {
                textContent: '<script>evil</script>',
                useSsml: false,
            };

            const middleware = createSsmlValidator();
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should validate when SSML is enabled', () => {
            mockReq.body = {
                textContent: '<script>evil</script>',
                useSsml: 'true',
            };

            const middleware = createSsmlValidator();
            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should accept valid SSML', () => {
            mockReq.body = {
                textContent: '<speak>Hello</speak>',
                useSsml: true,
            };

            const middleware = createSsmlValidator();
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should use custom field name', () => {
            mockReq.body = {
                customField: '<speak>Hello</speak>',
                useSsml: true,
            };

            const middleware = createSsmlValidator('customField');
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });
});
