// ==========================================================================
// DASHBOARD STATS MODULE
// ==========================================================================

import { fetchDashboard } from '../api.js';
import { FREE_TIER_LIMITS } from '../config.js';
import { renderUsageChart, renderVoiceTypeChart, setUsageChartRef, setVoiceTypeChartRef } from './charts.js';
import { escapeHtml } from '../utils/html.js';

export function getCurrentYearMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
}

export function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

export function updateUsageIndicator(quota) {
    const usageBarFill = document.getElementById('usageBarFill');
    const usageText = document.getElementById('usageText');
    const usageTooltipContent = document.getElementById('usageTooltipContent');

    if (!usageBarFill || !usageText) return;

    let totalUsage = 0;
    let totalLimit = 0;
    const currentMonth = getCurrentYearMonth();
    const voiceTypeUsage = {};

    const monthData = quota[currentMonth] || {};

    for (const [voiceType, limit] of Object.entries(FREE_TIER_LIMITS)) {
        const usage = monthData[voiceType] || 0;
        totalUsage += usage;
        totalLimit += limit;
        voiceTypeUsage[voiceType] = { usage, limit };
    }

    const overallPercentage = totalLimit > 0 ? Math.min((totalUsage / totalLimit) * 100, 100) : 0;

    usageBarFill.style.width = overallPercentage + '%';
    usageText.textContent = Math.round(overallPercentage) + '%';

    usageBarFill.classList.remove('warning', 'danger');
    if (overallPercentage >= 90) {
        usageBarFill.classList.add('danger');
    } else if (overallPercentage >= 70) {
        usageBarFill.classList.add('warning');
    }

    if (usageTooltipContent) {
        let tooltipHtml = '';

        for (const voiceType in voiceTypeUsage) {
            const data = voiceTypeUsage[voiceType];
            if (data.usage > 0 || data.limit > 0) {
                const pct = Math.round((data.usage / data.limit) * 100);
                const isCharBased = (voiceType === 'Standard' || voiceType === 'WaveNet');
                const unit = isCharBased ? 'chars' : 'bytes';
                const usageStr = formatNumber(data.usage);
                const limitStr = formatNumber(data.limit);

                // Security: Escape all dynamic values to prevent XSS
                tooltipHtml += '<div class="usage-tooltip-item">' +
                    '<span class="voice-name">' + escapeHtml(voiceType) + '</span>' +
                    '<span class="voice-usage">' + escapeHtml(usageStr) + ' / ' + escapeHtml(limitStr) + ' ' + escapeHtml(unit) + '</span>' +
                    '<span class="voice-pct ' + (pct >= 90 ? 'danger' : (pct >= 70 ? 'warning' : '')) + '">' + pct + '%</span>' +
                '</div>';
            }
        }

        if (!tooltipHtml) {
            tooltipHtml = '<div class="usage-tooltip-item"><span>No usage this month</span></div>';
        }

        tooltipHtml = '<div class="usage-month">' + escapeHtml(currentMonth) + '</div>' + tooltipHtml;
        usageTooltipContent.innerHTML = tooltipHtml;
    }
}

export function displayUsageStats(quota) {
    if (!quota || Object.keys(quota).length === 0) {
        console.log('No usage data available');
        return;
    }

    let totalUsage = 0;
    const uniqueVoicesSet = new Set();
    const currentMonth = getCurrentYearMonth();
    let currentMonthUsage = 0;

    for (const yearMonth in quota) {
        const voices = quota[yearMonth];
        for (const voiceType in voices) {
            const count = voices[voiceType];
            totalUsage += count;
            uniqueVoicesSet.add(voiceType);
            if (yearMonth === currentMonth) {
                currentMonthUsage += count;
            }
        }
    }

    const totalUsageEl = document.getElementById('totalUsage');
    const uniqueVoicesEl = document.getElementById('uniqueVoices');
    const currentMonthUsageEl = document.getElementById('currentMonthUsage');

    if (totalUsageEl) totalUsageEl.textContent = totalUsage.toLocaleString();
    if (uniqueVoicesEl) uniqueVoicesEl.textContent = uniqueVoicesSet.size;
    if (currentMonthUsageEl) currentMonthUsageEl.textContent = currentMonthUsage.toLocaleString();

    console.log('Usage stats - Total:', totalUsage, 'This month:', currentMonthUsage, 'Voice types:', uniqueVoicesSet.size);

    // Prepare data for charts
    const usageData = {};
    const voiceTypeData = {};

    for (const [yearMonth, voices] of Object.entries(quota)) {
        if (!usageData[yearMonth]) {
            usageData[yearMonth] = 0;
        }
        for (const [voiceType, count] of Object.entries(voices)) {
            usageData[yearMonth] += count;

            if (!voiceTypeData[voiceType]) {
                voiceTypeData[voiceType] = 0;
            }
            voiceTypeData[voiceType] += count;
        }
    }

    renderUsageChart(usageData);
    renderVoiceTypeChart(voiceTypeData);
    displayVoiceTypeConsumption(voiceTypeData);

    console.log("Usage statistics displayed on dashboard.");
}

function displayVoiceTypeConsumption(data) {
    const voiceUsageContainer = document.getElementById('voiceUsageCards');
    if (!voiceUsageContainer) return;

    voiceUsageContainer.innerHTML = '';

    const renderCard = (voiceType, usage) => {
        const limit = FREE_TIER_LIMITS[voiceType] || 0;
        const isCharacterBased = ['Standard', 'WaveNet'].includes(voiceType);
        const unit = isCharacterBased ? 'characters' : 'bytes';
        const percentage = limit > 0 ? Math.min((usage / limit) * 100, 100) : 0;
        const progressBarClass = percentage < 80 ? 'bg-success' : (percentage < 100 ? 'bg-warning' : 'bg-danger');

        const iconClasses = {
            'Standard': 'fas fa-microphone-alt',
            'WaveNet': 'fas fa-wave-square',
            'Neural2': 'fas fa-brain',
            'Polyglot': 'fas fa-language',
            'Journey': 'fas fa-road',
            'Studio': 'fas fa-video'
        };
        const iconClass = iconClasses[voiceType] || 'fas fa-microphone';

        const colDiv = document.createElement('div');
        colDiv.className = 'col-md-6 voice-usage';

        const cardDiv = document.createElement('div');
        cardDiv.className = 'summary-card';
        // Security: Escape dynamic values to prevent XSS
        cardDiv.innerHTML = `
            <h5><i class="${escapeHtml(iconClass)}"></i> ${escapeHtml(voiceType)} Voices</h5>
            <p>${escapeHtml(usage.toLocaleString())} / ${escapeHtml(limit.toLocaleString())} ${escapeHtml(unit)}</p>
            <div class="progress">
                <div
                    class="progress-bar ${escapeHtml(progressBarClass)}"
                    role="progressbar"
                    style="width: ${percentage}%;"
                    aria-valuenow="${percentage}"
                    aria-valuemin="0"
                    aria-valuemax="100"
                >
                    ${percentage.toFixed(2)}%
                </div>
            </div>
        `;

        colDiv.appendChild(cardDiv);
        voiceUsageContainer.appendChild(colDiv);
    };

    // Render cards for used voice types
    for (const [voiceType, count] of Object.entries(data)) {
        renderCard(voiceType, count);
    }

    // Render cards for unused voice types
    for (const voiceType of Object.keys(FREE_TIER_LIMITS)) {
        if (!data.hasOwnProperty(voiceType)) {
            renderCard(voiceType, 0);
        }
    }
}

export async function fetchUsageStats() {
    console.log("Fetching usage statistics...");
    try {
        const data = await fetchDashboard();
        if (data && data.quota) {
            console.log("Received usage data:", data);
            displayUsageStats(data.quota);
            updateUsageIndicator(data.quota);
        }
    } catch (error) {
        console.error('Error fetching usage statistics:', error);
    }
}

// Alias for backwards compatibility
export const loadUsageStats = fetchUsageStats;
