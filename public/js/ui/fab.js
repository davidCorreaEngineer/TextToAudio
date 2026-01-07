// ==========================================================================
// FLOATING ACTION BUTTON
// ==========================================================================

import { dom } from '../dom.js';

function closeFabMenu(fabButton, fabMenu, fabInput) {
    fabButton.classList.remove('active');
    fabMenu.classList.remove('show');
    fabButton.setAttribute('aria-expanded', 'false');
    fabButton.focus();
}

function openFabMenu(fabButton, fabMenu, fabInput) {
    fabButton.classList.add('active');
    fabMenu.classList.add('show');
    fabButton.setAttribute('aria-expanded', 'true');
    if (fabInput) {
        fabInput.focus();
    }
}

export function initFab() {
    const fabButton = document.getElementById('fabButton');
    const fabMenu = document.getElementById('fabMenu');
    const fabInput = document.getElementById('fabInput');
    const fabGenerate = document.getElementById('fabGenerate');

    if (!fabButton || !fabMenu) return;

    fabButton.addEventListener('click', () => {
        const isOpen = fabMenu.classList.contains('show');
        if (isOpen) {
            closeFabMenu(fabButton, fabMenu, fabInput);
        } else {
            openFabMenu(fabButton, fabMenu, fabInput);
        }
    });

    // Escape key to close FAB menu
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && fabMenu.classList.contains('show')) {
            e.preventDefault();
            closeFabMenu(fabButton, fabMenu, fabInput);
        }
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (fabMenu.classList.contains('show') &&
            !fabMenu.contains(e.target) &&
            !fabButton.contains(e.target)) {
            closeFabMenu(fabButton, fabMenu, fabInput);
        }
    });

    if (fabGenerate) {
        fabGenerate.addEventListener('click', () => {
            const text = fabInput?.value.trim();
            if (!text) return;

            closeFabMenu(fabButton, fabMenu, fabInput);

            // Set text in editor and switch to editor mode
            if (dom.textEditor) {
                dom.textEditor.value = text;
            }
            if (dom.textEditorModeBtn) {
                dom.textEditorModeBtn.click();
            }
            if (fabInput) {
                fabInput.value = '';
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    if (fabInput) {
        fabInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey && fabGenerate) {
                fabGenerate.click();
            }
        });
    }
}

// Learning Dashboard (related to FAB section)
let audioItemsRef = [];

export function setAudioItemsRef(items) {
    audioItemsRef = items;
}

export function updateDashboard() {
    const dashboardPhrases = document.getElementById('dashboardPhrases');
    const dashboardStreak = document.getElementById('dashboardStreak');
    const dashboardTime = document.getElementById('dashboardTime');
    const dashboardProgressFill = document.getElementById('dashboardProgressFill');

    let stats = { phrases: 0, streak: 0, time: 0 };
    try {
        const stored = localStorage.getItem('learningStats');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (typeof parsed === 'object' && parsed !== null) {
                stats = { ...stats, ...parsed };
            }
        }
    } catch (e) {
        console.warn('Failed to parse learningStats');
    }

    if (dashboardPhrases) {
        dashboardPhrases.textContent = stats.phrases || audioItemsRef.length;
    }
    if (dashboardStreak) {
        dashboardStreak.textContent = stats.streak || 0;
    }
    if (dashboardTime) {
        dashboardTime.textContent = `${Math.floor((stats.time || 0) / 60)}m`;
    }

    if (dashboardProgressFill) {
        const weeklyGoal = 50;
        const progress = Math.min(100, (stats.phrases / weeklyGoal) * 100);
        dashboardProgressFill.style.width = `${progress}%`;
    }
}

export function incrementPhrases() {
    let stats = { phrases: 0, streak: 0, time: 0 };
    try {
        const stored = localStorage.getItem('learningStats');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (typeof parsed === 'object' && parsed !== null) {
                stats = { ...stats, ...parsed };
            }
        }
    } catch (e) {
        console.warn('Failed to parse learningStats');
    }
    stats.phrases = (stats.phrases || 0) + 1;
    localStorage.setItem('learningStats', JSON.stringify(stats));
    updateDashboard();
}

// Expose globally
window.incrementPhrases = incrementPhrases;
