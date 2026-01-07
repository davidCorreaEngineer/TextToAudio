// ==========================================================================
// SETTINGS EVENT HANDLERS
// ==========================================================================

import { dom } from '../dom.js';
import { stripComments } from '../synthesis/textProcessing.js';

function updateStrippedCharCount() {
    const { stripCommentsCheckbox, textPreview, strippedCharCountDiv, cleanCharCountSpan } = dom;
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

export function initSettingsEvents() {
    const {
        speakingRateInput, speakingRateValue,
        pitchInput, pitchValue,
        addPausesCheckbox, pauseDurationContainer,
        stripCommentsCheckbox
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
}
