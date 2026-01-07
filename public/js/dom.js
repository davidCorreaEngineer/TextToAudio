// ==========================================================================
// DOM ELEMENT REFERENCES
// ==========================================================================
// Lazy initialization - elements are queried when first accessed

let elementsCache = null;

function getElements() {
    if (elementsCache) return elementsCache;

    elementsCache = {
        // Form Elements
        form: document.getElementById('ttsForm'),
        languageSelect: document.getElementById('language'),
        voiceSelect: document.getElementById('voice'),
        resultDiv: document.getElementById('result'),
        fileSizeDiv: document.getElementById('fileSize'),
        textFileInput: document.getElementById('textFile'),
        testVoiceButton: document.getElementById('testVoiceButton'),
        audioPlayer: document.getElementById('audioPlayer'),
        testSentenceDiv: document.getElementById('testSentence'),
        dropZone: document.getElementById('dropZone'),
        progressContainer: document.getElementById('progressContainer'),
        progressBar: document.getElementById('progressBar'),
        textPreview: document.getElementById('textPreview'),

        // Settings
        speakingRateInput: document.getElementById('speakingRate'),
        speakingRateValue: document.getElementById('speakingRateValue'),
        pitchInput: document.getElementById('pitch'),
        pitchValue: document.getElementById('pitchValue'),
        addPausesCheckbox: document.getElementById('addPauses'),
        pauseDurationContainer: document.getElementById('pauseDurationContainer'),
        pauseDurationInput: document.getElementById('pauseDuration'),
        stripCommentsCheckbox: document.getElementById('stripComments'),
        strippedCharCountDiv: document.getElementById('strippedCharCount'),
        cleanCharCountSpan: document.getElementById('cleanCharCount'),

        // Dashboard
        dashboardDiv: document.getElementById('usageStats'),

        // Audio Player Section
        audioDropZone: document.getElementById('audioDropZone'),
        audioFileInput: document.getElementById('audioFileInput'),
        mainAudioPlayer: document.getElementById('mainAudioPlayer'),
        audioFileInfo: document.getElementById('audioFileInfo'),
        audioFileNameSpan: document.getElementById('audioFileName'),

        // Text Editor
        fileUploadModeBtn: document.getElementById('fileUploadMode'),
        textEditorModeBtn: document.getElementById('textEditorMode'),
        fileUploadContainer: document.getElementById('fileUploadContainer'),
        textEditorContainer: document.getElementById('textEditorContainer'),
        textEditor: document.getElementById('textEditor'),
        editorCharCount: document.getElementById('editorCharCount'),
        selectionPreviewContainer: document.getElementById('selectionPreviewContainer'),
        selectedTextDisplay: document.getElementById('selectedTextDisplay'),
        previewSelectionBtn: document.getElementById('previewSelectionBtn'),
        selectionPreviewStatus: document.getElementById('selectionPreviewStatus'),

        // SSML Toolbar
        ssmlPauseBtn: document.getElementById('ssmlPause'),
        ssmlEmphasisBtn: document.getElementById('ssmlEmphasis'),
        ssmlSlowBtn: document.getElementById('ssmlSlow'),
        ssmlFastBtn: document.getElementById('ssmlFast'),
        ssmlWhisperBtn: document.getElementById('ssmlWhisper'),
        ssmlSayAsBtn: document.getElementById('ssmlSayAs'),
        ssmlHelpBtn: document.getElementById('ssmlHelp'),

        // German Lessons
        germanLessonSelect: document.getElementById('germanLessonSelect'),
        loadGermanLessonBtn: document.getElementById('loadGermanLesson'),

        // Shadowing Elements
        shadowingCard: document.getElementById('shadowingCard'),
        shadowingLaunch: document.getElementById('shadowingLaunch'),
        shadowingPlayer: document.getElementById('shadowingPlayer'),
        startShadowingBtn: document.getElementById('startShadowingBtn'),
        phraseList: document.getElementById('phraseList'),
        gapIndicator: document.getElementById('gapIndicator'),
        gapTimer: document.getElementById('gapTimer'),
        shadowingAudio: document.getElementById('shadowingAudio'),
        gapMultiplierSelect: document.getElementById('gapMultiplier'),
        shadowingSpeedSelect: document.getElementById('shadowingSpeed'),
        loopCountSelect: document.getElementById('loopCount'),
        shadowingPrevBtn: document.getElementById('shadowingPrevBtn'),
        shadowingPlayPauseBtn: document.getElementById('shadowingPlayPauseBtn'),
        shadowingNextBtn: document.getElementById('shadowingNextBtn'),
        shadowingRestartBtn: document.getElementById('shadowingRestartBtn'),
        shadowingStopBtn: document.getElementById('shadowingStopBtn'),
        currentPhraseNumSpan: document.getElementById('currentPhraseNum'),
        totalPhrasesSpan: document.getElementById('totalPhrases'),

        // Dictation Elements
        dictationCard: document.getElementById('dictationCard'),
        dictationLaunch: document.getElementById('dictationLaunch'),
        dictationPlayer: document.getElementById('dictationPlayer'),
        startDictationBtn: document.getElementById('startDictationBtn'),
        dictationPlayBtn: document.getElementById('dictationPlayBtn'),
        dictationInput: document.getElementById('dictationInput'),
        dictationCheckBtn: document.getElementById('dictationCheckBtn'),
        dictationSkipBtn: document.getElementById('dictationSkipBtn'),
        dictationNextBtn: document.getElementById('dictationNextBtn'),
        dictationStopBtn: document.getElementById('dictationStopBtn'),
        dictationRestartBtn: document.getElementById('dictationRestartBtn'),
        dictationCloseBtn: document.getElementById('dictationCloseBtn'),
        replayCorrectBtn: document.getElementById('replayCorrectBtn'),
        dictationAudio: document.getElementById('dictationAudio'),
        dictationSpeedSelect: document.getElementById('dictationSpeed'),
        dictationProgressFill: document.getElementById('dictationProgressFill'),
        dictationCurrentNum: document.getElementById('dictationCurrentNum'),
        dictationTotalNum: document.getElementById('dictationTotalNum'),
        dictationScoreSpan: document.getElementById('dictationScore'),
        replayCountSpan: document.getElementById('replayCount'),
        dictationResult: document.getElementById('dictationResult'),
        resultIcon: document.getElementById('resultIcon'),
        resultLabel: document.getElementById('resultLabel'),
        userAnswerDisplay: document.getElementById('userAnswerDisplay'),
        correctAnswerDisplay: document.getElementById('correctAnswerDisplay'),
        resultDiff: document.getElementById('resultDiff'),
        dictationComplete: document.getElementById('dictationComplete'),
        finalScoreSpan: document.getElementById('finalScore'),
        phrasesCorrectSpan: document.getElementById('phrasesCorrect'),

        // Library
        audioLibrary: document.getElementById('audioLibrary'),

        // FAB
        fabButton: document.getElementById('fabButton'),
        fabMenu: document.getElementById('fabMenu'),
        fabInput: document.getElementById('fabInput'),
        fabGenerate: document.getElementById('fabGenerate'),

        // Theme
        themeToggle: document.getElementById('themeToggle'),

        // Toast Container
        toastContainer: document.getElementById('toastContainer'),

        // Output Card
        outputCard: document.getElementById('outputCard')
    };

    return elementsCache;
}

// Export as a proxy for lazy access
export const dom = new Proxy({}, {
    get(target, prop) {
        return getElements()[prop];
    }
});

// Reset cache (useful for testing)
export function resetDomCache() {
    elementsCache = null;
}
