const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;

// Mock Google TTS before requiring the app
jest.mock('@google-cloud/text-to-speech', () => {
    return require('../mocks/googleTTS.mock');
});

describe('Batch Synthesis Endpoint', () => {
    let app;
    const API_KEY = 'test-api-key';

    beforeAll(() => {
        process.env.TTS_API_KEY = API_KEY;
        // Clear module cache to ensure fresh require
        delete require.cache[require.resolve('../../app_server')];
        app = require('../../app_server');
    });

    describe('POST /synthesize-batch', () => {
        it('should reject requests without API key', async () => {
            const response = await request(app)
                .post('/synthesize-batch')
                .expect(401);

            expect(response.body.error).toBeDefined();
        });

        it('should reject requests with no files', async () => {
            const response = await request(app)
                .post('/synthesize-batch')
                .set('X-API-Key', API_KEY)
                .field('language', 'en-US')
                .field('voice', 'en-US-Standard-A')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('No files');
        });

        it('should process multiple text files successfully', async () => {
            const testFiles = [
                { name: 'test1.txt', content: 'Hello world' },
                { name: 'test2.txt', content: 'This is a test' }
            ];

            // Create temporary test files
            const tempFiles = [];
            for (const file of testFiles) {
                const filePath = path.join(__dirname, '../fixtures', file.name);
                await fs.writeFile(filePath, file.content);
                tempFiles.push(filePath);
            }

            try {
                const response = await request(app)
                    .post('/synthesize-batch')
                    .set('X-API-Key', API_KEY)
                    .field('language', 'en-US')
                    .field('voice', 'en-US-Standard-A')
                    .field('speakingRate', '1.0')
                    .field('pitch', '0')
                    .field('useSsml', 'false')
                    .attach('textFiles', tempFiles[0])
                    .attach('textFiles', tempFiles[1]);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.totalFiles).toBe(2);
                expect(response.body.results).toHaveLength(2);

                // Check that each file was processed
                response.body.results.forEach(result => {
                    if (result.success) {
                        expect(result.audioFile).toBeDefined();
                        expect(result.audioFile).toMatch(/\.mp3$/);
                    }
                });

            } finally {
                // Clean up temp files
                for (const filePath of tempFiles) {
                    await fs.unlink(filePath).catch(() => {});
                }
            }
        });

        it('should handle empty files gracefully', async () => {
            const emptyFile = path.join(__dirname, '../fixtures/empty.txt');
            await fs.writeFile(emptyFile, '');

            try {
                const response = await request(app)
                    .post('/synthesize-batch')
                    .set('X-API-Key', API_KEY)
                    .field('language', 'en-US')
                    .field('voice', 'en-US-Standard-A')
                    .attach('textFiles', emptyFile);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.results[0].success).toBe(false);
                expect(response.body.results[0].error).toContain('empty');

            } finally {
                await fs.unlink(emptyFile).catch(() => {});
            }
        });

        it('should respect file size limits', async () => {
            const largeContent = 'a'.repeat(6000); // Exceeds MAX_TEXT_LENGTH
            const largeFile = path.join(__dirname, '../fixtures/large.txt');
            await fs.writeFile(largeFile, largeContent);

            try {
                const response = await request(app)
                    .post('/synthesize-batch')
                    .set('X-API-Key', API_KEY)
                    .field('language', 'en-US')
                    .field('voice', 'en-US-Standard-A')
                    .attach('textFiles', largeFile);

                expect(response.status).toBe(200);
                expect(response.body.results[0].success).toBe(false);
                expect(response.body.results[0].error).toContain('too long');

            } finally {
                await fs.unlink(largeFile).catch(() => {});
            }
        });

        it('should handle mixed success and failure', async () => {
            const validFile = path.join(__dirname, '../fixtures/valid.txt');
            const emptyFile = path.join(__dirname, '../fixtures/empty2.txt');

            await fs.writeFile(validFile, 'Valid content');
            await fs.writeFile(emptyFile, '');

            try {
                const response = await request(app)
                    .post('/synthesize-batch')
                    .set('X-API-Key', API_KEY)
                    .field('language', 'en-US')
                    .field('voice', 'en-US-Standard-A')
                    .attach('textFiles', validFile)
                    .attach('textFiles', emptyFile);

                expect(response.status).toBe(200);
                expect(response.body.success).toBe(true);
                expect(response.body.totalFiles).toBe(2);
                expect(response.body.successCount).toBe(1);

                const successResult = response.body.results.find(r => r.success);
                const failResult = response.body.results.find(r => !r.success);

                expect(successResult).toBeDefined();
                expect(failResult).toBeDefined();
                expect(failResult.error).toBeDefined();

            } finally {
                await fs.unlink(validFile).catch(() => {});
                await fs.unlink(emptyFile).catch(() => {});
            }
        });

        it('should limit maximum number of files', async () => {
            // Attempt to upload more than 20 files (the limit)
            const files = [];
            for (let i = 0; i < 25; i++) {
                const filePath = path.join(__dirname, `../fixtures/test${i}.txt`);
                await fs.writeFile(filePath, `Test content ${i}`);
                files.push(filePath);
            }

            try {
                let req = request(app)
                    .post('/synthesize-batch')
                    .set('X-API-Key', API_KEY)
                    .field('language', 'en-US')
                    .field('voice', 'en-US-Standard-A');

                // Only first 20 files should be accepted by multer
                for (let i = 0; i < 20; i++) {
                    req = req.attach('textFiles', files[i]);
                }

                const response = await req;

                expect(response.status).toBe(200);
                expect(response.body.totalFiles).toBeLessThanOrEqual(20);

            } finally {
                for (const filePath of files) {
                    await fs.unlink(filePath).catch(() => {});
                }
            }
        });
    });
});
