// ==========================================================================
// LOADING SKELETON UTILITIES
// ==========================================================================

/**
 * Create skeleton loading card for audio library
 */
function createSkeletonCard() {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-card';
    skeleton.innerHTML = `
        <div class="skeleton-header">
            <div class="skeleton skeleton-icon"></div>
            <div class="skeleton skeleton-title"></div>
        </div>
        <div class="skeleton skeleton-waveform"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
        <div class="skeleton-controls">
            <div class="skeleton skeleton-play-btn"></div>
            <div class="skeleton skeleton-duration"></div>
            <div class="skeleton-actions">
                <div class="skeleton skeleton-action-btn"></div>
                <div class="skeleton skeleton-action-btn"></div>
                <div class="skeleton skeleton-action-btn"></div>
            </div>
        </div>
    `;
    return skeleton;
}

/**
 * Show skeleton loading in audio library
 * @param {number} count - Number of skeleton cards to show
 */
export function showLibraryLoading(count = 3) {
    const library = document.getElementById('audioLibrary');
    if (!library) return;

    library.innerHTML = '';
    for (let i = 0; i < count; i++) {
        library.appendChild(createSkeletonCard());
    }
}

/**
 * Add/remove loading state to button
 * @param {HTMLElement} button - Button element
 * @param {boolean} loading - Loading state
 */
export function setButtonLoading(button, loading) {
    if (!button) return;

    if (loading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// Expose globally for use in other modules
window.showLibraryLoading = showLibraryLoading;
window.setButtonLoading = setButtonLoading;
