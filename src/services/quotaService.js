/**
 * Quota Management Service
 * Handles quota tracking, checking, and updates for TTS voice usage
 */

const fs = require('fs').promises;
const path = require('path');
const {
    getVoiceCategory,
    countCharacters,
    countBytes,
    countCharactersInSsml,
    countCharactersInSsmlText,
    QUOTA_LIMITS,
    BYTE_BASED_VOICES,
} = require('../utils');

// Mutex for quota updates (prevents race conditions)
let quotaLock = Promise.resolve();

/**
 * Gets the current year-month string for quota tracking
 * @returns {string} Format: "YYYY-MM"
 */
function getCurrentYearMonth() {
    const currentDate = new Date();
    return `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
}

/**
 * Calculates the quota count for a given text based on voice type
 * @param {string} text - The text to count
 * @param {string} voiceName - The voice name to determine counting method
 * @param {boolean} useSsml - Whether the text is SSML
 * @returns {{ count: number, voiceCategory: string, unit: string }}
 */
function calculateQuotaCount(text, voiceName, useSsml = false) {
    const voiceCategory = getVoiceCategory(voiceName);
    let count;
    let unit;

    if (BYTE_BASED_VOICES.includes(voiceCategory)) {
        // Count bytes for byte-based voices
        if (useSsml) {
            count = countBytes(countCharactersInSsmlText(text));
        } else {
            count = countBytes(text);
        }
        unit = 'bytes';
    } else {
        // Count characters for character-based voices (Standard, WaveNet)
        if (useSsml) {
            count = countCharactersInSsml(text);
        } else {
            count = countCharacters(text);
        }
        unit = 'characters';
    }

    return { count, voiceCategory, unit };
}

/**
 * Updates the quota for a voice type with mutex lock
 * @param {string} voiceType - The voice category (Standard, WaveNet, Neural2, etc.)
 * @param {number} count - The count to add to the quota
 * @param {string} quotaFilePath - Path to quota.json file
 */
async function updateQuota(voiceType, count, quotaFilePath) {
    // Acquire lock using proper async mutex pattern
    let release;
    const lockPromise = new Promise(r => { release = r; });

    const previousLock = quotaLock;
    quotaLock = lockPromise;

    await previousLock; // Wait for previous operation

    try {
        let quota = {};

        try {
            const data = await fs.readFile(quotaFilePath, 'utf8');
            quota = JSON.parse(data);
            console.log("Quota data loaded:", quota);
        } catch (error) {
            // File doesn't exist or is empty/invalid, start with an empty object
            console.log("Quota file not found or empty. Starting fresh.");
        }

        const yearMonth = getCurrentYearMonth();

        if (!quota[yearMonth]) {
            quota[yearMonth] = {};
        }

        if (!quota[yearMonth][voiceType]) {
            quota[yearMonth][voiceType] = 0;
        }

        quota[yearMonth][voiceType] += count;

        await fs.writeFile(quotaFilePath, JSON.stringify(quota, null, 2));
        console.log(`Quota updated for ${voiceType} in ${yearMonth}: ${quota[yearMonth][voiceType]}`);
    } finally {
        release(); // Always release lock, even on error
    }
}

/**
 * Checks if a quota allows a requested operation
 * @param {string} voiceType - The voice category
 * @param {number} requestedCount - The amount to check against quota
 * @param {string} quotaFilePath - Path to quota.json file
 * @returns {Promise<{ allowed: boolean, currentUsage?: number, limit?: number, requested?: number, remaining?: number }>}
 */
async function checkQuotaAllows(voiceType, requestedCount, quotaFilePath) {
    const limit = QUOTA_LIMITS[voiceType];

    // If no limit defined for this voice type, allow (but log warning)
    if (limit === undefined) {
        console.warn(`No quota limit defined for voice type: ${voiceType}`);
        return { allowed: true };
    }

    let quota = {};
    try {
        const data = await fs.readFile(quotaFilePath, 'utf8');
        quota = JSON.parse(data);
    } catch (error) {
        // File doesn't exist, no usage yet
        return { allowed: true, currentUsage: 0, limit };
    }

    const yearMonth = getCurrentYearMonth();
    const currentUsage = (quota[yearMonth] && quota[yearMonth][voiceType]) || 0;
    const projectedUsage = currentUsage + requestedCount;

    if (projectedUsage > limit) {
        return {
            allowed: false,
            currentUsage,
            limit,
            requested: requestedCount,
            remaining: Math.max(0, limit - currentUsage)
        };
    }

    return { allowed: true, currentUsage, limit };
}

/**
 * Gets current quota usage for dashboard
 * @param {string} quotaFilePath - Path to quota.json file
 * @returns {Promise<Object>} Quota data
 */
async function getQuotaData(quotaFilePath) {
    try {
        const data = await fs.readFile(quotaFilePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // File doesn't exist or empty
        return {};
    }
}

/**
 * Formats a quota exceeded error message
 * @param {string} voiceCategory - Voice category
 * @param {Object} quotaCheck - Result from checkQuotaAllows
 * @returns {string} Formatted error message
 */
function formatQuotaExceededError(voiceCategory, quotaCheck) {
    const unit = BYTE_BASED_VOICES.includes(voiceCategory) ? 'bytes' : 'characters';
    return `Monthly quota exceeded for ${voiceCategory} voices. ` +
           `Used: ${quotaCheck.currentUsage.toLocaleString()} / ${quotaCheck.limit.toLocaleString()} ${unit}. ` +
           `Remaining: ${quotaCheck.remaining.toLocaleString()} ${unit}. ` +
           `Try a shorter text or different voice type.`;
}

module.exports = {
    getCurrentYearMonth,
    calculateQuotaCount,
    updateQuota,
    checkQuotaAllows,
    getQuotaData,
    formatQuotaExceededError,
};
