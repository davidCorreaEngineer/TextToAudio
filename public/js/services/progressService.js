// ==========================================================================
// PROGRESS TRACKING SERVICE
// Handles localStorage persistence for learning progress
// ==========================================================================

const STORAGE_KEY = 'voicecraft_learning_data';
const DATA_VERSION = 1;
const MAX_SESSIONS = 100; // Keep last 100 sessions
const MAX_PHRASES = 500;  // Keep top 500 phrases by recency

/**
 * Default data structure
 */
function createDefaultData() {
    return {
        version: DATA_VERSION,
        streak: {
            current: 0,
            longest: 0,
            lastPracticeDate: null
        },
        sessions: [],
        phraseHistory: {},
        textMastery: {}
    };
}

/**
 * Load progress data from localStorage
 */
export function loadProgress() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return createDefaultData();
        }
        const data = JSON.parse(stored);

        // Handle version migrations if needed
        if (!data.version || data.version < DATA_VERSION) {
            return migrateData(data);
        }

        return data;
    } catch (error) {
        console.error('Failed to load progress data:', error);
        return createDefaultData();
    }
}

/**
 * Save progress data to localStorage
 */
export function saveProgress(data) {
    try {
        // Prune old data to stay within localStorage limits
        const pruned = pruneData(data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
        return true;
    } catch (error) {
        console.error('Failed to save progress data:', error);
        // If quota exceeded, try aggressive pruning
        if (error.name === 'QuotaExceededError') {
            try {
                const aggressive = aggressivePrune(data);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(aggressive));
                return true;
            } catch (e) {
                console.error('Cannot save even after aggressive pruning:', e);
            }
        }
        return false;
    }
}

/**
 * Migrate data from older versions
 */
function migrateData(oldData) {
    const newData = createDefaultData();

    // Copy over any existing fields that match
    if (oldData.streak) newData.streak = { ...newData.streak, ...oldData.streak };
    if (oldData.sessions) newData.sessions = oldData.sessions;
    if (oldData.phraseHistory) newData.phraseHistory = oldData.phraseHistory;
    if (oldData.textMastery) newData.textMastery = oldData.textMastery;

    return newData;
}

/**
 * Prune old data to keep localStorage usage reasonable
 */
function pruneData(data) {
    const pruned = { ...data };

    // Keep only last MAX_SESSIONS sessions
    if (pruned.sessions.length > MAX_SESSIONS) {
        pruned.sessions = pruned.sessions.slice(-MAX_SESSIONS);
    }

    // Keep only top MAX_PHRASES by most recent attempt
    const phraseEntries = Object.entries(pruned.phraseHistory);
    if (phraseEntries.length > MAX_PHRASES) {
        phraseEntries.sort((a, b) => {
            const dateA = new Date(a[1].lastAttempt || 0);
            const dateB = new Date(b[1].lastAttempt || 0);
            return dateB - dateA;
        });
        pruned.phraseHistory = Object.fromEntries(phraseEntries.slice(0, MAX_PHRASES));
    }

    return pruned;
}

/**
 * Aggressive pruning when quota is exceeded
 */
function aggressivePrune(data) {
    const pruned = { ...data };
    pruned.sessions = pruned.sessions.slice(-30); // Last 30 sessions only

    const phraseEntries = Object.entries(pruned.phraseHistory);
    phraseEntries.sort((a, b) => {
        const dateA = new Date(a[1].lastAttempt || 0);
        const dateB = new Date(b[1].lastAttempt || 0);
        return dateB - dateA;
    });
    pruned.phraseHistory = Object.fromEntries(phraseEntries.slice(0, 100));

    return pruned;
}

// ==========================================================================
// STREAK MANAGEMENT
// ==========================================================================

/**
 * Get today's date as YYYY-MM-DD string
 */
function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

/**
 * Get yesterday's date as YYYY-MM-DD string
 */
function getYesterdayString() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
}

/**
 * Update streak based on practice activity
 * Call this when a practice session is completed
 */
export function updateStreak() {
    const data = loadProgress();
    const today = getTodayString();
    const yesterday = getYesterdayString();

    if (data.streak.lastPracticeDate === today) {
        // Already practiced today, no change
        return data.streak;
    }

    if (data.streak.lastPracticeDate === yesterday) {
        // Continued streak from yesterday
        data.streak.current++;
    } else if (data.streak.lastPracticeDate === null || data.streak.lastPracticeDate < yesterday) {
        // Streak broken or first time
        data.streak.current = 1;
    }

    // Update longest streak
    if (data.streak.current > data.streak.longest) {
        data.streak.longest = data.streak.current;
    }

    data.streak.lastPracticeDate = today;
    saveProgress(data);

    return data.streak;
}

/**
 * Get current streak info (recalculates if day changed)
 */
export function getStreak() {
    const data = loadProgress();
    const today = getTodayString();
    const yesterday = getYesterdayString();

    // Check if streak is still valid
    if (data.streak.lastPracticeDate &&
        data.streak.lastPracticeDate !== today &&
        data.streak.lastPracticeDate !== yesterday) {
        // Streak was broken
        data.streak.current = 0;
        saveProgress(data);
    }

    return {
        current: data.streak.current,
        longest: data.streak.longest,
        lastPracticeDate: data.streak.lastPracticeDate,
        practicedToday: data.streak.lastPracticeDate === today
    };
}

// ==========================================================================
// SESSION TRACKING
// ==========================================================================

/**
 * Record a practice session
 */
export function recordSession(sessionData) {
    const data = loadProgress();

    const session = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        date: new Date().toISOString(),
        type: sessionData.type, // 'shadowing' | 'dictation'
        durationSec: sessionData.durationSec || 0,
        phrasesAttempted: sessionData.phrasesAttempted || 0,
        phrasesCorrect: sessionData.phrasesCorrect || 0,
        avgScore: sessionData.avgScore || 0,
        sourceText: sessionData.sourceText || 'Unknown'
    };

    data.sessions.push(session);

    // Update streak
    updateStreak();

    saveProgress(data);

    return session;
}

/**
 * Get recent sessions
 */
export function getRecentSessions(limit = 7) {
    const data = loadProgress();
    return data.sessions.slice(-limit).reverse();
}

/**
 * Get sessions for a specific date range
 */
export function getSessionsByDateRange(startDate, endDate) {
    const data = loadProgress();
    const start = new Date(startDate);
    const end = new Date(endDate);

    return data.sessions.filter(session => {
        const sessionDate = new Date(session.date);
        return sessionDate >= start && sessionDate <= end;
    });
}

/**
 * Get session statistics for last N days
 */
export function getSessionStats(days = 7) {
    const data = loadProgress();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recentSessions = data.sessions.filter(s => new Date(s.date) >= cutoff);

    const totalTime = recentSessions.reduce((sum, s) => sum + (s.durationSec || 0), 0);
    const totalPhrases = recentSessions.reduce((sum, s) => sum + (s.phrasesAttempted || 0), 0);
    const totalCorrect = recentSessions.reduce((sum, s) => sum + (s.phrasesCorrect || 0), 0);
    const avgScore = recentSessions.length > 0
        ? recentSessions.reduce((sum, s) => sum + (s.avgScore || 0), 0) / recentSessions.length
        : 0;

    return {
        sessionCount: recentSessions.length,
        totalTimeMinutes: Math.round(totalTime / 60),
        totalPhrases,
        totalCorrect,
        avgScore: Math.round(avgScore),
        byType: {
            shadowing: recentSessions.filter(s => s.type === 'shadowing').length,
            dictation: recentSessions.filter(s => s.type === 'dictation').length
        }
    };
}

// ==========================================================================
// PHRASE-LEVEL TRACKING
// ==========================================================================

/**
 * Generate a hash for a phrase (simple but consistent)
 */
function hashPhrase(phrase) {
    let hash = 0;
    const normalized = phrase.toLowerCase().trim();
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return 'p' + Math.abs(hash).toString(36);
}

/**
 * Record a phrase attempt
 */
export function recordPhraseAttempt(phrase, score, sourceText = 'Unknown') {
    const data = loadProgress();
    const hash = hashPhrase(phrase);
    const today = getTodayString();

    if (!data.phraseHistory[hash]) {
        data.phraseHistory[hash] = {
            phrase: phrase.substring(0, 100), // Store truncated for display
            attempts: 0,
            correct: 0,
            totalScore: 0,
            lastAttempt: null,
            sourceText
        };
    }

    const entry = data.phraseHistory[hash];
    entry.attempts++;
    entry.totalScore += score;
    entry.lastAttempt = today;

    if (score === 100) {
        entry.correct++;
    }

    // Calculate average accuracy
    entry.avgAccuracy = Math.round(entry.totalScore / entry.attempts);

    saveProgress(data);

    return entry;
}

/**
 * Get mastery level for a phrase
 * Returns: 'mastered' (>80%, 3+ attempts), 'learning' (50-80% or <3 attempts), 'struggling' (<50%)
 */
export function getPhraseMastery(phrase) {
    const data = loadProgress();
    const hash = hashPhrase(phrase);
    const entry = data.phraseHistory[hash];

    if (!entry) {
        return { level: 'new', accuracy: 0, attempts: 0 };
    }

    const accuracy = entry.avgAccuracy || 0;
    const attempts = entry.attempts || 0;

    let level;
    if (accuracy >= 80 && attempts >= 3) {
        level = 'mastered';
    } else if (accuracy < 50 && attempts >= 2) {
        level = 'struggling';
    } else {
        level = 'learning';
    }

    return { level, accuracy, attempts };
}

/**
 * Get all phrase mastery data for a list of phrases
 */
export function getBulkPhraseMastery(phrases) {
    return phrases.map(phrase => ({
        phrase,
        ...getPhraseMastery(phrase)
    }));
}

/**
 * Get weakest phrases (lowest accuracy, at least 2 attempts)
 */
export function getWeakPhrases(limit = 10) {
    const data = loadProgress();

    return Object.values(data.phraseHistory)
        .filter(entry => entry.attempts >= 2)
        .sort((a, b) => (a.avgAccuracy || 0) - (b.avgAccuracy || 0))
        .slice(0, limit);
}

// ==========================================================================
// TEXT MASTERY TRACKING
// ==========================================================================

/**
 * Update mastery for a text/file
 */
export function updateTextMastery(textName, phraseResults) {
    const data = loadProgress();
    const today = getTodayString();

    if (!data.textMastery[textName]) {
        data.textMastery[textName] = {
            totalPhrases: 0,
            practiced: 0,
            mastered: 0,
            lastPracticed: null
        };
    }

    const entry = data.textMastery[textName];
    entry.totalPhrases = phraseResults.length;
    entry.practiced = phraseResults.filter(r => r.attempts > 0).length;
    entry.mastered = phraseResults.filter(r => r.level === 'mastered').length;
    entry.lastPracticed = today;

    saveProgress(data);

    return entry;
}

/**
 * Get mastery info for a text
 */
export function getTextMastery(textName) {
    const data = loadProgress();
    return data.textMastery[textName] || null;
}

/**
 * Get all text mastery data
 */
export function getAllTextMastery() {
    const data = loadProgress();
    return Object.entries(data.textMastery).map(([name, info]) => ({
        name,
        ...info,
        masteryPercent: info.totalPhrases > 0
            ? Math.round((info.mastered / info.totalPhrases) * 100)
            : 0
    }));
}

// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================

/**
 * Clear all progress data
 */
export function clearAllProgress() {
    localStorage.removeItem(STORAGE_KEY);
}

/**
 * Export progress data for backup
 */
export function exportProgress() {
    const data = loadProgress();
    return JSON.stringify(data, null, 2);
}

/**
 * Import progress data from backup
 */
export function importProgress(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        if (data.version) {
            saveProgress(data);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Failed to import progress:', error);
        return false;
    }
}

/**
 * Get storage usage info
 */
export function getStorageInfo() {
    const data = localStorage.getItem(STORAGE_KEY) || '';
    const bytes = new Blob([data]).size;
    const kb = (bytes / 1024).toFixed(2);

    return {
        bytes,
        kb: parseFloat(kb),
        sessionCount: loadProgress().sessions.length,
        phraseCount: Object.keys(loadProgress().phraseHistory).length
    };
}
