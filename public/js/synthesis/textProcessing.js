// ==========================================================================
// TEXT PROCESSING UTILITIES
// ==========================================================================

export function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export function stripComments(text) {
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

export function convertTextToSsml(text, pauseDuration) {
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
