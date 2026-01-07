const request = require('supertest');
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { createGermanLessonsRouter } = require('../../src/routes/germanLessonsRouter');

// Mock fs module
jest.mock('fs', () => ({
    promises: {
        readdir: jest.fn(),
        readFile: jest.fn(),
    }
}));

describe('German Lessons Router', () => {
    let app;
    const testLessonsPath = '/test/lessons';
    const mockAuthMiddleware = (req, res, next) => next();

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        const router = createGermanLessonsRouter({
            lessonsPath: testLessonsPath,
            authMiddleware: mockAuthMiddleware,
        });
        app.use('/german-lessons', router);
    });

    describe('GET /german-lessons', () => {
        it('should return empty list when no files exist', async () => {
            fs.readdir.mockResolvedValue([]);

            const response = await request(app)
                .get('/german-lessons')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.lessons).toEqual([]);
        });

        it('should return list of .txt files with display names', async () => {
            fs.readdir.mockResolvedValue([
                '1_stackable.txt',
                '2_stackable.txt',
                'a2_capstone_stackable.txt',
                'readme.md',
                'config.json',
            ]);

            const response = await request(app)
                .get('/german-lessons')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.lessons).toHaveLength(3);
            expect(response.body.lessons[0]).toEqual({
                filename: '1_stackable.txt',
                displayName: 'Lesson 1',
            });
            expect(response.body.lessons[1]).toEqual({
                filename: '2_stackable.txt',
                displayName: 'Lesson 2',
            });
            expect(response.body.lessons[2]).toEqual({
                filename: 'a2_capstone_stackable.txt',
                displayName: 'A2 Capstone Review',
            });
        });

        it('should sort lessons numerically', async () => {
            fs.readdir.mockResolvedValue([
                '10_stackable.txt',
                '2_stackable.txt',
                '1_stackable.txt',
            ]);

            const response = await request(app)
                .get('/german-lessons')
                .expect(200);

            expect(response.body.lessons[0].displayName).toBe('Lesson 1');
            expect(response.body.lessons[1].displayName).toBe('Lesson 2');
            expect(response.body.lessons[2].displayName).toBe('Lesson 10');
        });

        it('should handle generated lessons', async () => {
            fs.readdir.mockResolvedValue(['lesson_5_generated.txt']);

            const response = await request(app)
                .get('/german-lessons')
                .expect(200);

            expect(response.body.lessons[0]).toEqual({
                filename: 'lesson_5_generated.txt',
                displayName: 'Generated Lesson 5',
            });
        });

        it('should return empty list when directory not found', async () => {
            const error = new Error('Directory not found');
            error.code = 'ENOENT';
            fs.readdir.mockRejectedValue(error);

            const response = await request(app)
                .get('/german-lessons')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.lessons).toEqual([]);
            expect(response.body.message).toBe('German lessons directory not found');
        });

        it('should return 500 on other errors', async () => {
            fs.readdir.mockRejectedValue(new Error('Permission denied'));

            const response = await request(app)
                .get('/german-lessons')
                .expect(500);

            expect(response.body.success).toBe(false);
        });
    });

    describe('GET /german-lessons/:filename', () => {
        it('should return lesson content', async () => {
            const lessonContent = 'Hallo, wie geht es dir?\nGut, danke!';
            fs.readFile.mockResolvedValue(lessonContent);

            const response = await request(app)
                .get('/german-lessons/1_stackable.txt')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.filename).toBe('1_stackable.txt');
            expect(response.body.content).toBe(lessonContent);
            expect(fs.readFile).toHaveBeenCalledWith(
                path.join(testLessonsPath, '1_stackable.txt'),
                'utf8'
            );
        });

        it('should reject directory traversal attempts with ..', async () => {
            // Use URL encoding to bypass Express path normalization
            const response = await request(app)
                .get('/german-lessons/..%2Fsecret.txt')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid filename');
            expect(fs.readFile).not.toHaveBeenCalled();
        });

        it('should reject paths with forward slashes', async () => {
            const response = await request(app)
                .get('/german-lessons/subdir%2Ffile.txt')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid filename');
        });

        it('should reject non-.txt files', async () => {
            const response = await request(app)
                .get('/german-lessons/config.json')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid filename');
        });

        it('should return 404 when file not found', async () => {
            const error = new Error('File not found');
            error.code = 'ENOENT';
            fs.readFile.mockRejectedValue(error);

            const response = await request(app)
                .get('/german-lessons/nonexistent.txt')
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Lesson file not found');
        });

        it('should return 500 on other errors', async () => {
            fs.readFile.mockRejectedValue(new Error('Disk error'));

            const response = await request(app)
                .get('/german-lessons/1_stackable.txt')
                .expect(500);

            expect(response.body.success).toBe(false);
        });

        // Security: Directory traversal bypass prevention tests
        describe('directory traversal bypass prevention', () => {
            it('should reject filenames with special characters (defense against injection)', async () => {
                // Note: URL-level null bytes get handled by Express/Node URL parsing
                // We test that our allowlist pattern blocks any unexpected characters
                const maliciousNames = [
                    'file\x00.txt',     // null byte (if not stripped by URL layer)
                    'file\n.txt',       // newline
                    'file\r.txt',       // carriage return
                ];

                for (const name of maliciousNames) {
                    const response = await request(app)
                        .get(`/german-lessons/${encodeURIComponent(name)}`);

                    // Should either be 400 (invalid) or 404 (URL layer strips it, file not found)
                    expect([400, 404]).toContain(response.status);
                }
            });

            it('should only allow alphanumeric, underscore, hyphen in filename', async () => {
                // Test various special characters that might bypass simple checks
                const invalidNames = [
                    'file$name.txt',
                    'file@name.txt',
                    'file name.txt',  // spaces
                    'file%name.txt',
                    'file;name.txt',
                    'file|name.txt',
                    'file`name.txt',
                ];

                for (const name of invalidNames) {
                    const response = await request(app)
                        .get(`/german-lessons/${encodeURIComponent(name)}`)
                        .expect(400);

                    expect(response.body.error).toBe('Invalid filename');
                }
            });

            it('should verify resolved path stays within lessons directory', async () => {
                // Even if a filename passes basic checks, the resolved path must stay within lessonsPath
                // This is a defense-in-depth measure
                fs.readFile.mockResolvedValue('content');

                const response = await request(app)
                    .get('/german-lessons/valid_file.txt')
                    .expect(200);

                // Verify readFile was called with correct path
                expect(fs.readFile).toHaveBeenCalledWith(
                    expect.stringMatching(/^\/test\/lessons\/valid_file\.txt$/),
                    'utf8'
                );
            });

            it('should allow valid filenames with numbers, underscores, hyphens', async () => {
                fs.readFile.mockResolvedValue('lesson content');

                const validNames = [
                    '1_stackable.txt',
                    'lesson-123.txt',
                    'a2_capstone_stackable.txt',
                    'My_Lesson_01.txt',
                ];

                for (const name of validNames) {
                    fs.readFile.mockClear();
                    const response = await request(app)
                        .get(`/german-lessons/${encodeURIComponent(name)}`)
                        .expect(200);

                    expect(response.body.success).toBe(true);
                }
            });
        });
    });

    describe('Authentication', () => {
        it('should use provided auth middleware', async () => {
            const mockAuth = jest.fn((req, res, next) => {
                res.status(401).json({ error: 'Unauthorized' });
            });

            const authApp = express();
            const router = createGermanLessonsRouter({
                lessonsPath: testLessonsPath,
                authMiddleware: mockAuth,
            });
            authApp.use('/german-lessons', router);

            await request(authApp)
                .get('/german-lessons')
                .expect(401);

            expect(mockAuth).toHaveBeenCalled();
        });
    });
});
