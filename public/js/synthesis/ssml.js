// ==========================================================================
// SSML TOOLBAR MODULE
// ==========================================================================

import { dom } from '../dom.js';
import { showPrompt, showModal } from '../ui/modal.js';

function updateEditorCharCount() {
    const { textEditor, editorCharCount } = dom;
    if (!textEditor || !editorCharCount) return;

    const count = textEditor.value.length;
    editorCharCount.textContent = `${count.toLocaleString()} characters`;

    if (count > 4500) {
        editorCharCount.style.color = 'var(--error)';
    } else if (count > 4000) {
        editorCharCount.style.color = 'var(--warning)';
    } else {
        editorCharCount.style.color = '';
    }
}

function insertSSMLTag(tagStart, tagEnd, placeholder = '') {
    const { textEditor } = dom;
    if (!textEditor) return;

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

export function initSSMLToolbar() {
    const {
        ssmlPauseBtn,
        ssmlEmphasisBtn,
        ssmlSlowBtn,
        ssmlFastBtn,
        ssmlWhisperBtn,
        ssmlSayAsBtn,
        ssmlHelpBtn,
        textEditor
    } = dom;

    // Pause button - inserts a break tag
    if (ssmlPauseBtn) {
        ssmlPauseBtn.addEventListener('click', async () => {
            const pauseMs = await showPrompt('Enter pause duration in milliseconds:', '500', {
                inputType: 'number',
                min: 0,
                max: 10000,
                step: 100
            });
            if (pauseMs !== null && textEditor) {
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
    }

    // Emphasis button
    if (ssmlEmphasisBtn) {
        ssmlEmphasisBtn.addEventListener('click', async () => {
            const level = await showPrompt('Select emphasis level:', 'strong', {
                inputType: 'select',
                selectOptions: [
                    { value: 'strong', label: 'Strong' },
                    { value: 'moderate', label: 'Moderate' },
                    { value: 'reduced', label: 'Reduced' }
                ]
            });
            if (level !== null) {
                insertSSMLTag(`<emphasis level="${level}">`, '</emphasis>', 'emphasized text');
            }
        });
    }

    // Slow speech button
    if (ssmlSlowBtn) {
        ssmlSlowBtn.addEventListener('click', () => {
            insertSSMLTag('<prosody rate="slow">', '</prosody>', 'slow text');
        });
    }

    // Fast speech button
    if (ssmlFastBtn) {
        ssmlFastBtn.addEventListener('click', () => {
            insertSSMLTag('<prosody rate="fast">', '</prosody>', 'fast text');
        });
    }

    // Whisper effect
    if (ssmlWhisperBtn) {
        ssmlWhisperBtn.addEventListener('click', () => {
            insertSSMLTag('<prosody volume="x-soft" rate="slow">', '</prosody>', 'whispered text');
        });
    }

    // Say-as button (for numbers, dates, etc.)
    if (ssmlSayAsBtn) {
        ssmlSayAsBtn.addEventListener('click', async () => {
            const interpretAs = await showPrompt('Select interpretation type:', 'cardinal', {
                inputType: 'select',
                selectOptions: [
                    { value: 'cardinal', label: 'Cardinal (123)' },
                    { value: 'ordinal', label: 'Ordinal (1st, 2nd)' },
                    { value: 'characters', label: 'Characters (ABC)' },
                    { value: 'fraction', label: 'Fraction (1/2)' },
                    { value: 'date', label: 'Date' },
                    { value: 'time', label: 'Time' },
                    { value: 'telephone', label: 'Telephone' },
                    { value: 'currency', label: 'Currency' }
                ]
            });
            if (interpretAs !== null) {
                insertSSMLTag(`<say-as interpret-as="${interpretAs}">`, '</say-as>', '123');
            }
        });
    }

    // Help button - show SSML reference
    if (ssmlHelpBtn) {
        ssmlHelpBtn.addEventListener('click', () => {
            const helpContent = `
                <div class="ssml-help">
                    <h4>Breaks/Pauses</h4>
                    <code>&lt;break time="500ms"/&gt;</code> - Pause for 500 milliseconds<br>
                    <code>&lt;break strength="strong"/&gt;</code> - Natural pause

                    <h4>Emphasis</h4>
                    <code>&lt;emphasis level="strong"&gt;text&lt;/emphasis&gt;</code><br>
                    Levels: strong, moderate, reduced

                    <h4>Prosody (Speed, Pitch, Volume)</h4>
                    <code>&lt;prosody rate="slow"&gt;text&lt;/prosody&gt;</code><br>
                    <code>&lt;prosody pitch="+2st"&gt;text&lt;/prosody&gt;</code><br>
                    <code>&lt;prosody volume="loud"&gt;text&lt;/prosody&gt;</code><br>
                    <small>Rate: x-slow, slow, medium, fast, x-fast, or percentage</small><br>
                    <small>Pitch: x-low, low, medium, high, x-high, or +/-Xst</small>

                    <h4>Say-As (Interpretation)</h4>
                    <code>&lt;say-as interpret-as="cardinal"&gt;123&lt;/say-as&gt;</code><br>
                    <code>&lt;say-as interpret-as="ordinal"&gt;1&lt;/say-as&gt;</code><br>
                    <code>&lt;say-as interpret-as="characters"&gt;ABC&lt;/say-as&gt;</code><br>
                    <code>&lt;say-as interpret-as="date" format="mdy"&gt;12/25/2024&lt;/say-as&gt;</code>

                    <h4>Substitution</h4>
                    <code>&lt;sub alias="World Wide Web"&gt;WWW&lt;/sub&gt;</code>

                    <p><em>Tip: Select text before clicking toolbar buttons to wrap existing text.</em></p>
                </div>
            `;

            showModal({
                title: 'SSML Quick Reference',
                body: helpContent,
                buttons: [{ label: 'Close', variant: 'primary' }]
            });
        });
    }
}

export { updateEditorCharCount };
