// ==========================================================================
// API MODULE - All backend communication
// ==========================================================================

import { getAuthHeaders, getApiKey } from './config.js';

// Request timeout in milliseconds (60 seconds)
const XHR_TIMEOUT_MS = 60000;

/**
 * Creates and sends an XHR request with progress tracking
 * @param {Object} options
 * @param {string} options.url - Request URL
 * @param {FormData} options.formData - Form data to send
 * @param {number} options.timeout - Timeout in ms
 * @param {number} options.progressMax - Max progress value (100 for full, 50 for batch upload phase)
 * @param {string} options.networkError - Network error message
 * @param {string} options.timeoutError - Timeout error message
 * @param {Function} options.onProgress - Progress callback (percent)
 * @param {Function} options.onComplete - Success callback (response)
 * @param {Function} options.onError - Error callback (Error)
 * @returns {XMLHttpRequest}
 */
function createXhrRequest({
    url,
    formData,
    timeout = XHR_TIMEOUT_MS,
    progressMax = 100,
    networkError = 'Network error',
    timeoutError = 'Request timed out',
    onProgress,
    onComplete,
    onError
}) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('X-API-Key', getApiKey());
    xhr.timeout = timeout;

    if (onProgress) {
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * progressMax);
                onProgress(percent);
            }
        };
    }

    xhr.onload = () => {
        if (xhr.status === 200) {
            try {
                onComplete(JSON.parse(xhr.responseText));
            } catch (e) {
                onError(new Error('Invalid response from server'));
            }
        } else {
            try {
                const errorData = JSON.parse(xhr.responseText);
                onError(new Error(errorData.error || `Server error: ${xhr.status}`));
            } catch (e) {
                onError(new Error(`Server error: ${xhr.status}`));
            }
        }
    };

    xhr.onerror = () => onError(new Error(networkError));
    xhr.ontimeout = () => onError(new Error(timeoutError));

    xhr.send(formData);
    return xhr;
}

// Fetch available voices for selected language
export async function fetchVoices() {
    const response = await fetch('/voices', {
        headers: getAuthHeaders()
    });

    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('tts_api_key');
        throw new Error('Invalid API key. Please reload and enter a valid key.');
    }

    if (!response.ok) {
        throw new Error('Failed to fetch voices');
    }

    return response.json();
}

// Test voice with sample text
export async function testVoice(language, voice, speakingRate, pitch, customText = null) {
    const body = {
        language,
        voice,
        speakingRate,
        pitch
    };

    if (customText) {
        body.customText = customText;
    }

    const response = await fetch('/test-voice', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to test voice');
    }

    return response.json();
}

// Fetch usage statistics / dashboard data
export async function fetchDashboard() {
    const response = await fetch('/dashboard', {
        headers: getAuthHeaders()
    });

    if (response.status === 401 || response.status === 403) {
        console.log('Dashboard fetch failed due to authentication.');
        return null;
    }

    if (!response.ok) {
        throw new Error('Failed to fetch usage statistics');
    }

    return response.json();
}

// Fetch German lessons list
export async function fetchGermanLessons() {
    const response = await fetch('/german-lessons', {
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        throw new Error('Failed to load German lessons');
    }

    return response.json();
}

// Fetch specific German lesson
export async function fetchGermanLesson(filename) {
    const response = await fetch(`/german-lessons/${encodeURIComponent(filename)}`, {
        headers: getAuthHeaders()
    });

    if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load lesson');
    }

    return response.json();
}

// Synthesize speech (returns XHR for progress tracking)
export function synthesizeSpeech(formData, onProgress, onComplete, onError) {
    return createXhrRequest({
        url: '/synthesize',
        formData,
        onProgress,
        onComplete,
        onError,
        networkError: 'Network error - please check your connection',
        timeoutError: 'Request timed out. Please try again with shorter text.'
    });
}

// Batch synthesize multiple files
export function synthesizeBatch(formData, onProgress, onComplete, onError) {
    return createXhrRequest({
        url: '/synthesize-batch',
        formData,
        timeout: XHR_TIMEOUT_MS * 5,
        progressMax: 50,
        onProgress,
        onComplete,
        onError,
        networkError: 'Network error during batch processing',
        timeoutError: 'Batch processing timed out. Try with fewer files.'
    });
}

// Convert base64 to Blob object
export function base64ToBlob(base64, mimeType = 'audio/mpeg') {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);

        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }

        byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: mimeType });
}
