// ==========================================================================
// DICTATION PRACTICE MODULE
// ==========================================================================

import { dom } from '../dom.js';
import { dictationState, resetDictationState, currentInputMode } from '../state.js';
import { getAuthHeaders } from '../config.js';
import { splitIntoPhrases, compareAnswers } from './phrases.js';
import { detectSilenceGaps, buildTimingsFromSilence, estimatePhraseTimings } from '../audio/analysis.js';
import { base64ToBlob } from '../api.js';

function updateDictationProgress() {
    const { dictationCurrentNum, dictationProgressFill, dictationScoreSpan } = dom;

    const current = dictationState.currentIndex + 1;
    const total = dictationState.phrases.length;
    const progress = (current / total) * 100;

    if (dictationCurrentNum) dictationCurrentNum.textContent = current;
    if (dictationProgressFill) dictationProgressFill.style.width = progress + '%';

    if (dictationState.scores.length > 0) {
        const avgScore = dictationState.scores.reduce((a, b) => a + b, 0) / dictationState.scores.length;
        if (dictationScoreSpan) dictationScoreSpan.textContent = Math.round(avgScore);
    } else {
        if (dictationScoreSpan) dictationScoreSpan.textContent = '0';
    }
}

function updateReplayCount() {
    const { replayCountSpan } = dom;
    if (!replayCountSpan) return;

    replayCountSpan.textContent = dictationState.replaysLeft + ' replay' + (dictationState.replaysLeft !== 1 ? 's' : '') + ' left';

    replayCountSpan.classList.remove('warning', 'danger');
    if (dictationState.replaysLeft === 1) {
        replayCountSpan.classList.add('warning');
    } else if (dictationState.replaysLeft === 0) {
        replayCountSpan.classList.add('danger');
    }
}

function showDictationUI() {
    const {
        dictationLaunch, dictationPlayer, dictationResult,
        dictationComplete, dictationTotalNum, dictationInput
    } = dom;

    if (dictationLaunch) dictationLaunch.style.display = 'none';
    if (dictationPlayer) dictationPlayer.classList.add('active');
    if (dictationResult) dictationResult.style.display = 'none';
    if (dictationComplete) dictationComplete.style.display = 'none';

    if (dictationTotalNum) dictationTotalNum.textContent = dictationState.phrases.length;
    updateDictationProgress();

    if (dictationInput) {
        dictationInput.value = '';
        dictationInput.disabled = false;
        dictationInput.focus();
    }

    dictationState.replaysLeft = dictationState.maxReplays;
    updateReplayCount();

    console.log('Dictation initialized with ' + dictationState.phrases.length + ' phrases');
}

async function playDictationPhrase() {
    if (dictationState.replaysLeft <= 0) return;

    const {
        dictationPlayBtn, dictationAudio, dictationSpeedSelect,
        voiceSelect, languageSelect, pitchInput
    } = dom;

    dictationState.replaysLeft--;
    updateReplayCount();

    const phrase = dictationState.phrases[dictationState.currentIndex];
    const speed = parseFloat(dictationSpeedSelect?.value) || 1.0;

    if (dictationPlayBtn) {
        dictationPlayBtn.disabled = true;
        dictationPlayBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Playing...';
    }

    if (dictationState.useExistingAudio && dictationState.phraseTimings.length > 0) {
        const timing = dictationState.phraseTimings[dictationState.currentIndex];
        if (timing && dictationAudio) {
            dictationAudio.currentTime = timing.start;
            dictationAudio.playbackRate = speed;

            const onTimeUpdate = function() {
                if (dictationAudio.currentTime >= timing.end) {
                    dictationAudio.removeEventListener('timeupdate', onTimeUpdate);
                    dictationAudio.pause();
                    if (dictationPlayBtn) {
                        dictationPlayBtn.disabled = false;
                        dictationPlayBtn.innerHTML = '<i class="fas fa-volume-up"></i> Play';
                    }
                }
            };
            dictationAudio.addEventListener('timeupdate', onTimeUpdate);
            dictationAudio.play();
            return;
        }
    }

    // Generate audio via API
    try {
        const response = await fetch('/test-voice', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                language: languageSelect?.value,
                voice: voiceSelect?.value,
                speakingRate: speed,
                pitch: parseFloat(pitchInput?.value) || 0,
                customText: phrase,
                useSsml: false
            })
        });

        if (!response.ok) {
            throw new Error('Failed to generate audio');
        }

        const result = await response.json();
        if (result.success) {
            if (dictationState.currentPhraseAudioUrl) {
                URL.revokeObjectURL(dictationState.currentPhraseAudioUrl);
            }

            const audioBlob = base64ToBlob(result.audioContent, 'audio/mp3');
            dictationState.currentPhraseAudioUrl = URL.createObjectURL(audioBlob);
            if (dictationAudio) {
                dictationAudio.src = dictationState.currentPhraseAudioUrl;
                dictationAudio.play();
            }
        }
    } catch (error) {
        console.error('Error generating dictation audio:', error);
        alert('Error playing audio: ' + error.message);
    }

    if (dictationPlayBtn) {
        dictationPlayBtn.disabled = false;
        dictationPlayBtn.innerHTML = '<i class="fas fa-volume-up"></i> Play';
    }
}

function showDictationResult(userAnswer, correctAnswer, result) {
    const {
        dictationInput, dictationCheckBtn, dictationSkipBtn,
        dictationResult, resultIcon, resultLabel,
        userAnswerDisplay, correctAnswerDisplay, resultDiff
    } = dom;

    if (dictationInput) dictationInput.disabled = true;
    if (dictationCheckBtn) dictationCheckBtn.style.display = 'none';
    if (dictationSkipBtn) dictationSkipBtn.style.display = 'none';

    if (dictationResult) dictationResult.style.display = 'block';

    const header = dictationResult?.querySelector('.result-header');
    if (header) {
        header.classList.remove('correct', 'partial', 'incorrect');

        if (result.score === 100) {
            if (resultIcon) resultIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
            if (resultLabel) resultLabel.textContent = 'Perfect!';
            header.classList.add('correct');
        } else if (result.score >= 70) {
            if (resultIcon) resultIcon.innerHTML = '<i class="fas fa-minus-circle"></i>';
            if (resultLabel) resultLabel.textContent = 'Almost there! (' + result.score + '%)';
            header.classList.add('partial');
        } else {
            if (resultIcon) resultIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
            if (resultLabel) resultLabel.textContent = 'Keep practicing (' + result.score + '%)';
            header.classList.add('incorrect');
        }
    }

    if (userAnswerDisplay) userAnswerDisplay.textContent = userAnswer || '(no answer)';
    if (correctAnswerDisplay) correctAnswerDisplay.textContent = correctAnswer;

    // Build diff display
    if (resultDiff && result.diff) {
        let diffHtml = '';
        result.diff.forEach(item => {
            if (item.type === 'match') {
                diffHtml += `<span class="diff-match">${item.correct}</span> `;
            } else if (item.type === 'close') {
                diffHtml += `<span class="diff-close" title="You wrote: ${item.user}">${item.correct}</span> `;
            } else if (item.type === 'wrong') {
                diffHtml += `<span class="diff-wrong" title="You wrote: ${item.user}">${item.correct}</span> `;
            } else if (item.type === 'missing') {
                diffHtml += `<span class="diff-missing">${item.correct}</span> `;
            } else if (item.type === 'extra') {
                diffHtml += `<span class="diff-extra">${item.user}</span> `;
            }
        });
        resultDiff.innerHTML = diffHtml;
    }
}

function checkDictationAnswer() {
    const { dictationInput } = dom;

    const userAnswer = dictationInput?.value.trim() || '';
    const correctAnswer = dictationState.phrases[dictationState.currentIndex];

    const result = compareAnswers(userAnswer, correctAnswer);

    dictationState.scores.push(result.score);
    if (result.score === 100) {
        dictationState.totalCorrect++;
    }

    updateDictationProgress();
    showDictationResult(userAnswer, correctAnswer, result);
}

function nextDictationPhrase() {
    const {
        dictationInput, dictationCheckBtn, dictationSkipBtn,
        dictationResult, dictationNextBtn
    } = dom;

    dictationState.currentIndex++;

    if (dictationState.currentIndex >= dictationState.phrases.length) {
        showDictationComplete();
        return;
    }

    // Reset for next phrase
    if (dictationInput) {
        dictationInput.value = '';
        dictationInput.disabled = false;
        dictationInput.focus();
    }
    if (dictationCheckBtn) dictationCheckBtn.style.display = 'inline-flex';
    if (dictationSkipBtn) dictationSkipBtn.style.display = 'inline-flex';
    if (dictationResult) dictationResult.style.display = 'none';

    dictationState.replaysLeft = dictationState.maxReplays;
    updateReplayCount();
    updateDictationProgress();
}

function skipDictationPhrase() {
    dictationState.scores.push(0);
    updateDictationProgress();
    nextDictationPhrase();
}

function showDictationComplete() {
    const {
        dictationPlayer, dictationComplete, dictationResult,
        finalScoreSpan, phrasesCorrectSpan
    } = dom;

    if (dictationPlayer) dictationPlayer.classList.remove('active');
    if (dictationComplete) dictationComplete.style.display = 'block';
    if (dictationResult) dictationResult.style.display = 'none';

    const avgScore = dictationState.scores.length > 0
        ? Math.round(dictationState.scores.reduce((a, b) => a + b, 0) / dictationState.scores.length)
        : 0;

    if (finalScoreSpan) finalScoreSpan.textContent = avgScore + '%';
    if (phrasesCorrectSpan) {
        phrasesCorrectSpan.textContent = dictationState.totalCorrect + '/' + dictationState.phrases.length;
    }

    dictationState.isActive = false;
    console.log('Dictation complete! Score: ' + avgScore + '%');
}

function restartDictation() {
    const { dictationComplete, dictationLaunch, dictationPlayer } = dom;

    resetDictationState();

    if (dictationComplete) dictationComplete.style.display = 'none';
    if (dictationPlayer) dictationPlayer.classList.remove('active');
    if (dictationLaunch) dictationLaunch.style.display = 'flex';
}

function stopDictation() {
    const { dictationPlayer, dictationLaunch, dictationComplete } = dom;

    if (dictationState.currentPhraseAudioUrl) {
        URL.revokeObjectURL(dictationState.currentPhraseAudioUrl);
    }

    resetDictationState();

    if (dictationPlayer) dictationPlayer.classList.remove('active');
    if (dictationComplete) dictationComplete.style.display = 'none';
    if (dictationLaunch) dictationLaunch.style.display = 'flex';
}

function replayCorrectAudio() {
    const { dictationAudio } = dom;
    if (!dictationAudio) return;

    if (dictationState.useExistingAudio && dictationState.phraseTimings.length > 0) {
        const timing = dictationState.phraseTimings[dictationState.currentIndex];
        if (timing) {
            dictationAudio.currentTime = timing.start;
            dictationAudio.play();
        }
    } else if (dictationState.currentPhraseAudioUrl) {
        dictationAudio.src = dictationState.currentPhraseAudioUrl;
        dictationAudio.play();
    }
}

export function updateDictationVisibility() {
    const { textEditor, textPreview, dictationCard } = dom;

    let text = '';
    if (currentInputMode === 'editor') {
        text = textEditor?.value.trim() || '';
    } else {
        text = textPreview?.value.trim() || '';
    }

    if (text && dictationCard) {
        dictationCard.classList.add('show');
    } else if (dictationCard) {
        dictationCard.classList.remove('show');
    }
}

function initDictation() {
    const {
        textEditor, textPreview, voiceSelect, mainAudioPlayer,
        dictationAudio, startDictationBtn, speakingRateInput
    } = dom;

    let text = '';
    if (currentInputMode === 'editor') {
        text = textEditor?.value.trim() || '';
    } else {
        text = textPreview?.value.trim() || '';
    }

    if (!text) {
        alert('Please enter some text first. Dictation requires text to check your answers against.');
        return;
    }

    if (!voiceSelect?.value) {
        alert('Please select a voice first.');
        return;
    }

    dictationState.phrases = splitIntoPhrases(text);
    if (dictationState.phrases.length === 0) {
        alert('No phrases found in the text.');
        return;
    }

    dictationState.currentIndex = 0;
    dictationState.replaysLeft = dictationState.maxReplays;
    dictationState.scores = [];
    dictationState.totalCorrect = 0;
    dictationState.isActive = true;

    const hasSrc = mainAudioPlayer?.src && mainAudioPlayer.src.length > 0 && !mainAudioPlayer.src.endsWith('/');
    const hasDuration = mainAudioPlayer?.duration && mainAudioPlayer.duration > 0 && !isNaN(mainAudioPlayer.duration);

    if (hasSrc && hasDuration) {
        dictationState.useExistingAudio = true;
        dictationState.fullAudioUrl = mainAudioPlayer.src;
        if (dictationAudio) dictationAudio.src = mainAudioPlayer.src;

        if (startDictationBtn) {
            startDictationBtn.disabled = true;
            startDictationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        }

        detectSilenceGaps(mainAudioPlayer.src).then((silenceResult) => {
            if (startDictationBtn) {
                startDictationBtn.disabled = false;
                startDictationBtn.innerHTML = '<i class="fas fa-play"></i> Start Dictation';
            }

            if (silenceResult && silenceResult.gaps.length > 0) {
                dictationState.phraseTimings = buildTimingsFromSilence(
                    silenceResult,
                    dictationState.phrases.length
                );
            } else {
                const speakingRate = parseFloat(speakingRateInput?.value) || 1.0;
                dictationState.phraseTimings = estimatePhraseTimings(
                    dictationState.phrases,
                    speakingRate,
                    mainAudioPlayer.duration
                );
            }

            showDictationUI();
        }).catch((error) => {
            console.error('Silence detection failed:', error);
            if (startDictationBtn) {
                startDictationBtn.disabled = false;
                startDictationBtn.innerHTML = '<i class="fas fa-play"></i> Start Dictation';
            }

            const speakingRate = parseFloat(speakingRateInput?.value) || 1.0;
            dictationState.phraseTimings = estimatePhraseTimings(
                dictationState.phrases,
                speakingRate,
                mainAudioPlayer.duration
            );
            showDictationUI();
        });
    } else {
        dictationState.useExistingAudio = false;
        dictationState.phraseTimings = [];
        showDictationUI();
    }
}

export function initDictationEvents() {
    const {
        startDictationBtn, dictationPlayBtn, dictationCheckBtn,
        dictationSkipBtn, dictationNextBtn, dictationStopBtn,
        dictationRestartBtn, dictationCloseBtn, replayCorrectBtn,
        dictationInput, dictationAudio, textEditor, mainAudioPlayer
    } = dom;

    if (startDictationBtn) {
        startDictationBtn.addEventListener('click', initDictation);
    }
    if (dictationPlayBtn) {
        dictationPlayBtn.addEventListener('click', playDictationPhrase);
    }
    if (dictationCheckBtn) {
        dictationCheckBtn.addEventListener('click', checkDictationAnswer);
    }
    if (dictationSkipBtn) {
        dictationSkipBtn.addEventListener('click', skipDictationPhrase);
    }
    if (dictationNextBtn) {
        dictationNextBtn.addEventListener('click', nextDictationPhrase);
    }
    if (dictationStopBtn) {
        dictationStopBtn.addEventListener('click', stopDictation);
    }
    if (dictationRestartBtn) {
        dictationRestartBtn.addEventListener('click', restartDictation);
    }
    if (dictationCloseBtn) {
        dictationCloseBtn.addEventListener('click', stopDictation);
    }
    if (replayCorrectBtn) {
        replayCorrectBtn.addEventListener('click', replayCorrectAudio);
    }
    if (dictationInput) {
        dictationInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                checkDictationAnswer();
            }
        });
    }
    if (dictationAudio) {
        dictationAudio.addEventListener('ended', () => {
            const { dictationPlayBtn } = dom;
            if (dictationPlayBtn) {
                dictationPlayBtn.disabled = false;
                dictationPlayBtn.innerHTML = '<i class="fas fa-volume-up"></i> Play';
            }
        });
    }

    // Visibility listeners
    if (textEditor) {
        textEditor.addEventListener('input', updateDictationVisibility);
    }
    if (mainAudioPlayer) {
        mainAudioPlayer.addEventListener('loadedmetadata', updateDictationVisibility);
        mainAudioPlayer.addEventListener('loadeddata', updateDictationVisibility);
    }
}
