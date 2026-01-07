/**
 * Unit Tests for Modal Component
 * Tests the accessible modal dialog system
 */

const { describe, test, expect, beforeEach, afterEach, jest: jestObj } = require('@jest/globals');
const { JSDOM } = require('jsdom');

// ============================================================================
// MODAL MODULE TESTS
// ============================================================================

describe('Modal Component', () => {
    let dom;
    let document;
    let window;
    let modalModule;

    // Replicate modal module for testing
    function createModalModule(doc) {
        let activeModal = null;
        let previousActiveElement = null;
        let focusTrapListener = null;

        function handleEscapeKey(e) {
            if (e.key === 'Escape' && activeModal) {
                e.preventDefault();
                closeModal();
            }
        }

        function setupFocusTrap(modal) {
            focusTrapListener = (e) => {
                if (e.key !== 'Tab') return;

                const focusableElements = getFocusableElements(modal);
                if (focusableElements.length === 0) return;

                const firstFocusable = focusableElements[0];
                const lastFocusable = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) {
                    if (doc.activeElement === firstFocusable) {
                        e.preventDefault();
                        lastFocusable.focus();
                    }
                } else {
                    if (doc.activeElement === lastFocusable) {
                        e.preventDefault();
                        firstFocusable.focus();
                    }
                }
            };

            modal.addEventListener('keydown', focusTrapListener);
        }

        function getFocusableElements(container) {
            const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]';
            return Array.from(container.querySelectorAll(selector)).filter(el => {
                return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0;
            });
        }

        function getFirstFocusable(container) {
            const elements = getFocusableElements(container);
            return elements[0] || null;
        }

        function escapeHtml(str) {
            if (typeof str !== 'string') return '';
            const div = doc.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }

        function showModal({ title, body, buttons = [], onClose, closeOnBackdrop = true }) {
            if (activeModal) {
                closeModal();
            }

            previousActiveElement = doc.activeElement;

            const backdrop = doc.getElementById('modalBackdrop');
            if (!backdrop) {
                return null;
            }

            const modalTitle = doc.getElementById('modalTitle');
            const modalBody = doc.getElementById('modalBody');
            const modalFooter = doc.getElementById('modalFooter');
            const modalCloseBtn = backdrop.querySelector('.modal-close');

            if (modalTitle) {
                modalTitle.textContent = title || '';
            }

            if (modalBody) {
                if (typeof body === 'string') {
                    modalBody.innerHTML = body;
                } else if (body instanceof doc.defaultView.HTMLElement) {
                    modalBody.innerHTML = '';
                    modalBody.appendChild(body);
                } else {
                    modalBody.innerHTML = '';
                }
            }

            if (modalFooter) {
                modalFooter.innerHTML = '';
                buttons.forEach((btn, index) => {
                    const button = doc.createElement('button');
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

                    if (index === 0) {
                        button.setAttribute('data-autofocus', 'true');
                    }

                    modalFooter.appendChild(button);
                });
            }

            if (modalCloseBtn) {
                modalCloseBtn.onclick = () => closeModal();
            }

            backdrop._onClose = onClose;

            if (closeOnBackdrop) {
                backdrop.onclick = (e) => {
                    if (e.target === backdrop) {
                        closeModal();
                    }
                };
            } else {
                backdrop.onclick = null;
            }

            backdrop.hidden = false;
            backdrop.classList.add('show');
            activeModal = backdrop;

            setupFocusTrap(backdrop);
            doc.addEventListener('keydown', handleEscapeKey);

            return backdrop;
        }

        function showAlert(message, type = 'info') {
            return new Promise((resolve) => {
                const titles = {
                    info: 'Information',
                    warning: 'Warning',
                    error: 'Error',
                    success: 'Success'
                };

                showModal({
                    title: titles[type] || titles.info,
                    body: `<div class="modal-alert ${type}"><p>${escapeHtml(message)}</p></div>`,
                    buttons: [
                        { label: 'OK', variant: 'primary', onClick: resolve }
                    ],
                    onClose: resolve
                });
            });
        }

        function showPrompt(message, defaultValue = '', options = {}) {
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
                            <button type="button" class="modal-password-toggle" aria-label="Show password" data-visible="false">Toggle</button>
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
                    const input = doc.getElementById(inputId);
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

                // Setup Enter key handler for text inputs
                setTimeout(() => {
                    const input = doc.getElementById(inputId);
                    if (input && inputType !== 'select') {
                        input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                resolve(getValue());
                                closeModal();
                            }
                        });
                    }
                }, 0);
            });
        }

        function showConfirm(message, options = {}) {
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

        function closeModal() {
            if (!activeModal) return;

            const backdrop = activeModal;
            const onClose = backdrop._onClose;

            backdrop.classList.remove('show');
            backdrop.hidden = true;
            backdrop._onClose = null;

            doc.removeEventListener('keydown', handleEscapeKey);
            if (focusTrapListener) {
                backdrop.removeEventListener('keydown', focusTrapListener);
                focusTrapListener = null;
            }

            activeModal = null;

            if (previousActiveElement && previousActiveElement.focus) {
                previousActiveElement.focus();
            }
            previousActiveElement = null;

            if (onClose) {
                onClose();
            }
        }

        function isModalOpen() {
            return activeModal !== null;
        }

        return {
            showModal,
            showAlert,
            showPrompt,
            showConfirm,
            closeModal,
            isModalOpen
        };
    }

    beforeEach(() => {
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div class="modal-backdrop" id="modalBackdrop" hidden>
                    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
                        <div class="modal-header">
                            <h3 class="modal-title" id="modalTitle"></h3>
                            <button type="button" class="modal-close" aria-label="Close">&times;</button>
                        </div>
                        <div class="modal-body" id="modalBody"></div>
                        <div class="modal-footer" id="modalFooter"></div>
                    </div>
                </div>
                <button id="triggerButton">Open Modal</button>
            </body>
            </html>
        `, { runScripts: 'dangerously' });

        document = dom.window.document;
        window = dom.window;
        modalModule = createModalModule(document);
    });

    afterEach(() => {
        if (modalModule.isModalOpen()) {
            modalModule.closeModal();
        }
    });

    describe('showModal', () => {
        test('should show the modal with title and body', () => {
            modalModule.showModal({
                title: 'Test Title',
                body: 'Test content',
                buttons: [{ label: 'OK', variant: 'primary' }]
            });

            const backdrop = document.getElementById('modalBackdrop');
            const title = document.getElementById('modalTitle');
            const body = document.getElementById('modalBody');

            expect(backdrop.hidden).toBe(false);
            expect(backdrop.classList.contains('show')).toBe(true);
            expect(title.textContent).toBe('Test Title');
            expect(body.innerHTML).toBe('Test content');
        });

        test('should render buttons in footer', () => {
            modalModule.showModal({
                title: 'Test',
                body: 'Content',
                buttons: [
                    { label: 'Cancel', variant: 'secondary' },
                    { label: 'Confirm', variant: 'primary' }
                ]
            });

            const footer = document.getElementById('modalFooter');
            const buttons = footer.querySelectorAll('button');

            expect(buttons).toHaveLength(2);
            expect(buttons[0].textContent).toBe('Cancel');
            expect(buttons[1].textContent).toBe('Confirm');
        });

        test('should close existing modal before opening new one', () => {
            modalModule.showModal({ title: 'First', body: 'First modal' });
            expect(document.getElementById('modalTitle').textContent).toBe('First');

            modalModule.showModal({ title: 'Second', body: 'Second modal' });
            expect(document.getElementById('modalTitle').textContent).toBe('Second');
        });

        test('should accept HTML element as body', () => {
            const div = document.createElement('div');
            div.textContent = 'Custom element';

            modalModule.showModal({
                title: 'Test',
                body: div,
                buttons: []
            });

            const body = document.getElementById('modalBody');
            expect(body.firstChild).toBe(div);
        });

        test('should handle missing modal elements gracefully', () => {
            const emptyDom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
            const emptyModule = createModalModule(emptyDom.window.document);

            const result = emptyModule.showModal({ title: 'Test', body: 'Content' });
            expect(result).toBeNull();
        });
    });

    describe('closeModal', () => {
        test('should hide the modal', () => {
            modalModule.showModal({ title: 'Test', body: 'Content' });
            modalModule.closeModal();

            const backdrop = document.getElementById('modalBackdrop');
            expect(backdrop.hidden).toBe(true);
            expect(backdrop.classList.contains('show')).toBe(false);
        });

        test('should call onClose callback', () => {
            const onClose = jestObj.fn();

            modalModule.showModal({ title: 'Test', body: 'Content', onClose });
            modalModule.closeModal();

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        test('should do nothing if no modal is open', () => {
            expect(() => modalModule.closeModal()).not.toThrow();
        });
    });

    describe('isModalOpen', () => {
        test('should return false when no modal is open', () => {
            expect(modalModule.isModalOpen()).toBe(false);
        });

        test('should return true when modal is open', () => {
            modalModule.showModal({ title: 'Test', body: 'Content' });
            expect(modalModule.isModalOpen()).toBe(true);
        });

        test('should return false after closing modal', () => {
            modalModule.showModal({ title: 'Test', body: 'Content' });
            modalModule.closeModal();
            expect(modalModule.isModalOpen()).toBe(false);
        });
    });

    describe('Escape key handling', () => {
        test('should close modal on Escape key', () => {
            modalModule.showModal({ title: 'Test', body: 'Content' });
            expect(modalModule.isModalOpen()).toBe(true);

            const event = new window.KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(event);

            expect(modalModule.isModalOpen()).toBe(false);
        });

        test('should not respond to Escape when modal is closed', () => {
            const event = new window.KeyboardEvent('keydown', { key: 'Escape' });
            expect(() => document.dispatchEvent(event)).not.toThrow();
            expect(modalModule.isModalOpen()).toBe(false);
        });
    });

    describe('Backdrop click', () => {
        test('should close modal when clicking backdrop', () => {
            modalModule.showModal({ title: 'Test', body: 'Content', closeOnBackdrop: true });

            const backdrop = document.getElementById('modalBackdrop');
            const clickEvent = new window.MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: backdrop });
            backdrop.dispatchEvent(clickEvent);

            expect(modalModule.isModalOpen()).toBe(false);
        });

        test('should not close when clicking modal content', () => {
            modalModule.showModal({ title: 'Test', body: 'Content', closeOnBackdrop: true });

            const body = document.getElementById('modalBody');
            const backdrop = document.getElementById('modalBackdrop');
            const clickEvent = new window.MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: body });
            backdrop.dispatchEvent(clickEvent);

            expect(modalModule.isModalOpen()).toBe(true);
        });

        test('should respect closeOnBackdrop=false', () => {
            modalModule.showModal({ title: 'Test', body: 'Content', closeOnBackdrop: false });

            const backdrop = document.getElementById('modalBackdrop');
            const clickEvent = new window.MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: backdrop });
            backdrop.dispatchEvent(clickEvent);

            expect(modalModule.isModalOpen()).toBe(true);
        });
    });

    describe('Close button', () => {
        test('should close modal when clicking close button', () => {
            modalModule.showModal({ title: 'Test', body: 'Content' });

            const closeBtn = document.querySelector('.modal-close');
            closeBtn.click();

            expect(modalModule.isModalOpen()).toBe(false);
        });
    });

    describe('Button callbacks', () => {
        test('should execute onClick callback when button clicked', () => {
            const onClick = jestObj.fn();

            modalModule.showModal({
                title: 'Test',
                body: 'Content',
                buttons: [{ label: 'Action', variant: 'primary', onClick }]
            });

            const button = document.getElementById('modalFooter').querySelector('button');
            button.click();

            expect(onClick).toHaveBeenCalledTimes(1);
        });

        test('should close modal by default after button click', () => {
            modalModule.showModal({
                title: 'Test',
                body: 'Content',
                buttons: [{ label: 'Close', variant: 'primary' }]
            });

            const button = document.getElementById('modalFooter').querySelector('button');
            button.click();

            expect(modalModule.isModalOpen()).toBe(false);
        });

        test('should respect closeOnClick=false', () => {
            modalModule.showModal({
                title: 'Test',
                body: 'Content',
                buttons: [{ label: 'Stay', variant: 'primary', closeOnClick: false }]
            });

            const button = document.getElementById('modalFooter').querySelector('button');
            button.click();

            expect(modalModule.isModalOpen()).toBe(true);
        });
    });

    describe('showAlert', () => {
        test('should show info alert', async () => {
            const promise = modalModule.showAlert('Test message', 'info');

            expect(modalModule.isModalOpen()).toBe(true);
            expect(document.getElementById('modalTitle').textContent).toBe('Information');
            expect(document.getElementById('modalBody').textContent).toContain('Test message');

            const okButton = document.getElementById('modalFooter').querySelector('button');
            okButton.click();

            await promise;
            expect(modalModule.isModalOpen()).toBe(false);
        });

        test('should show warning alert', () => {
            modalModule.showAlert('Warning message', 'warning');
            expect(document.getElementById('modalTitle').textContent).toBe('Warning');
        });

        test('should show error alert', () => {
            modalModule.showAlert('Error message', 'error');
            expect(document.getElementById('modalTitle').textContent).toBe('Error');
        });

        test('should show success alert', () => {
            modalModule.showAlert('Success message', 'success');
            expect(document.getElementById('modalTitle').textContent).toBe('Success');
        });

        test('should escape HTML in message', () => {
            modalModule.showAlert('<script>alert("xss")</script>', 'info');

            const body = document.getElementById('modalBody');
            expect(body.innerHTML).not.toContain('<script>');
            expect(body.textContent).toContain('<script>');
        });
    });

    describe('showPrompt', () => {
        test('should show text input prompt', () => {
            modalModule.showPrompt('Enter value:', 'default');

            expect(modalModule.isModalOpen()).toBe(true);
            const input = document.getElementById('modalPromptInput');
            expect(input).not.toBeNull();
            expect(input.value).toBe('default');
            expect(input.type).toBe('text');
        });

        test('should resolve with input value on OK', async () => {
            const promise = modalModule.showPrompt('Enter value:', '');

            const input = document.getElementById('modalPromptInput');
            input.value = 'user input';

            const buttons = document.getElementById('modalFooter').querySelectorAll('button');
            const okButton = buttons[1];
            okButton.click();

            const result = await promise;
            expect(result).toBe('user input');
        });

        test('should resolve with null on Cancel', async () => {
            const promise = modalModule.showPrompt('Enter value:', 'default');

            const buttons = document.getElementById('modalFooter').querySelectorAll('button');
            const cancelButton = buttons[0];
            cancelButton.click();

            const result = await promise;
            expect(result).toBeNull();
        });

        test('should show number input when inputType is number', () => {
            modalModule.showPrompt('Enter number:', '5', { inputType: 'number', min: 0, max: 10 });

            const input = document.getElementById('modalPromptInput');
            expect(input.type).toBe('number');
            expect(input.min).toBe('0');
            expect(input.max).toBe('10');
        });

        test('should show select when inputType is select', () => {
            modalModule.showPrompt('Select option:', 'b', {
                inputType: 'select',
                selectOptions: [
                    { value: 'a', label: 'Option A' },
                    { value: 'b', label: 'Option B' },
                ]
            });

            const select = document.getElementById('modalPromptInput');
            expect(select.tagName).toBe('SELECT');
            expect(select.options).toHaveLength(2);
            expect(select.value).toBe('b');
        });

        test('should show password input with toggle', () => {
            modalModule.showPrompt('Enter password:', '', { inputType: 'password' });

            const input = document.getElementById('modalPromptInput');
            const toggle = document.querySelector('.modal-password-toggle');

            expect(input.type).toBe('password');
            expect(toggle).not.toBeNull();
        });

        test('should not close when closeOnBackdrop is false', () => {
            modalModule.showPrompt('Enter value:', '');

            const backdrop = document.getElementById('modalBackdrop');
            const clickEvent = new window.MouseEvent('click', { bubbles: true });
            Object.defineProperty(clickEvent, 'target', { value: backdrop });
            backdrop.dispatchEvent(clickEvent);

            expect(modalModule.isModalOpen()).toBe(true);
        });
    });

    describe('showConfirm', () => {
        test('should show confirmation dialog', () => {
            modalModule.showConfirm('Are you sure?');

            expect(modalModule.isModalOpen()).toBe(true);
            expect(document.getElementById('modalTitle').textContent).toBe('Confirm');
            expect(document.getElementById('modalBody').textContent).toContain('Are you sure?');
        });

        test('should resolve true on confirm', async () => {
            const promise = modalModule.showConfirm('Are you sure?');

            const buttons = document.getElementById('modalFooter').querySelectorAll('button');
            const confirmButton = buttons[1];
            confirmButton.click();

            const result = await promise;
            expect(result).toBe(true);
        });

        test('should resolve false on cancel', async () => {
            const promise = modalModule.showConfirm('Are you sure?');

            const buttons = document.getElementById('modalFooter').querySelectorAll('button');
            const cancelButton = buttons[0];
            cancelButton.click();

            const result = await promise;
            expect(result).toBe(false);
        });

        test('should resolve false on close', async () => {
            const promise = modalModule.showConfirm('Are you sure?');
            modalModule.closeModal();

            const result = await promise;
            expect(result).toBe(false);
        });

        test('should use custom button labels', () => {
            modalModule.showConfirm('Delete item?', {
                confirmLabel: 'Delete',
                cancelLabel: 'Keep'
            });

            const buttons = document.getElementById('modalFooter').querySelectorAll('button');
            expect(buttons[0].textContent).toBe('Keep');
            expect(buttons[1].textContent).toBe('Delete');
        });

        test('should use custom variant', () => {
            modalModule.showConfirm('Delete item?', { variant: 'danger' });

            const buttons = document.getElementById('modalFooter').querySelectorAll('button');
            const confirmButton = buttons[1];
            expect(confirmButton.classList.contains('danger')).toBe(true);
        });
    });

    describe('ARIA attributes', () => {
        test('should have correct ARIA attributes on modal', () => {
            const modal = document.querySelector('.modal');

            expect(modal.getAttribute('role')).toBe('dialog');
            expect(modal.getAttribute('aria-modal')).toBe('true');
            expect(modal.getAttribute('aria-labelledby')).toBe('modalTitle');
        });

        test('should have aria-label on close button', () => {
            const closeBtn = document.querySelector('.modal-close');
            expect(closeBtn.getAttribute('aria-label')).toBe('Close');
        });
    });

    describe('HTML escaping', () => {
        test('should escape HTML in showPrompt message', () => {
            modalModule.showPrompt('<script>alert(1)</script>');

            const body = document.getElementById('modalBody');
            expect(body.innerHTML).not.toContain('<script>');
        });

        test('should escape HTML in showConfirm message', () => {
            modalModule.showConfirm('<img src=x onerror=alert(1)>');

            const body = document.getElementById('modalBody');
            // HTML should be escaped - no actual img tag should exist
            expect(body.innerHTML).toContain('&lt;img');
            expect(body.querySelector('img')).toBeNull();
        });
    });
});
