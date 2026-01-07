// ==========================================================================
// HTML UTILITIES
// ==========================================================================

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {*} text - Text to escape (will be converted to string)
 * @returns {string} HTML-escaped string
 */
export function escapeHtml(text) {
    if (text === null || text === undefined) {
        return '';
    }
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}
