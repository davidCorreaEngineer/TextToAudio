const textToSpeech = require('@google-cloud/text-to-speech');
const path = require('path');

/**
 * TTS Service Layer
 * Handles all text-to-speech business logic independently of HTTP layer
 */

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
 * @param {textToSpeech.TextToSpeechClient} client - TTS client
 * @param {Object} params - Synthesis parameters
 * @returns {Promise<Buffer>} Audio content as Buffer
 */
async function generateSpeech(client, params) {
    const request = buildSynthesisRequest(params);
    const [response] = await client.synthesizeSpeech(request);
    return response.audioContent;
}

/**
 * Lists available voices from Google Cloud TTS
 * @param {textToSpeech.TextToSpeechClient} client - TTS client
 * @param {string[]} languageCodes - Optional language codes filter
 * @returns {Promise<Array>} Array of voice objects
 */
async function listVoices(client, languageCodes = null) {
    const [result] = await client.listVoices({});

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
