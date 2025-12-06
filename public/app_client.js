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

    // Drop
    audioDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        audioDropZone.classList.remove('dragover');
        console.log("Audio file dropped.");

        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            // Check if it's an audio file
            if (file.type.startsWith('audio/')) {
                loadAudioIntoPlayer(file, file.name);
            } else {
                alert('Please drop an audio file (MP3, WAV, OGG, M4A).');
            }
        }
    });

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

        // Update tooltip content
        if (usageTooltipContent) {
            let tooltipHtml = '';
            for (const [voiceType, data] of Object.entries(voiceTypeUsage)) {
                if (data.usage > 0) {
                    const pct = Math.round((data.usage / data.limit) * 100);
                    tooltipHtml += `<div class="usage-tooltip-item">
                        <span>${voiceType}</span>
                        <span>${pct}%</span>
                    </div>`;
                }
            }
            if (!tooltipHtml) {
                tooltipHtml = '<div class="usage-tooltip-item"><span>No usage this month</span></div>';
            }
            usageTooltipContent.innerHTML = tooltipHtml;
        }
    }

    function displayUsageStats(quota) {
        if (Object.keys(quota).length === 0) {
            dashboardDiv.innerHTML = '<p>No usage data available.</p>';
            return;
        }

        // **10.1. Calculate Summary Statistics**
        let totalUsage = 0;
        let uniqueVoicesSet = new Set();
        let currentMonth = getCurrentYearMonth();
        let currentMonthUsage = 0;

        for (const [yearMonth, voices] of Object.entries(quota)) {
            for (const [voiceType, count] of Object.entries(voices)) {
                totalUsage += count;
                uniqueVoicesSet.add(voiceType);
                if (yearMonth === currentMonth) {
                    currentMonthUsage += count;
                }
            }
        }

        // **10.2. Update Summary Cards**
        document.getElementById('totalUsage').textContent = totalUsage.toLocaleString();
        document.getElementById('uniqueVoices').textContent = uniqueVoicesSet.size;
        document.getElementById('currentMonthUsage').textContent = currentMonthUsage.toLocaleString();

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
        const ctx = document.getElementById('usageChart').getContext('2d');
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
        const ctx = document.getElementById('voiceTypeChart').getContext('2d');
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
        const voiceUsageContainer = document.getElementById('voiceUsageCards');
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

    // **11. Initialize by Loading Voices and Fetching Usage Stats**
    loadVoices();
    fetchUsageStats();

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
