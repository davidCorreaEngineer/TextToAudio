// ==========================================================================
// AUDIO PLAYER MODULE
// ==========================================================================

import { dom } from '../dom.js';
import { setCurrentMainAudioUrl, currentMainAudioUrl } from '../state.js';

let mainAudioUrlRef = null;

/**
 * Load audio into the main player
 * @param {Blob|string} audioSource - Audio blob or URL
 * @param {string} fileName - Name to display
 */
export function loadAudioIntoPlayer(audioSource, fileName) {
    const { mainAudioPlayer, audioFileNameSpan, audioFileInfo } = dom;

    // Clean up previous audio URL if it was a blob URL
    if (mainAudioUrlRef && mainAudioUrlRef.startsWith('blob:')) {
        URL.revokeObjectURL(mainAudioUrlRef);
    }

    // Set the audio source
    if (audioSource instanceof Blob) {
        mainAudioUrlRef = URL.createObjectURL(audioSource);
        mainAudioPlayer.src = mainAudioUrlRef;
    } else {
        // It's a URL string
        mainAudioUrlRef = audioSource;
        mainAudioPlayer.src = audioSource;
    }

    setCurrentMainAudioUrl(mainAudioUrlRef);

    // Update UI
    if (audioFileNameSpan) {
        audioFileNameSpan.textContent = fileName || 'Audio loaded';
    }
    if (audioFileInfo) {
        audioFileInfo.style.display = 'block';
    }
    if (mainAudioPlayer) {
        mainAudioPlayer.style.display = 'block';
    }

    console.log("Audio loaded into player:", fileName);
}

/**
 * Initialize audio player event listeners (debug)
 */
export function initAudioPlayerEvents() {
    const { mainAudioPlayer } = dom;
    if (!mainAudioPlayer) return;

    mainAudioPlayer.addEventListener('play', () => {
        console.log("Audio player: play event");
        console.log("  currentTime:", mainAudioPlayer.currentTime);
    });

    mainAudioPlayer.addEventListener('pause', () => {
        console.log("Audio player: pause event");
        console.log("  currentTime:", mainAudioPlayer.currentTime);
    });

    mainAudioPlayer.addEventListener('ended', () => {
        console.log("Audio player: ended event");
    });

    mainAudioPlayer.addEventListener('error', () => {
        console.error("Audio player error:", mainAudioPlayer.error);
    });

    mainAudioPlayer.addEventListener('loadeddata', () => {
        console.log("Audio player: loadeddata event, duration:", mainAudioPlayer.duration);
    });

    // Prevent audio player clicks from bubbling
    mainAudioPlayer.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

/**
 * Initialize browser audio test button
 */
export function initAudioTest() {
    const testAudioBtn = document.getElementById('testAudioBtn');
    const audioTestResult = document.getElementById('audioTestResult');

    if (!testAudioBtn) return;

    testAudioBtn.addEventListener('click', () => {
        console.log("Testing browser audio...");
        if (audioTestResult) {
            audioTestResult.textContent = "Playing test tone...";
            audioTestResult.style.color = '#666';
        }

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const audioContext = new AudioContext();

            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 440; // A4 note
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;

            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
                audioContext.close();
                if (audioTestResult) {
                    audioTestResult.textContent = "Test tone played! Did you hear it?";
                    audioTestResult.style.color = 'green';
                }
                console.log("Test tone completed.");
            }, 500);
        } catch (err) {
            console.error("Test audio failed:", err);
            if (audioTestResult) {
                audioTestResult.textContent = "Audio test failed: " + err.message;
                audioTestResult.style.color = 'red';
            }
        }
    });
}

/**
 * Get current main audio URL
 */
export function getMainAudioUrl() {
    return mainAudioUrlRef;
}
