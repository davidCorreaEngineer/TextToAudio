// ==========================================================================
// DASHBOARD CHARTS MODULE
// ==========================================================================

import { usageChart, voiceTypeChart, setUsageChart, setVoiceTypeChart } from '../state.js';

function generateColorPalette(numColors) {
    const colors = [];
    const hueStep = 360 / numColors;
    for (let i = 0; i < numColors; i++) {
        const hue = i * hueStep;
        colors.push(`hsl(${hue}, 70%, 50%)`);
    }
    return colors;
}

export function renderUsageChart(data) {
    const chartEl = document.getElementById('usageChart');
    if (!chartEl || typeof Chart === 'undefined') return;

    const ctx = chartEl.getContext('2d');
    const labels = Object.keys(data).sort();
    const values = labels.map(label => data[label]);

    if (usageChart) {
        usageChart.destroy();
    }

    const newChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Usage Count',
                data: values,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                fill: true,
                lineTension: 0.3,
                pointBackgroundColor: 'rgba(54, 162, 235, 1)',
            }]
        },
        options: {
            responsive: true,
            title: {
                display: true,
                text: 'Total Usage Over Time'
            },
            scales: {
                yAxes: [{
                    ticks: {
                        beginAtZero: true,
                        callback: function(value) { return value.toLocaleString(); }
                    },
                    scaleLabel: {
                        display: true,
                        labelString: 'Usage Count'
                    }
                }],
                xAxes: [{
                    scaleLabel: {
                        display: true,
                        labelString: 'Year-Month'
                    }
                }]
            },
            tooltips: {
                callbacks: {
                    label: function(tooltipItem) {
                        return `Usage: ${tooltipItem.yLabel.toLocaleString()}`;
                    }
                }
            }
        }
    });

    setUsageChart(newChart);
}

export function renderVoiceTypeChart(data) {
    const chartEl = document.getElementById('voiceTypeChart');
    if (!chartEl || typeof Chart === 'undefined') return;

    const ctx = chartEl.getContext('2d');
    const labels = Object.keys(data);
    const values = labels.map(label => data[label]);
    const backgroundColors = generateColorPalette(labels.length);

    if (voiceTypeChart) {
        voiceTypeChart.destroy();
    }

    const newChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: backgroundColors,
            }]
        },
        options: {
            responsive: true,
            title: {
                display: true,
                text: 'Voice Type Distribution'
            },
            tooltips: {
                callbacks: {
                    label: function(tooltipItem, chartData) {
                        const dataset = chartData.datasets[tooltipItem.datasetIndex];
                        const total = dataset.data.reduce((a, b) => a + b, 0);
                        const currentValue = dataset.data[tooltipItem.index];
                        const percentage = ((currentValue / total) * 100).toFixed(2);
                        return `${chartData.labels[tooltipItem.index]}: ${currentValue.toLocaleString()} (${percentage}%)`;
                    }
                }
            }
        }
    });

    setVoiceTypeChart(newChart);
}

// Re-export setters for use by stats module
export { setUsageChart as setUsageChartRef, setVoiceTypeChart as setVoiceTypeChartRef };
