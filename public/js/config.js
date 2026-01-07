// ==========================================================================
// CONFIGURATION & CONSTANTS
// ==========================================================================

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

export function getApiKey() {
    if (!apiKey) {
        apiKey = prompt('Please enter your API key to use this application:');
        if (apiKey) {
            localStorage.setItem('tts_api_key', apiKey);
        }
    }
    return apiKey;
}

export function clearApiKey() {
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
