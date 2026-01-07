// ==========================================================================
// AUDIO LIBRARY MODULE
// ==========================================================================

import { escapeHtml } from '../utils/html.js';

let audioItems = [];
try {
    audioItems = JSON.parse(localStorage.getItem('audioLibrary') || '[]');
    if (!Array.isArray(audioItems)) audioItems = [];
} catch (e) {
    console.warn('Failed to parse audio library from localStorage, starting fresh');
    audioItems = [];
}

// Track WaveSurfer instances to prevent memory leaks
const waveSurferInstances = new Map();

function saveLibrary() {
    localStorage.setItem('audioLibrary', JSON.stringify(audioItems));
    updateLibraryCount();
}

function updateLibraryCount() {
    const libraryCount = document.getElementById('libraryCount');
    if (libraryCount) {
        libraryCount.textContent = `${audioItems.length} item${audioItems.length !== 1 ? 's' : ''}`;
    }
}

export function addToLibrary(audioUrl, text, duration) {
    const item = {
        id: Date.now(),
        audioUrl,
        text: text.substring(0, 200),
        duration: duration || '0:00',
        timestamp: new Date().toISOString(),
        favorite: false
    };
    audioItems.unshift(item);
    saveLibrary();
    renderLibrary();
}

export function removeFromLibrary(id) {
    audioItems = audioItems.filter(item => item.id !== id);
    saveLibrary();
    renderLibrary();
}

export function toggleFavorite(id) {
    const item = audioItems.find(i => i.id === id);
    if (item) {
        item.favorite = !item.favorite;
        saveLibrary();
        renderLibrary();
    }
}

export function renderLibrary() {
    const audioLibrary = document.getElementById('audioLibrary');
    if (!audioLibrary) return;

    // Destroy existing WaveSurfer instances to prevent memory leaks
    waveSurferInstances.forEach((ws, id) => {
        try {
            ws.destroy();
        } catch (e) {
            console.warn(`Failed to destroy WaveSurfer instance ${id}:`, e);
        }
    });
    waveSurferInstances.clear();

    if (audioItems.length === 0) {
        audioLibrary.innerHTML = `
            <div class="audio-library-empty">
                <i class="fas fa-music"></i>
                <p>No audio files yet</p>
                <small>Generate audio to see it here</small>
            </div>
        `;
        return;
    }

    audioLibrary.innerHTML = audioItems.map(item => `
        <div class="audio-card" data-id="${item.id}">
            <div class="audio-card-content">
                <div class="audio-card-text">${escapeHtml(item.text)}</div>
                <div class="audio-card-waveform" id="waveform-${item.id}"></div>
            </div>
            <div class="audio-card-controls">
                <button class="audio-card-play" data-action="play" data-id="${item.id}">
                    <i class="fas fa-play"></i>
                </button>
                <span class="audio-card-duration">${item.duration}</span>
                <div class="audio-card-actions">
                    <button class="audio-card-btn favorite ${item.favorite ? 'active' : ''}"
                            data-action="favorite" data-id="${item.id}" title="Favorite">
                        <i class="fas fa-star"></i>
                    </button>
                    <button class="audio-card-btn" data-action="download" data-id="${item.id}" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="audio-card-btn" data-action="delete" data-id="${item.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="audio-card-meta">
                ${new Date(item.timestamp).toLocaleString()}
            </div>
        </div>
    `).join('');

    // Initialize waveforms
    setTimeout(() => {
        audioItems.forEach(item => {
            const container = document.getElementById(`waveform-${item.id}`);
            if (container && typeof WaveSurfer !== 'undefined') {
                const ws = WaveSurfer.create({
                    container: container,
                    waveColor: '#94a3b8',
                    progressColor: '#0891b2',
                    height: 60,
                    barWidth: 2,
                    barGap: 1,
                    barRadius: 2,
                    interact: false
                });
                ws.load(item.audioUrl);
                // Track this instance for cleanup
                waveSurferInstances.set(item.id, ws);
            }
        });
    }, 100);
}

export function getAudioItems() {
    return audioItems;
}

export function initLibraryCount() {
    updateLibraryCount();
}

function playAudioCard(id) {
    const item = audioItems.find(i => i.id === id);
    if (item) {
        const audio = new Audio(item.audioUrl);
        audio.play();
    }
}

function downloadAudioCard(id) {
    const item = audioItems.find(i => i.id === id);
    if (item) {
        const a = document.createElement('a');
        a.href = item.audioUrl;
        a.download = `audio-${item.id}.mp3`;
        a.click();
    }
}

/**
 * Initialize event delegation for audio library actions
 */
export function initLibraryEvents() {
    const audioLibrary = document.getElementById('audioLibrary');
    if (!audioLibrary) return;

    audioLibrary.addEventListener('click', (e) => {
        const button = e.target.closest('[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const id = parseInt(button.dataset.id, 10);

        switch (action) {
            case 'play':
                playAudioCard(id);
                break;
            case 'download':
                downloadAudioCard(id);
                break;
            case 'favorite':
                toggleFavorite(id);
                break;
            case 'delete':
                removeFromLibrary(id);
                break;
        }
    });
}
