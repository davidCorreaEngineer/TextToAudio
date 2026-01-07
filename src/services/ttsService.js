const textToSpeech = require('@google-cloud/text-to-speech');
const path = require('path');

/**
 * TTS Service Layer
 * Handles all text-to-speech business logic independently of HTTP layer
 */

// Configuration
const API_TIMEOUT_MS = 30000; // 30 second timeout
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

/**
 * Wraps a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operation - Operation name for error message
 * @returns {Promise} Promise that rejects on timeout
 */
function withTimeout(promise, timeoutMs, operation = 'Operation') {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
            () => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)),
            timeoutMs
        );
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId);
    });
}

/**
 * Checks if an error is retryable (quota/rate limit errors)
 * @param {Error} error - The error to check
 * @returns {boolean} Whether the error is retryable
 */
function isRetryableError(error) {
    const message = error.message || '';
    const code = error.code;
    // Retry on 429 (quota exceeded), 503 (service unavailable), or RESOURCE_EXHAUSTED
    return code === 429 || code === 503 || code === 8 ||
           message.includes('RESOURCE_EXHAUSTED') ||
           message.includes('Quota exceeded') ||
           message.includes('rate limit');
}

/**
 * Delays execution for specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a Google Cloud TTS client
 * @param {string} keyfilePath - Path to Google Cloud credentials
 * @returns {textToSpeech.TextToSpeechClient} TTS client instance
 */
function createTtsClient(keyfilePath) {
    return new textToSpeech.TextToSpeechClient({
        keyFilename: keyfilePath
    });
}

/**
 * Builds synthesis request object
 * @param {Object} params
 * @param {string} params.text - Text or SSML content
 * @param {string} params.languageCode - Language code (e.g., 'en-US')
 * @param {string} params.voiceName - Voice name
 * @param {number} params.speakingRate - Speaking rate (0.25-4.0)
 * @param {number} params.pitch - Pitch adjustment (-20.0 to 20.0)
 * @param {boolean} params.useSsml - Whether text contains SSML
 * @returns {Object} TTS API request object
 */
function buildSynthesisRequest({ text, languageCode, voiceName, speakingRate = 1.0, pitch = 0.0, useSsml = false }) {
    const input = useSsml ? { ssml: text } : { text };

    return {
        input,
        voice: { languageCode, name: voiceName },
        audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: parseFloat(speakingRate),
            pitch: parseFloat(pitch)
        }
    };
}

/**
 * Generates speech from text using Google Cloud TTS
 * Includes timeout and retry logic for resilience
 * @param {textToSpeech.TextToSpeechClient} client - TTS client
 * @param {Object} params - Synthesis parameters
 * @returns {Promise<Buffer>} Audio content as Buffer
 */
async function generateSpeech(client, params) {
    const request = buildSynthesisRequest(params);
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const [response] = await withTimeout(
                client.synthesizeSpeech(request),
                API_TIMEOUT_MS,
                'Speech synthesis'
            );
            return response.audioContent;
        } catch (error) {
            lastError = error;

            // Don't retry on non-retryable errors or last attempt
            if (!isRetryableError(error) || attempt === MAX_RETRIES) {
                throw error;
            }

            // Wait before retrying
            const delayMs = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
            console.log(`GCP API error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${error.message}. Retrying in ${delayMs}ms...`);
            await delay(delayMs);
        }
    }

    throw lastError;
}

/**
 * Lists available voices from Google Cloud TTS
 * Includes timeout for resilience
 * @param {textToSpeech.TextToSpeechClient} client - TTS client
 * @param {string[]} languageCodes - Optional language codes filter
 * @returns {Promise<Array>} Array of voice objects
 */
async function listVoices(client, languageCodes = null) {
    const [result] = await withTimeout(
        client.listVoices({}),
        API_TIMEOUT_MS,
        'List voices'
    );

    if (!languageCodes || languageCodes.length === 0) {
        return result.voices;
    }

    return result.voices.filter(voice =>
        voice.languageCodes.some(code => languageCodes.includes(code))
    );
}

module.exports = {
    createTtsClient,
    buildSynthesisRequest,
    generateSpeech,
    listVoices
};
