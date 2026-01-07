// ==========================================================================
// AUDIO ANALYSIS UTILITIES
// ==========================================================================

// Detect silence gaps in audio using Web Audio API
// Returns array of timestamps where silences occur (phrase boundaries)
export async function detectSilenceGaps(audioUrl, silenceThreshold = 0.01, minSilenceDuration = 0.3) {
    console.log('Detecting silence gaps in audio...');

    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const totalDuration = audioBuffer.duration;

        console.log('  Sample rate:', sampleRate, 'Duration:', totalDuration.toFixed(2) + 's');

        // Analyze in chunks (every 10ms)
        const chunkSize = Math.floor(sampleRate * 0.01);
        const silenceGaps = [];
        let inSilence = false;
        let silenceStart = 0;

        for (let i = 0; i < channelData.length; i += chunkSize) {
            // Calculate RMS (root mean square) for this chunk
            let sum = 0;
            const chunkEnd = Math.min(i + chunkSize, channelData.length);
            for (let j = i; j < chunkEnd; j++) {
                sum += channelData[j] * channelData[j];
            }
            const rms = Math.sqrt(sum / (chunkEnd - i));

            const currentTime = i / sampleRate;

            if (rms < silenceThreshold) {
                // In silence
                if (!inSilence) {
                    inSilence = true;
                    silenceStart = currentTime;
                }
            } else {
                // In sound
                if (inSilence) {
                    const silenceDuration = currentTime - silenceStart;
                    if (silenceDuration >= minSilenceDuration) {
                        // Found a significant silence gap
                        silenceGaps.push({
                            start: silenceStart,
                            end: currentTime,
                            midpoint: silenceStart + (silenceDuration / 2)
                        });
                    }
                    inSilence = false;
                }
            }
        }

        audioContext.close();

        console.log('  Found ' + silenceGaps.length + ' silence gaps');
        silenceGaps.forEach((gap, i) => {
            console.log('    Gap ' + (i + 1) + ': ' + gap.start.toFixed(2) + 's - ' + gap.end.toFixed(2) + 's');
        });

        return {
            gaps: silenceGaps,
            totalDuration: totalDuration
        };
    } catch (error) {
        console.error('Error detecting silence:', error);
        return null;
    }
}

// Build phrase timings from detected silence gaps
export function buildTimingsFromSilence(silenceResult, phraseCount) {
    if (!silenceResult || !silenceResult.gaps) {
        return null;
    }

    const gaps = silenceResult.gaps;
    const totalDuration = silenceResult.totalDuration;
    const timings = [];

    // Filter out leading silence (gap that starts at or very near 0)
    const filteredGaps = gaps.filter(gap => gap.start > 0.1);

    console.log('  Filtered gaps (removed leading silence):', filteredGaps.length);

    // First phrase: from 0 (or after leading silence) to first gap
    let audioStart = 0;
    if (gaps.length > 0 && gaps[0].start < 0.1) {
        audioStart = gaps[0].end;
        console.log('  Audio starts after leading silence at:', audioStart.toFixed(2) + 's');
    }

    let currentStart = audioStart;

    for (let i = 0; i < phraseCount; i++) {
        let timing;

        if (i < filteredGaps.length) {
            // End at the start of the silence gap
            timing = {
                start: currentStart,
                end: filteredGaps[i].start,
                duration: filteredGaps[i].start - currentStart
            };
            // Next phrase starts after the silence gap
            currentStart = filteredGaps[i].end;
        } else {
            // No more gaps - last phrase goes to end
            timing = {
                start: currentStart,
                end: totalDuration,
                duration: totalDuration - currentStart
            };
        }

        console.log('  Phrase ' + (i + 1) + ': ' + timing.start.toFixed(2) + 's - ' + timing.end.toFixed(2) + 's');
        timings.push(timing);
    }

    return timings;
}

// Fallback: Estimate phrase timings based on character count
export function estimatePhraseTimings(phrases, speakingRate, totalDuration) {
    const charCounts = phrases.map(phrase => phrase.length);
    const totalChars = charCounts.reduce((a, b) => a + b, 0);

    console.log('Fallback: Estimating timings from character count');
    console.log('  Total characters:', totalChars);
    console.log('  Total audio duration:', totalDuration, 'seconds');

    let currentTime = 0;
    const timings = phrases.map((phrase, i) => {
        const proportion = charCounts[i] / totalChars;
        const duration = totalDuration * proportion;

        const timing = {
            start: currentTime,
            end: currentTime + duration,
            duration: duration
        };

        currentTime += duration;
        return timing;
    });

    return timings;
}
