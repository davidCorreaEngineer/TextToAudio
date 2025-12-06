document.addEventListener('DOMContentLoaded', function() {
    console.log("app_client.js loaded and DOMContentLoaded event fired.");

    // ==========================================================================
    // API KEY CONFIGURATION
    // ==========================================================================
    // The API key should be provided by the server or configured here.
    // In production, consider injecting this via a secure mechanism.
    //
    // Option 1: Set it directly (for development/single-user deployments)
    // Option 2: Prompt user for API key on first use
    // Option 3: Have server inject it into the page for authenticated sessions
    //
    // For now, we'll check localStorage or prompt the user.
    // ==========================================================================

    let API_KEY = localStorage.getItem('tts_api_key') || '';

    // If no API key stored, prompt the user
    if (!API_KEY) {
        API_KEY = prompt('Please enter your API key to use this application:');
        if (API_KEY) {
            localStorage.setItem('tts_api_key', API_KEY);
        }
    }

    // Helper function to get headers with API key
    function getAuthHeaders(additionalHeaders = {}) {
        return {
            'X-API-Key': API_KEY,
            ...additionalHeaders
        };
    }

    // Function to clear stored API key (for logout or key change)
    window.clearApiKey = function() {
        localStorage.removeItem('tts_api_key');
        location.reload();
    };

    // ==========================================================================
    // DOM ELEMENTS
    // ==========================================================================

    const form = document.getElementById('ttsForm');
    const languageSelect = document.getElementById('language');
    const voiceSelect = document.getElementById('voice');
    const resultDiv = document.getElementById('result');
    const fileSizeDiv = document.getElementById('fileSize');
    const textFileInput = document.getElementById('textFile');
    const testVoiceButton = document.getElementById('testVoiceButton');
    const audioPlayer = document.getElementById('audioPlayer');
    const testSentenceDiv = document.getElementById('testSentence');
    const dropZone = document.getElementById('dropZone');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const textPreview = document.getElementById('textPreview');
    const speakingRateInput = document.getElementById('speakingRate');
    const speakingRateValue = document.getElementById('speakingRateValue');
    const pitchInput = document.getElementById('pitch');
    const pitchValue = document.getElementById('pitchValue');
    const dashboardDiv = document.getElementById('usageStats');
	const addPausesCheckbox = document.getElementById('addPauses');
    const pauseDurationContainer = document.getElementById('pauseDurationContainer');
    const pauseDurationInput = document.getElementById('pauseDuration');
    const stripCommentsCheckbox = document.getElementById('stripComments');
    const strippedCharCountDiv = document.getElementById('strippedCharCount');
    const cleanCharCountSpan = document.getElementById('cleanCharCount');

    // Audio Player Section Elements
    const audioDropZone = document.getElementById('audioDropZone');
    const audioFileInput = document.getElementById('audioFileInput');
    const mainAudioPlayer = document.getElementById('mainAudioPlayer');
    const audioFileInfo = document.getElementById('audioFileInfo');
    const audioFileNameSpan = document.getElementById('audioFileName');

    // Text Editor Elements
    const fileUploadModeBtn = document.getElementById('fileUploadMode');
    const textEditorModeBtn = document.getElementById('textEditorMode');
    const fileUploadContainer = document.getElementById('fileUploadContainer');
    const textEditorContainer = document.getElementById('textEditorContainer');
    const textEditor = document.getElementById('textEditor');
    const editorCharCount = document.getElementById('editorCharCount');
    const selectionPreviewContainer = document.getElementById('selectionPreviewContainer');
    const selectedTextDisplay = document.getElementById('selectedTextDisplay');
    const previewSelectionBtn = document.getElementById('previewSelectionBtn');
    const selectionPreviewStatus = document.getElementById('selectionPreviewStatus');

    // SSML Toolbar Buttons
    const ssmlPauseBtn = document.getElementById('ssmlPause');
    const ssmlEmphasisBtn = document.getElementById('ssmlEmphasis');
    const ssmlSlowBtn = document.getElementById('ssmlSlow');
    const ssmlFastBtn = document.getElementById('ssmlFast');
    const ssmlWhisperBtn = document.getElementById('ssmlWhisper');
    const ssmlSayAsBtn = document.getElementById('ssmlSayAs');
    const ssmlHelpBtn = document.getElementById('ssmlHelp');

    // German Lessons Elements
    const germanLessonSelect = document.getElementById('germanLessonSelect');
    const loadGermanLessonBtn = document.getElementById('loadGermanLesson');

    // Track current input mode
    let currentInputMode = 'file'; // 'file' or 'editor'

    // **1. Initialize Chart Variables**
    let usageChart;
    let voiceTypeChart;

    // **Track current audio URL for cleanup**
    let currentAudioUrl = null;

    const MAX_TEXT_LENGTH = 5000;

    let originalFileName = 'audio'; // Default name if no file is uploaded

    // **2. Define Free Tier Limits**
    const FREE_TIER_LIMITS = {
        'Neural2': 1000000,      // 1 million bytes
        'Studio': 100000,        // 100,000 bytes
        'Polyglot': 100000,      // 100,000 bytes
        'Standard': 4000000,     // 4 million characters
        'WaveNet': 1000000,      // 1 million characters
        'Journey': 1000000       // 1 million bytes (assuming similar to Neural2)
    };

    // **3. Load Voices on Page Load and Language Change**
    async function loadVoices() {
        console.log("Loading voices...");
        try {
            console.log('Fetching voices from server...');
            const response = await fetch('/voices', {
                headers: getAuthHeaders()
            });
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('tts_api_key');
                resultDiv.innerHTML = '<p class="text-danger">Invalid API key. Please reload and enter a valid key.</p>';
                return;
            }
            if (!response.ok) {
                throw new Error('Failed to fetch voices');
            }
            const voices = await response.json();
            console.log('Received voices:', voices);
            updateVoiceOptions(voices);
        } catch (error) {
            console.error('Error loading voices:', error);
            resultDiv.innerHTML = '<p class="text-danger">Error loading voices. Please try again or check the server connection.</p>';
        }
    }
	
	// **Show/Hide Pause Duration Input Based on Checkbox**
    addPausesCheckbox.addEventListener('change', () => {
        if (addPausesCheckbox.checked) {
            pauseDurationContainer.style.display = 'block';
        } else {
            pauseDurationContainer.style.display = 'none';
        }
    });

    function updateVoiceOptions(voices) {
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

    languageSelect.addEventListener('change', loadVoices);

    // **4. Handle File Selection and Preview**
    textFileInput.addEventListener('change', function(e) {
        console.log("File input changed.");
        const file = e.target.files[0];
        if (file) {
            originalFileName = file.name;
            console.log("Selected file:", originalFileName, file.size, "bytes");
            // Display File Size
            const fileSize = file.size;
            fileSizeDiv.textContent = `File size: ${fileSize.toLocaleString()} bytes`;
            if (fileSize > MAX_TEXT_LENGTH) {
                fileSizeDiv.innerHTML += '<br><span class="text-warning">Warning: File exceeds maximum allowed size.</span>';
            }

            // Preview Text Content
            const reader = new FileReader();
            reader.onload = function(event) {
                textPreview.value = event.target.result;
                console.log("Text preview updated.");
                updateStrippedCharCount();
                updateShadowingVisibility();
            };
            reader.readAsText(file);
        } else {
            originalFileName = 'audio'; // Reset if no file is selected
            fileSizeDiv.textContent = '';
            textPreview.value = '';
            console.log("File input cleared.");
        }
    });

    // **5. Drag-and-Drop Functionality**
    dropZone.addEventListener('click', () => {
        console.log("Drop zone clicked. Opening file dialog.");
        textFileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
        console.log("Dragging over drop zone.");
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
        console.log("Dragging out of drop zone.");
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

    // **5.5. Audio Player Drag-and-Drop and Upload Functionality**

    // Track current main audio URL for cleanup
    let currentMainAudioUrl = null;

    // Function to load audio into the main player
    function loadAudioIntoPlayer(audioSource, fileName) {
        // Clean up previous audio URL if it was a blob URL
        if (currentMainAudioUrl && currentMainAudioUrl.startsWith('blob:')) {
            URL.revokeObjectURL(currentMainAudioUrl);
        }

        // Set the audio source
        if (audioSource instanceof Blob) {
            currentMainAudioUrl = URL.createObjectURL(audioSource);
            mainAudioPlayer.src = currentMainAudioUrl;
        } else {
            // It's a URL string
            currentMainAudioUrl = audioSource;
            mainAudioPlayer.src = audioSource;
        }

        // Update UI
        audioFileNameSpan.textContent = fileName || 'Audio loaded';
        audioFileInfo.style.display = 'block';
        mainAudioPlayer.style.display = 'block';

        console.log("Audio loaded into player:", fileName);
    }

    // Debug event listeners for audio player
    mainAudioPlayer.addEventListener('play', () => {
        console.log("Audio player: play event");
        console.log("  currentTime:", mainAudioPlayer.currentTime);
        console.log("  paused:", mainAudioPlayer.paused);
        console.log("  muted:", mainAudioPlayer.muted);
        console.log("  volume:", mainAudioPlayer.volume);
    });

    mainAudioPlayer.addEventListener('pause', () => {
        console.log("Audio player: pause event");
        console.log("  currentTime:", mainAudioPlayer.currentTime);
        console.log("  Stack trace:", new Error().stack);
    });

    mainAudioPlayer.addEventListener('ended', () => {
        console.log("Audio player: ended event");
    });

    mainAudioPlayer.addEventListener('error', (e) => {
        console.error("Audio player error:", mainAudioPlayer.error);
    });

    mainAudioPlayer.addEventListener('loadeddata', () => {
        console.log("Audio player: loadeddata event, duration:", mainAudioPlayer.duration);
    });

    mainAudioPlayer.addEventListener('canplay', () => {
        console.log("Audio player: canplay event");
    });

    // Test Browser Audio button - plays a tone to verify audio output works
    const testAudioBtn = document.getElementById('testAudioBtn');
    const audioTestResult = document.getElementById('audioTestResult');

    if (testAudioBtn) {
        testAudioBtn.addEventListener('click', () => {
            console.log("Testing browser audio...");
            audioTestResult.textContent = "Playing test tone...";
            audioTestResult.style.color = '#666';

            try {
                // Create Web Audio API context
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const audioContext = new AudioContext();

                // Create oscillator for a simple beep
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                // Configure tone
                oscillator.frequency.value = 440; // A4 note
                oscillator.type = 'sine';
                gainNode.gain.value = 0.3; // Not too loud

                // Play for 500ms
                oscillator.start();
                setTimeout(() => {
                    oscillator.stop();
                    audioContext.close();
                    audioTestResult.textContent = "Test tone played! Did you hear it?";
                    audioTestResult.style.color = 'green';
                    console.log("Test tone completed.");
                }, 500);
            } catch (err) {
                console.error("Test audio failed:", err);
                audioTestResult.textContent = "Audio test failed: " + err.message;
                audioTestResult.style.color = 'red';
            }
        });
    }

    // Prevent audio player clicks from bubbling (in case it's inside or near the drop zone)
    mainAudioPlayer.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Debounce flag to prevent double-click issues
    let isFileDialogOpen = false;

    // Click to open file dialog
    audioDropZone.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Prevent opening multiple dialogs
        if (isFileDialogOpen) {
            console.log("File dialog already open, ignoring click.");
            return;
        }

        console.log("Audio drop zone clicked. Opening file dialog.");
        isFileDialogOpen = true;
        audioFileInput.click();

        // Reset flag after a short delay (dialog close doesn't have a reliable event)
        setTimeout(() => {
            isFileDialogOpen = false;
        }, 1000);
    });

    // Handle file selection
    audioFileInput.addEventListener('change', (e) => {
        e.stopPropagation();
        isFileDialogOpen = false;

        const file = e.target.files[0];
        if (file) {
            console.log("Audio file selected:", file.name);
            loadAudioIntoPlayer(file, file.name);
        }
    });

    // Drag over
    audioDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        audioDropZone.classList.add('dragover');
    });

    // Drag leave
    audioDropZone.addEventListener('dragleave', () => {
        audioDropZone.classList.remove('dragover');
    });

    // Drop - supports both audio and text files for shadowing practice
    audioDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        audioDropZone.classList.remove('dragover');
        console.log("Files dropped:", e.dataTransfer.files.length);

        if (e.dataTransfer.files.length) {
            var audioFile = null;
            var textFile = null;

            // Sort files into audio and text
            for (var i = 0; i < e.dataTransfer.files.length; i++) {
                var file = e.dataTransfer.files[i];
                if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
                    audioFile = file;
                } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
                    textFile = file;
                }
            }

            // Load audio file
            if (audioFile) {
                loadAudioIntoPlayer(audioFile, audioFile.name);
                console.log("Audio file loaded:", audioFile.name);
            }

            // Load text file for shadowing
            if (textFile) {
                loadPracticeTextFile(textFile);
                console.log("Text file loaded:", textFile.name);
            }

            if (!audioFile && !textFile) {
                alert('Please drop an audio file (MP3, WAV) and/or a text file (.txt)');
            }
        }
    });

    // Practice text file elements
    var practiceTextInfo = document.getElementById('practiceTextInfo');
    var practiceTextFileName = document.getElementById('practiceTextFileName');
    var practiceText = ''; // Store loaded practice text

    // Load practice text file
    function loadPracticeTextFile(file) {
        var reader = new FileReader();
        reader.onload = function(e) {
            practiceText = e.target.result;

            // Update UI
            if (practiceTextInfo) {
                practiceTextInfo.style.display = 'flex';
                practiceTextFileName.textContent = file.name;
            }

            // Also put it in the text editor so shadowing can use it
            if (textEditor) {
                textEditor.value = practiceText;
                updateEditorCharCount();
            }

            // Update shadowing visibility
            updateShadowingVisibility();

            console.log("Practice text loaded:", file.name, "-", practiceText.length, "characters");
        };
        reader.readAsText(file);
    }

    // **6. Update Display Values for Advanced Settings**
    speakingRateInput.addEventListener('input', () => {
        speakingRateValue.textContent = speakingRateInput.value + 'x';
        console.log("Speaking rate changed to:", speakingRateInput.value);
    });

    pitchInput.addEventListener('input', () => {
        pitchValue.textContent = pitchInput.value;
        console.log("Pitch changed to:", pitchInput.value);
    });

    // ==========================================================================
    // INPUT MODE TOGGLE (File Upload vs Text Editor)
    // ==========================================================================

    function setInputMode(mode) {
        currentInputMode = mode;
        console.log("Input mode changed to:", mode);

        if (mode === 'file') {
            fileUploadModeBtn.classList.add('active');
            textEditorModeBtn.classList.remove('active');
            fileUploadContainer.style.display = 'block';
            textEditorContainer.style.display = 'none';
        } else {
            fileUploadModeBtn.classList.remove('active');
            textEditorModeBtn.classList.add('active');
            fileUploadContainer.style.display = 'none';
            textEditorContainer.style.display = 'block';
            // Sync text preview to editor if there's content
            if (textPreview.value && !textEditor.value) {
                textEditor.value = textPreview.value;
                updateEditorCharCount();
            }
        }
    }

    fileUploadModeBtn.addEventListener('click', () => setInputMode('file'));
    textEditorModeBtn.addEventListener('click', () => setInputMode('editor'));

    // ==========================================================================
    // TEXT EDITOR FUNCTIONALITY
    // ==========================================================================

    // Update character count
    function updateEditorCharCount() {
        const length = textEditor.value.length;
        editorCharCount.textContent = `${length.toLocaleString()} characters`;

        // Update warning class based on character count
        editorCharCount.classList.remove('warning', 'danger');
        if (length > MAX_TEXT_LENGTH) {
            editorCharCount.classList.add('danger');
        } else if (length > MAX_TEXT_LENGTH * 0.8) {
            editorCharCount.classList.add('warning');
        }
    }

    textEditor.addEventListener('input', updateEditorCharCount);

    // Handle text selection for preview
    textEditor.addEventListener('mouseup', handleTextSelection);
    textEditor.addEventListener('keyup', handleTextSelection);

    function handleTextSelection() {
        const selectedText = textEditor.value.substring(
            textEditor.selectionStart,
            textEditor.selectionEnd
        ).trim();

        if (selectedText && selectedText.length > 0) {
            // Show selection preview container
            selectionPreviewContainer.classList.add('show');
            selectedTextDisplay.textContent = selectedText.length > 100
                ? selectedText.substring(0, 100) + '...'
                : selectedText;
            selectionPreviewStatus.textContent = '';
        } else {
            selectionPreviewContainer.classList.remove('show');
        }
    }

    // Preview selected text
    previewSelectionBtn.addEventListener('click', async function() {
        const selectedText = textEditor.value.substring(
            textEditor.selectionStart,
            textEditor.selectionEnd
        ).trim();

        if (!selectedText) {
            selectionPreviewStatus.textContent = 'No text selected';
            selectionPreviewStatus.style.color = '#dc3545';
            return;
        }

        const voice = voiceSelect.value;
        if (!voice) {
            selectionPreviewStatus.textContent = 'Please select a voice first';
            selectionPreviewStatus.style.color = '#dc3545';
            return;
        }

        selectionPreviewStatus.textContent = 'Generating preview...';
        selectionPreviewStatus.style.color = '#6c757d';
        previewSelectionBtn.disabled = true;

        try {
            // Check if text contains SSML tags
            const containsSSML = /<[^>]+>/.test(selectedText);
            let textToSend = selectedText;

            // Wrap in <speak> if it contains SSML but doesn't have the wrapper
            if (containsSSML && !selectedText.trim().startsWith('<speak>')) {
                textToSend = `<speak>${selectedText}</speak>`;
            }

            const response = await fetch('/test-voice', {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    language: languageSelect.value,
                    voice: voice,
                    speakingRate: speakingRateInput.value,
                    pitch: pitchInput.value,
                    customText: textToSend,
                    useSsml: containsSSML
                })
            });

            if (response.status === 401 || response.status === 403) {
                selectionPreviewStatus.textContent = 'Authentication failed';
                selectionPreviewStatus.style.color = '#dc3545';
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to preview text');
            }

            const result = await response.json();
            if (result.success) {
                if (currentAudioUrl) {
                    URL.revokeObjectURL(currentAudioUrl);
                }
                const audioBlob = base64ToBlob(result.audioContent, 'audio/mp3');
                currentAudioUrl = URL.createObjectURL(audioBlob);
                audioPlayer.src = currentAudioUrl;
                audioPlayer.style.display = 'block';
                audioPlayer.play();
                selectionPreviewStatus.textContent = 'Playing preview';
                selectionPreviewStatus.style.color = '#28a745';
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error previewing selection:', error);
            selectionPreviewStatus.textContent = 'Error: ' + error.message;
            selectionPreviewStatus.style.color = '#dc3545';
        } finally {
            previewSelectionBtn.disabled = false;
        }
    });

    // ==========================================================================
    // SSML TOOLBAR FUNCTIONALITY
    // ==========================================================================

    function insertSSMLTag(tagStart, tagEnd, placeholder = '') {
        const start = textEditor.selectionStart;
        const end = textEditor.selectionEnd;
        const selectedText = textEditor.value.substring(start, end);
        const textToWrap = selectedText || placeholder;

        const newText = textEditor.value.substring(0, start)
            + tagStart + textToWrap + tagEnd
            + textEditor.value.substring(end);

        textEditor.value = newText;

        // Position cursor appropriately
        if (selectedText) {
            textEditor.selectionStart = start;
            textEditor.selectionEnd = start + tagStart.length + textToWrap.length + tagEnd.length;
        } else {
            textEditor.selectionStart = start + tagStart.length;
            textEditor.selectionEnd = start + tagStart.length + placeholder.length;
        }

        textEditor.focus();
        updateEditorCharCount();
    }

    // Pause button - inserts a break tag
    ssmlPauseBtn.addEventListener('click', () => {
        const pauseMs = prompt('Enter pause duration in milliseconds:', '500');
        if (pauseMs !== null) {
            const start = textEditor.selectionStart;
            const pauseTag = `<break time="${pauseMs}ms"/>`;
            textEditor.value = textEditor.value.substring(0, start)
                + pauseTag
                + textEditor.value.substring(start);
            textEditor.selectionStart = textEditor.selectionEnd = start + pauseTag.length;
            textEditor.focus();
            updateEditorCharCount();
        }
    });

    // Emphasis button
    ssmlEmphasisBtn.addEventListener('click', () => {
        const level = prompt('Emphasis level (strong, moderate, reduced):', 'strong');
        if (level !== null) {
            insertSSMLTag(`<emphasis level="${level}">`, '</emphasis>', 'emphasized text');
        }
    });

    // Slow speech button
    ssmlSlowBtn.addEventListener('click', () => {
        insertSSMLTag('<prosody rate="slow">', '</prosody>', 'slow text');
    });

    // Fast speech button
    ssmlFastBtn.addEventListener('click', () => {
        insertSSMLTag('<prosody rate="fast">', '</prosody>', 'fast text');
    });

    // Whisper effect
    ssmlWhisperBtn.addEventListener('click', () => {
        insertSSMLTag('<prosody volume="x-soft" rate="slow">', '</prosody>', 'whispered text');
    });

    // Say-as button (for numbers, dates, etc.)
    ssmlSayAsBtn.addEventListener('click', () => {
        const interpretAs = prompt(
            'Interpret as (cardinal, ordinal, characters, fraction, date, time, telephone, currency):',
            'cardinal'
        );
        if (interpretAs !== null) {
            insertSSMLTag(`<say-as interpret-as="${interpretAs}">`, '</say-as>', '123');
        }
    });

    // Help button - show SSML reference
    ssmlHelpBtn.addEventListener('click', () => {
        alert(`SSML Quick Reference:

BREAKS/PAUSES:
<break time="500ms"/> - Pause for 500 milliseconds
<break strength="strong"/> - Natural pause

EMPHASIS:
<emphasis level="strong">text</emphasis>
Levels: strong, moderate, reduced

PROSODY (Speed, Pitch, Volume):
<prosody rate="slow">text</prosody>
<prosody pitch="+2st">text</prosody>
<prosody volume="loud">text</prosody>
Rate: x-slow, slow, medium, fast, x-fast, or percentage
Pitch: x-low, low, medium, high, x-high, or +/-Xst

SAY-AS (Interpretation):
<say-as interpret-as="cardinal">123</say-as>
<say-as interpret-as="ordinal">1</say-as>
<say-as interpret-as="characters">ABC</say-as>
<say-as interpret-as="date" format="mdy">12/25/2024</say-as>

SUB (Substitution):
<sub alias="World Wide Web">WWW</sub>

Note: Select text before clicking toolbar buttons to wrap existing text.`);
    });

    // **7. Test Voice Functionality**
    testVoiceButton.addEventListener('click', async function() {
        console.log("Test Voice button clicked.");
        const language = languageSelect.value;
        const voice = voiceSelect.value;
        const speakingRate = speakingRateInput.value;
        const pitch = pitchInput.value;

        if (!voice) {
            alert('Please select a voice first.');
            console.log("No voice selected.");
            return;
        }

        try {
            const response = await fetch('/test-voice', {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ language, voice, speakingRate, pitch })
            });

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('tts_api_key');
                resultDiv.innerHTML = '<p class="text-danger">Invalid API key. Please reload and enter a valid key.</p>';
                return;
            }
            if (!response.ok) {
                throw new Error('Failed to test voice');
            }

            const result = await response.json();
            if (result.success) {
                // Revoke previous audio URL to prevent memory leak
                if (currentAudioUrl) {
                    URL.revokeObjectURL(currentAudioUrl);
                }
                // Decode Base64 audio content
                const audioBlob = base64ToBlob(result.audioContent, 'audio/mp3');
                currentAudioUrl = URL.createObjectURL(audioBlob);
                audioPlayer.src = currentAudioUrl;
                audioPlayer.style.display = 'block';
                audioPlayer.play();
                testSentenceDiv.textContent = `Test sentence: "${result.testText}"`;
                console.log("Test audio played.");
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error testing voice:', error);
            resultDiv.innerHTML = `<p class="text-danger">Error testing voice: ${error.message}</p>`;
        }
    });

    // **8. Form Submission with Progress Indicator**
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log("Form submitted.");

        // Retrieve text based on current input mode
        let editedText;
        if (currentInputMode === 'editor') {
            editedText = textEditor.value;
            if (!editedText.trim()) {
                alert('Text editor is empty. Please enter some text.');
                console.log("Text editor is empty.");
                return;
            }
            // Set a default file name for editor mode
            if (originalFileName === 'audio') {
                originalFileName = 'text-editor-audio';
            }
        } else {
            editedText = textPreview.value;
            if (!editedText.trim()) {
                alert('Text preview is empty. Please upload and review your text file.');
                console.log("Text preview is empty.");
                return;
            }
        }

        // **Strip Comments if Enabled**
        if (stripCommentsCheckbox.checked) {
            editedText = stripComments(editedText);
            console.log("Comments stripped. New length:", editedText.length);
        }

		// **Process Text to Add Pauses if Enabled**
        const addPauses = addPausesCheckbox.checked;
        const pauseDuration = parseInt(pauseDurationInput.value) || 1000; // Default to 1000 ms if invalid

        let processedText = editedText;
        let useSsml = false;

        // Check if text already contains SSML tags (from editor mode)
        const containsSSML = /<[^>]+>/.test(editedText);

        if (containsSSML) {
            useSsml = true;
            // Wrap in <speak> if it doesn't have it
            if (!editedText.trim().startsWith('<speak>')) {
                processedText = `<speak>${editedText}</speak>`;
            }
            console.log("Text contains SSML, using SSML mode.");
        } else if (addPauses) {
            useSsml = true;
            processedText = convertTextToSsml(editedText, pauseDuration);
            console.log("Processed text with SSML pauses:", processedText);
        }

        const formData = new FormData();

        // Append necessary fields
        formData.append('language', languageSelect.value);
        formData.append('voice', voiceSelect.value);
        formData.append('speakingRate', speakingRateInput.value);
        formData.append('pitch', pitchInput.value);
        formData.append('textContent', processedText);
        formData.append('originalFileName', originalFileName);
        formData.append('useSsml', useSsml);

        // Show Progress Bar
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', 0);
        console.log("Progress bar displayed.");

        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/synthesize', true);

            // Set API key header for authentication
            xhr.setRequestHeader('X-API-Key', API_KEY);

            // **9. Update Progress Bar Based on Upload Progress**
            xhr.upload.onprogress = function(event) {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    progressBar.style.width = `${percentComplete}%`;
                    progressBar.setAttribute('aria-valuenow', percentComplete);
                    console.log(`Upload progress: ${percentComplete}%`);
                }
            };

            xhr.onload = function() {
                if (xhr.status === 401 || xhr.status === 403) {
                    localStorage.removeItem('tts_api_key');
                    resultDiv.innerHTML = '<p class="error-message">Invalid API key. Please reload and enter a valid key.</p>';
                    progressContainer.style.display = 'none';
                    return;
                }
                if (xhr.status === 200) {
                    const result = JSON.parse(xhr.responseText);
                    if (result.success) {
                        resultDiv.innerHTML = `<a href="${result.file}" download="${result.fileName}" class="download-btn"><i class="fas fa-download"></i> Download: ${result.fileName}</a>`;
                        console.log("Audio generated:", result.fileName);

                        // Show output card and load audio
                        const outputCard = document.getElementById('outputCard');
                        if (outputCard) {
                            outputCard.classList.add('show');
                        }

                        // Also load the generated audio into the main audio player
                        loadAudioIntoPlayer(result.file, result.fileName);

                        // Refresh usage stats
                        fetchUsageStats();
                    } else {
                        resultDiv.innerHTML = `<p class="error-message">Error: ${result.error}</p>`;
                        console.log("Error generating audio:", result.error);
                    }
                } else {
                    const result = xhr.responseText ? JSON.parse(xhr.responseText) : {};
                    resultDiv.innerHTML = `<p class="error-message">Error: ${result.error || 'Error generating audio. Please try again.'}</p>`;
                    console.log("Error generating audio. Status:", xhr.status);
                    // Show output card for error display
                    const outputCard = document.getElementById('outputCard');
                    if (outputCard) {
                        outputCard.classList.add('show');
                    }
                }
                // Hide Progress Bar after completion
                progressBar.style.width = '100%';
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                    console.log("Progress bar hidden.");
                }, 500);
            };

            xhr.onerror = function() {
                resultDiv.innerHTML = '<p class="text-danger">Error generating audio. Please try again.</p>';
                progressContainer.style.display = 'none';
                console.log("XHR error.");
            };

            xhr.send(formData);
            console.log("Form data sent.");
        } catch (error) {
            console.error('Error:', error);
            resultDiv.innerHTML = '<p class="text-danger">Error generating audio. Please try again.</p>';
            progressContainer.style.display = 'none';
            console.log("Error during form submission.");
        }
    });
	
	// **Function to Escape XML Special Characters for SSML**
    function escapeXml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // **Function to Strip Comments from Text**
    // Removes:
    // - Lines starting with // (single-line comments)
    // - Lines starting with /* or ending with */ (multi-line comment markers)
    // - Lines starting with == (section headers)
    // - Multi-line /* ... */ blocks
    function stripComments(text) {
        // First, remove multi-line /* ... */ blocks (including content between them)
        let result = text.replace(/\/\*[\s\S]*?\*\//g, '');

        // Then process line by line
        const lines = result.split('\n');
        const cleanedLines = lines.filter(line => {
            const trimmed = line.trim();
            // Skip empty lines that resulted from comment removal
            if (trimmed === '') return false;
            // Skip lines starting with //
            if (trimmed.startsWith('//')) return false;
            // Skip lines starting with ==
            if (trimmed.startsWith('==')) return false;
            // Skip lines that are just /* or */
            if (trimmed === '/*' || trimmed === '*/') return false;
            return true;
        });

        return cleanedLines.join('\n').trim();
    }

    // **Update character count when strip comments checkbox changes**
    stripCommentsCheckbox.addEventListener('change', () => {
        updateStrippedCharCount();
    });

    function updateStrippedCharCount() {
        const text = textPreview.value;
        if (stripCommentsCheckbox.checked && text) {
            const cleanedText = stripComments(text);
            cleanCharCountSpan.textContent = cleanedText.length.toLocaleString();
            strippedCharCountDiv.style.display = 'block';
        } else {
            strippedCharCountDiv.style.display = 'none';
        }
    }

    // **Function to Convert Text to SSML with Pauses**
    function convertTextToSsml(text, pauseDuration) {
        // Split text into sentences based on periods, question marks, or exclamation marks
        const sentenceEndRegex = /([.?!])/g;
        const sentences = text.split(sentenceEndRegex).filter(s => s.trim() !== '');
        let ssmlText = '<speak>';

        for (let i = 0; i < sentences.length; i += 2) {
            const sentence = escapeXml(sentences[i].trim());
            const punctuation = sentences[i + 1] || '';
            ssmlText += sentence + punctuation;

            // If not the last sentence, and punctuation marks the end of a sentence, add a break
            if (i + 2 < sentences.length && (punctuation === '.' || punctuation === '?' || punctuation === '!')) {
                ssmlText += `<break time="${pauseDuration}ms"/> `;
            } else {
                ssmlText += ' ';
            }
        }

        ssmlText += '</speak>';
        return ssmlText;
    }

    // **10. Fetch and Display Usage Statistics**
    async function fetchUsageStats() {
        console.log("Fetching usage statistics...");
        try {
            const response = await fetch('/dashboard', {
                headers: getAuthHeaders()
            });
            if (response.status === 401 || response.status === 403) {
                // Don't show error for dashboard if auth fails - voices endpoint will handle it
                console.log("Dashboard fetch failed due to authentication.");
                return;
            }
            if (!response.ok) {
                throw new Error('Failed to fetch usage statistics');
            }
            const data = await response.json();
            console.log("Received usage data:", data);
            displayUsageStats(data.quota);
            updateUsageIndicator(data.quota);
        } catch (error) {
            console.error('Error fetching usage statistics:', error);
        }
    }

    // **10.1 Update Header Usage Indicator**
    function updateUsageIndicator(quota) {
        const usageBarFill = document.getElementById('usageBarFill');
        const usageText = document.getElementById('usageText');
        const usageTooltipContent = document.getElementById('usageTooltipContent');

        if (!usageBarFill || !usageText) return;

        // Calculate total usage percentage across all voice types
        let totalUsage = 0;
        let totalLimit = 0;
        const currentMonth = getCurrentYearMonth();
        const voiceTypeUsage = {};

        // Get current month data
        const monthData = quota[currentMonth] || {};

        for (const [voiceType, limit] of Object.entries(FREE_TIER_LIMITS)) {
            const usage = monthData[voiceType] || 0;
            totalUsage += usage;
            totalLimit += limit;
            voiceTypeUsage[voiceType] = { usage, limit };
        }

        const overallPercentage = totalLimit > 0 ? Math.min((totalUsage / totalLimit) * 100, 100) : 0;

        // Update the bar
        usageBarFill.style.width = overallPercentage + '%';
        usageText.textContent = Math.round(overallPercentage) + '%';

        // Update bar color based on usage
        usageBarFill.classList.remove('warning', 'danger');
        if (overallPercentage >= 90) {
            usageBarFill.classList.add('danger');
        } else if (overallPercentage >= 70) {
            usageBarFill.classList.add('warning');
        }

        // Update tooltip content with detailed usage info
        if (usageTooltipContent) {
            var tooltipHtml = '';

            // Show all voice types with usage
            for (var voiceType in voiceTypeUsage) {
                var data = voiceTypeUsage[voiceType];
                if (data.usage > 0 || data.limit > 0) {
                    var pct = Math.round((data.usage / data.limit) * 100);
                    var isCharBased = (voiceType === 'Standard' || voiceType === 'WaveNet');
                    var unit = isCharBased ? 'chars' : 'bytes';
                    var usageStr = formatNumber(data.usage);
                    var limitStr = formatNumber(data.limit);

                    tooltipHtml += '<div class="usage-tooltip-item">' +
                        '<span class="voice-name">' + voiceType + '</span>' +
                        '<span class="voice-usage">' + usageStr + ' / ' + limitStr + ' ' + unit + '</span>' +
                        '<span class="voice-pct ' + (pct >= 90 ? 'danger' : (pct >= 70 ? 'warning' : '')) + '">' + pct + '%</span>' +
                    '</div>';
                }
            }

            if (!tooltipHtml) {
                tooltipHtml = '<div class="usage-tooltip-item"><span>No usage this month</span></div>';
            }

            // Add month label
            tooltipHtml = '<div class="usage-month">' + currentMonth + '</div>' + tooltipHtml;

            usageTooltipContent.innerHTML = tooltipHtml;
        }
    }

    // Format large numbers (1000 -> 1K, 1000000 -> 1M)
    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    function displayUsageStats(quota) {
        if (Object.keys(quota).length === 0) {
            console.log('No usage data available');
            return;
        }

        // **10.1. Calculate Summary Statistics**
        var totalUsage = 0;
        var uniqueVoicesSet = new Set();
        var currentMonth = getCurrentYearMonth();
        var currentMonthUsage = 0;

        for (var yearMonth in quota) {
            var voices = quota[yearMonth];
            for (var voiceType in voices) {
                var count = voices[voiceType];
                totalUsage += count;
                uniqueVoicesSet.add(voiceType);
                if (yearMonth === currentMonth) {
                    currentMonthUsage += count;
                }
            }
        }

        // **10.2. Update Summary Cards (if they exist)**
        var totalUsageEl = document.getElementById('totalUsage');
        var uniqueVoicesEl = document.getElementById('uniqueVoices');
        var currentMonthUsageEl = document.getElementById('currentMonthUsage');

        if (totalUsageEl) totalUsageEl.textContent = totalUsage.toLocaleString();
        if (uniqueVoicesEl) uniqueVoicesEl.textContent = uniqueVoicesSet.size;
        if (currentMonthUsageEl) currentMonthUsageEl.textContent = currentMonthUsage.toLocaleString();

        console.log('Usage stats - Total:', totalUsage, 'This month:', currentMonthUsage, 'Voice types:', uniqueVoicesSet.size);

        // **10.3. Prepare Data for Charts**
        const usageData = {};
        const voiceTypeData = {};

        for (const [yearMonth, voices] of Object.entries(quota)) {
            if (!usageData[yearMonth]) {
                usageData[yearMonth] = 0;
            }
            for (const [voiceType, count] of Object.entries(voices)) {
                usageData[yearMonth] += count;

                if (!voiceTypeData[voiceType]) {
                    voiceTypeData[voiceType] = 0;
                }
                voiceTypeData[voiceType] += count;
            }
        }

        // **10.4. Render Usage Over Time Chart**
        renderUsageChart(usageData);

        // **10.5. Render Voice Type Distribution Chart**
        renderVoiceTypeChart(voiceTypeData);

        // **10.6. Display Voice Type Consumption with Progress Bars**
        displayVoiceTypeConsumption(voiceTypeData);

        console.log("Usage statistics displayed on dashboard.");
    }

    function renderUsageChart(data) {
        var chartEl = document.getElementById('usageChart');
        if (!chartEl) return; // Chart element doesn't exist
        var ctx = chartEl.getContext('2d');
        const labels = Object.keys(data).sort();
        const values = labels.map(label => data[label]);

        if (usageChart) {
            usageChart.destroy();
        }

        usageChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Usage Count',
                    data: values,
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    fill: true,
                    lineTension: 0.3,
                    pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                }]
            },
            options: {
                responsive: true,
                title: {
                    display: true,
                    text: 'Total Usage Over Time'
                },
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero: true,
                            callback: function(value) { return value.toLocaleString(); }
                        },
                        scaleLabel: {
                            display: true,
                            labelString: 'Usage Count'
                        }
                    }],
                    xAxes: [{
                        scaleLabel: {
                            display: true,
                            labelString: 'Year-Month'
                        }
                    }]
                },
                tooltips: {
                    callbacks: {
                        label: function(tooltipItem, data) {
                            return `Usage: ${tooltipItem.yLabel.toLocaleString()}`;
                        }
                    }
                }
            }
        });
    }

    function renderVoiceTypeChart(data) {
        var chartEl = document.getElementById('voiceTypeChart');
        if (!chartEl) return; // Chart element doesn't exist
        var ctx = chartEl.getContext('2d');
        const labels = Object.keys(data);
        const values = labels.map(label => data[label]);

        const backgroundColors = generateColorPalette(labels.length);

        if (voiceTypeChart) {
            voiceTypeChart.destroy();
        }

        voiceTypeChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: backgroundColors,
                }]
            },
            options: {
                responsive: true,
                title: {
                    display: true,
                    text: 'Voice Type Distribution'
                },
                tooltips: {
                    callbacks: {
                        label: function(tooltipItem, data) {
                            const dataset = data.datasets[tooltipItem.datasetIndex];
                            const total = dataset.data.reduce((a, b) => a + b, 0);
                            const currentValue = dataset.data[tooltipItem.index];
                            const percentage = ((currentValue / total) * 100).toFixed(2);
                            return `${data.labels[tooltipItem.index]}: ${currentValue.toLocaleString()} (${percentage}%)`;
                        }
                    }
                }
            }
        });
    }

    function displayVoiceTypeConsumption(data) {
        var voiceUsageContainer = document.getElementById('voiceUsageCards');
        if (!voiceUsageContainer) return; // Element doesn't exist
        voiceUsageContainer.innerHTML = ''; // Clear existing content

        for (const [voiceType, count] of Object.entries(data)) {
            const limit = FREE_TIER_LIMITS[voiceType] || 0;
            const isCharacterBased = ['Standard', 'WaveNet'].includes(voiceType);
            const unit = isCharacterBased ? 'characters' : 'bytes';
            const usage = count;
            const percentage = limit > 0 ? Math.min((usage / limit) * 100, 100) : 0;
            const progressBarClass = percentage < 80 ? 'bg-success' : (percentage < 100 ? 'bg-warning' : 'bg-danger');

            const colDiv = document.createElement('div');
            colDiv.className = 'col-md-6 voice-usage';

            const cardDiv = document.createElement('div');
            cardDiv.className = 'summary-card';

            // Icon based on voice type
            let iconClass = 'fas fa-microphone';
            switch (voiceType) {
                case 'Standard':
                    iconClass = 'fas fa-microphone-alt';
                    break;
                case 'WaveNet':
                    iconClass = 'fas fa-wave-square';
                    break;
                case 'Neural2':
                    iconClass = 'fas fa-brain';
                    break;
                case 'Polyglot':
                    iconClass = 'fas fa-language';
                    break;
                case 'Journey':
                    iconClass = 'fas fa-road';
                    break;
                case 'Studio':
                    iconClass = 'fas fa-video';
                    break;
                default:
                    iconClass = 'fas fa-microphone';
            }

            cardDiv.innerHTML = `
                <h5><i class="${iconClass}"></i> ${voiceType} Voices</h5>
                <p>${usage.toLocaleString()} / ${limit.toLocaleString()} ${unit}</p>
                <div class="progress">
                    <div 
                        class="progress-bar ${progressBarClass}" 
                        role="progressbar" 
                        style="width: ${percentage}%;" 
                        aria-valuenow="${percentage}" 
                        aria-valuemin="0" 
                        aria-valuemax="100"
                    >
                        ${percentage.toFixed(2)}%
                    </div>
                </div>
            `;

            voiceUsageContainer.appendChild(colDiv);
            colDiv.appendChild(cardDiv);
        }

        // **Handle Voice Types with No Consumption**
        const allVoiceTypes = Object.keys(FREE_TIER_LIMITS);
        for (const voiceType of allVoiceTypes) {
            if (!data.hasOwnProperty(voiceType)) {
                const limit = FREE_TIER_LIMITS[voiceType];
                const isCharacterBased = ['Standard', 'WaveNet'].includes(voiceType);
                const unit = isCharacterBased ? 'characters' : 'bytes';
                const usage = 0;
                const percentage = 0;
                const progressBarClass = 'bg-success';

                const colDiv = document.createElement('div');
                colDiv.className = 'col-md-6 voice-usage';

                const cardDiv = document.createElement('div');
                cardDiv.className = 'summary-card';

                // Icon based on voice type
                let iconClass = 'fas fa-microphone';
                switch (voiceType) {
                    case 'Standard':
                        iconClass = 'fas fa-microphone-alt';
                        break;
                    case 'WaveNet':
                        iconClass = 'fas fa-wave-square';
                        break;
                    case 'Neural2':
                        iconClass = 'fas fa-brain';
                        break;
                    case 'Polyglot':
                        iconClass = 'fas fa-language';
                        break;
                    case 'Journey':
                        iconClass = 'fas fa-road';
                        break;
                    case 'Studio':
                        iconClass = 'fas fa-video';
                        break;
                    default:
                        iconClass = 'fas fa-microphone';
                }

                cardDiv.innerHTML = `
                    <h5><i class="${iconClass}"></i> ${voiceType} Voices</h5>
                    <p>${usage.toLocaleString()} / ${limit.toLocaleString()} ${unit}</p>
                    <div class="progress">
                        <div 
                            class="progress-bar ${progressBarClass}" 
                            role="progressbar" 
                            style="width: ${percentage}%;" 
                            aria-valuenow="${percentage}" 
                            aria-valuemin="0" 
                            aria-valuemax="100"
                        >
                            ${percentage.toFixed(2)}%
                        </div>
                    </div>
                `;

                voiceUsageContainer.appendChild(colDiv);
                colDiv.appendChild(cardDiv);
            }
        }
    }

    function generateColorPalette(numColors) {
        const colors = [];
        const hueStep = 360 / numColors;
        for (let i = 0; i < numColors; i++) {
            const hue = i * hueStep;
            colors.push(`hsl(${hue}, 70%, 50%)`);
        }
        return colors;
    }

    function getCurrentYearMonth() {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
    }

    // ==========================================================================
    // GERMAN LESSONS INTEGRATION
    // ==========================================================================

    // Fetch available German lessons
    async function loadGermanLessons() {
        if (!germanLessonSelect) return;

        try {
            const response = await fetch('/german-lessons', {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                console.log('German lessons not available');
                return;
            }

            const data = await response.json();
            if (data.success && data.lessons && data.lessons.length > 0) {
                germanLessonSelect.innerHTML = '<option value="">Select a lesson...</option>';
                data.lessons.forEach(lesson => {
                    const option = document.createElement('option');
                    option.value = lesson.filename;
                    option.textContent = lesson.displayName;
                    germanLessonSelect.appendChild(option);
                });
                console.log(`Loaded ${data.lessons.length} German lessons`);
            } else {
                // Hide the loader if no lessons available
                const loader = document.querySelector('.german-lessons-loader');
                if (loader) loader.style.display = 'none';
            }
        } catch (error) {
            console.error('Error loading German lessons:', error);
            // Hide the loader on error
            const loader = document.querySelector('.german-lessons-loader');
            if (loader) loader.style.display = 'none';
        }
    }

    // Load selected German lesson into text editor
    async function loadSelectedGermanLesson() {
        const filename = germanLessonSelect.value;
        if (!filename) {
            alert('Please select a lesson first.');
            return;
        }

        loadGermanLessonBtn.disabled = true;
        loadGermanLessonBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';

        try {
            const response = await fetch(`/german-lessons/${encodeURIComponent(filename)}`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Failed to load lesson');
            }

            const data = await response.json();
            if (data.success) {
                textEditor.value = data.content;
                updateEditorCharCount();
                updateShadowingVisibility();

                // Set original filename for audio output
                originalFileName = filename.replace('.txt', '');

                // Auto-select German language
                languageSelect.value = 'de-DE';
                loadVoices();

                console.log(`Loaded German lesson: ${filename}`);
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error loading German lesson:', error);
            alert('Error loading lesson: ' + error.message);
        } finally {
            loadGermanLessonBtn.disabled = false;
            loadGermanLessonBtn.innerHTML = '<i class="fas fa-download"></i> Load';
        }
    }

    // Event listener for load button
    if (loadGermanLessonBtn) {
        loadGermanLessonBtn.addEventListener('click', loadSelectedGermanLesson);
    }

    // Also allow double-click on select to load
    if (germanLessonSelect) {
        germanLessonSelect.addEventListener('dblclick', () => {
            if (germanLessonSelect.value) {
                loadSelectedGermanLesson();
            }
        });
    }

    // ==========================================================================
    // SHADOWING PRACTICE MODE
    // ==========================================================================

    // Shadowing DOM Elements
    const shadowingCard = document.getElementById('shadowingCard');
    const shadowingLaunch = document.getElementById('shadowingLaunch');
    const shadowingPlayer = document.getElementById('shadowingPlayer');
    const startShadowingBtn = document.getElementById('startShadowingBtn');
    const phraseList = document.getElementById('phraseList');
    const gapIndicator = document.getElementById('gapIndicator');
    const gapTimer = document.getElementById('gapTimer');
    const shadowingAudio = document.getElementById('shadowingAudio');
    const gapMultiplierSelect = document.getElementById('gapMultiplier');
    const shadowingSpeedSelect = document.getElementById('shadowingSpeed');
    const loopCountSelect = document.getElementById('loopCount');
    const shadowingPrevBtn = document.getElementById('shadowingPrevBtn');
    const shadowingPlayPauseBtn = document.getElementById('shadowingPlayPauseBtn');
    const shadowingNextBtn = document.getElementById('shadowingNextBtn');
    const shadowingRestartBtn = document.getElementById('shadowingRestartBtn');
    const shadowingStopBtn = document.getElementById('shadowingStopBtn');
    const currentPhraseNumSpan = document.getElementById('currentPhraseNum');
    const totalPhrasesSpan = document.getElementById('totalPhrases');

    // Shadowing State
    let shadowingState = {
        phrases: [],
        currentIndex: 0,
        isPlaying: false,
        isPaused: false,
        currentLoopIteration: 0,
        gapTimeoutId: null,
        gapIntervalId: null,
        phraseAudioUrls: [], // Cache for generated audio URLs (fallback)
        currentPhraseUrl: null,
        // For using existing MP3
        useExistingAudio: false,
        phraseTimings: [], // [{start, end, duration}, ...]
        fullAudioUrl: null
    };

    // Split text into phrases (sentences)
    function splitIntoPhrases(text) {
        // Split by sentence-ending punctuation, keeping the punctuation
        const sentences = text.split(/(?<=[.!?])\s+/).filter(function(s) { return s.trim().length > 0; });
        return sentences.map(function(s) { return s.trim(); });
    }

    // Detect silence gaps in audio using Web Audio API
    // Returns array of timestamps where silences occur (phrase boundaries)
    async function detectSilenceGaps(audioUrl, silenceThreshold, minSilenceDuration) {
        silenceThreshold = silenceThreshold || 0.01; // Audio level below this = silence
        minSilenceDuration = minSilenceDuration || 0.3; // Minimum silence length in seconds

        console.log('Detecting silence gaps in audio...');

        try {
            var audioContext = new (window.AudioContext || window.webkitAudioContext)();
            var response = await fetch(audioUrl);
            var arrayBuffer = await response.arrayBuffer();
            var audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            var channelData = audioBuffer.getChannelData(0); // Get first channel
            var sampleRate = audioBuffer.sampleRate;
            var totalDuration = audioBuffer.duration;

            console.log('  Sample rate:', sampleRate, 'Duration:', totalDuration.toFixed(2) + 's');

            // Analyze in chunks (every 10ms)
            var chunkSize = Math.floor(sampleRate * 0.01); // 10ms chunks
            var silenceGaps = [];
            var inSilence = false;
            var silenceStart = 0;

            for (var i = 0; i < channelData.length; i += chunkSize) {
                // Calculate RMS (root mean square) for this chunk
                var sum = 0;
                var chunkEnd = Math.min(i + chunkSize, channelData.length);
                for (var j = i; j < chunkEnd; j++) {
                    sum += channelData[j] * channelData[j];
                }
                var rms = Math.sqrt(sum / (chunkEnd - i));

                var currentTime = i / sampleRate;

                if (rms < silenceThreshold) {
                    // In silence
                    if (!inSilence) {
                        inSilence = true;
                        silenceStart = currentTime;
                    }
                } else {
                    // In sound
                    if (inSilence) {
                        var silenceDuration = currentTime - silenceStart;
                        if (silenceDuration >= minSilenceDuration) {
                            // Found a significant silence gap
                            silenceGaps.push({
                                start: silenceStart,
                                end: currentTime,
                                midpoint: silenceStart + (silenceDuration / 2)
                            });
                        }
                        inSilence = false;
                    }
                }
            }

            audioContext.close();

            console.log('  Found ' + silenceGaps.length + ' silence gaps');
            silenceGaps.forEach(function(gap, i) {
                console.log('    Gap ' + (i+1) + ': ' + gap.start.toFixed(2) + 's - ' + gap.end.toFixed(2) + 's');
            });

            return {
                gaps: silenceGaps,
                totalDuration: totalDuration
            };
        } catch (error) {
            console.error('Error detecting silence:', error);
            return null;
        }
    }

    // Build phrase timings from detected silence gaps
    function buildTimingsFromSilence(silenceResult, phraseCount) {
        if (!silenceResult || !silenceResult.gaps) {
            return null;
        }

        var gaps = silenceResult.gaps;
        var totalDuration = silenceResult.totalDuration;
        var timings = [];

        // Filter out leading silence (gap that starts at or very near 0)
        // This happens when the audio file has silence before the first phrase
        var filteredGaps = gaps.filter(function(gap) {
            return gap.start > 0.1; // Ignore gaps in the first 100ms
        });

        console.log('  Filtered gaps (removed leading silence):', filteredGaps.length);

        // First phrase: from 0 (or after leading silence) to first gap
        var audioStart = 0;
        if (gaps.length > 0 && gaps[0].start < 0.1) {
            // There's leading silence - start after it
            audioStart = gaps[0].end;
            console.log('  Audio starts after leading silence at:', audioStart.toFixed(2) + 's');
        }

        var currentStart = audioStart;

        for (var i = 0; i < phraseCount; i++) {
            var timing;

            if (i < filteredGaps.length) {
                // End at the start of the silence gap
                timing = {
                    start: currentStart,
                    end: filteredGaps[i].start,
                    duration: filteredGaps[i].start - currentStart
                };
                // Next phrase starts after the silence gap
                currentStart = filteredGaps[i].end;
            } else {
                // No more gaps - last phrase goes to end
                timing = {
                    start: currentStart,
                    end: totalDuration,
                    duration: totalDuration - currentStart
                };
            }

            console.log('  Phrase ' + (i + 1) + ': ' + timing.start.toFixed(2) + 's - ' + timing.end.toFixed(2) + 's');
            timings.push(timing);
        }

        return timings;
    }

    // Fallback: Estimate phrase timings based on character count (when silence detection fails)
    function estimatePhraseTimings(phrases, speakingRate, totalDuration) {
        // Calculate relative weights based on character count
        var charCounts = phrases.map(function(phrase) {
            return phrase.length;
        });

        var totalChars = charCounts.reduce(function(a, b) { return a + b; }, 0);

        console.log('Fallback: Estimating timings from character count');
        console.log('  Total characters:', totalChars);
        console.log('  Total audio duration:', totalDuration, 'seconds');

        // Build timing array - distribute total duration proportionally
        var currentTime = 0;
        var timings = phrases.map(function(phrase, i) {
            var proportion = charCounts[i] / totalChars;
            var duration = totalDuration * proportion;

            var timing = {
                start: currentTime,
                end: currentTime + duration,
                duration: duration
            };

            currentTime += duration;
            return timing;
        });

        return timings;
    }

    // Show shadowing card when text OR audio is available
    function updateShadowingVisibility() {
        var text = '';
        if (currentInputMode === 'editor') {
            text = textEditor.value.trim();
        } else {
            text = textPreview.value.trim();
        }

        var hasSrc = mainAudioPlayer && mainAudioPlayer.src && mainAudioPlayer.src.length > 0 && !mainAudioPlayer.src.endsWith('/');
        var hasDuration = mainAudioPlayer && mainAudioPlayer.duration && mainAudioPlayer.duration > 0 && !isNaN(mainAudioPlayer.duration);
        var hasAudio = hasSrc && hasDuration;

        // Show shadowing card if we have text OR audio
        if ((text || hasAudio) && shadowingCard) {
            shadowingCard.classList.add('show');
            updateShadowingButtonState();
        } else if (shadowingCard) {
            shadowingCard.classList.remove('show');
        }
    }

    // Update the Start Practice button based on audio availability
    function updateShadowingButtonState() {
        if (!startShadowingBtn) return;

        var hasSrc = mainAudioPlayer.src && mainAudioPlayer.src.length > 0 && !mainAudioPlayer.src.endsWith('/');
        var hasDuration = mainAudioPlayer.duration && mainAudioPlayer.duration > 0 && !isNaN(mainAudioPlayer.duration);
        var hasAudio = hasSrc && hasDuration;

        var text = '';
        if (currentInputMode === 'editor') {
            text = textEditor.value.trim();
        } else {
            text = textPreview.value.trim();
        }

        if (hasAudio && text) {
            startShadowingBtn.innerHTML = '<i class="fas fa-play"></i> Start Practice (0 API calls)';
            startShadowingBtn.title = 'Uses the already-generated audio with your text';
        } else if (hasAudio) {
            startShadowingBtn.innerHTML = '<i class="fas fa-play"></i> Start Practice (Audio Only)';
            startShadowingBtn.title = 'Phrases will be auto-detected from silence gaps in the audio';
        } else {
            startShadowingBtn.innerHTML = '<i class="fas fa-play"></i> Start Practice';
            startShadowingBtn.title = 'Generate audio first to avoid extra API calls';
        }
    }

    // Listen for audio load to update button state and shadowing visibility
    if (mainAudioPlayer) {
        mainAudioPlayer.addEventListener('loadedmetadata', function() {
            updateShadowingButtonState();
            updateShadowingVisibility();
        });
        mainAudioPlayer.addEventListener('loadeddata', function() {
            updateShadowingButtonState();
            updateShadowingVisibility();
        });
    }

    // Listen for text changes
    if (textEditor) {
        textEditor.addEventListener('input', updateShadowingVisibility);
    }
    if (textPreview) {
        const observer = new MutationObserver(updateShadowingVisibility);
        observer.observe(textPreview, { attributes: true, childList: true, characterData: true });
        // Also check on value change
        textPreview.addEventListener('change', updateShadowingVisibility);
    }

    // Initialize shadowing session
    function initShadowing() {
        var text = '';
        if (currentInputMode === 'editor') {
            text = textEditor.value.trim();
        } else {
            text = textPreview.value.trim();
        }

        // Check if we have audio loaded
        var hasSrc = mainAudioPlayer.src && mainAudioPlayer.src.length > 0 && !mainAudioPlayer.src.endsWith('/');
        var hasDuration = mainAudioPlayer.duration && mainAudioPlayer.duration > 0 && !isNaN(mainAudioPlayer.duration);
        var hasAudio = hasSrc && hasDuration;

        // Need either text or audio
        if (!text && !hasAudio) {
            alert('Please enter some text or load an audio file first.');
            return;
        }

        // If no audio but has text, need a voice selected
        if (!hasAudio && text) {
            var voice = voiceSelect.value;
            if (!voice) {
                alert('Please select a voice first.');
                return;
            }
        }

        // Audio-only mode: will detect phrases from silence
        var audioOnlyMode = hasAudio && !text;

        // Split into phrases (or create placeholder for audio-only mode)
        if (text) {
            shadowingState.phrases = splitIntoPhrases(text);
        } else {
            // Will be populated after silence detection
            shadowingState.phrases = [];
        }

        shadowingState.currentIndex = 0;
        shadowingState.isPlaying = false;
        shadowingState.isPaused = false;
        shadowingState.currentLoopIteration = 0;
        shadowingState.audioOnlyMode = audioOnlyMode;
        shadowingState.phraseAudioUrls = [];

        // Use the audio we already checked
        var existingAudioSrc = mainAudioPlayer.src;

        console.log('Shadowing init:');
        console.log('  Audio source:', existingAudioSrc);
        console.log('  Audio duration:', mainAudioPlayer.duration);
        console.log('  Audio-only mode:', audioOnlyMode);
        console.log('  Text phrases:', shadowingState.phrases.length);

        if (hasAudio) {
            // Use existing MP3 - ZERO API CALLS!
            shadowingState.useExistingAudio = true;
            shadowingState.fullAudioUrl = existingAudioSrc;
            shadowingAudio.src = existingAudioSrc;

            console.log('Shadowing: Using loaded audio (0 API calls!)');
            console.log('Analyzing audio for phrase boundaries...');

            // Show loading state
            startShadowingBtn.disabled = true;
            startShadowingBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing audio...';

            // Use silence detection to find exact phrase boundaries
            detectSilenceGaps(existingAudioSrc).then(function(silenceResult) {
                startShadowingBtn.disabled = false;
                updateShadowingButtonState();

                if (silenceResult && silenceResult.gaps.length > 0) {
                    // For audio-only mode, create phrases from detected gaps
                    if (audioOnlyMode) {
                        var numPhrases = silenceResult.gaps.length + 1;
                        shadowingState.phrases = [];
                        for (var p = 1; p <= numPhrases; p++) {
                            shadowingState.phrases.push('Phrase ' + p);
                        }
                        console.log('Audio-only mode: Created ' + numPhrases + ' phrases from silence detection');
                    }

                    // Build timings from detected silence gaps
                    shadowingState.phraseTimings = buildTimingsFromSilence(
                        silenceResult,
                        shadowingState.phrases.length
                    );
                    console.log('Phrase timings from silence detection:', shadowingState.phraseTimings);

                    // Re-render phrase list now that we have phrases
                    renderPhraseList();
                    totalPhrasesSpan.textContent = shadowingState.phrases.length;
                } else if (!audioOnlyMode) {
                    // No gaps found but we have text - fallback to character-based estimation
                    console.log('No silence gaps found, falling back to estimation');
                    var speakingRate = parseFloat(speakingRateInput.value) || 1.0;
                    shadowingState.phraseTimings = estimatePhraseTimings(
                        shadowingState.phrases,
                        speakingRate,
                        mainAudioPlayer.duration
                    );
                } else {
                    // Audio-only with no gaps - create a single phrase for whole audio
                    console.log('No silence gaps found in audio-only mode, using entire audio as one phrase');
                    shadowingState.phrases = ['Full Audio'];
                    shadowingState.phraseTimings = [{
                        start: 0,
                        end: mainAudioPlayer.duration,
                        duration: mainAudioPlayer.duration
                    }];
                    renderPhraseList();
                    totalPhrasesSpan.textContent = '1';
                }
            }).catch(function(error) {
                console.error('Silence detection failed:', error);
                startShadowingBtn.disabled = false;
                updateShadowingButtonState();

                if (!audioOnlyMode) {
                    // Fallback to character-based estimation
                    var speakingRate = parseFloat(speakingRateInput.value) || 1.0;
                    shadowingState.phraseTimings = estimatePhraseTimings(
                        shadowingState.phrases,
                        speakingRate,
                        mainAudioPlayer.duration
                    );
                } else {
                    // Audio-only fallback - use entire audio
                    shadowingState.phrases = ['Full Audio'];
                    shadowingState.phraseTimings = [{
                        start: 0,
                        end: mainAudioPlayer.duration,
                        duration: mainAudioPlayer.duration
                    }];
                    renderPhraseList();
                    totalPhrasesSpan.textContent = '1';
                }
            });
        } else {
            // No existing audio - will need to generate per phrase (uses API)
            shadowingState.useExistingAudio = false;
            shadowingState.phraseTimings = [];
            console.log('Shadowing: No audio loaded, will generate phrases individually');
        }

        // Populate phrase list (may be re-rendered after silence detection in audio-only mode)
        renderPhraseList();

        // Update UI
        shadowingLaunch.style.display = 'none';
        shadowingPlayer.classList.add('active');
        totalPhrasesSpan.textContent = shadowingState.phrases.length || '?';
        currentPhraseNumSpan.textContent = '1';

        console.log('Shadowing initialized');
    }

    // Render phrase list
    function renderPhraseList() {
        phraseList.innerHTML = '';
        shadowingState.phrases.forEach((phrase, index) => {
            const div = document.createElement('div');
            div.className = 'phrase-item' + (index === shadowingState.currentIndex ? ' current' : '');
            div.innerHTML = `
                <span class="phrase-number">${index + 1}</span>
                <span class="phrase-text">${escapeHtml(phrase)}</span>
                <span class="phrase-status">${index < shadowingState.currentIndex ? 'Done' : (index === shadowingState.currentIndex ? 'Current' : '')}</span>
            `;
            div.addEventListener('click', () => jumpToPhrase(index));
            phraseList.appendChild(div);
        });
    }

    // Helper to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Update phrase list highlighting
    function updatePhraseListUI() {
        const items = phraseList.querySelectorAll('.phrase-item');
        items.forEach((item, index) => {
            item.classList.remove('current', 'completed');
            const statusSpan = item.querySelector('.phrase-status');
            if (index < shadowingState.currentIndex) {
                item.classList.add('completed');
                statusSpan.textContent = 'Done';
            } else if (index === shadowingState.currentIndex) {
                item.classList.add('current');
                statusSpan.textContent = 'Current';
                // Scroll into view
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                statusSpan.textContent = '';
            }
        });
        currentPhraseNumSpan.textContent = shadowingState.currentIndex + 1;
    }

    // Generate audio for a phrase using test-voice endpoint
    async function generatePhraseAudio(phrase) {
        const voice = voiceSelect.value;
        const language = languageSelect.value;
        const speed = parseFloat(shadowingSpeedSelect.value) || 1.0;

        try {
            const response = await fetch('/test-voice', {
                method: 'POST',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    language: language,
                    voice: voice,
                    speakingRate: speed,
                    pitch: parseFloat(pitchInput.value) || 0,
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

    // Play current phrase
    async function playCurrentPhrase() {
        if (shadowingState.currentIndex >= shadowingState.phrases.length) {
            // End of session
            endShadowing();
            return;
        }

        const phrase = shadowingState.phrases[shadowingState.currentIndex];
        shadowingState.isPlaying = true;
        updatePlayPauseButton();

        // Show which phrase is playing
        gapIndicator.classList.remove('show');
        updatePhraseListUI();

        // Check if using existing MP3 (zero API calls path)
        if (shadowingState.useExistingAudio && shadowingState.phraseTimings.length > 0) {
            const timing = shadowingState.phraseTimings[shadowingState.currentIndex];
            if (timing) {
                // Seek to phrase start position and play
                shadowingAudio.currentTime = timing.start;

                // Set up handler to stop at phrase end
                var onTimeUpdate = function() {
                    if (shadowingAudio.currentTime >= timing.end) {
                        shadowingAudio.removeEventListener('timeupdate', onTimeUpdate);
                        shadowingAudio.pause();
                        // Manually trigger the gap (since 'ended' won't fire)
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

        // Fallback: Generate audio for this phrase (uses API)
        var audioUrl = shadowingState.phraseAudioUrls[shadowingState.currentIndex];
        if (!audioUrl) {
            // Show loading state
            var currentItem = phraseList.querySelector('.phrase-item.current .phrase-status');
            if (currentItem) currentItem.textContent = 'Loading...';

            audioUrl = await generatePhraseAudio(phrase);
            if (audioUrl) {
                shadowingState.phraseAudioUrls[shadowingState.currentIndex] = audioUrl;
            } else {
                // Error generating audio, skip to next
                console.error('Could not generate audio for phrase:', phrase);
                shadowingState.currentIndex++;
                playCurrentPhrase();
                return;
            }
        }

        // Play the audio
        shadowingAudio.src = audioUrl;
        shadowingAudio.playbackRate = 1.0; // Speed already applied in TTS
        shadowingAudio.play();
    }

    // Start gap with specified duration (for existing audio mode)
    function startGapWithDuration(phraseDuration) {
        var gapMultiplier = parseFloat(gapMultiplierSelect.value) || 1.5;
        var gapDuration = phraseDuration * gapMultiplier;

        gapIndicator.classList.add('show');

        var remainingTime = gapDuration;
        gapTimer.textContent = remainingTime.toFixed(1) + 's';

        // Countdown timer
        shadowingState.gapIntervalId = setInterval(function() {
            remainingTime -= 0.1;
            if (remainingTime > 0) {
                gapTimer.textContent = remainingTime.toFixed(1) + 's';
            }
        }, 100);

        // After gap, move to next phrase
        shadowingState.gapTimeoutId = setTimeout(function() {
            clearInterval(shadowingState.gapIntervalId);
            gapIndicator.classList.remove('show');

            // Handle looping
            var loopCount = parseInt(loopCountSelect.value);
            shadowingState.currentLoopIteration++;

            if (loopCount === 0 || shadowingState.currentLoopIteration < loopCount) {
                // Repeat current phrase
                playCurrentPhrase();
            } else {
                // Move to next phrase
                shadowingState.currentLoopIteration = 0;
                shadowingState.currentIndex++;
                playCurrentPhrase();
            }
        }, gapDuration * 1000);
    }

    // Handle audio ended - start gap
    if (shadowingAudio) {
        shadowingAudio.addEventListener('ended', () => {
            if (!shadowingState.isPlaying) return;
            startGap();
        });
    }

    // Start gap (silence for user to repeat)
    function startGap() {
        const gapMultiplier = parseFloat(gapMultiplierSelect.value) || 1.5;
        const phraseDuration = shadowingAudio.duration || 2;
        const gapDuration = phraseDuration * gapMultiplier;

        gapIndicator.classList.add('show');

        let remainingTime = gapDuration;
        gapTimer.textContent = remainingTime.toFixed(1) + 's';

        // Countdown timer
        shadowingState.gapIntervalId = setInterval(() => {
            remainingTime -= 0.1;
            if (remainingTime > 0) {
                gapTimer.textContent = remainingTime.toFixed(1) + 's';
            }
        }, 100);

        // After gap, move to next phrase
        shadowingState.gapTimeoutId = setTimeout(() => {
            clearInterval(shadowingState.gapIntervalId);
            gapIndicator.classList.remove('show');

            // Handle looping
            const loopCount = parseInt(loopCountSelect.value);
            shadowingState.currentLoopIteration++;

            if (loopCount === 0 || shadowingState.currentLoopIteration < loopCount) {
                // Repeat current phrase
                playCurrentPhrase();
            } else {
                // Move to next phrase
                shadowingState.currentLoopIteration = 0;
                shadowingState.currentIndex++;
                playCurrentPhrase();
            }
        }, gapDuration * 1000);
    }

    // Clear gap timers
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

    // Update play/pause button
    function updatePlayPauseButton() {
        const icon = shadowingPlayPauseBtn.querySelector('i');
        if (shadowingState.isPlaying && !shadowingState.isPaused) {
            icon.className = 'fas fa-pause';
        } else {
            icon.className = 'fas fa-play';
        }
    }

    // Play/Pause toggle
    function togglePlayPause() {
        if (!shadowingState.isPlaying) {
            // Start playing
            playCurrentPhrase();
        } else if (shadowingState.isPaused) {
            // Resume
            shadowingState.isPaused = false;
            shadowingAudio.play();
            updatePlayPauseButton();
        } else {
            // Pause
            shadowingState.isPaused = true;
            shadowingAudio.pause();
            clearGapTimers();
            gapIndicator.classList.remove('show');
            updatePlayPauseButton();
        }
    }

    // Jump to specific phrase
    function jumpToPhrase(index) {
        clearGapTimers();
        // Remove any existing timeupdate handler
        if (shadowingState.currentTimeUpdateHandler) {
            shadowingAudio.removeEventListener('timeupdate', shadowingState.currentTimeUpdateHandler);
            shadowingState.currentTimeUpdateHandler = null;
        }
        shadowingAudio.pause();
        gapIndicator.classList.remove('show');

        shadowingState.currentIndex = index;
        shadowingState.currentLoopIteration = 0;
        updatePhraseListUI();

        if (shadowingState.isPlaying && !shadowingState.isPaused) {
            playCurrentPhrase();
        }
    }

    // Previous phrase
    function prevPhrase() {
        if (shadowingState.currentIndex > 0) {
            jumpToPhrase(shadowingState.currentIndex - 1);
        }
    }

    // Next phrase
    function nextPhrase() {
        if (shadowingState.currentIndex < shadowingState.phrases.length - 1) {
            jumpToPhrase(shadowingState.currentIndex + 1);
        }
    }

    // Restart from beginning
    function restartShadowing() {
        jumpToPhrase(0);
    }

    // End shadowing session
    function endShadowing() {
        shadowingState.isPlaying = false;
        shadowingState.isPaused = false;
        clearGapTimers();
        // Remove any existing timeupdate handler
        if (shadowingState.currentTimeUpdateHandler) {
            shadowingAudio.removeEventListener('timeupdate', shadowingState.currentTimeUpdateHandler);
            shadowingState.currentTimeUpdateHandler = null;
        }
        shadowingAudio.pause();
        gapIndicator.classList.remove('show');
        updatePlayPauseButton();
        console.log('Shadowing session complete!');
    }

    // Stop and close shadowing
    function stopShadowing() {
        endShadowing();

        // Clean up audio URLs
        shadowingState.phraseAudioUrls.forEach(url => {
            if (url) URL.revokeObjectURL(url);
        });
        shadowingState.phraseAudioUrls = [];

        // Reset UI
        shadowingPlayer.classList.remove('active');
        shadowingLaunch.style.display = 'flex';
    }

    // Event listeners for shadowing controls
    if (startShadowingBtn) {
        startShadowingBtn.addEventListener('click', initShadowing);
    }
    if (shadowingPlayPauseBtn) {
        shadowingPlayPauseBtn.addEventListener('click', togglePlayPause);
    }
    if (shadowingPrevBtn) {
        shadowingPrevBtn.addEventListener('click', prevPhrase);
    }
    if (shadowingNextBtn) {
        shadowingNextBtn.addEventListener('click', nextPhrase);
    }
    if (shadowingRestartBtn) {
        shadowingRestartBtn.addEventListener('click', restartShadowing);
    }
    if (shadowingStopBtn) {
        shadowingStopBtn.addEventListener('click', stopShadowing);
    }

    // **11. Initialize by Loading Voices and Fetching Usage Stats**
    loadVoices();
    fetchUsageStats();
    loadGermanLessons();

    // **Helper Function to Convert Base64 to Blob**
    function base64ToBlob(base64, mime) {
        const byteChars = atob(base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], {type: mime});
    }
});
