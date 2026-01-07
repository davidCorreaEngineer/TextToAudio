// ==========================================================================
// TOAST NOTIFICATION SYSTEM
// ==========================================================================

import { escapeHtml } from '../utils/html.js';

let toastContainer = null;

function getContainer() {
    if (!toastContainer) {
        toastContainer = document.getElementById('toastContainer');
    }
    return toastContainer;
}

function removeToast(toast) {
    toast.classList.add('hiding');
    setTimeout(() => {
        if (toast.parentElement) {
            toast.parentElement.removeChild(toast);
        }
    }, 300);
}

/**
 * Show toast notification
 * @param {string} type - 'success', 'error', 'info', or 'warning'
 * @param {string} title - Toast title
 * @param {string} message - Toast message (optional)
 * @param {number} duration - Auto-dismiss duration in ms (0 = no auto-dismiss)
 */
export function showToast(type, title, message = '', duration = 4000) {
    const container = getContainer();
    if (!container) {
        console.warn('Toast container not found');
        return null;
    }

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Add ARIA attributes for accessibility
    // Errors use assertive/alert for immediate announcement
    // Other types use polite/status for non-intrusive announcement
    if (type === 'error') {
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
    } else {
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
    }

    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${icons[type]}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(title)}</div>
            ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
        </div>
        <button class="toast-close" aria-label="Close">
            <i class="fas fa-times"></i>
        </button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));

    container.appendChild(toast);

    if (duration > 0) {
        setTimeout(() => removeToast(toast), duration);
    }

    return toast;
}
