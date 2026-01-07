// ==========================================================================
// INPUT MODE TOGGLE
// ==========================================================================

import { dom } from '../dom.js';
import { setInputMode } from '../state.js';
import { updateEditorCharCount } from '../synthesis/ssml.js';
import { updateShadowingVisibility } from '../practice/shadowing.js';
import { updateDictationVisibility } from '../practice/dictation.js';

export function initInputModeToggle() {
    const {
        fileUploadModeBtn, textEditorModeBtn,
        fileUploadContainer, textEditorContainer,
        textEditor
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
