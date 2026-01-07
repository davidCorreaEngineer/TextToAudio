// ==========================================================================
// TEST VOICE BUTTON
// ==========================================================================

import { dom } from '../dom.js';
import { getAuthHeaders } from '../config.js';
import { base64ToBlob } from '../api.js';
import { showToast } from '../ui/toast.js';
import { setButtonLoading } from '../ui/loading.js';

let testVoiceAudioUrl = null;

export function initTestVoiceButton() {
    const {
        testVoiceButton, voiceSelect, languageSelect,
        speakingRateInput, pitchInput,
        audioPlayer, testSentenceDiv, resultDiv
    } = dom;

    if (testVoiceButton) {
        testVoiceButton.addEventListener('click', async function() {
            console.log("Test Voice button clicked.");

            const voice = voiceSelect?.value;
            if (!voice) {
                showToast('warning', 'No Voice Selected', 'Please select a voice first.');
                return;
            }

            setButtonLoading(testVoiceButton, true);

            try {
                const response = await fetch('/test-voice', {
                    method: 'POST',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                        language: languageSelect?.value,
                        voice,
                        speakingRate: speakingRateInput?.value,
                        pitch: pitchInput?.value
                    })
                });

                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem('tts_api_key');
                    if (resultDiv) {
                        resultDiv.innerHTML = '<p class="text-danger">Invalid API key. Please reload and enter a valid key.</p>';
                    }
                    showToast('error', 'Authentication Failed', 'Invalid API key.');
                    setButtonLoading(testVoiceButton, false);
                    return;
                }

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to test voice');
                }

                const result = await response.json();
                if (result.success) {
                    showToast('info', 'Voice Preview', 'Playing voice sample...');

                    if (testVoiceAudioUrl) {
                        URL.revokeObjectURL(testVoiceAudioUrl);
                    }

                    const audioBlob = base64ToBlob(result.audioContent, 'audio/mp3');
                    testVoiceAudioUrl = URL.createObjectURL(audioBlob);

                    if (audioPlayer) {
                        audioPlayer.src = testVoiceAudioUrl;
                        audioPlayer.style.display = 'block';
                        audioPlayer.play();
                    }
                    if (testSentenceDiv) {
                        testSentenceDiv.textContent = `Test sentence: "${result.testText}"`;
                    }
                    console.log("Test audio played.");
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                console.error('Error testing voice:', error);
                showToast('error', 'Voice Test Failed', error.message);
                if (resultDiv) {
                    resultDiv.innerHTML = `<p class="text-danger">Error testing voice: ${error.message}</p>`;
                }
            } finally {
                setButtonLoading(testVoiceButton, false);
            }
        });
    }
}
