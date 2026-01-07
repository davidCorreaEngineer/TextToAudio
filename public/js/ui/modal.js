// ==========================================================================
// MODAL COMPONENT
// ==========================================================================
// Accessible modal dialogs with focus trap, keyboard navigation, and ARIA

import { escapeHtml } from '../utils/html.js';

let activeModal = null;
let previousActiveElement = null;
let focusTrapListener = null;

/**
 * Shows a modal dialog
 * @param {Object} options - Modal configuration
 * @param {string} options.title - Modal title
 * @param {string|HTMLElement} options.body - Modal body content (HTML string or element)
 * @param {Array<{label: string, variant?: string, onClick?: Function}>} options.buttons - Button configs
 * @param {Function} [options.onClose] - Callback when modal is closed
 * @param {boolean} [options.closeOnBackdrop=true] - Close when clicking backdrop
 * @returns {HTMLElement} The modal element
 */
export function showModal({ title, body, buttons = [], onClose, closeOnBackdrop = true }) {
    // Close any existing modal
    if (activeModal) {
        closeModal();
    }

    // Store currently focused element to restore later
    previousActiveElement = document.activeElement;

    // Get or create modal container
    const backdrop = document.getElementById('modalBackdrop');
    if (!backdrop) {
        console.error('Modal backdrop element not found in DOM');
        return null;
    }

    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalFooter = document.getElementById('modalFooter');
    const modalCloseBtn = backdrop.querySelector('.modal-close');

    // Set title
    if (modalTitle) {
        modalTitle.textContent = title || '';
    }

    // Set body content
    if (modalBody) {
        if (typeof body === 'string') {
            modalBody.innerHTML = body;
        } else if (body instanceof HTMLElement) {
            modalBody.innerHTML = '';
            modalBody.appendChild(body);
        } else {
            modalBody.innerHTML = '';
        }
    }

    // Set buttons
    if (modalFooter) {
        modalFooter.innerHTML = '';
        buttons.forEach((btn, index) => {
            const button = document.createElement('button');
            button.textContent = btn.label;
            button.className = `modal-btn ${btn.variant || 'secondary'}`;
            button.type = 'button';

            button.addEventListener('click', () => {
                if (btn.onClick) {
                    btn.onClick();
                }
                if (btn.closeOnClick !== false) {
                    closeModal();
                }
            });

            // Auto-focus first button
            if (index === 0) {
                button.setAttribute('data-autofocus', 'true');
            }

            modalFooter.appendChild(button);
        });
    }

    // Setup close button
    if (modalCloseBtn) {
        modalCloseBtn.onclick = () => closeModal();
    }

    // Store close callback
    backdrop._onClose = onClose;

    // Setup backdrop click
    if (closeOnBackdrop) {
        backdrop.onclick = (e) => {
            if (e.target === backdrop) {
                closeModal();
            }
        };
    } else {
        backdrop.onclick = null;
    }

    // Show modal
    backdrop.hidden = false;
    backdrop.classList.add('show');
    activeModal = backdrop;

    // Setup focus trap
    setupFocusTrap(backdrop);

    // Setup escape key handler
    document.addEventListener('keydown', handleEscapeKey);

    // Focus first focusable element
    requestAnimationFrame(() => {
        const autofocusEl = backdrop.querySelector('[data-autofocus]');
        const firstFocusable = autofocusEl || getFirstFocusable(backdrop);
        if (firstFocusable) {
            firstFocusable.focus();
        }
    });

    return backdrop;
}

/**
 * Shows an alert modal (informational message)
 * @param {string} message - Message to display
 * @param {string} [type='info'] - Alert type: 'info', 'warning', 'error', 'success'
 * @returns {Promise<void>} Resolves when modal is closed
 */
export function showAlert(message, type = 'info') {
    return new Promise((resolve) => {
        const titles = {
            info: 'Information',
            warning: 'Warning',
            error: 'Error',
            success: 'Success'
        };

        const icons = {
            info: '<svg class="modal-icon info" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="8" r="1" fill="currentColor"/></svg>',
            warning: '<svg class="modal-icon warning" viewBox="0 0 24 24" width="24" height="24"><path d="M12 2L2 22h20L12 2z" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="10" x2="12" y2="14" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="18" r="1" fill="currentColor"/></svg>',
            error: '<svg class="modal-icon error" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/></svg>',
            success: '<svg class="modal-icon success" viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><polyline points="8,12 11,15 16,9" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
        };

        showModal({
            title: titles[type] || titles.info,
            body: `<div class="modal-alert ${type}">${icons[type] || ''}<p>${escapeHtml(message)}</p></div>`,
            buttons: [
                { label: 'OK', variant: 'primary', onClick: resolve }
            ],
            onClose: resolve
        });
    });
}

/**
 * Shows a prompt modal for user input
 * @param {string} message - Prompt message
 * @param {string} [defaultValue=''] - Default input value
 * @param {Object} [options={}] - Additional options
 * @param {string} [options.inputType='text'] - Input type: 'text', 'number', 'password', 'select'
 * @param {Array<{value: string, label: string}>} [options.selectOptions] - Options for select type
 * @param {string} [options.placeholder=''] - Input placeholder
 * @param {number} [options.min] - Min value for number input
 * @param {number} [options.max] - Max value for number input
 * @param {number} [options.step] - Step value for number input
 * @returns {Promise<string|null>} Resolves with input value or null if cancelled
 */
export function showPrompt(message, defaultValue = '', options = {}) {
    return new Promise((resolve) => {
        const {
            inputType = 'text',
            selectOptions = [],
            placeholder = '',
            min,
            max,
            step
        } = options;

        let inputHtml;
        const inputId = 'modalPromptInput';

        if (inputType === 'select') {
            const optionsHtml = selectOptions
                .map(opt => `<option value="${escapeHtml(opt.value)}" ${opt.value === defaultValue ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`)
                .join('');
            inputHtml = `<select id="${inputId}" class="modal-input">${optionsHtml}</select>`;
        } else if (inputType === 'password') {
            inputHtml = `
                <div class="modal-password-container">
                    <input type="password" id="${inputId}" class="modal-input" value="${escapeHtml(defaultValue)}" placeholder="${escapeHtml(placeholder)}">
                    <button type="button" class="modal-password-toggle" aria-label="Show password" data-visible="false">
                        <svg class="eye-icon" viewBox="0 0 24 24" width="20" height="20">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" fill="none" stroke="currentColor" stroke-width="2"/>
                            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/>
                        </svg>
                    </button>
                </div>
            `;
        } else {
            const typeAttr = inputType === 'number' ? 'number' : 'text';
            const minAttr = min !== undefined ? `min="${min}"` : '';
            const maxAttr = max !== undefined ? `max="${max}"` : '';
            const stepAttr = step !== undefined ? `step="${step}"` : '';
            inputHtml = `<input type="${typeAttr}" id="${inputId}" class="modal-input" value="${escapeHtml(defaultValue)}" placeholder="${escapeHtml(placeholder)}" ${minAttr} ${maxAttr} ${stepAttr}>`;
        }

        const bodyHtml = `
            <div class="modal-prompt">
                <label for="${inputId}">${escapeHtml(message)}</label>
                ${inputHtml}
            </div>
        `;

        const getValue = () => {
            const input = document.getElementById(inputId);
            return input ? input.value : null;
        };

        showModal({
            title: 'Input Required',
            body: bodyHtml,
            buttons: [
                { label: 'Cancel', variant: 'secondary', onClick: () => resolve(null) },
                { label: 'OK', variant: 'primary', onClick: () => resolve(getValue()) }
            ],
            onClose: () => resolve(null),
            closeOnBackdrop: false
        });

        // Setup password toggle if needed
        if (inputType === 'password') {
            const toggle = document.querySelector('.modal-password-toggle');
            const input = document.getElementById(inputId);
            if (toggle && input) {
                toggle.addEventListener('click', () => {
                    const isVisible = toggle.dataset.visible === 'true';
                    input.type = isVisible ? 'password' : 'text';
                    toggle.dataset.visible = !isVisible;
                    toggle.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
                });
            }
        }

        // Focus input after modal opens
        requestAnimationFrame(() => {
            const input = document.getElementById(inputId);
            if (input) {
                input.focus();
                if (input.select) {
                    input.select();
                }
            }
        });

        // Handle Enter key to submit
        const input = document.getElementById(inputId);
        if (input && inputType !== 'select') {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    resolve(getValue());
                    closeModal();
                }
            });
        }
    });
}

/**
 * Shows a confirmation modal
 * @param {string} message - Confirmation message
 * @param {Object} [options={}] - Additional options
 * @param {string} [options.confirmLabel='Confirm'] - Confirm button label
 * @param {string} [options.cancelLabel='Cancel'] - Cancel button label
 * @param {string} [options.variant='primary'] - Confirm button variant
 * @returns {Promise<boolean>} Resolves with true if confirmed, false otherwise
 */
export function showConfirm(message, options = {}) {
    return new Promise((resolve) => {
        const {
            confirmLabel = 'Confirm',
            cancelLabel = 'Cancel',
            variant = 'primary'
        } = options;

        showModal({
            title: 'Confirm',
            body: `<p class="modal-confirm-message">${escapeHtml(message)}</p>`,
            buttons: [
                { label: cancelLabel, variant: 'secondary', onClick: () => resolve(false) },
                { label: confirmLabel, variant, onClick: () => resolve(true) }
            ],
            onClose: () => resolve(false),
            closeOnBackdrop: false
        });
    });
}

/**
 * Closes the currently active modal
 */
export function closeModal() {
    if (!activeModal) return;

    const backdrop = activeModal;
    const onClose = backdrop._onClose;

    // Cleanup
    backdrop.classList.remove('show');
    backdrop.hidden = true;
    backdrop._onClose = null;

    // Remove event listeners
    document.removeEventListener('keydown', handleEscapeKey);
    if (focusTrapListener) {
        backdrop.removeEventListener('keydown', focusTrapListener);
        focusTrapListener = null;
    }

    activeModal = null;

    // Restore focus to previous element
    if (previousActiveElement && previousActiveElement.focus) {
        previousActiveElement.focus();
    }
    previousActiveElement = null;

    // Call onClose callback
    if (onClose) {
        onClose();
    }
}

/**
 * Check if a modal is currently open
 * @returns {boolean}
 */
export function isModalOpen() {
    return activeModal !== null;
}

// ==========================================================================
// PRIVATE HELPERS
// ==========================================================================

/**
 * Handles Escape key to close modal
 */
function handleEscapeKey(e) {
    if (e.key === 'Escape' && activeModal) {
        e.preventDefault();
        closeModal();
    }
}

/**
 * Sets up focus trap within modal
 */
function setupFocusTrap(modal) {
    focusTrapListener = (e) => {
        if (e.key !== 'Tab') return;

        const focusableElements = getFocusableElements(modal);
        if (focusableElements.length === 0) return;

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            // Shift+Tab: if on first element, go to last
            if (document.activeElement === firstFocusable) {
                e.preventDefault();
                lastFocusable.focus();
            }
        } else {
            // Tab: if on last element, go to first
            if (document.activeElement === lastFocusable) {
                e.preventDefault();
                firstFocusable.focus();
            }
        }
    };

    modal.addEventListener('keydown', focusTrapListener);
}

/**
 * Gets all focusable elements within a container
 */
function getFocusableElements(container) {
    const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]';
    return Array.from(container.querySelectorAll(selector)).filter(el => {
        return el.offsetParent !== null; // Only visible elements
    });
}

/**
 * Gets the first focusable element
 */
function getFirstFocusable(container) {
    const elements = getFocusableElements(container);
    return elements[0] || null;
}

