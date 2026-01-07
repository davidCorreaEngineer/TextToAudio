// ==========================================================================
// FORM SUBMISSION MODULE
// ==========================================================================

import { dom } from '../dom.js';
import { getApiKey } from '../config.js';
import { currentInputMode, originalFileName, setOriginalFileName } from '../state.js';
import { stripComments, convertTextToSsml } from './textProcessing.js';
import { loadAudioIntoPlayer } from '../audio/player.js';
import { showToast } from '../ui/toast.js';
import { setButtonLoading } from '../ui/loading.js';

// Reference to fetchUsageStats - will be set by app_client.js
let fetchUsageStatsRef = null;

export function setFetchUsageStats(fn) {
    fetchUsageStatsRef = fn;
}

export function initFormSubmission() {
    const { form } = dom;
    if (!form) return;

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log("Form submitted.");

        const {
            textFileInput,
            textEditor,
            textPreview,
            stripCommentsCheckbox,
            addPausesCheckbox,
            pauseDurationInput,
            languageSelect,
            voiceSelect,
            speakingRateInput,
            pitchInput,
            progressContainer,
            progressBar,
            resultDiv
        } = dom;

        // Check if batch mode (multiple files uploaded)
        if (currentInputMode === 'file' && textFileInput && textFileInput.files.length > 1) {
            await handleBatchProcessing(textFileInput.files);
            return;
        }

        // Retrieve text based on current input mode
        let editedText;
        let fileName = originalFileName;

        if (currentInputMode === 'editor') {
            editedText = textEditor?.value || '';
            if (!editedText.trim()) {
                showToast('warning', 'No Text', 'Please enter some text in the editor.');
                console.log("Text editor is empty.");
                return;
            }
            // Generate filename from first words of text for editor mode
            if (fileName === 'audio') {
                const firstWords = editedText.trim().substring(0, 30)
                    .replace(/<[^>]*>/g, '') // Remove SSML tags
                    .replace(/[^\w\s]/g, '') // Remove punctuation
                    .replace(/\s+/g, '_')    // Replace spaces with underscores
                    .toLowerCase();
                fileName = firstWords || 'text_editor';
                setOriginalFileName(fileName);
            }
        } else {
            editedText = textPreview?.value || '';
            if (!editedText.trim()) {
                showToast('warning', 'No File', 'Please upload and review your text file.');
                console.log("Text preview is empty.");
                return;
            }
        }

        // Strip Comments if Enabled
        if (stripCommentsCheckbox?.checked) {
            editedText = stripComments(editedText);
            console.log("Comments stripped. New length:", editedText.length);
        }

        // Process Text to Add Pauses if Enabled
        const addPauses = addPausesCheckbox?.checked;
        const pauseDuration = parseInt(pauseDurationInput?.value) || 1000;

        let processedText = editedText;
        let useSsml = false;

        // Check if text already contains SSML tags
        const containsSSML = /<[^>]+>/.test(editedText);

        if (containsSSML) {
            useSsml = true;
            if (!editedText.trim().startsWith('<speak>')) {
                processedText = `<speak>${editedText}</speak>`;
            }
            console.log("Text contains SSML, using SSML mode.");
        } else if (addPauses) {
            useSsml = true;
            processedText = convertTextToSsml(editedText, pauseDuration);
            console.log("Processed text with SSML pauses.");
        }

        const formData = new FormData();
        formData.append('language', languageSelect?.value || '');
        formData.append('voice', voiceSelect?.value || '');
        formData.append('speakingRate', speakingRateInput?.value || '1');
        formData.append('pitch', pitchInput?.value || '0');
        formData.append('textContent', processedText);
        formData.append('originalFileName', fileName);
        formData.append('useSsml', useSsml);

        // Show Progress Bar
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.setAttribute('aria-valuenow', 0);
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true);

        try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/synthesize', true);
            xhr.setRequestHeader('X-API-Key', getApiKey());

            xhr.upload.onprogress = function(event) {
                if (event.lengthComputable && progressBar) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    progressBar.style.width = `${percentComplete}%`;
                    progressBar.setAttribute('aria-valuenow', percentComplete);
                }
            };

            xhr.onload = function() {
                setButtonLoading(submitBtn, false);

                if (xhr.status === 401 || xhr.status === 403) {
                    localStorage.removeItem('tts_api_key');
                    if (resultDiv) {
                        resultDiv.innerHTML = '<p class="error-message">Invalid API key. Please reload and enter a valid key.</p>';
                    }
                    if (progressContainer) {
                        progressContainer.style.display = 'none';
                    }
                    showToast('error', 'Authentication Failed', 'Invalid API key.');
                    return;
                }

                if (xhr.status === 200) {
                    let result;
                    try {
                        result = JSON.parse(xhr.responseText);
                    } catch (parseError) {
                        console.error('Failed to parse response:', parseError);
                        showToast('error', 'Response Error', 'Invalid response from server');
                        if (progressContainer) progressContainer.style.display = 'none';
                        return;
                    }
                    if (result.success) {
                        if (resultDiv) {
                            resultDiv.innerHTML = `<a href="${result.file}" download="${result.fileName}" class="download-btn"><i class="fas fa-download"></i> Download: ${result.fileName}</a>`;
                        }
                        console.log("Audio generated:", result.fileName);
                        showToast('success', 'Audio Generated', `${result.fileName} is ready to download.`);

                        // Show output card
                        const outputCard = document.getElementById('outputCard');
                        if (outputCard) {
                            outputCard.classList.add('show');
                        }

                        // Load audio into player
                        loadAudioIntoPlayer(result.file, result.fileName);

                        // Add to library
                        if (typeof window.addToLibrary === 'function') {
                            window.addToLibrary(result.file, processedText, '0:00');
                            window.incrementPhrases?.();
                        }

                        // Refresh usage stats
                        if (fetchUsageStatsRef) {
                            fetchUsageStatsRef();
                        }
                    } else {
                        if (resultDiv) {
                            resultDiv.innerHTML = `<p class="error-message">Error: ${result.error}</p>`;
                        }
                        showToast('error', 'Generation Failed', result.error);
                    }
                } else {
                    let result = {};
                    try {
                        if (xhr.responseText) {
                            result = JSON.parse(xhr.responseText);
                        }
                    } catch (e) {
                        // Fallback if response is not JSON
                    }
                    const errorMsg = result.error || 'Error generating audio. Please try again.';
                    if (resultDiv) {
                        resultDiv.innerHTML = `<p class="error-message">Error: ${errorMsg}</p>`;
                    }
                    showToast('error', 'Request Failed', errorMsg);
                }

                if (progressBar) {
                    progressBar.style.width = '100%';
                }
                setTimeout(() => {
                    if (progressContainer) {
                        progressContainer.style.display = 'none';
                    }
                }, 500);
            };

            xhr.onerror = function() {
                setButtonLoading(submitBtn, false);
                if (resultDiv) {
                    resultDiv.innerHTML = '<p class="text-danger">Error generating audio. Please try again.</p>';
                }
                if (progressContainer) {
                    progressContainer.style.display = 'none';
                }
                showToast('error', 'Network Error', 'Failed to connect to server.');
            };

            xhr.send(formData);
        } catch (error) {
            console.error('Error:', error);
            setButtonLoading(submitBtn, false);
            if (resultDiv) {
                resultDiv.innerHTML = '<p class="text-danger">Error generating audio. Please try again.</p>';
            }
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
            showToast('error', 'Error', error.message);
        }
    });
}

async function handleBatchProcessing(files) {
    console.log(`Starting batch processing for ${files.length} files`);

    const {
        languageSelect,
        voiceSelect,
        speakingRateInput,
        pitchInput,
        progressContainer,
        progressBar,
        resultDiv,
        form
    } = dom;

    const formData = new FormData();

    for (let i = 0; i < files.length; i++) {
        formData.append('textFiles', files[i]);
    }

    formData.append('language', languageSelect?.value || '');
    formData.append('voice', voiceSelect?.value || '');
    formData.append('speakingRate', speakingRateInput?.value || '1');
    formData.append('pitch', pitchInput?.value || '0');
    formData.append('useSsml', 'false');

    if (progressContainer) {
        progressContainer.style.display = 'block';
    }
    if (progressBar) {
        progressBar.style.width = '0%';
    }

    const submitBtn = form?.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true);

    try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/synthesize-batch', true);
        xhr.setRequestHeader('X-API-Key', getApiKey());

        xhr.upload.onprogress = function(event) {
            if (event.lengthComputable && progressBar) {
                const percentComplete = Math.round((event.loaded / event.total) * 50);
                progressBar.style.width = `${percentComplete}%`;
            }
        };

        xhr.onload = function() {
            if (xhr.status === 200) {
                if (progressBar) {
                    progressBar.style.width = '100%';
                }
                let response;
                try {
                    response = JSON.parse(xhr.responseText);
                } catch (parseError) {
                    console.error('Failed to parse batch response:', parseError);
                    showToast('error', 'Response Error', 'Invalid response from server');
                    setButtonLoading(submitBtn, false);
                    if (progressContainer) progressContainer.style.display = 'none';
                    return;
                }

                if (response.success) {
                    console.log('Batch processing complete:', response);

                    let resultsHtml = `<div style="margin-bottom: var(--space-md);">
                        <strong>Batch Processing Complete</strong><br>
                        Processed: ${response.successCount} / ${response.totalFiles} files
                    </div>`;

                    response.results.forEach((result) => {
                        if (result.success) {
                            resultsHtml += `
                                <div style="margin-bottom: var(--space-sm); padding: var(--space-sm); background: var(--bg-secondary); border-radius: var(--radius-sm);">
                                    <i class="fas fa-check-circle" style="color: var(--success);"></i>
                                    ${result.fileName} →
                                    <a href="${result.audioFile}" download class="download-btn" style="display: inline-flex; margin-left: var(--space-sm);">
                                        <i class="fas fa-download"></i> ${result.audioFile}
                                    </a>
                                </div>`;
                        } else {
                            resultsHtml += `
                                <div style="margin-bottom: var(--space-sm); padding: var(--space-sm); background: #fee2e2; border-radius: var(--radius-sm); color: var(--error);">
                                    <i class="fas fa-exclamation-circle"></i>
                                    ${result.fileName}: ${result.error}
                                </div>`;
                        }
                    });

                    if (resultDiv) {
                        resultDiv.innerHTML = resultsHtml;
                    }

                    if (response.successCount > 0) {
                        showToast('success', 'Batch Complete', `Successfully generated ${response.successCount} audio files`);
                    } else {
                        showToast('error', 'Batch Failed', 'No files were processed successfully');
                    }

                    if (fetchUsageStatsRef) {
                        fetchUsageStatsRef();
                    }
                } else {
                    showToast('error', 'Batch Failed', response.error || 'Batch processing failed');
                }
            } else {
                let errorData = {};
                try {
                    errorData = JSON.parse(xhr.responseText);
                } catch (e) {
                    // Fallback if response is not JSON
                }
                showToast('error', 'Server Error', errorData.error || `Server error: ${xhr.status}`);
            }

            setButtonLoading(submitBtn, false);
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
        };

        xhr.onerror = function() {
            console.error('Network error during batch processing');
            showToast('error', 'Network Error', 'Failed to connect to server');
            setButtonLoading(submitBtn, false);
            if (progressContainer) {
                progressContainer.style.display = 'none';
            }
        };

        xhr.send(formData);

    } catch (error) {
        console.error('Error in batch processing:', error);
        showToast('error', 'Batch Error', error.message);
        setButtonLoading(submitBtn, false);
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    }
}
