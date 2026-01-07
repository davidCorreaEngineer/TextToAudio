/**
 * Input Validation Module
 * Validates and sanitizes voice parameters and SSML content
 */

// Supported languages for TTS
const SUPPORTED_LANGUAGES = [
    'en-GB', 'en-US', 'en-AU',
    'nl-NL',
    'es-ES', 'es-US',
    'de-DE',
    'ja-JP',
    'it-IT',
    'fr-FR',
    'pt-PT', 'pt-BR',
    'tr-TR'
];

// Voice name pattern: language-region-VoiceType-Letter (e.g., en-US-Standard-A)
const VOICE_NAME_PATTERN = /^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9]+-[A-Z]$/;

// Speaking rate limits
const SPEAKING_RATE_MIN = 0.25;
const SPEAKING_RATE_MAX = 4.0;
const SPEAKING_RATE_DEFAULT = 1.0;

// Pitch limits
const PITCH_MIN = -20.0;
const PITCH_MAX = 20.0;
const PITCH_DEFAULT = 0.0;

// Dangerous patterns to reject in SSML
const DANGEROUS_PATTERNS = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,  // onclick, onerror, etc.
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<!\[CDATA\[/i,    // CDATA sections (could hide malicious content)
    /<!ENTITY/i,       // Entity declarations (XXE attacks)
    /<!DOCTYPE/i,      // DOCTYPE declarations (could reference external DTD)
];

/**
 * Validates and sanitizes voice parameters
 * @param {Object} params - Raw parameters from request
 * @param {string} params.language - Language code (e.g., 'en-US')
 * @param {string} params.voice - Voice name (e.g., 'en-US-Standard-A')
 * @param {string|number} params.speakingRate - Speaking rate (0.25 to 4.0)
 * @param {string|number} params.pitch - Pitch adjustment (-20.0 to 20.0)
 * @returns {{ valid: boolean, errors: string[], sanitized: Object }}
 */
function validateVoiceParams({ language, voice, speakingRate, pitch }) {
    const errors = [];
    const sanitized = {};

    // Validate language
    if (!language || typeof language !== 'string') {
        errors.push('Language is required');
    } else if (!SUPPORTED_LANGUAGES.includes(language)) {
        errors.push(`Unsupported language: ${language}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
    } else {
        sanitized.language = language;
    }

    // Validate voice name format
    if (!voice || typeof voice !== 'string') {
        errors.push('Voice is required');
    } else if (!VOICE_NAME_PATTERN.test(voice)) {
        errors.push(`Invalid voice name format: ${voice}`);
    } else {
        sanitized.voice = voice;
    }

    // Validate and clamp speaking rate
    const rate = parseFloat(speakingRate);
    if (isNaN(rate)) {
        sanitized.speakingRate = SPEAKING_RATE_DEFAULT;
    } else {
        sanitized.speakingRate = Math.max(SPEAKING_RATE_MIN, Math.min(SPEAKING_RATE_MAX, rate));
    }

    // Validate and clamp pitch
    const pitchVal = parseFloat(pitch);
    if (isNaN(pitchVal)) {
        sanitized.pitch = PITCH_DEFAULT;
    } else {
        sanitized.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitchVal));
    }

    return {
        valid: errors.length === 0,
        errors,
        sanitized
    };
}

/**
 * Basic SSML validation - checks for well-formed structure and dangerous content
 * @param {string} text - Text that may contain SSML
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateSsml(text) {
    if (!text || typeof text !== 'string') {
        return { valid: false, error: 'Text is required' };
    }

    // Check for potentially malicious patterns
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(text)) {
            return { valid: false, error: 'Text contains disallowed content' };
        }
    }

    // If text looks like SSML, do structure validation
    // Check for speak tags (case-insensitive detection for validation purposes)
    const hasOpenSpeak = /<speak\b/i.test(text);
    const hasCloseSpeak = /<\/speak>/i.test(text);

    if (hasOpenSpeak || hasCloseSpeak) {
        // SSML spec requires lowercase <speak> tags - reject incorrect casing
        const hasUppercaseOpen = /<SPEAK\b/.test(text) || /<Speak\b/.test(text);
        const hasUppercaseClose = /<\/SPEAK>/.test(text) || /<\/Speak>/.test(text);

        if (hasUppercaseOpen || hasUppercaseClose) {
            return { valid: false, error: 'Invalid SSML: speak tags must be lowercase' };
        }

        // Balanced tag check (with attribute support)
        const speakOpenMatches = text.match(/<speak\b[^>]*>/g) || [];
        const speakCloseMatches = text.match(/<\/speak>/g) || [];

        // Verify proper nesting: first opening tag should appear before first closing tag
        const firstOpenIndex = text.search(/<speak\b/);
        const firstCloseIndex = text.search(/<\/speak>/);

        if (firstCloseIndex !== -1 && (firstOpenIndex === -1 || firstCloseIndex < firstOpenIndex)) {
            return { valid: false, error: 'Invalid SSML structure: closing tag before opening tag' };
        }

        if (speakOpenMatches.length !== speakCloseMatches.length) {
            return { valid: false, error: 'Unbalanced <speak> tags in SSML' };
        }
    }

    return { valid: true, error: null };
}

/**
 * Validates text content for synthesis
 * @param {string} text - Text to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateTextContent(text, maxLength) {
    if (!text || typeof text !== 'string') {
        return { valid: false, error: 'No text provided.' };
    }

    if (text.trim().length === 0) {
        return { valid: false, error: 'No text provided.' };
    }

    if (text.length > maxLength) {
        return {
            valid: false,
            error: `Text is too long (${text.length} characters). Maximum allowed is ${maxLength} characters.`
        };
    }

    return { valid: true, error: null };
}

/**
 * Express middleware factory for voice parameter validation
 * @returns {Function} Express middleware function
 */
function createVoiceParamsValidator() {
    return (req, res, next) => {
        const { language, voice, speakingRate, pitch } = req.body;
        const validation = validateVoiceParams({ language, voice, speakingRate, pitch });

        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: validation.errors.join('; ')
            });
        }

        // Attach sanitized params to request for downstream handlers
        req.validatedParams = validation.sanitized;
        next();
    };
}

/**
 * Express middleware factory for SSML validation
 * @param {string} textField - Name of the field containing text (default: 'textContent')
 * @returns {Function} Express middleware function
 */
function createSsmlValidator(textField = 'textContent') {
    return (req, res, next) => {
        const text = req.body[textField];
        const useSsml = req.body.useSsml === 'true' || req.body.useSsml === true;

        if (useSsml && text) {
            const validation = validateSsml(text);
            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    error: validation.error
                });
            }
        }

        next();
    };
}

module.exports = {
    // Constants
    SUPPORTED_LANGUAGES,
    VOICE_NAME_PATTERN,
    SPEAKING_RATE_MIN,
    SPEAKING_RATE_MAX,
    SPEAKING_RATE_DEFAULT,
    PITCH_MIN,
    PITCH_MAX,
    PITCH_DEFAULT,
    DANGEROUS_PATTERNS,

    // Validation functions
    validateVoiceParams,
    validateSsml,
    validateTextContent,

    // Middleware factories
    createVoiceParamsValidator,
    createSsmlValidator,
};
