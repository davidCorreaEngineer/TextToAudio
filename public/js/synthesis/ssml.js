// ==========================================================================
// SSML TOOLBAR MODULE
// ==========================================================================

import { dom } from '../dom.js';

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
        ssmlPauseBtn.addEventListener('click', () => {
            const pauseMs = prompt('Enter pause duration in milliseconds:', '500');
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
        ssmlEmphasisBtn.addEventListener('click', () => {
            const level = prompt('Emphasis level (strong, moderate, reduced):', 'strong');
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
        ssmlSayAsBtn.addEventListener('click', () => {
            const interpretAs = prompt(
                'Interpret as (cardinal, ordinal, characters, fraction, date, time, telephone, currency):',
                'cardinal'
            );
            if (interpretAs !== null) {
                insertSSMLTag(`<say-as interpret-as="${interpretAs}">`, '</say-as>', '123');
            }
        });
    }

    // Help button - show SSML reference
    if (ssmlHelpBtn) {
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
    }
}

export { updateEditorCharCount };
