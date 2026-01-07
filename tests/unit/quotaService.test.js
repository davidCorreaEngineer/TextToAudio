const fs = require('fs').promises;
const path = require('path');
const {
    getCurrentYearMonth,
    calculateQuotaCount,
    updateQuota,
    checkQuotaAllows,
    getQuotaData,
    formatQuotaExceededError,
} = require('../../src/services/quotaService');

// Mock fs module
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
    }
}));

describe('Quota Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getCurrentYearMonth', () => {
        it('should return current year-month in YYYY-MM format', () => {
            const result = getCurrentYearMonth();
            expect(result).toMatch(/^\d{4}-\d{2}$/);
        });

        it('should pad single-digit months with zero', () => {
            const originalDate = global.Date;
            // Mock January (month 0)
            global.Date = class extends originalDate {
                constructor() { super(); }
                getFullYear() { return 2026; }
                getMonth() { return 0; }
            };

            const result = getCurrentYearMonth();
            expect(result).toBe('2026-01');

            global.Date = originalDate;
        });

        it('should handle December correctly', () => {
            const originalDate = global.Date;
            global.Date = class extends originalDate {
                constructor() { super(); }
                getFullYear() { return 2026; }
                getMonth() { return 11; }
            };

            const result = getCurrentYearMonth();
            expect(result).toBe('2026-12');

            global.Date = originalDate;
        });
    });

    describe('calculateQuotaCount', () => {
        it('should count bytes for Neural2 voices', () => {
            const text = 'Hello world';
            const result = calculateQuotaCount(text, 'en-US-Neural2-A', false);

            expect(result.voiceCategory).toBe('Neural2');
            expect(result.unit).toBe('bytes');
            expect(result.count).toBe(Buffer.byteLength(text, 'utf8'));
        });

        it('should count bytes for Studio voices', () => {
            const text = 'Test';
            const result = calculateQuotaCount(text, 'en-US-Studio-O', false);

            expect(result.voiceCategory).toBe('Studio');
            expect(result.unit).toBe('bytes');
        });

        it('should count bytes for Journey voices', () => {
            const text = 'Test';
            const result = calculateQuotaCount(text, 'en-US-Journey-D', false);

            expect(result.voiceCategory).toBe('Journey');
            expect(result.unit).toBe('bytes');
        });

        it('should count bytes for Polyglot voices', () => {
            const text = 'Test';
            const result = calculateQuotaCount(text, 'en-US-Polyglot-1', false);

            expect(result.voiceCategory).toBe('Polyglot');
            expect(result.unit).toBe('bytes');
        });

        it('should count characters for Standard voices', () => {
            const text = 'Hello world';
            const result = calculateQuotaCount(text, 'en-US-Standard-A', false);

            expect(result.voiceCategory).toBe('Standard');
            expect(result.unit).toBe('characters');
            expect(result.count).toBe(11);
        });

        it('should count characters for WaveNet voices', () => {
            const text = 'Test message';
            const result = calculateQuotaCount(text, 'en-US-Wavenet-A', false);

            expect(result.voiceCategory).toBe('WaveNet');
            expect(result.unit).toBe('characters');
            expect(result.count).toBe(12);
        });

        it('should strip SSML tags for character count', () => {
            const ssmlText = '<speak>Hello <break time="1s"/> world</speak>';
            const result = calculateQuotaCount(ssmlText, 'en-US-Standard-A', true);

            expect(result.count).toBe(12); // "Hello  world" without tags
        });

        it('should strip SSML tags then count bytes for byte-based voices', () => {
            const ssmlText = '<speak>Hello</speak>';
            const result = calculateQuotaCount(ssmlText, 'en-US-Neural2-A', true);

            expect(result.unit).toBe('bytes');
            expect(result.count).toBe(Buffer.byteLength('Hello', 'utf8'));
        });

        it('should handle Unicode characters correctly for byte count', () => {
            const unicodeText = '\u{1F600}'; // 4-byte emoji (grinning face)
            const result = calculateQuotaCount(unicodeText, 'en-US-Neural2-A', false);

            expect(result.count).toBe(4);
        });

        it('should handle Unicode characters correctly for character count', () => {
            const unicodeText = '\u{1F600}'; // 1 emoji character
            const result = calculateQuotaCount(unicodeText, 'en-US-Standard-A', false);

            // Emoji is 1 "character" when counted as string length but may vary based on implementation
            expect(result.count).toBe(unicodeText.length);
        });
    });

    describe('checkQuotaAllows', () => {
        const testQuotaFile = '/test/quota.json';

        it('should allow when no quota file exists', async () => {
            fs.readFile.mockRejectedValue(new Error('ENOENT'));

            const result = await checkQuotaAllows('Standard', 1000, testQuotaFile);

            expect(result.allowed).toBe(true);
            expect(result.currentUsage).toBe(0);
        });

        it('should allow when quota file is empty', async () => {
            fs.readFile.mockResolvedValue('{}');

            const result = await checkQuotaAllows('Standard', 1000, testQuotaFile);

            expect(result.allowed).toBe(true);
        });

        it('should allow when within quota limit', async () => {
            const yearMonth = getCurrentYearMonth();
            fs.readFile.mockResolvedValue(JSON.stringify({
                [yearMonth]: { 'Standard': 1000000 }
            }));

            const result = await checkQuotaAllows('Standard', 100000, testQuotaFile);

            expect(result.allowed).toBe(true);
            expect(result.currentUsage).toBe(1000000);
            expect(result.limit).toBe(4000000);
        });

        it('should deny when quota exceeded', async () => {
            const yearMonth = getCurrentYearMonth();
            fs.readFile.mockResolvedValue(JSON.stringify({
                [yearMonth]: { 'Standard': 3900000 }
            }));

            const result = await checkQuotaAllows('Standard', 200000, testQuotaFile);

            expect(result.allowed).toBe(false);
            expect(result.currentUsage).toBe(3900000);
            expect(result.remaining).toBe(100000);
            expect(result.requested).toBe(200000);
        });

        it('should allow when exactly at limit', async () => {
            const yearMonth = getCurrentYearMonth();
            fs.readFile.mockResolvedValue(JSON.stringify({
                [yearMonth]: { 'Standard': 3900000 }
            }));

            const result = await checkQuotaAllows('Standard', 100000, testQuotaFile);

            expect(result.allowed).toBe(true);
        });

        it('should deny when request would exceed limit', async () => {
            const yearMonth = getCurrentYearMonth();
            fs.readFile.mockResolvedValue(JSON.stringify({
                [yearMonth]: { 'Neural2': 999999 }
            }));

            const result = await checkQuotaAllows('Neural2', 2, testQuotaFile);

            expect(result.allowed).toBe(false);
            expect(result.remaining).toBe(1);
        });

        it('should allow unknown voice types with warning', async () => {
            fs.readFile.mockResolvedValue('{}');
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            const result = await checkQuotaAllows('UnknownType', 1000, testQuotaFile);

            expect(result.allowed).toBe(true);
            expect(consoleSpy).toHaveBeenCalledWith(
                'No quota limit defined for voice type: UnknownType'
            );

            consoleSpy.mockRestore();
        });

        it('should handle corrupted JSON gracefully', async () => {
            fs.readFile.mockRejectedValue(new Error('Invalid JSON'));

            const result = await checkQuotaAllows('Standard', 1000, testQuotaFile);

            expect(result.allowed).toBe(true);
        });
    });

    describe('updateQuota', () => {
        const testQuotaFile = '/test/quota.json';

        it('should create new quota entry when file empty', async () => {
            fs.readFile.mockRejectedValue(new Error('ENOENT'));
            fs.writeFile.mockResolvedValue();

            await updateQuota('Standard', 1000, testQuotaFile);

            expect(fs.writeFile).toHaveBeenCalled();
            const writtenData = JSON.parse(fs.writeFile.mock.calls[0][1]);
            const yearMonth = getCurrentYearMonth();
            expect(writtenData[yearMonth]['Standard']).toBe(1000);
        });

        it('should add to existing quota', async () => {
            const yearMonth = getCurrentYearMonth();
            fs.readFile.mockResolvedValue(JSON.stringify({
                [yearMonth]: { 'Standard': 5000 }
            }));
            fs.writeFile.mockResolvedValue();

            await updateQuota('Standard', 1000, testQuotaFile);

            const writtenData = JSON.parse(fs.writeFile.mock.calls[0][1]);
            expect(writtenData[yearMonth]['Standard']).toBe(6000);
        });

        it('should create new voice type entry', async () => {
            const yearMonth = getCurrentYearMonth();
            fs.readFile.mockResolvedValue(JSON.stringify({
                [yearMonth]: { 'Standard': 5000 }
            }));
            fs.writeFile.mockResolvedValue();

            await updateQuota('Neural2', 1000, testQuotaFile);

            const writtenData = JSON.parse(fs.writeFile.mock.calls[0][1]);
            expect(writtenData[yearMonth]['Neural2']).toBe(1000);
            expect(writtenData[yearMonth]['Standard']).toBe(5000);
        });

        it('should handle concurrent updates with mutex', async () => {
            fs.readFile.mockResolvedValue('{}');
            fs.writeFile.mockResolvedValue();

            // Fire multiple updates concurrently
            await Promise.all([
                updateQuota('Standard', 100, testQuotaFile),
                updateQuota('Standard', 200, testQuotaFile),
                updateQuota('Standard', 300, testQuotaFile),
            ]);

            // Should have been called 3 times
            expect(fs.writeFile).toHaveBeenCalledTimes(3);
        });

        // Security: Mutex deadlock prevention tests
        describe('mutex deadlock prevention', () => {
            it('should not deadlock when fs.writeFile throws', async () => {
                fs.readFile.mockResolvedValue('{}');
                fs.writeFile.mockRejectedValueOnce(new Error('Disk full'));

                // First call should fail but not deadlock
                await expect(updateQuota('Standard', 100, testQuotaFile))
                    .rejects.toThrow('Disk full');

                // Second call should still work (not deadlocked)
                fs.writeFile.mockResolvedValueOnce();

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Deadlock detected')), 1000)
                );

                await expect(Promise.race([
                    updateQuota('Standard', 100, testQuotaFile),
                    timeoutPromise
                ])).resolves.toBeUndefined();
            });

            it('should not deadlock when JSON.parse throws on corrupted data', async () => {
                fs.readFile.mockResolvedValueOnce('invalid json {{{');
                fs.writeFile.mockResolvedValue();

                // Should handle gracefully (starts fresh), not deadlock
                await updateQuota('Standard', 100, testQuotaFile);

                // Second call should work
                fs.readFile.mockResolvedValueOnce('{}');

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Deadlock detected')), 1000)
                );

                await expect(Promise.race([
                    updateQuota('Standard', 100, testQuotaFile),
                    timeoutPromise
                ])).resolves.toBeUndefined();
            });

            it('should propagate writeFile errors to caller', async () => {
                fs.readFile.mockResolvedValue('{}');
                fs.writeFile.mockRejectedValue(new Error('Permission denied'));

                await expect(updateQuota('Standard', 100, testQuotaFile))
                    .rejects.toThrow('Permission denied');
            });
        });
    });

    describe('getQuotaData', () => {
        const testQuotaFile = '/test/quota.json';

        it('should return quota data from file', async () => {
            const quotaData = { '2026-01': { 'Standard': 1000 } };
            fs.readFile.mockResolvedValue(JSON.stringify(quotaData));

            const result = await getQuotaData(testQuotaFile);

            expect(result).toEqual(quotaData);
        });

        it('should return empty object when file not found', async () => {
            fs.readFile.mockRejectedValue(new Error('ENOENT'));

            const result = await getQuotaData(testQuotaFile);

            expect(result).toEqual({});
        });
    });

    describe('formatQuotaExceededError', () => {
        it('should format error for byte-based voices', () => {
            const quotaCheck = {
                currentUsage: 900000,
                limit: 1000000,
                remaining: 100000,
            };

            const result = formatQuotaExceededError('Neural2', quotaCheck);

            expect(result).toContain('Monthly quota exceeded for Neural2 voices');
            expect(result).toContain('bytes');
            expect(result).toContain('900,000');
            expect(result).toContain('1,000,000');
        });

        it('should format error for character-based voices', () => {
            const quotaCheck = {
                currentUsage: 3500000,
                limit: 4000000,
                remaining: 500000,
            };

            const result = formatQuotaExceededError('Standard', quotaCheck);

            expect(result).toContain('Monthly quota exceeded for Standard voices');
            expect(result).toContain('characters');
        });

        it('should include remaining quota', () => {
            const quotaCheck = {
                currentUsage: 800000,
                limit: 1000000,
                remaining: 200000,
            };

            const result = formatQuotaExceededError('WaveNet', quotaCheck);

            expect(result).toContain('Remaining: 200,000');
        });

        it('should suggest alternatives', () => {
            const quotaCheck = {
                currentUsage: 1000000,
                limit: 1000000,
                remaining: 0,
            };

            const result = formatQuotaExceededError('Neural2', quotaCheck);

            expect(result).toContain('Try a shorter text or different voice type');
        });
    });
});
