// ==========================================================================
// CONFIGURATION & CONSTANTS
// ==========================================================================

import { showPrompt } from './ui/modal.js';

export const MAX_TEXT_LENGTH = 5000;

export const FREE_TIER_LIMITS = {
    'Neural2': 1000000,      // 1 million bytes
    'Studio': 100000,        // 100,000 bytes
    'Polyglot': 100000,      // 100,000 bytes
    'Standard': 4000000,     // 4 million characters
    'WaveNet': 1000000,      // 1 million characters
    'Journey': 1000000       // 1 million bytes
};

// API Key Management
let apiKey = localStorage.getItem('tts_api_key') || '';

/**
 * Gets the API key, prompting user if not set
 * Note: This is synchronous for backward compatibility.
 * Use promptForApiKey() for async modal-based input.
 * @returns {string} The API key
 */
export function getApiKey() {
    return apiKey;
}

/**
 * Prompts user for API key using secure modal
 * @returns {Promise<string|null>} The entered API key or null if cancelled
 */
export async function promptForApiKey() {
    const key = await showPrompt(
        'Please enter your API key to use this application:',
        '',
        { inputType: 'password' }
    );

    if (key) {
        apiKey = key;
        localStorage.setItem('tts_api_key', apiKey);
    }

    return key;
}

/**
 * Checks if API key is set, prompts if not
 * Call this at app initialization
 * @returns {Promise<boolean>} True if API key is available
 */
export async function ensureApiKey() {
    if (apiKey) {
        return true;
    }

    const key = await promptForApiKey();
    return !!key;
}

/**
 * Checks if API key is currently set
 * @returns {boolean}
 */
export function hasApiKey() {
    return !!apiKey;
}

export function clearApiKey() {
    apiKey = '';
    localStorage.removeItem('tts_api_key');
    location.reload();
}

export function getAuthHeaders(additionalHeaders = {}) {
    return {
        'X-API-Key': getApiKey(),
        ...additionalHeaders
    };
}

// Expose clearApiKey globally for logout button
window.clearApiKey = clearApiKey;
