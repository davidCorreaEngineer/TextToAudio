// ==========================================================================
// API MODULE - All backend communication
// ==========================================================================

import { getAuthHeaders, getApiKey } from './config.js';

// Request timeout in milliseconds (60 seconds)
const XHR_TIMEOUT_MS = 60000;

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
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/synthesize', true);
    xhr.setRequestHeader('X-API-Key', getApiKey());
    xhr.timeout = XHR_TIMEOUT_MS;

    xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            onProgress(percentComplete);
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            try {
                const response = JSON.parse(xhr.responseText);
                onComplete(response);
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

    xhr.onerror = () => {
        onError(new Error('Network error - please check your connection'));
    };

    xhr.ontimeout = () => {
        onError(new Error('Request timed out. Please try again with shorter text.'));
    };

    xhr.send(formData);
    return xhr;
}

// Batch synthesize multiple files
export function synthesizeBatch(formData, onProgress, onComplete, onError) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/synthesize-batch', true);
    xhr.setRequestHeader('X-API-Key', getApiKey());
    // Longer timeout for batch (5 minutes)
    xhr.timeout = XHR_TIMEOUT_MS * 5;

    xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
            const percentComplete = Math.round((event.loaded / event.total) * 50); // 0-50% for upload
            onProgress(percentComplete);
        }
    };

    xhr.onload = () => {
        if (xhr.status === 200) {
            try {
                const response = JSON.parse(xhr.responseText);
                onComplete(response);
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

    xhr.onerror = () => {
        onError(new Error('Network error during batch processing'));
    };

    xhr.ontimeout = () => {
        onError(new Error('Batch processing timed out. Try with fewer files.'));
    };

    xhr.send(formData);
    return xhr;
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
