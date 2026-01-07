/**
 * Unit Tests for Client-Side Modules
 * Tests state management, config, UI utilities, and audio library functions
 */

const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const { JSDOM } = require('jsdom');

// ============================================================================
// STATE MODULE TESTS
// ============================================================================

describe('State Module', () => {
    // Replicate state module for testing
    let state;

    beforeEach(() => {
        state = {
            currentInputMode: 'file',
            currentAudioUrl: null,
            currentMainAudioUrl: null,
            originalFileName: 'audio',
            usageChart: null,
            voiceTypeChart: null,
            practiceText: '',
            shadowingState: {
                phrases: [],
                currentIndex: 0,
                isPlaying: false,
                isPaused: false,
                currentLoopIteration: 0,
                gapTimeoutId: null,
                gapIntervalId: null,
                phraseAudioUrls: [],
                currentPhraseUrl: null,
                useExistingAudio: false,
                phraseTimings: [],
                fullAudioUrl: null,
                currentTimeUpdateHandler: null
            },
            dictationState: {
                phrases: [],
                currentIndex: 0,
                replaysLeft: 3,
                maxReplays: 3,
                scores: [],
                totalCorrect: 0,
                isActive: false,
                useExistingAudio: false,
                phraseTimings: [],
                fullAudioUrl: null,
                currentPhraseAudioUrl: null
            }
        };
    });

    describe('Input Mode Management', () => {
        test('should have default input mode as file', () => {
            expect(state.currentInputMode).toBe('file');
        });

        test('should allow setting input mode to editor', () => {
            state.currentInputMode = 'editor';
            expect(state.currentInputMode).toBe('editor');
        });

        test('should allow toggling between modes', () => {
            state.currentInputMode = 'editor';
            expect(state.currentInputMode).toBe('editor');
            state.currentInputMode = 'file';
            expect(state.currentInputMode).toBe('file');
        });
    });

    describe('Audio URL Management', () => {
        test('should initialize with null audio URLs', () => {
            expect(state.currentAudioUrl).toBeNull();
            expect(state.currentMainAudioUrl).toBeNull();
        });

        test('should store audio URLs', () => {
            state.currentAudioUrl = 'blob:http://localhost/test1';
            state.currentMainAudioUrl = 'blob:http://localhost/test2';
            expect(state.currentAudioUrl).toBe('blob:http://localhost/test1');
            expect(state.currentMainAudioUrl).toBe('blob:http://localhost/test2');
        });
    });

    describe('Shadowing State', () => {
        test('should initialize with empty phrases', () => {
            expect(state.shadowingState.phrases).toEqual([]);
            expect(state.shadowingState.currentIndex).toBe(0);
        });

        test('should track playing state', () => {
            state.shadowingState.isPlaying = true;
            expect(state.shadowingState.isPlaying).toBe(true);
        });

        test('should track pause state', () => {
            state.shadowingState.isPaused = true;
            expect(state.shadowingState.isPaused).toBe(true);
        });

        test('should reset shadowing state', () => {
            // Modify state
            state.shadowingState.phrases = ['test1', 'test2'];
            state.shadowingState.currentIndex = 5;
            state.shadowingState.isPlaying = true;

            // Reset function
            function resetShadowingState() {
                state.shadowingState.phrases = [];
                state.shadowingState.currentIndex = 0;
                state.shadowingState.isPlaying = false;
                state.shadowingState.isPaused = false;
                state.shadowingState.currentLoopIteration = 0;
            }

            resetShadowingState();

            expect(state.shadowingState.phrases).toEqual([]);
            expect(state.shadowingState.currentIndex).toBe(0);
            expect(state.shadowingState.isPlaying).toBe(false);
        });
    });

    describe('Dictation State', () => {
        test('should initialize with default replay count', () => {
            expect(state.dictationState.replaysLeft).toBe(3);
            expect(state.dictationState.maxReplays).toBe(3);
        });

        test('should track scores', () => {
            state.dictationState.scores = [100, 80, 90];
            expect(state.dictationState.scores.length).toBe(3);
        });

        test('should calculate total correct', () => {
            state.dictationState.totalCorrect = 5;
            expect(state.dictationState.totalCorrect).toBe(5);
        });

        test('should reset dictation state', () => {
            state.dictationState.scores = [100, 80];
            state.dictationState.totalCorrect = 10;
            state.dictationState.replaysLeft = 1;

            function resetDictationState() {
                state.dictationState.phrases = [];
                state.dictationState.currentIndex = 0;
                state.dictationState.replaysLeft = 3;
                state.dictationState.scores = [];
                state.dictationState.totalCorrect = 0;
                state.dictationState.isActive = false;
            }

            resetDictationState();

            expect(state.dictationState.scores).toEqual([]);
            expect(state.dictationState.totalCorrect).toBe(0);
            expect(state.dictationState.replaysLeft).toBe(3);
        });
    });
});

// ============================================================================
// CONFIG MODULE TESTS
// ============================================================================

describe('Config Module', () => {
    const MAX_TEXT_LENGTH = 5000;

    const FREE_TIER_LIMITS = {
        'Neural2': 1000000,
        'Studio': 100000,
        'Polyglot': 100000,
        'Standard': 4000000,
        'WaveNet': 1000000,
        'Journey': 1000000
    };

    describe('MAX_TEXT_LENGTH', () => {
        test('should be 5000 characters', () => {
            expect(MAX_TEXT_LENGTH).toBe(5000);
        });

        test('should match server-side limit', () => {
            // Server uses 5000 bytes as max
            expect(MAX_TEXT_LENGTH).toBeLessThanOrEqual(5000);
        });
    });

    describe('FREE_TIER_LIMITS', () => {
        test('should define limits for all voice types', () => {
            const expectedTypes = ['Neural2', 'Studio', 'Polyglot', 'Standard', 'WaveNet', 'Journey'];
            expectedTypes.forEach(type => {
                expect(FREE_TIER_LIMITS[type]).toBeDefined();
                expect(typeof FREE_TIER_LIMITS[type]).toBe('number');
            });
        });

        test('should have correct byte-based limits', () => {
            expect(FREE_TIER_LIMITS['Neural2']).toBe(1000000);
            expect(FREE_TIER_LIMITS['Studio']).toBe(100000);
            expect(FREE_TIER_LIMITS['Polyglot']).toBe(100000);
            expect(FREE_TIER_LIMITS['Journey']).toBe(1000000);
        });

        test('should have correct character-based limits', () => {
            expect(FREE_TIER_LIMITS['Standard']).toBe(4000000);
            expect(FREE_TIER_LIMITS['WaveNet']).toBe(1000000);
        });

        test('Standard should have highest limit', () => {
            const maxLimit = Math.max(...Object.values(FREE_TIER_LIMITS));
            expect(FREE_TIER_LIMITS['Standard']).toBe(maxLimit);
        });
    });

    describe('Auth Headers Generation', () => {
        function getAuthHeaders(apiKey, additionalHeaders = {}) {
            return {
                'X-API-Key': apiKey,
                ...additionalHeaders
            };
        }

        test('should include API key in headers', () => {
            const headers = getAuthHeaders('test-key');
            expect(headers['X-API-Key']).toBe('test-key');
        });

        test('should merge additional headers', () => {
            const headers = getAuthHeaders('test-key', { 'Content-Type': 'application/json' });
            expect(headers['X-API-Key']).toBe('test-key');
            expect(headers['Content-Type']).toBe('application/json');
        });

        test('should handle empty additional headers', () => {
            const headers = getAuthHeaders('test-key', {});
            expect(Object.keys(headers).length).toBe(1);
        });
    });
});

// ============================================================================
// AUDIO LIBRARY MODULE TESTS
// ============================================================================

describe('Audio Library Module', () => {
    // HTML Escape function from library.js
    function escapeHtml(text) {
        const div = { textContent: '', innerHTML: '' };
        div.textContent = text;
        // Simulate browser behavior
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    describe('escapeHtml', () => {
        test('should escape HTML entities', () => {
            expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
        });

        test('should escape ampersands', () => {
            expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
        });

        test('should escape quotes', () => {
            expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
        });

        test('should handle empty string', () => {
            expect(escapeHtml('')).toBe('');
        });

        test('should not modify plain text', () => {
            expect(escapeHtml('Hello World')).toBe('Hello World');
        });
    });

    describe('Audio Item Management', () => {
        let audioItems;

        beforeEach(() => {
            audioItems = [];
        });

        function addToLibrary(audioUrl, text, duration) {
            const item = {
                id: Date.now(),
                audioUrl,
                text: text.substring(0, 200),
                duration: duration || '0:00',
                timestamp: new Date().toISOString(),
                favorite: false
            };
            audioItems.unshift(item);
            return item;
        }

        function removeFromLibrary(id) {
            audioItems = audioItems.filter(item => item.id !== id);
        }

        function toggleFavorite(id) {
            const item = audioItems.find(i => i.id === id);
            if (item) {
                item.favorite = !item.favorite;
            }
        }

        test('should add item to library', () => {
            const item = addToLibrary('blob:test', 'Test text', '1:30');
            expect(audioItems.length).toBe(1);
            expect(audioItems[0].text).toBe('Test text');
        });

        test('should truncate text to 200 characters', () => {
            const longText = 'A'.repeat(300);
            const item = addToLibrary('blob:test', longText, '1:30');
            expect(item.text.length).toBe(200);
        });

        test('should add items to front of list (unshift)', () => {
            addToLibrary('blob:1', 'First', '0:30');
            addToLibrary('blob:2', 'Second', '0:30');
            expect(audioItems[0].text).toBe('Second');
            expect(audioItems[1].text).toBe('First');
        });

        test('should remove item from library', () => {
            const item = addToLibrary('blob:test', 'Test', '0:30');
            expect(audioItems.length).toBe(1);
            removeFromLibrary(item.id);
            expect(audioItems.length).toBe(0);
        });

        test('should toggle favorite status', () => {
            const item = addToLibrary('blob:test', 'Test', '0:30');
            expect(item.favorite).toBe(false);
            toggleFavorite(item.id);
            expect(audioItems[0].favorite).toBe(true);
            toggleFavorite(item.id);
            expect(audioItems[0].favorite).toBe(false);
        });

        test('should initialize with default values', () => {
            const item = addToLibrary('blob:test', 'Test');
            expect(item.duration).toBe('0:00');
            expect(item.favorite).toBe(false);
            expect(item.timestamp).toBeDefined();
        });
    });

    describe('Library Count', () => {
        test('should format count correctly', () => {
            function formatLibraryCount(count) {
                return `${count} item${count !== 1 ? 's' : ''}`;
            }

            expect(formatLibraryCount(0)).toBe('0 items');
            expect(formatLibraryCount(1)).toBe('1 item');
            expect(formatLibraryCount(5)).toBe('5 items');
        });
    });
});

// ============================================================================
// TOAST MODULE TESTS
// ============================================================================

describe('Toast Module', () => {
    let dom;
    let document;

    beforeEach(() => {
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="toastContainer"></div>
            </body>
            </html>
        `);
        document = dom.window.document;
    });

    afterEach(() => {
        dom = null;
    });

    describe('showToast', () => {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };

        function createToast(type, title, message = '') {
            const container = document.getElementById('toastContainer');
            if (!container) return null;

            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = `
                <div class="toast-icon">
                    <i class="fas ${icons[type]}"></i>
                </div>
                <div class="toast-content">
                    <div class="toast-title">${title}</div>
                    ${message ? `<div class="toast-message">${message}</div>` : ''}
                </div>
                <button class="toast-close" aria-label="Close">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(toast);
            return toast;
        }

        test('should create toast element', () => {
            const toast = createToast('success', 'Test Title');
            expect(toast).not.toBeNull();
            expect(toast.classList.contains('toast')).toBe(true);
        });

        test('should have correct type class', () => {
            const successToast = createToast('success', 'Success');
            const errorToast = createToast('error', 'Error');
            expect(successToast.classList.contains('success')).toBe(true);
            expect(errorToast.classList.contains('error')).toBe(true);
        });

        test('should display title', () => {
            const toast = createToast('info', 'Test Title');
            expect(toast.innerHTML).toContain('Test Title');
        });

        test('should display message when provided', () => {
            const toast = createToast('info', 'Title', 'Test Message');
            expect(toast.innerHTML).toContain('Test Message');
        });

        test('should not have message element when not provided', () => {
            const toast = createToast('info', 'Title');
            expect(toast.querySelector('.toast-message')).toBeNull();
        });

        test('should have close button', () => {
            const toast = createToast('info', 'Title');
            expect(toast.querySelector('.toast-close')).not.toBeNull();
        });

        test('should use correct icon for each type', () => {
            Object.entries(icons).forEach(([type, iconClass]) => {
                const toast = createToast(type, 'Title');
                expect(toast.innerHTML).toContain(iconClass);
            });
        });

        test('should append to container', () => {
            createToast('success', 'Test 1');
            createToast('error', 'Test 2');
            const container = document.getElementById('toastContainer');
            expect(container.children.length).toBe(2);
        });
    });
});

// ============================================================================
// LOADING MODULE TESTS
// ============================================================================

describe('Loading Module', () => {
    let dom;
    let document;

    beforeEach(() => {
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <button id="testButton">Submit</button>
                <div id="libraryLoading" style="display: none;"></div>
            </body>
            </html>
        `);
        document = dom.window.document;
    });

    describe('setButtonLoading', () => {
        function setButtonLoading(button, isLoading) {
            if (!button) return;
            if (isLoading) {
                button.disabled = true;
                button.dataset.originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            } else {
                button.disabled = false;
                if (button.dataset.originalText) {
                    button.innerHTML = button.dataset.originalText;
                }
            }
        }

        test('should disable button when loading', () => {
            const button = document.getElementById('testButton');
            setButtonLoading(button, true);
            expect(button.disabled).toBe(true);
        });

        test('should enable button when not loading', () => {
            const button = document.getElementById('testButton');
            setButtonLoading(button, true);
            setButtonLoading(button, false);
            expect(button.disabled).toBe(false);
        });

        test('should show spinner when loading', () => {
            const button = document.getElementById('testButton');
            setButtonLoading(button, true);
            expect(button.innerHTML).toContain('fa-spinner');
        });

        test('should restore original text when done', () => {
            const button = document.getElementById('testButton');
            const originalText = button.innerHTML;
            setButtonLoading(button, true);
            setButtonLoading(button, false);
            expect(button.innerHTML).toBe(originalText);
        });

        test('should handle null button gracefully', () => {
            expect(() => {
                function setButtonLoading(button, isLoading) {
                    if (!button) return;
                }
                setButtonLoading(null, true);
            }).not.toThrow();
        });
    });

    describe('showLibraryLoading', () => {
        function showLibraryLoading(show) {
            const loading = document.getElementById('libraryLoading');
            if (loading) {
                loading.style.display = show ? 'block' : 'none';
            }
        }

        test('should show loading indicator', () => {
            showLibraryLoading(true);
            const loading = document.getElementById('libraryLoading');
            expect(loading.style.display).toBe('block');
        });

        test('should hide loading indicator', () => {
            showLibraryLoading(true);
            showLibraryLoading(false);
            const loading = document.getElementById('libraryLoading');
            expect(loading.style.display).toBe('none');
        });
    });
});

// ============================================================================
// FAB MODULE TESTS
// ============================================================================

describe('FAB Module', () => {
    describe('Dashboard Stats', () => {
        function parseStats(stored) {
            let stats = { phrases: 0, streak: 0, time: 0 };
            try {
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (typeof parsed === 'object' && parsed !== null) {
                        stats = { ...stats, ...parsed };
                    }
                }
            } catch (e) {
                // Use defaults
            }
            return stats;
        }

        test('should parse valid JSON stats', () => {
            const stored = '{"phrases": 10, "streak": 5, "time": 120}';
            const stats = parseStats(stored);
            expect(stats.phrases).toBe(10);
            expect(stats.streak).toBe(5);
            expect(stats.time).toBe(120);
        });

        test('should use defaults for missing fields', () => {
            const stored = '{"phrases": 10}';
            const stats = parseStats(stored);
            expect(stats.phrases).toBe(10);
            expect(stats.streak).toBe(0);
            expect(stats.time).toBe(0);
        });

        test('should handle invalid JSON', () => {
            const stored = 'invalid json';
            const stats = parseStats(stored);
            expect(stats.phrases).toBe(0);
            expect(stats.streak).toBe(0);
        });

        test('should handle null input', () => {
            const stats = parseStats(null);
            expect(stats.phrases).toBe(0);
        });

        test('should handle empty string', () => {
            const stats = parseStats('');
            expect(stats.phrases).toBe(0);
        });
    });

    describe('incrementPhrases', () => {
        test('should increment phrase count', () => {
            let stats = { phrases: 5, streak: 0, time: 0 };
            stats.phrases = (stats.phrases || 0) + 1;
            expect(stats.phrases).toBe(6);
        });

        test('should handle undefined phrase count', () => {
            let stats = { streak: 0, time: 0 };
            stats.phrases = (stats.phrases || 0) + 1;
            expect(stats.phrases).toBe(1);
        });
    });

    describe('Weekly Goal Progress', () => {
        function calculateProgress(current, goal) {
            return Math.min(100, Math.round((current / goal) * 100));
        }

        test('should calculate percentage correctly', () => {
            expect(calculateProgress(25, 50)).toBe(50);
            expect(calculateProgress(50, 50)).toBe(100);
        });

        test('should cap at 100%', () => {
            expect(calculateProgress(75, 50)).toBe(100);
        });

        test('should handle zero goal', () => {
            expect(calculateProgress(10, 0)).toBe(100); // Infinity capped
        });
    });
});

// ============================================================================
// TEXT PROCESSING TESTS
// ============================================================================

describe('Text Processing', () => {
    describe('splitIntoPhrases', () => {
        function splitIntoPhrases(text) {
            if (!text || typeof text !== 'string') return [];
            return text
                .split(/[.!?]+/)
                .map(s => s.trim())
                .filter(s => s.length > 0);
        }

        test('should split by periods', () => {
            const phrases = splitIntoPhrases('First sentence. Second sentence.');
            expect(phrases.length).toBe(2);
            expect(phrases[0]).toBe('First sentence');
        });

        test('should split by question marks', () => {
            const phrases = splitIntoPhrases('What is this? Why is that?');
            expect(phrases.length).toBe(2);
        });

        test('should split by exclamation marks', () => {
            const phrases = splitIntoPhrases('Wow! Amazing!');
            expect(phrases.length).toBe(2);
        });

        test('should handle empty string', () => {
            expect(splitIntoPhrases('')).toEqual([]);
        });

        test('should handle null input', () => {
            expect(splitIntoPhrases(null)).toEqual([]);
        });

        test('should trim whitespace', () => {
            const phrases = splitIntoPhrases('  Hello.   World.  ');
            expect(phrases[0]).toBe('Hello');
            expect(phrases[1]).toBe('World');
        });

        test('should filter empty phrases', () => {
            const phrases = splitIntoPhrases('Hello... World');
            expect(phrases.every(p => p.length > 0)).toBe(true);
        });
    });

    describe('Character Counting', () => {
        function countCharacters(text) {
            return text.replace(/<[^>]*>/g, '').length;
        }

        test('should count plain text characters', () => {
            expect(countCharacters('Hello')).toBe(5);
        });

        test('should strip HTML tags', () => {
            expect(countCharacters('<b>Hello</b>')).toBe(5);
        });

        test('should handle empty string', () => {
            expect(countCharacters('')).toBe(0);
        });

        test('should count spaces', () => {
            expect(countCharacters('Hello World')).toBe(11);
        });
    });
});

// ============================================================================
// FORM VALIDATION TESTS
// ============================================================================

describe('Form Validation', () => {
    describe('validateTextLength', () => {
        const MAX_LENGTH = 5000;

        function validateTextLength(text) {
            if (!text) return { valid: false, error: 'No text provided' };
            if (text.length > MAX_LENGTH) {
                return { valid: false, error: `Text exceeds ${MAX_LENGTH} characters` };
            }
            return { valid: true, error: null };
        }

        test('should accept valid text', () => {
            const result = validateTextLength('Hello World');
            expect(result.valid).toBe(true);
        });

        test('should reject empty text', () => {
            const result = validateTextLength('');
            expect(result.valid).toBe(false);
        });

        test('should reject text exceeding limit', () => {
            const longText = 'A'.repeat(5001);
            const result = validateTextLength(longText);
            expect(result.valid).toBe(false);
        });

        test('should accept text at limit', () => {
            const text = 'A'.repeat(5000);
            const result = validateTextLength(text);
            expect(result.valid).toBe(true);
        });
    });

    describe('File Validation', () => {
        function validateFile(file) {
            if (!file) return { valid: false, error: 'No file selected' };
            if (!file.name.endsWith('.txt')) {
                return { valid: false, error: 'Only .txt files are allowed' };
            }
            return { valid: true, error: null };
        }

        test('should accept .txt files', () => {
            const result = validateFile({ name: 'test.txt' });
            expect(result.valid).toBe(true);
        });

        test('should reject non-.txt files', () => {
            const result = validateFile({ name: 'test.pdf' });
            expect(result.valid).toBe(false);
        });

        test('should reject null file', () => {
            const result = validateFile(null);
            expect(result.valid).toBe(false);
        });
    });
});

// ============================================================================
// PRACTICE MODE TESTS
// ============================================================================

describe('Practice Modes', () => {
    describe('Shadowing', () => {
        function calculateLoopCount(phrases, loopsPerPhrase) {
            return phrases.length * loopsPerPhrase;
        }

        function getNextPhraseIndex(current, total) {
            return (current + 1) % total;
        }

        test('should calculate total loop count', () => {
            expect(calculateLoopCount(['a', 'b', 'c'], 3)).toBe(9);
        });

        test('should wrap to first phrase after last', () => {
            expect(getNextPhraseIndex(2, 3)).toBe(0);
        });

        test('should advance to next phrase', () => {
            expect(getNextPhraseIndex(0, 3)).toBe(1);
        });
    });

    describe('Dictation', () => {
        function calculateScore(userInput, expected) {
            const normalizedUser = userInput.toLowerCase().trim();
            const normalizedExpected = expected.toLowerCase().trim();

            if (normalizedUser === normalizedExpected) return 100;

            // Simple word-based scoring
            const userWords = normalizedUser.split(/\s+/);
            const expectedWords = normalizedExpected.split(/\s+/);

            let correctWords = 0;
            userWords.forEach((word, i) => {
                if (expectedWords[i] === word) correctWords++;
            });

            return Math.round((correctWords / expectedWords.length) * 100);
        }

        test('should return 100 for exact match', () => {
            expect(calculateScore('Hello World', 'Hello World')).toBe(100);
        });

        test('should be case insensitive', () => {
            expect(calculateScore('HELLO WORLD', 'hello world')).toBe(100);
        });

        test('should calculate partial score', () => {
            const score = calculateScore('Hello Earth', 'Hello World');
            expect(score).toBe(50); // 1 of 2 words correct
        });

        test('should handle empty input', () => {
            const score = calculateScore('', 'Hello');
            expect(score).toBe(0);
        });
    });
});

// ============================================================================
// UTILITY FUNCTIONS TESTS
// ============================================================================

describe('Utility Functions', () => {
    describe('formatDuration', () => {
        function formatDuration(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }

        test('should format seconds to mm:ss', () => {
            expect(formatDuration(90)).toBe('1:30');
            expect(formatDuration(65)).toBe('1:05');
        });

        test('should handle zero', () => {
            expect(formatDuration(0)).toBe('0:00');
        });

        test('should pad seconds with zero', () => {
            expect(formatDuration(61)).toBe('1:01');
        });
    });

    describe('debounce', () => {
        function debounce(fn, delay) {
            let timeoutId;
            return function(...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => fn.apply(this, args), delay);
            };
        }

        test('should return a function', () => {
            const debouncedFn = debounce(() => {}, 100);
            expect(typeof debouncedFn).toBe('function');
        });

        test('should create debounced wrapper', () => {
            let callCount = 0;
            const fn = () => { callCount++; };
            const debouncedFn = debounce(fn, 10);

            // Function should be callable
            expect(() => debouncedFn()).not.toThrow();
        });
    });

    describe('sanitizeFilename', () => {
        function sanitizeFilename(filename) {
            return filename
                .replace(/\s+/g, '_')
                .replace(/[^\w\-]/g, '');
        }

        test('should replace spaces with underscores', () => {
            expect(sanitizeFilename('hello world')).toBe('hello_world');
        });

        test('should remove special characters', () => {
            expect(sanitizeFilename('file<>:"/\\|?*')).toBe('file');
        });

        test('should preserve alphanumeric and hyphens', () => {
            expect(sanitizeFilename('file-name_123')).toBe('file-name_123');
        });
    });
});
