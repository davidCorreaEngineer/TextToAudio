/**
 * German Lessons Router
 * Handles endpoints for listing and retrieving German lesson content
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { sendError } = require('../middleware/errorHandler');

/**
 * Creates the German lessons router
 * @param {Object} options - Configuration options
 * @param {string} options.lessonsPath - Path to the lessons directory
 * @param {Function} options.authMiddleware - Authentication middleware
 * @returns {express.Router} Configured router
 */
function createGermanLessonsRouter({ lessonsPath, authMiddleware }) {
    const router = express.Router();

    // Apply auth middleware to all routes
    router.use(authMiddleware);

    /**
     * GET /german-lessons
     * Lists all available German lesson files
     */
    router.get('/', async (req, res) => {
        try {
            const files = await fs.readdir(lessonsPath);
            const lessonFiles = files
                .filter(f => f.endsWith('.txt'))
                .map(f => {
                    // Extract lesson number or name for display
                    const name = f.replace('.txt', '');
                    let displayName = name;

                    // Format display names nicely
                    if (name.match(/^\d+_stackable$/)) {
                        displayName = `Lesson ${name.split('_')[0]}`;
                    } else if (name === 'a2_capstone_stackable') {
                        displayName = 'A2 Capstone Review';
                    } else if (name.match(/lesson_\d+_generated/)) {
                        displayName = `Generated Lesson ${name.match(/\d+/)[0]}`;
                    }

                    return { filename: f, displayName };
                })
                .sort((a, b) => {
                    // Sort numerically where possible
                    const matchA = a.filename.match(/\d+/);
                    const matchB = b.filename.match(/\d+/);
                    const numA = matchA ? parseInt(matchA[0]) : 999;
                    const numB = matchB ? parseInt(matchB[0]) : 999;
                    return numA - numB;
                });

            console.log(`Found ${lessonFiles.length} German lesson files`);
            res.json({ success: true, lessons: lessonFiles });
        } catch (error) {
            console.error("Error listing German lessons:", error);
            // Return empty list if directory doesn't exist
            if (error.code === 'ENOENT') {
                return res.json({ success: true, lessons: [], message: 'German lessons directory not found' });
            }
            return sendError(res, 500, error);
        }
    });

    /**
     * GET /german-lessons/:filename
     * Retrieves content of a specific German lesson file
     */
    router.get('/:filename', async (req, res) => {
        try {
            const filename = req.params.filename;

            // Security: Strict filename validation using allowlist approach
            // Only allow: alphanumeric, underscore, hyphen, followed by .txt
            const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.txt$/;

            if (!SAFE_FILENAME_PATTERN.test(filename)) {
                return res.status(400).json({ success: false, error: 'Invalid filename' });
            }

            // Defense-in-depth: Verify resolved path stays within lessons directory
            const resolvedPath = path.resolve(lessonsPath, filename);
            const normalizedLessonsPath = path.resolve(lessonsPath);

            if (!resolvedPath.startsWith(normalizedLessonsPath + path.sep)) {
                console.warn(`Path traversal attempt detected: ${filename}`);
                return res.status(400).json({ success: false, error: 'Invalid filename' });
            }

            const filePath = resolvedPath;
            const content = await fs.readFile(filePath, 'utf8');

            console.log(`Loaded German lesson: ${filename} (${content.length} characters)`);
            res.json({ success: true, filename, content });
        } catch (error) {
            console.error("Error loading German lesson:", error);
            if (error.code === 'ENOENT') {
                return res.status(404).json({ success: false, error: 'Lesson file not found' });
            }
            return sendError(res, 500, error);
        }
    });

    return router;
}

module.exports = { createGermanLessonsRouter };
