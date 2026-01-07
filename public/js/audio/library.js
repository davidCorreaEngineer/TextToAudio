// ==========================================================================
// AUDIO LIBRARY MODULE
// ==========================================================================

// HTML escape to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

let audioItems = [];
try {
    audioItems = JSON.parse(localStorage.getItem('audioLibrary') || '[]');
    if (!Array.isArray(audioItems)) audioItems = [];
} catch (e) {
    console.warn('Failed to parse audio library from localStorage, starting fresh');
    audioItems = [];
}

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
                <button class="audio-card-play" onclick="playAudioCard(${item.id})">
                    <i class="fas fa-play"></i>
                </button>
                <span class="audio-card-duration">${item.duration}</span>
                <div class="audio-card-actions">
                    <button class="audio-card-btn favorite ${item.favorite ? 'active' : ''}"
                            onclick="toggleFavorite(${item.id})" title="Favorite">
                        <i class="fas fa-star"></i>
                    </button>
                    <button class="audio-card-btn" onclick="downloadAudioCard(${item.id})" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="audio-card-btn" onclick="removeFromLibrary(${item.id})" title="Delete">
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

// Expose functions to window scope for onclick handlers in HTML
window.playAudioCard = function(id) {
    const item = audioItems.find(i => i.id === id);
    if (item) {
        const audio = new Audio(item.audioUrl);
        audio.play();
    }
};

window.downloadAudioCard = function(id) {
    const item = audioItems.find(i => i.id === id);
    if (item) {
        const a = document.createElement('a');
        a.href = item.audioUrl;
        a.download = `audio-${item.id}.mp3`;
        a.click();
    }
};

window.toggleFavorite = toggleFavorite;
window.removeFromLibrary = removeFromLibrary;
window.addToLibrary = addToLibrary;
