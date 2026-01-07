// ==========================================================================
// GERMAN LESSONS MODULE
// ==========================================================================

import { dom } from '../dom.js';
import { fetchGermanLessons, fetchGermanLesson } from '../api.js';
import { setOriginalFileName } from '../state.js';
import { updateEditorCharCount } from '../synthesis/ssml.js';
import { updateShadowingVisibility } from '../practice/shadowing.js';
import { loadVoices } from '../synthesis/voices.js';
import { showToast } from '../ui/toast.js';

export async function loadGermanLessons() {
    const { germanLessonSelect } = dom;
    if (!germanLessonSelect) return;

    try {
        const data = await fetchGermanLessons();

        if (data.success && data.lessons && data.lessons.length > 0) {
            germanLessonSelect.innerHTML = '<option value="">Select a lesson...</option>';
            data.lessons.forEach(lesson => {
                const option = document.createElement('option');
                option.value = lesson.filename;
                option.textContent = lesson.displayName;
                germanLessonSelect.appendChild(option);
            });
            console.log(`Loaded ${data.lessons.length} German lessons`);
        } else {
            const loader = document.querySelector('.german-lessons-loader');
            if (loader) loader.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading German lessons:', error);
        const loader = document.querySelector('.german-lessons-loader');
        if (loader) loader.style.display = 'none';
    }
}

export async function loadSelectedGermanLesson() {
    const { germanLessonSelect, loadGermanLessonBtn, textEditor, languageSelect } = dom;

    const filename = germanLessonSelect?.value;
    if (!filename) {
        showToast('warning', 'No Lesson Selected', 'Please select a lesson first.');
        return;
    }

    if (loadGermanLessonBtn) {
        loadGermanLessonBtn.disabled = true;
        loadGermanLessonBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    }

    try {
        const data = await fetchGermanLesson(filename);

        if (data.success && textEditor) {
            textEditor.value = data.content;
            updateEditorCharCount();
            updateShadowingVisibility();

            // Set original filename for audio output
            setOriginalFileName(filename.replace('.txt', ''));

            // Auto-select German language
            if (languageSelect) {
                languageSelect.value = 'de-DE';
                loadVoices();
            }

            console.log(`Loaded German lesson: ${filename}`);
        } else {
            throw new Error(data.error || 'Unknown error');
        }
    } catch (error) {
        console.error('Error loading German lesson:', error);
        showToast('error', 'Failed to Load Lesson', error.message);
    } finally {
        if (loadGermanLessonBtn) {
            loadGermanLessonBtn.disabled = false;
            loadGermanLessonBtn.innerHTML = '<i class="fas fa-download"></i> Load';
        }
    }
}

export function initGermanLessonsEvents() {
    const { germanLessonSelect, loadGermanLessonBtn } = dom;

    if (loadGermanLessonBtn) {
        loadGermanLessonBtn.addEventListener('click', loadSelectedGermanLesson);
    }

    if (germanLessonSelect) {
        germanLessonSelect.addEventListener('dblclick', () => {
            if (germanLessonSelect.value) {
                loadSelectedGermanLesson();
            }
        });
    }
}
