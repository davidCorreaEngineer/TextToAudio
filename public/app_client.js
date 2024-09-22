document.addEventListener('DOMContentLoaded', function() {
    console.log("app_client.js loaded and DOMContentLoaded event fired.");
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

    // **1. Initialize Chart Variables**
    let usageChart;
    let voiceTypeChart;

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
            const response = await fetch('/voices');
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

    // **6. Update Display Values for Advanced Settings**
    speakingRateInput.addEventListener('input', () => {
        speakingRateValue.textContent = speakingRateInput.value;
        console.log("Speaking rate changed to:", speakingRateInput.value);
    });

    pitchInput.addEventListener('input', () => {
        pitchValue.textContent = pitchInput.value;
        console.log("Pitch changed to:", pitchInput.value);
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language, voice, speakingRate, pitch })
            });

            if (!response.ok) {
                throw new Error('Failed to test voice');
            }

            const result = await response.json();
            if (result.success) {
                // Decode Base64 audio content
                const audioBlob = base64ToBlob(result.audioContent, 'audio/mp3');
                const audioUrl = URL.createObjectURL(audioBlob);
                audioPlayer.src = audioUrl;
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

        // Retrieve edited text from preview
        const editedText = textPreview.value;
        if (!editedText.trim()) {
            alert('Text preview is empty. Please upload and review your text file.');
            console.log("Text preview is empty.");
            return;
        }
		
		// **Process Text to Add Pauses if Enabled**
        const addPauses = addPausesCheckbox.checked;
        const pauseDuration = parseInt(pauseDurationInput.value) || 1000; // Default to 1000 ms if invalid

        let processedText = editedText;
        let useSsml = false;

        if (addPauses) {
            useSsml = true;
            processedText = convertTextToSsml(editedText, pauseDuration);
            console.log("Processed text with SSML:", processedText);
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
                if (xhr.status === 200) {
                    const result = JSON.parse(xhr.responseText);
                    if (result.success) {
                        resultDiv.innerHTML = `<a href="${result.file}" download="${result.fileName}" class="btn btn-success">Download Audio: ${result.fileName}</a>`;
                        console.log("Audio generated:", result.fileName);
                    } else {
                        resultDiv.innerHTML = `<p class="text-danger">Error: ${result.error}</p>`;
                        console.log("Error generating audio:", result.error);
                    }
                } else {
                    resultDiv.innerHTML = '<p class="text-danger">Error generating audio. Please try again.</p>';
                    console.log("Error generating audio. Status:", xhr.status);
                }
                // Hide Progress Bar after completion
                progressBar.style.width = '100%';
                progressBar.setAttribute('aria-valuenow', 100);
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
	
	// **Function to Convert Text to SSML with Pauses**
    function convertTextToSsml(text, pauseDuration) {
        // Split text into sentences based on periods, question marks, or exclamation marks
        const sentenceEndRegex = /([.?!])/g;
        const sentences = text.split(sentenceEndRegex).filter(s => s.trim() !== '');
        let ssmlText = '<speak>';

        for (let i = 0; i < sentences.length; i += 2) {
            const sentence = sentences[i].trim();
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
        console.log("Fetching usage statistics for dashboard...");
        try {
            const response = await fetch('/dashboard');
            if (!response.ok) {
                throw new Error('Failed to fetch usage statistics');
            }
            const data = await response.json();
            console.log("Received usage data:", data);
            displayUsageStats(data.quota);
        } catch (error) {
            console.error('Error fetching usage statistics:', error);
            dashboardDiv.innerHTML = '<p class="text-danger">Error loading usage statistics.</p>';
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
