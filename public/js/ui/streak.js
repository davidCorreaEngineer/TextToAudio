// ==========================================================================
// STREAK UI MODULE
// Updates streak indicator and progress dashboard
// ==========================================================================

import {
    getStreak,
    getSessionStats,
    getRecentSessions,
    getWeakPhrases,
    getAllTextMastery,
    getStorageInfo
} from '../services/progressService.js';
import { showModal } from './modal.js';
import { escapeHtml } from '../utils/html.js';

/**
 * Update the streak indicator in the header
 */
export function updateStreakIndicator() {
    const streakIndicator = document.getElementById('streakIndicator');
    const streakCount = document.getElementById('streakCount');

    if (!streakIndicator || !streakCount) return;

    const streak = getStreak();

    streakCount.textContent = streak.current;

    // Update visual state based on streak
    streakIndicator.classList.remove('active', 'hot');

    if (streak.current >= 7) {
        streakIndicator.classList.add('hot');
        streakIndicator.title = `${streak.current} day streak! You're on fire!`;
    } else if (streak.current >= 1) {
        streakIndicator.classList.add('active');
        streakIndicator.title = `${streak.current} day streak${streak.practicedToday ? ' - practiced today!' : ' - practice today to keep it going!'}`;
    } else {
        streakIndicator.title = 'Start practicing to build a streak!';
    }
}

/**
 * Update the progress dashboard stats
 */
export function updateProgressDashboard() {
    const dashboardPhrases = document.getElementById('dashboardPhrases');
    const dashboardStreak = document.getElementById('dashboardStreak');
    const dashboardTime = document.getElementById('dashboardTime');

    const streak = getStreak();
    const stats = getSessionStats(7); // Last 7 days

    if (dashboardPhrases) {
        dashboardPhrases.textContent = stats.totalPhrases;
    }

    if (dashboardStreak) {
        dashboardStreak.textContent = streak.current;
    }

    if (dashboardTime) {
        const minutes = stats.totalTimeMinutes;
        if (minutes >= 60) {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            dashboardTime.textContent = `${hours}h ${mins}m`;
        } else {
            dashboardTime.textContent = `${minutes}m`;
        }
    }
}

/**
 * Show the full progress dashboard modal
 */
export function showProgressDashboardModal() {
    const streak = getStreak();
    const stats = getSessionStats(7);
    const recentSessions = getRecentSessions(5);
    const weakPhrases = getWeakPhrases(5);
    const textMastery = getAllTextMastery();
    const storage = getStorageInfo();

    // Build recent sessions HTML
    let sessionsHtml = '';
    if (recentSessions.length > 0) {
        sessionsHtml = recentSessions.map(s => {
            const date = new Date(s.date);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const typeIcon = s.type === 'dictation' ? 'fa-keyboard' : 'fa-headphones';
            const score = s.avgScore !== undefined ? `${s.avgScore}%` : '-';
            return `
                <div class="progress-session-item">
                    <i class="fas ${typeIcon}"></i>
                    <span class="session-date">${dateStr}</span>
                    <span class="session-type">${s.type}</span>
                    <span class="session-score">${score}</span>
                </div>
            `;
        }).join('');
    } else {
        sessionsHtml = '<p class="progress-empty">No recent sessions</p>';
    }

    // Build weak phrases HTML
    let weakPhrasesHtml = '';
    if (weakPhrases.length > 0) {
        weakPhrasesHtml = weakPhrases.map(p => {
            const accuracy = p.avgAccuracy || 0;
            return `
                <div class="progress-weak-phrase">
                    <span class="weak-phrase-text">${escapeHtml(p.phrase)}</span>
                    <span class="weak-phrase-accuracy" style="color: ${accuracy < 50 ? 'var(--error)' : 'var(--warning)'}">
                        ${accuracy}%
                    </span>
                </div>
            `;
        }).join('');
    } else {
        weakPhrasesHtml = '<p class="progress-empty">No struggling phrases yet</p>';
    }

    // Build text mastery HTML
    let masteryHtml = '';
    if (textMastery.length > 0) {
        masteryHtml = textMastery.slice(0, 5).map(t => {
            const percent = t.masteryPercent;
            const barColor = percent >= 80 ? 'var(--success)' : percent >= 50 ? 'var(--warning)' : 'var(--error)';
            return `
                <div class="progress-mastery-item">
                    <div class="mastery-label">${escapeHtml(t.name.substring(0, 30))}</div>
                    <div class="mastery-bar-container">
                        <div class="mastery-bar" style="width: ${percent}%; background: ${barColor}"></div>
                    </div>
                    <span class="mastery-percent">${percent}%</span>
                </div>
            `;
        }).join('');
    } else {
        masteryHtml = '<p class="progress-empty">No texts practiced yet</p>';
    }

    const bodyHtml = `
        <div class="progress-modal-content">
            <div class="progress-stats-grid">
                <div class="progress-stat-card">
                    <div class="progress-stat-icon"><i class="fas fa-fire"></i></div>
                    <div class="progress-stat-value">${streak.current}</div>
                    <div class="progress-stat-label">Day Streak</div>
                    <div class="progress-stat-sub">Best: ${streak.longest}</div>
                </div>
                <div class="progress-stat-card">
                    <div class="progress-stat-icon"><i class="fas fa-comment-dots"></i></div>
                    <div class="progress-stat-value">${stats.totalPhrases}</div>
                    <div class="progress-stat-label">Phrases (7d)</div>
                    <div class="progress-stat-sub">${stats.totalCorrect} correct</div>
                </div>
                <div class="progress-stat-card">
                    <div class="progress-stat-icon"><i class="fas fa-clock"></i></div>
                    <div class="progress-stat-value">${stats.totalTimeMinutes}m</div>
                    <div class="progress-stat-label">Practice Time</div>
                    <div class="progress-stat-sub">${stats.sessionCount} sessions</div>
                </div>
                <div class="progress-stat-card">
                    <div class="progress-stat-icon"><i class="fas fa-chart-line"></i></div>
                    <div class="progress-stat-value">${stats.avgScore}%</div>
                    <div class="progress-stat-label">Avg Score</div>
                    <div class="progress-stat-sub">Last 7 days</div>
                </div>
            </div>

            <div class="progress-sections">
                <div class="progress-section">
                    <h4><i class="fas fa-history"></i> Recent Sessions</h4>
                    <div class="progress-sessions-list">
                        ${sessionsHtml}
                    </div>
                </div>

                <div class="progress-section">
                    <h4><i class="fas fa-exclamation-triangle"></i> Needs Practice</h4>
                    <div class="progress-weak-list">
                        ${weakPhrasesHtml}
                    </div>
                </div>

                <div class="progress-section">
                    <h4><i class="fas fa-book"></i> Text Mastery</h4>
                    <div class="progress-mastery-list">
                        ${masteryHtml}
                    </div>
                </div>
            </div>

            <div class="progress-footer">
                <span class="storage-info">
                    <i class="fas fa-database"></i> ${storage.kb}KB used (${storage.sessionCount} sessions, ${storage.phraseCount} phrases)
                </span>
            </div>
        </div>
    `;

    showModal({
        title: 'Learning Progress',
        body: bodyHtml,
        buttons: [
            { label: 'Close', variant: 'primary' }
        ]
    });
}

/**
 * Initialize streak UI - updates on page load
 */
export function initStreakUI() {
    updateStreakIndicator();
    updateProgressDashboard();

    // Add click handler to show detailed stats modal
    const streakIndicator = document.getElementById('streakIndicator');
    if (streakIndicator) {
        streakIndicator.addEventListener('click', showProgressDashboardModal);
    }
}
