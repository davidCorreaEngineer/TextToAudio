// ==========================================================================
// SHADOWING PRACTICE MODULE
// ==========================================================================

import { dom } from '../dom.js';
import { shadowingState, resetShadowingState, currentInputMode } from '../state.js';
import { getAuthHeaders } from '../config.js';
import { splitIntoPhrases } from './phrases.js';
import { detectSilenceGaps, buildTimingsFromSilence, estimatePhraseTimings } from '../audio/analysis.js';
import { base64ToBlob } from '../api.js';
import { showToast } from '../ui/toast.js';
import {
    recordSession,
    recordPhraseAttempt,
    updateTextMastery,
    getBulkPhraseMastery,
    getPhraseMastery
} from '../services/progressService.js';
import { updateStreakIndicator, updateProgressDashboard } from '../ui/streak.js';

// Session tracking
let sessionStartTime = null;
let currentSourceText = 'Unknown';
let phrasesCompleted = 0;

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updatePlayPauseButton() {
    const { shadowingPlayPauseBtn } = dom;
    if (!shadowingPlayPauseBtn) return;

    const icon = shadowingPlayPauseBtn.querySelector('i');
    if (icon) {
        if (shadowingState.isPlaying && !shadowingState.isPaused) {
            icon.className = 'fas fa-pause';
        } else {
            icon.className = 'fas fa-play';
        }
    }
}

function clearGapTimers() {
    if (shadowingState.gapTimeoutId) {
        clearTimeout(shadowingState.gapTimeoutId);
        shadowingState.gapTimeoutId = null;
    }
    if (shadowingState.gapIntervalId) {
        clearInterval(shadowingState.gapIntervalId);
        shadowingState.gapIntervalId = null;
    }
}

export function renderPhraseList() {
    const { phraseList } = dom;
    if (!phraseList) return;

    phraseList.innerHTML = '';
    shadowingState.phrases.forEach((phrase, index) => {
        const div = document.createElement('div');

        // Get mastery level for color coding (skip generic "Phrase X" names)
        let masteryClass = '';
        if (!phrase.startsWith('Phrase ')) {
            const mastery = getPhraseMastery(phrase);
            if (mastery.level === 'mastered') {
                masteryClass = ' mastery-mastered';
            } else if (mastery.level === 'struggling') {
                masteryClass = ' mastery-struggling';
            } else if (mastery.level === 'learning' && mastery.attempts > 0) {
                masteryClass = ' mastery-learning';
            }
        }

        div.className = 'phrase-item' + (index === shadowingState.currentIndex ? ' current' : '') + masteryClass;
        div.innerHTML = `
            <span class="phrase-number">${index + 1}</span>
            <span class="phrase-text">${escapeHtml(phrase)}</span>
            <span class="phrase-status">${index < shadowingState.currentIndex ? 'Done' : (index === shadowingState.currentIndex ? 'Current' : '')}</span>
        `;
        div.addEventListener('click', () => jumpToPhrase(index));
        phraseList.appendChild(div);
    });
}

function updatePhraseListUI() {
    const { phraseList, currentPhraseNumSpan } = dom;
    if (!phraseList) return;

    const items = phraseList.querySelectorAll('.phrase-item');
    items.forEach((item, index) => {
        item.classList.remove('current', 'completed');
        const statusSpan = item.querySelector('.phrase-status');
        if (index < shadowingState.currentIndex) {
            item.classList.add('completed');
            if (statusSpan) statusSpan.textContent = 'Done';
        } else if (index === shadowingState.currentIndex) {
            item.classList.add('current');
            if (statusSpan) statusSpan.textContent = 'Current';
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            if (statusSpan) statusSpan.textContent = '';
        }
    });

    if (currentPhraseNumSpan) {
        currentPhraseNumSpan.textContent = shadowingState.currentIndex + 1;
    }
}

async function generatePhraseAudio(phrase) {
    const { voiceSelect, languageSelect, shadowingSpeedSelect, pitchInput } = dom;

    const voice = voiceSelect?.value;
    const language = languageSelect?.value;
    const speed = parseFloat(shadowingSpeedSelect?.value) || 1.0;

    try {
        const response = await fetch('/test-voice', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                language,
                voice,
                speakingRate: speed,
                pitch: parseFloat(pitchInput?.value) || 0,
                customText: phrase,
                useSsml: false
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate phrase audio');
        }

        const result = await response.json();
        if (result.success) {
            const audioBlob = base64ToBlob(result.audioContent, 'audio/mp3');
            return URL.createObjectURL(audioBlob);
        }
        throw new Error(result.error || 'Unknown error');
    } catch (error) {
        console.error('Error generating phrase audio:', error);
        return null;
    }
}

function startGapWithDuration(phraseDuration) {
    const { gapMultiplierSelect, loopCountSelect, gapIndicator, gapTimer } = dom;

    const gapMultiplier = parseFloat(gapMultiplierSelect?.value) || 1.5;
    const gapDuration = phraseDuration * gapMultiplier;

    if (gapIndicator) gapIndicator.classList.add('show');

    let remainingTime = gapDuration;
    if (gapTimer) gapTimer.textContent = remainingTime.toFixed(1) + 's';

    shadowingState.gapIntervalId = setInterval(() => {
        remainingTime -= 0.1;
        if (remainingTime > 0 && gapTimer) {
            gapTimer.textContent = remainingTime.toFixed(1) + 's';
        }
    }, 100);

    shadowingState.gapTimeoutId = setTimeout(() => {
        clearInterval(shadowingState.gapIntervalId);
        if (gapIndicator) gapIndicator.classList.remove('show');

        const loopCount = parseInt(loopCountSelect?.value) || 1;
        shadowingState.currentLoopIteration++;

        if (loopCount === 0 || shadowingState.currentLoopIteration < loopCount) {
            playCurrentPhrase();
        } else {
            // Phrase completed - record progress (score 100 for shadowing = completed)
            const completedPhrase = shadowingState.phrases[shadowingState.currentIndex];
            if (completedPhrase && !completedPhrase.startsWith('Phrase ')) {
                recordPhraseAttempt(completedPhrase, 100, currentSourceText);
            }
            phrasesCompleted++;

            shadowingState.currentLoopIteration = 0;
            shadowingState.currentIndex++;
            playCurrentPhrase();
        }
    }, gapDuration * 1000);
}

function startGap() {
    const { shadowingAudio, gapMultiplierSelect, loopCountSelect, gapIndicator, gapTimer } = dom;

    const gapMultiplier = parseFloat(gapMultiplierSelect?.value) || 1.5;
    const phraseDuration = shadowingAudio?.duration || 2;
    const gapDuration = phraseDuration * gapMultiplier;

    if (gapIndicator) gapIndicator.classList.add('show');

    let remainingTime = gapDuration;
    if (gapTimer) gapTimer.textContent = remainingTime.toFixed(1) + 's';

    shadowingState.gapIntervalId = setInterval(() => {
        remainingTime -= 0.1;
        if (remainingTime > 0 && gapTimer) {
            gapTimer.textContent = remainingTime.toFixed(1) + 's';
        }
    }, 100);

    shadowingState.gapTimeoutId = setTimeout(() => {
        clearInterval(shadowingState.gapIntervalId);
        if (gapIndicator) gapIndicator.classList.remove('show');

        const loopCount = parseInt(loopCountSelect?.value) || 1;
        shadowingState.currentLoopIteration++;

        if (loopCount === 0 || shadowingState.currentLoopIteration < loopCount) {
            playCurrentPhrase();
        } else {
            // Phrase completed - record progress (score 100 for shadowing = completed)
            const completedPhrase = shadowingState.phrases[shadowingState.currentIndex];
            if (completedPhrase && !completedPhrase.startsWith('Phrase ')) {
                recordPhraseAttempt(completedPhrase, 100, currentSourceText);
            }
            phrasesCompleted++;

            shadowingState.currentLoopIteration = 0;
            shadowingState.currentIndex++;
            playCurrentPhrase();
        }
    }, gapDuration * 1000);
}

async function playCurrentPhrase() {
    const { shadowingAudio, gapIndicator, phraseList } = dom;

    if (shadowingState.currentIndex >= shadowingState.phrases.length) {
        endShadowing();
        return;
    }

    const phrase = shadowingState.phrases[shadowingState.currentIndex];
    shadowingState.isPlaying = true;
    updatePlayPauseButton();

    if (gapIndicator) gapIndicator.classList.remove('show');
    updatePhraseListUI();

    if (shadowingState.useExistingAudio && shadowingState.phraseTimings.length > 0) {
        const timing = shadowingState.phraseTimings[shadowingState.currentIndex];
        if (timing && shadowingAudio) {
            shadowingAudio.currentTime = timing.start;

            const onTimeUpdate = function() {
                if (shadowingAudio.currentTime >= timing.end) {
                    shadowingAudio.removeEventListener('timeupdate', onTimeUpdate);
                    shadowingAudio.pause();
                    if (shadowingState.isPlaying && !shadowingState.isPaused) {
                        startGapWithDuration(timing.duration);
                    }
                }
            };
            shadowingAudio.addEventListener('timeupdate', onTimeUpdate);
            shadowingState.currentTimeUpdateHandler = onTimeUpdate;

            shadowingAudio.play();
            console.log('Playing phrase ' + (shadowingState.currentIndex + 1) +
                ' from ' + timing.start.toFixed(2) + 's to ' + timing.end.toFixed(2) + 's');
            return;
        }
    }

    // Fallback: Generate audio for this phrase
    let audioUrl = shadowingState.phraseAudioUrls[shadowingState.currentIndex];
    if (!audioUrl) {
        const currentItem = phraseList?.querySelector('.phrase-item.current .phrase-status');
        if (currentItem) currentItem.textContent = 'Loading...';

        audioUrl = await generatePhraseAudio(phrase);
        if (audioUrl) {
            shadowingState.phraseAudioUrls[shadowingState.currentIndex] = audioUrl;
        } else {
            console.error('Could not generate audio for phrase:', phrase);
            shadowingState.currentIndex++;
            playCurrentPhrase();
            return;
        }
    }

    if (shadowingAudio) {
        shadowingAudio.src = audioUrl;
        shadowingAudio.playbackRate = 1.0;
        shadowingAudio.play();
    }
}

function jumpToPhrase(index) {
    const { shadowingAudio, gapIndicator } = dom;

    clearGapTimers();
    if (shadowingState.currentTimeUpdateHandler && shadowingAudio) {
        shadowingAudio.removeEventListener('timeupdate', shadowingState.currentTimeUpdateHandler);
        shadowingState.currentTimeUpdateHandler = null;
    }
    if (shadowingAudio) shadowingAudio.pause();
    if (gapIndicator) gapIndicator.classList.remove('show');

    shadowingState.currentIndex = index;
    shadowingState.currentLoopIteration = 0;
    updatePhraseListUI();

    if (shadowingState.isPlaying && !shadowingState.isPaused) {
        playCurrentPhrase();
    }
}

function togglePlayPause() {
    const { shadowingAudio, gapIndicator } = dom;

    if (!shadowingState.isPlaying) {
        playCurrentPhrase();
    } else if (shadowingState.isPaused) {
        shadowingState.isPaused = false;
        if (shadowingAudio) shadowingAudio.play();
        updatePlayPauseButton();
    } else {
        shadowingState.isPaused = true;
        if (shadowingAudio) shadowingAudio.pause();
        clearGapTimers();
        if (gapIndicator) gapIndicator.classList.remove('show');
        updatePlayPauseButton();
    }
}

function endShadowing() {
    const { shadowingAudio, gapIndicator } = dom;

    shadowingState.isPlaying = false;
    shadowingState.isPaused = false;
    clearGapTimers();

    if (shadowingState.currentTimeUpdateHandler && shadowingAudio) {
        shadowingAudio.removeEventListener('timeupdate', shadowingState.currentTimeUpdateHandler);
        shadowingState.currentTimeUpdateHandler = null;
    }
    if (shadowingAudio) shadowingAudio.pause();
    if (gapIndicator) gapIndicator.classList.remove('show');
    updatePlayPauseButton();

    // Record session for progress tracking
    const durationSec = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0;
    if (phrasesCompleted > 0 || shadowingState.currentIndex > 0) {
        recordSession({
            type: 'shadowing',
            durationSec,
            phrasesAttempted: shadowingState.phrases.length,
            phrasesCorrect: phrasesCompleted,
            avgScore: shadowingState.phrases.length > 0
                ? Math.round((phrasesCompleted / shadowingState.phrases.length) * 100)
                : 0,
            sourceText: currentSourceText
        });

        // Update text mastery
        const realPhrases = shadowingState.phrases.filter(p => !p.startsWith('Phrase '));
        if (realPhrases.length > 0) {
            const phraseMastery = getBulkPhraseMastery(realPhrases);
            updateTextMastery(currentSourceText, phraseMastery);
        }

        // Refresh streak UI
        updateStreakIndicator();
        updateProgressDashboard();
    }

    console.log('Shadowing session complete!');
}

function stopShadowing() {
    const { shadowingPlayer, shadowingLaunch } = dom;

    endShadowing();

    shadowingState.phraseAudioUrls.forEach(url => {
        if (url) URL.revokeObjectURL(url);
    });
    shadowingState.phraseAudioUrls = [];

    if (shadowingPlayer) shadowingPlayer.classList.remove('active');
    if (shadowingLaunch) shadowingLaunch.style.display = 'flex';
}

export function updateShadowingVisibility() {
    const { textEditor, textPreview, mainAudioPlayer, shadowingCard } = dom;

    let text = '';
    if (currentInputMode === 'editor') {
        text = textEditor?.value.trim() || '';
    } else {
        text = textPreview?.value.trim() || '';
    }

    const hasSrc = mainAudioPlayer?.src && mainAudioPlayer.src.length > 0 && !mainAudioPlayer.src.endsWith('/');
    const hasDuration = mainAudioPlayer?.duration && mainAudioPlayer.duration > 0 && !isNaN(mainAudioPlayer.duration);
    const hasAudio = hasSrc && hasDuration;

    if ((text || hasAudio) && shadowingCard) {
        shadowingCard.classList.add('show');
        updateShadowingButtonState();
    } else if (shadowingCard) {
        shadowingCard.classList.remove('show');
    }
}

function updateShadowingButtonState() {
    const { startShadowingBtn, mainAudioPlayer, voiceSelect, textEditor, textPreview } = dom;
    if (!startShadowingBtn) return;

    const hasSrc = mainAudioPlayer?.src && mainAudioPlayer.src.length > 0 && !mainAudioPlayer.src.endsWith('/');
    const hasDuration = mainAudioPlayer?.duration && mainAudioPlayer.duration > 0 && !isNaN(mainAudioPlayer.duration);
    const hasAudio = hasSrc && hasDuration;

    let text = '';
    if (currentInputMode === 'editor') {
        text = textEditor?.value.trim() || '';
    } else {
        text = textPreview?.value.trim() || '';
    }

    if (hasAudio) {
        startShadowingBtn.innerHTML = '<i class="fas fa-play"></i> Start Practice (0 API calls)';
        startShadowingBtn.disabled = false;
    } else if (text && voiceSelect?.value) {
        startShadowingBtn.innerHTML = '<i class="fas fa-play"></i> Start Practice';
        startShadowingBtn.disabled = false;
    } else {
        startShadowingBtn.innerHTML = '<i class="fas fa-play"></i> Start Practice';
        startShadowingBtn.disabled = !text && !hasAudio;
    }
}

function initShadowing() {
    const {
        textEditor, textPreview, mainAudioPlayer, voiceSelect,
        shadowingAudio, startShadowingBtn, shadowingLaunch,
        shadowingPlayer, totalPhrasesSpan, speakingRateInput
    } = dom;

    let text = '';
    if (currentInputMode === 'editor') {
        text = textEditor?.value.trim() || '';
    } else {
        text = textPreview?.value.trim() || '';
    }

    const hasSrc = mainAudioPlayer?.src && mainAudioPlayer.src.length > 0 && !mainAudioPlayer.src.endsWith('/');
    const hasDuration = mainAudioPlayer?.duration && mainAudioPlayer.duration > 0 && !isNaN(mainAudioPlayer.duration);
    const hasAudio = hasSrc && hasDuration;

    if (!text && !hasAudio) {
        showToast('warning', 'No Content', 'Please enter some text or load an audio file first.');
        return;
    }

    if (!hasAudio && text && !voiceSelect?.value) {
        showToast('warning', 'No Voice', 'Please select a voice first.');
        return;
    }

    const audioOnlyMode = hasAudio && !text;

    if (text) {
        shadowingState.phrases = splitIntoPhrases(text);
    } else {
        shadowingState.phrases = [];
    }

    shadowingState.currentIndex = 0;
    shadowingState.isPlaying = false;
    shadowingState.isPaused = false;
    shadowingState.currentLoopIteration = 0;
    shadowingState.audioOnlyMode = audioOnlyMode;
    shadowingState.phraseAudioUrls = [];

    // Track session start and source
    sessionStartTime = Date.now();
    phrasesCompleted = 0;
    currentSourceText = text.substring(0, 50).replace(/\s+/g, ' ').trim() || 'Shadowing Practice';

    const existingAudioSrc = mainAudioPlayer?.src;

    console.log('Shadowing init:');
    console.log('  Audio source:', existingAudioSrc);
    console.log('  Audio-only mode:', audioOnlyMode);
    console.log('  Text phrases:', shadowingState.phrases.length);

    if (hasAudio) {
        shadowingState.useExistingAudio = true;
        shadowingState.fullAudioUrl = existingAudioSrc;
        if (shadowingAudio) shadowingAudio.src = existingAudioSrc;

        console.log('Shadowing: Using loaded audio (0 API calls!)');

        if (startShadowingBtn) {
            startShadowingBtn.disabled = true;
            startShadowingBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing audio...';
        }

        detectSilenceGaps(existingAudioSrc).then((silenceResult) => {
            if (startShadowingBtn) {
                startShadowingBtn.disabled = false;
                updateShadowingButtonState();
            }

            if (silenceResult && silenceResult.gaps.length > 0) {
                if (audioOnlyMode) {
                    const numPhrases = silenceResult.gaps.length + 1;
                    shadowingState.phrases = [];
                    for (let p = 1; p <= numPhrases; p++) {
                        shadowingState.phrases.push('Phrase ' + p);
                    }
                }

                shadowingState.phraseTimings = buildTimingsFromSilence(
                    silenceResult,
                    shadowingState.phrases.length
                );

                renderPhraseList();
                if (totalPhrasesSpan) totalPhrasesSpan.textContent = shadowingState.phrases.length;
            } else if (!audioOnlyMode) {
                const speakingRate = parseFloat(speakingRateInput?.value) || 1.0;
                shadowingState.phraseTimings = estimatePhraseTimings(
                    shadowingState.phrases,
                    speakingRate,
                    mainAudioPlayer.duration
                );
            } else {
                shadowingState.phrases = ['Full Audio'];
                shadowingState.phraseTimings = [{
                    start: 0,
                    end: mainAudioPlayer.duration,
                    duration: mainAudioPlayer.duration
                }];
                renderPhraseList();
                if (totalPhrasesSpan) totalPhrasesSpan.textContent = '1';
            }
        }).catch((error) => {
            console.error('Silence detection failed:', error);
            if (startShadowingBtn) {
                startShadowingBtn.disabled = false;
                updateShadowingButtonState();
            }

            if (!audioOnlyMode) {
                const speakingRate = parseFloat(speakingRateInput?.value) || 1.0;
                shadowingState.phraseTimings = estimatePhraseTimings(
                    shadowingState.phrases,
                    speakingRate,
                    mainAudioPlayer.duration
                );
            } else {
                shadowingState.phrases = ['Full Audio'];
                shadowingState.phraseTimings = [{
                    start: 0,
                    end: mainAudioPlayer.duration,
                    duration: mainAudioPlayer.duration
                }];
                renderPhraseList();
                if (totalPhrasesSpan) totalPhrasesSpan.textContent = '1';
            }
        });
    } else {
        shadowingState.useExistingAudio = false;
        shadowingState.phraseTimings = [];
    }

    renderPhraseList();

    if (shadowingLaunch) shadowingLaunch.style.display = 'none';
    if (shadowingPlayer) shadowingPlayer.classList.add('active');
    if (totalPhrasesSpan) totalPhrasesSpan.textContent = shadowingState.phrases.length || '?';

    const { currentPhraseNumSpan } = dom;
    if (currentPhraseNumSpan) currentPhraseNumSpan.textContent = '1';

    console.log('Shadowing initialized');
}

export function initShadowingEvents() {
    const {
        startShadowingBtn, shadowingPlayPauseBtn, shadowingPrevBtn,
        shadowingNextBtn, shadowingRestartBtn, shadowingStopBtn,
        shadowingAudio, textEditor, textPreview, mainAudioPlayer
    } = dom;

    if (startShadowingBtn) {
        startShadowingBtn.addEventListener('click', initShadowing);
    }
    if (shadowingPlayPauseBtn) {
        shadowingPlayPauseBtn.addEventListener('click', togglePlayPause);
    }
    if (shadowingPrevBtn) {
        shadowingPrevBtn.addEventListener('click', () => {
            if (shadowingState.currentIndex > 0) {
                jumpToPhrase(shadowingState.currentIndex - 1);
            }
        });
    }
    if (shadowingNextBtn) {
        shadowingNextBtn.addEventListener('click', () => {
            if (shadowingState.currentIndex < shadowingState.phrases.length - 1) {
                jumpToPhrase(shadowingState.currentIndex + 1);
            }
        });
    }
    if (shadowingRestartBtn) {
        shadowingRestartBtn.addEventListener('click', () => jumpToPhrase(0));
    }
    if (shadowingStopBtn) {
        shadowingStopBtn.addEventListener('click', stopShadowing);
    }
    if (shadowingAudio) {
        shadowingAudio.addEventListener('ended', () => {
            if (shadowingState.isPlaying) {
                startGap();
            }
        });
    }

    // Visibility listeners
    if (textEditor) {
        textEditor.addEventListener('input', updateShadowingVisibility);
    }
    if (mainAudioPlayer) {
        mainAudioPlayer.addEventListener('loadedmetadata', updateShadowingVisibility);
        mainAudioPlayer.addEventListener('loadeddata', updateShadowingVisibility);
    }
}
