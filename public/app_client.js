// ==========================================================================
// APP CLIENT - Main Orchestrator (ES Module)
// ==========================================================================
// This file imports all modules and wires up the application initialization.

// Config & State
import { ensureApiKey } from './js/config.js';

// UI Modules
import { initTheme } from './js/ui/theme.js';
import { initFab, updateDashboard, setAudioItemsRef } from './js/ui/fab.js';
import { initSettingsEvents } from './js/ui/settings.js';
import { initInputModeToggle } from './js/ui/modeToggle.js';
import { initStreakUI, updateStreakIndicator, updateProgressDashboard } from './js/ui/streak.js';

// Audio Modules
import { initAudioPlayerEvents, initAudioTest } from './js/audio/player.js';
import { renderLibrary, getAudioItems, initLibraryCount, initLibraryEvents } from './js/audio/library.js';
import { initAudioDropZone } from './js/audio/dropZone.js';

// Synthesis Modules
import { loadVoices, initVoicesEvents } from './js/synthesis/voices.js';
import { initSSMLToolbar } from './js/synthesis/ssml.js';
import { initFormSubmission, setFetchUsageStats } from './js/synthesis/form.js';
import { initTestVoiceButton } from './js/synthesis/voiceTest.js';

// Input Modules
import { initFileUploadHandlers } from './js/input/fileUpload.js';

// Practice Modules
import { initShadowingEvents, updateShadowingVisibility } from './js/practice/shadowing.js';
import { initDictationEvents, updateDictationVisibility } from './js/practice/dictation.js';

// Dashboard Modules
import { fetchUsageStats } from './js/dashboard/stats.js';

// Lessons Modules
import { loadGermanLessons, initGermanLessonsEvents } from './js/lessons/german.js';

// ==========================================================================
// APPLICATION INITIALIZATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log("app_client.js loaded and DOMContentLoaded event fired.");

    // Ensure API key is available (shows modal if not set)
    await ensureApiKey();

    // Initialize UI
    initTheme();
    initFab();
    initSettingsEvents();
    initInputModeToggle();

    // Initialize audio
    initAudioPlayerEvents();
    initAudioTest();
    initAudioDropZone();

    // Initialize synthesis controls
    initVoicesEvents();
    initSSMLToolbar();
    initFormSubmission();
    initTestVoiceButton();

    // Wire up fetchUsageStats for form.js
    setFetchUsageStats(fetchUsageStats);

    // Initialize practice modes
    initShadowingEvents();
    initDictationEvents();

    // Initialize lessons
    initGermanLessonsEvents();

    // Initialize file upload handlers
    initFileUploadHandlers();

    // Initialize audio library
    setAudioItemsRef(getAudioItems());
    initLibraryEvents();

    // Load initial data
    loadVoices();
    fetchUsageStats();
    loadGermanLessons();

    // Initial UI updates
    updateDictationVisibility();
    updateShadowingVisibility();
    renderLibrary();
    updateDashboard();
    initLibraryCount();

    // Initialize progress tracking UI
    initStreakUI();

    console.log("Application initialized.");
});
