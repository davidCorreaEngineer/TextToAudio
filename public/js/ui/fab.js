// ==========================================================================
// FLOATING ACTION BUTTON
// ==========================================================================

import { dom } from '../dom.js';

export function initFab() {
    const fabButton = document.getElementById('fabButton');
    const fabMenu = document.getElementById('fabMenu');
    const fabInput = document.getElementById('fabInput');
    const fabGenerate = document.getElementById('fabGenerate');

    if (!fabButton || !fabMenu) return;

    fabButton.addEventListener('click', () => {
        fabButton.classList.toggle('active');
        fabMenu.classList.toggle('show');
        if (fabMenu.classList.contains('show') && fabInput) {
            fabInput.focus();
        }
    });

    if (fabGenerate) {
        fabGenerate.addEventListener('click', () => {
            const text = fabInput?.value.trim();
            if (!text) return;

            fabButton.classList.remove('active');
            fabMenu.classList.remove('show');

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
