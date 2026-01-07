// ==========================================================================
// PHRASE UTILITIES
// ==========================================================================

// Split text into phrases (sentences)
export function splitIntoPhrases(text) {
    // Split by sentence-ending punctuation, keeping the punctuation
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    return sentences.map(s => s.trim());
}

// Compare user answer to correct answer
export function compareAnswers(userAnswer, correctAnswer) {
    // Normalize both answers
    const normalizeText = (text) => {
        return text
            .toLowerCase()
            .replace(/[.,!?;:'"()]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ')          // Normalize whitespace
            .trim();
    };

    const userNorm = normalizeText(userAnswer);
    const correctNorm = normalizeText(correctAnswer);

    // Exact match check (normalized)
    if (userNorm === correctNorm) {
        return {
            score: 100,
            isExactMatch: true,
            userWords: userAnswer.split(/\s+/),
            correctWords: correctAnswer.split(/\s+/),
            diff: []
        };
    }

    // Word-level comparison
    const userWords = userNorm.split(/\s+/).filter(w => w.length > 0);
    const correctWords = correctNorm.split(/\s+/).filter(w => w.length > 0);

    // Simple diff: compare word by word
    const diff = [];
    let matchCount = 0;
    const maxLen = Math.max(userWords.length, correctWords.length);

    for (let i = 0; i < maxLen; i++) {
        const userWord = userWords[i] || '';
        const correctWord = correctWords[i] || '';

        if (userWord === correctWord) {
            diff.push({ type: 'match', user: userWord, correct: correctWord });
            matchCount++;
        } else if (userWord && correctWord) {
            // Check for close match (typo tolerance)
            if (levenshteinDistance(userWord, correctWord) <= 2) {
                diff.push({ type: 'close', user: userWord, correct: correctWord });
                matchCount += 0.5; // Partial credit for close matches
            } else {
                diff.push({ type: 'wrong', user: userWord, correct: correctWord });
            }
        } else if (userWord && !correctWord) {
            diff.push({ type: 'extra', user: userWord, correct: '' });
        } else if (!userWord && correctWord) {
            diff.push({ type: 'missing', user: '', correct: correctWord });
        }
    }

    const score = correctWords.length > 0 ? Math.round((matchCount / correctWords.length) * 100) : 0;

    return {
        score: Math.min(score, 100),
        isExactMatch: false,
        userWords: userAnswer.split(/\s+/),
        correctWords: correctAnswer.split(/\s+/),
        diff: diff
    };
}

// Levenshtein distance for typo detection
export function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
}
