// ==========================================================================
// AUDIO DROP ZONE
// ==========================================================================

import { dom } from '../dom.js';
import { loadAudioIntoPlayer } from './player.js';
import { updateEditorCharCount } from '../synthesis/ssml.js';
import { updateShadowingVisibility } from '../practice/shadowing.js';
import { updateDictationVisibility } from '../practice/dictation.js';

function loadPracticeTextFile(file) {
    const { textEditor, textPreview } = dom;
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

export function initAudioDropZone() {
    const { audioDropZone, audioFileInput } = dom;

    let isFileDialogOpen = false;

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
