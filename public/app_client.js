// ==========================================================================
// APP CLIENT - Main Orchestrator (ES Module)
// ==========================================================================
// This file imports all modules and wires up the application initialization.

// Config & State
import { getApiKey, getAuthHeaders } from './js/config.js';
import { dom } from './js/dom.js';
import {
    currentInputMode, setInputMode,
    setOriginalFileName, originalFileName,
    setCurrentAudioUrl
} from './js/state.js';
import { base64ToBlob } from './js/api.js';

// UI Modules
import { initTheme } from './js/ui/theme.js';
import { showToast } from './js/ui/toast.js';
import { setButtonLoading, showLibraryLoading } from './js/ui/loading.js';
import { initFab, updateDashboard, setAudioItemsRef } from './js/ui/fab.js';

// Audio Modules
import { loadAudioIntoPlayer, initAudioPlayerEvents, initAudioTest } from './js/audio/player.js';
import { renderLibrary, getAudioItems, initLibraryCount } from './js/audio/library.js';

// Synthesis Modules
import { loadVoices, initVoicesEvents } from './js/synthesis/voices.js';
import { initSSMLToolbar, updateEditorCharCount } from './js/synthesis/ssml.js';
import { initFormSubmission, setFetchUsageStats } from './js/synthesis/form.js';
import { stripComments } from './js/synthesis/textProcessing.js';

// Practice Modules
import { initShadowingEvents, updateShadowingVisibility } from './js/practice/shadowing.js';
import { initDictationEvents, updateDictationVisibility } from './js/practice/dictation.js';

// Dashboard Modules
import { fetchUsageStats } from './js/dashboard/stats.js';

// Lessons Modules
import { loadGermanLessons, initGermanLessonsEvents } from './js/lessons/german.js';

// ==========================================================================
// APPLICATION INITIALIZATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log("app_client.js loaded and DOMContentLoaded event fired.");

    // Ensure API key is available
    getApiKey();

    // Initialize UI
    initTheme();
    initFab();
    initAudioPlayerEvents();
    initAudioTest();

    // Initialize synthesis controls
    initVoicesEvents();
    initSSMLToolbar();
    initFormSubmission();

    // Wire up fetchUsageStats for form.js
    setFetchUsageStats(fetchUsageStats);

    // Initialize practice modes
    initShadowingEvents();
    initDictationEvents();

    // Initialize lessons
    initGermanLessonsEvents();

    // Initialize audio library
    setAudioItemsRef(getAudioItems());

    // Initialize settings event listeners
    initSettingsEvents();

    // Initialize input mode toggle
    initInputModeToggle();

    // Initialize file upload handlers
    initFileUploadHandlers();

    // Initialize audio drop zone
    initAudioDropZone();

    // Initialize test voice button
    initTestVoiceButton();

    // Load initial data
    loadVoices();
    fetchUsageStats();
    loadGermanLessons();

    // Initial UI updates
    updateDictationVisibility();
    renderLibrary();
    updateDashboard();
    initLibraryCount();

    console.log("Application initialized.");
});

// ==========================================================================
// SETTINGS EVENT HANDLERS
// ==========================================================================

function initSettingsEvents() {
    const {
        speakingRateInput, speakingRateValue,
        pitchInput, pitchValue,
        addPausesCheckbox, pauseDurationContainer,
        stripCommentsCheckbox, textPreview,
        strippedCharCountDiv, cleanCharCountSpan
    } = dom;

    // Speaking rate slider
    if (speakingRateInput && speakingRateValue) {
        speakingRateInput.addEventListener('input', () => {
            speakingRateValue.textContent = speakingRateInput.value + 'x';
        });
    }

    // Pitch slider
    if (pitchInput && pitchValue) {
        pitchInput.addEventListener('input', () => {
            pitchValue.textContent = pitchInput.value;
        });
    }

    // Pauses checkbox
    if (addPausesCheckbox && pauseDurationContainer) {
        addPausesCheckbox.addEventListener('change', () => {
            pauseDurationContainer.style.display = addPausesCheckbox.checked ? 'block' : 'none';
        });
    }

    // Strip comments checkbox
    if (stripCommentsCheckbox) {
        stripCommentsCheckbox.addEventListener('change', () => {
            updateStrippedCharCount();
        });
    }

    function updateStrippedCharCount() {
        const text = textPreview?.value || '';
        if (stripCommentsCheckbox?.checked && text) {
            const cleanedText = stripComments(text);
            if (cleanCharCountSpan) {
                cleanCharCountSpan.textContent = cleanedText.length.toLocaleString();
            }
            if (strippedCharCountDiv) {
                strippedCharCountDiv.style.display = 'block';
            }
        } else if (strippedCharCountDiv) {
            strippedCharCountDiv.style.display = 'none';
        }
    }
}

// ==========================================================================
// INPUT MODE TOGGLE
// ==========================================================================

function initInputModeToggle() {
    const {
        fileUploadModeBtn, textEditorModeBtn,
        fileUploadContainer, textEditorContainer,
        textEditor, editorCharCount
    } = dom;

    function setMode(mode) {
        setInputMode(mode);

        if (mode === 'file') {
            if (fileUploadContainer) fileUploadContainer.style.display = 'block';
            if (textEditorContainer) textEditorContainer.style.display = 'none';
            if (fileUploadModeBtn) fileUploadModeBtn.classList.add('active');
            if (textEditorModeBtn) textEditorModeBtn.classList.remove('active');
        } else {
            if (fileUploadContainer) fileUploadContainer.style.display = 'none';
            if (textEditorContainer) textEditorContainer.style.display = 'block';
            if (fileUploadModeBtn) fileUploadModeBtn.classList.remove('active');
            if (textEditorModeBtn) textEditorModeBtn.classList.add('active');
        }

        updateShadowingVisibility();
        updateDictationVisibility();
    }

    if (fileUploadModeBtn) {
        fileUploadModeBtn.addEventListener('click', () => setMode('file'));
    }
    if (textEditorModeBtn) {
        textEditorModeBtn.addEventListener('click', () => setMode('editor'));
    }

    // Text editor input handler
    if (textEditor) {
        textEditor.addEventListener('input', () => {
            updateEditorCharCount();
            updateShadowingVisibility();
            updateDictationVisibility();
        });
    }
}

// ==========================================================================
// FILE UPLOAD HANDLERS
// ==========================================================================

function initFileUploadHandlers() {
    const {
        textFileInput, dropZone, textPreview, fileSizeDiv
    } = dom;
    const MAX_TEXT_LENGTH = 5000;

    const selectedFilesList = document.getElementById('selectedFilesList');
    const filesListContent = document.getElementById('filesListContent');

    if (textFileInput) {
        textFileInput.addEventListener('change', function(e) {
            console.log("File input changed.");
            const files = e.target.files;

            if (files.length > 0) {
                if (files.length > 1) {
                    // Multiple files - batch mode
                    console.log(`${files.length} files selected`);

                    let filesList = '';
                    let totalSize = 0;
                    for (let i = 0; i < files.length; i++) {
                        filesList += `${i + 1}. ${files[i].name} (${files[i].size.toLocaleString()} bytes)<br>`;
                        totalSize += files[i].size;
                    }

                    if (filesListContent) filesListContent.innerHTML = filesList;
                    if (selectedFilesList) selectedFilesList.style.display = 'block';
                    if (fileSizeDiv) fileSizeDiv.textContent = `Total size: ${totalSize.toLocaleString()} bytes (${files.length} files)`;
                    if (textPreview) textPreview.value = '';
                    setOriginalFileName('batch');
                } else {
                    // Single file
                    const file = files[0];
                    setOriginalFileName(file.name);
                    console.log("Selected file:", file.name, file.size, "bytes");

                    if (selectedFilesList) selectedFilesList.style.display = 'none';

                    if (fileSizeDiv) {
                        fileSizeDiv.textContent = `File size: ${file.size.toLocaleString()} bytes`;
                        if (file.size > MAX_TEXT_LENGTH) {
                            fileSizeDiv.innerHTML += '<br><span class="text-warning">Warning: File exceeds maximum allowed size.</span>';
                        }
                    }

                    const reader = new FileReader();
                    reader.onload = function(event) {
                        if (textPreview) textPreview.value = event.target.result;
                        console.log("Text preview updated.");
                        updateShadowingVisibility();
                    };
                    reader.readAsText(file);
                }
            } else {
                setOriginalFileName('audio');
                if (fileSizeDiv) fileSizeDiv.textContent = '';
                if (textPreview) textPreview.value = '';
                if (selectedFilesList) selectedFilesList.style.display = 'none';
                console.log("File input cleared.");
            }
        });
    }

    // Drop zone events
    if (dropZone && textFileInput) {
        dropZone.addEventListener('click', () => {
            console.log("Drop zone clicked. Opening file dialog.");
            textFileInput.click();
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            console.log("File dropped.");
            if (e.dataTransfer.files.length) {
                textFileInput.files = e.dataTransfer.files;
                const event = new Event('change');
                textFileInput.dispatchEvent(event);
            }
        });
    }
}

// ==========================================================================
// AUDIO DROP ZONE
// ==========================================================================

function initAudioDropZone() {
    const {
        audioDropZone, audioFileInput, mainAudioPlayer,
        textEditor, textPreview
    } = dom;

    let isFileDialogOpen = false;

    function loadPracticeTextFile(file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const content = event.target.result;
            if (textEditor) {
                textEditor.value = content;
                updateEditorCharCount();
            }
            if (textPreview) {
                textPreview.value = content;
            }
            updateShadowingVisibility();
            updateDictationVisibility();
            console.log("Practice text loaded from file:", file.name);
        };
        reader.readAsText(file);
    }

    if (audioDropZone) {
        audioDropZone.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (isFileDialogOpen) {
                console.log("File dialog already open, ignoring click.");
                return;
            }

            if (audioFileInput) {
                isFileDialogOpen = true;
                audioFileInput.click();
                setTimeout(() => { isFileDialogOpen = false; }, 1000);
            }
        });

        audioDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            audioDropZone.classList.add('dragover');
        });

        audioDropZone.addEventListener('dragleave', () => {
            audioDropZone.classList.remove('dragover');
        });

        audioDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            audioDropZone.classList.remove('dragover');
            console.log("File(s) dropped on audio drop zone.");

            const files = e.dataTransfer.files;
            let audioFile = null;
            let textFile = null;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.wav')) {
                    audioFile = file;
                } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
                    textFile = file;
                }
            }

            if (audioFile) {
                loadAudioIntoPlayer(audioFile, audioFile.name);
            }
            if (textFile) {
                loadPracticeTextFile(textFile);
            }
        });
    }

    if (audioFileInput) {
        audioFileInput.addEventListener('change', (e) => {
            isFileDialogOpen = false;
            const file = e.target.files[0];
            if (file) {
                loadAudioIntoPlayer(file, file.name);
            }
        });
    }
}

// ==========================================================================
// TEST VOICE BUTTON
// ==========================================================================

let testVoiceAudioUrl = null;

function initTestVoiceButton() {
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
