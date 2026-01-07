// ==========================================================================
// FILE UPLOAD HANDLERS
// ==========================================================================

import { dom } from '../dom.js';
import { setOriginalFileName } from '../state.js';
import { updateShadowingVisibility } from '../practice/shadowing.js';

const MAX_TEXT_LENGTH = 5000;

export function initFileUploadHandlers() {
    const {
        textFileInput, dropZone, textPreview, fileSizeDiv
    } = dom;

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
