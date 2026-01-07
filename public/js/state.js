// ==========================================================================
// GLOBAL STATE MANAGEMENT
// ==========================================================================

// Track current input mode
export let currentInputMode = 'file'; // 'file' or 'editor'

export function setInputMode(mode) {
    currentInputMode = mode;
}

// Track current audio URLs for cleanup
export let currentAudioUrl = null;
export let currentMainAudioUrl = null;

export function setCurrentAudioUrl(url) {
    currentAudioUrl = url;
}

export function setCurrentMainAudioUrl(url) {
    currentMainAudioUrl = url;
}

// Original filename for downloads
export let originalFileName = 'audio';

export function setOriginalFileName(name) {
    originalFileName = name;
}

// Chart instances
export let usageChart = null;
export let voiceTypeChart = null;

export function setUsageChart(chart) {
    usageChart = chart;
}

export function setVoiceTypeChart(chart) {
    voiceTypeChart = chart;
}

// Practice text for shadowing/dictation
export let practiceText = '';

export function setPracticeText(text) {
    practiceText = text;
}

// Shadowing State
export const shadowingState = {
    phrases: [],
    currentIndex: 0,
    isPlaying: false,
    isPaused: false,
    currentLoopIteration: 0,
    gapTimeoutId: null,
    gapIntervalId: null,
    phraseAudioUrls: [],
    currentPhraseUrl: null,
    useExistingAudio: false,
    phraseTimings: [],
    fullAudioUrl: null,
    currentTimeUpdateHandler: null
};

export function resetShadowingState() {
    shadowingState.phrases = [];
    shadowingState.currentIndex = 0;
    shadowingState.isPlaying = false;
    shadowingState.isPaused = false;
    shadowingState.currentLoopIteration = 0;
    shadowingState.gapTimeoutId = null;
    shadowingState.gapIntervalId = null;
    shadowingState.phraseAudioUrls = [];
    shadowingState.currentPhraseUrl = null;
    shadowingState.useExistingAudio = false;
    shadowingState.phraseTimings = [];
    shadowingState.fullAudioUrl = null;
    shadowingState.currentTimeUpdateHandler = null;
}

// Dictation State
export const dictationState = {
    phrases: [],
    currentIndex: 0,
    replaysLeft: 3,
    maxReplays: 3,
    scores: [],
    totalCorrect: 0,
    isActive: false,
    useExistingAudio: false,
    phraseTimings: [],
    fullAudioUrl: null,
    currentPhraseAudioUrl: null
};

export function resetDictationState() {
    dictationState.phrases = [];
    dictationState.currentIndex = 0;
    dictationState.replaysLeft = 3;
    dictationState.maxReplays = 3;
    dictationState.scores = [];
    dictationState.totalCorrect = 0;
    dictationState.isActive = false;
    dictationState.useExistingAudio = false;
    dictationState.phraseTimings = [];
    dictationState.fullAudioUrl = null;
    dictationState.currentPhraseAudioUrl = null;
}
