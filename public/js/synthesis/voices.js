// ==========================================================================
// VOICES MODULE
// ==========================================================================

import { fetchVoices } from '../api.js';
import { dom } from '../dom.js';

let cachedVoices = [];

export async function loadVoices() {
    console.log("Loading voices...");
    const { resultDiv } = dom;

    try {
        console.log('Fetching voices from server...');
        const voices = await fetchVoices();
        console.log('Received voices:', voices);
        cachedVoices = voices;
        updateVoiceOptions(voices);
    } catch (error) {
        console.error('Error loading voices:', error);
        if (resultDiv) {
            resultDiv.innerHTML = `<p class="text-danger">${error.message}</p>`;
        }
    }
}

export function updateVoiceOptions(voices) {
    const { languageSelect, voiceSelect } = dom;
    if (!languageSelect || !voiceSelect) return;

    const language = languageSelect.value;
    console.log('Selected language:', language);

    voiceSelect.innerHTML = '<option value="">Select a voice</option>';

    const filteredVoices = voices.filter(voice =>
        voice.languageCodes.includes(language)
    );
    console.log('Filtered voices for', language, ':', filteredVoices);

    filteredVoices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.ssmlGender})`;
        voiceSelect.appendChild(option);
    });

    if (filteredVoices.length === 0) {
        voiceSelect.innerHTML += '<option disabled>No voices available for selected language.</option>';
    }
}

export function getCachedVoices() {
    return cachedVoices;
}

export function initVoicesEvents() {
    const { languageSelect } = dom;
    if (languageSelect) {
        languageSelect.addEventListener('change', loadVoices);
    }
}
