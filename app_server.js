const express = require('express');
const multer = require('multer');
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'uploads/' });

const client = new textToSpeech.TextToSpeechClient({
    keyFilename: path.join(__dirname, 'keyfile.json')
});

const MAX_TEXT_LENGTH = 5000; // Maximum allowed bytes

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

// **1. Voice Type Mapping Function**
function getVoiceCategory(voiceName) {
    // Define mapping based on known voice name patterns or specific names
    // This mapping may need to be updated as new voices are introduced
    if (/Standard/i.test(voiceName)) {
        return 'Standard';
    } else if (/WaveNet/i.test(voiceName)) {
        return 'WaveNet';
    } else if (/Neural2/i.test(voiceName)) {
        return 'Neural2';
    } else if (/Polyglot/i.test(voiceName)) {
        return 'Polyglot';
    } else if (/Journey/i.test(voiceName)) {
        return 'Journey';
    } else if (/Studio/i.test(voiceName)) {
        return 'Studio';
    } else {
        // Default category for any new or unknown voice types
        return 'Standard';
    }
}

// **2. Count Characters Function**
function countCharacters(text) {
    // Remove SSML mark tags
    const textWithoutMarks = text.replace(/<mark name=['"].*?['"]\/>/g, '');
    // Count remaining characters (including other SSML tags, spaces, and line breaks)
    return textWithoutMarks.length;
}

// **3. Count Bytes Function**
function countBytes(text) {
    return Buffer.byteLength(text, 'utf8');
}

// **4. Update Quota Function**
async function updateQuota(voiceType, count) {
    const quotaFile = path.join(__dirname, 'quota.json');
    let quota = {};

    try {
        const data = await fs.readFile(quotaFile, 'utf8');
        quota = JSON.parse(data);
        console.log("Quota data loaded:", quota);
    } catch (error) {
        // File doesn't exist or is empty, start with an empty object
        console.log("Quota file not found or empty. Starting fresh.");
    }

    const currentDate = new Date();
    const yearMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;

    if (!quota[yearMonth]) {
        quota[yearMonth] = {};
    }

    if (!quota[yearMonth][voiceType]) {
        quota[yearMonth][voiceType] = 0;
    }

    quota[yearMonth][voiceType] += count;

    await fs.writeFile(quotaFile, JSON.stringify(quota, null, 2));
    console.log(`Quota updated for ${voiceType} in ${yearMonth}: ${quota[yearMonth][voiceType]}`);
}

// **5. Root Route**
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// **6. Voices Endpoint**
app.get('/voices', async (req, res) => {
    try {
        console.log('Fetching voices from Google TTS API...');
        const [result] = await client.listVoices({});
        console.log(`Total voices received: ${result.voices.length}`);

        // Supported Languages: English, Dutch, Spanish, German, Japanese, Australian English
        const supportedLanguages = ['en-GB', 'en-US', 'en-AU', 'nl-NL', 'es-ES', 'es-US', 'de-DE', 'ja-JP'];

        const voices = result.voices.filter(voice => 
            voice.languageCodes.some(code => supportedLanguages.includes(code))
        );

        console.log(`Filtered voices: ${voices.length}`);
        console.log('Available voices:');
        voices.forEach(voice => {
            console.log(`- ${voice.name}: ${voice.languageCodes.join(', ')}`);
        });

        res.json(voices);
    } catch (error) {
        console.error("Error fetching voices:", error);
        res.status(500).json({ error: error.message });
    }
});

// **7. Test Voice Endpoint (Do Not Save Audio Files)**
app.post('/test-voice', express.json(), async (req, res) => {
    try {
        const { language, voice, speakingRate, pitch } = req.body;
        console.log(`Received test-voice request: Language=${language}, Voice=${voice}, SpeakingRate=${speakingRate}, Pitch=${pitch}`);
        
        const testSentences = {
            'en-US': "The quick brown fox jumps over the lazy dog.",
            'en-GB': "The quick brown fox jumps over the lazy dog.",
            'en-AU': "The quick brown fox jumps over the lazy dog.",
            'es-ES': "El veloz murciélago hindú comía feliz cardillo y kiwi.",
			'es-US': "El veloz murciélago hindú comía feliz cardillo y kiwi.",
            'de-DE': "Zwölf Boxkämpfer jagen Viktor quer über den großen Sylter Deich.",
            'nl-NL': "De snelle bruine vos springt over de luie hond.",
            'ja-JP': "いろはにほへとちりぬるを。"
        };

        const testText = testSentences[language] || "This is a test of the selected voice.";
        console.log(`Test sentence: "${testText}"`);

        const request = {
            input: { text: testText },
            voice: { languageCode: language, name: voice },
            audioConfig: { 
                audioEncoding: 'MP3',
                speakingRate: parseFloat(speakingRate) || 1.0,
                pitch: parseFloat(pitch) || 0.0
            },
        };

        const [response] = await client.synthesizeSpeech(request);
        console.log("Audio synthesized successfully for test voice.");

        // Convert audio content to Base64
        const audioBase64 = response.audioContent.toString('base64');
        res.json({ success: true, audioContent: audioBase64, testText: testText });
        console.log("Test voice audio data sent to client.");
    } catch (error) {
        console.error("Error testing voice:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// **8. Check File Size Endpoint**
app.post('/check-file-size', upload.single('textFile'), async (req, res) => {
    try {
        if (!req.file) {
            console.log("No file uploaded for size check.");
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const stats = await fs.stat(req.file.path);
        const fileSizeInBytes = stats.size;
        await fs.unlink(req.file.path); // Clean up the uploaded file
        console.log(`File size checked: ${fileSizeInBytes} bytes`);
        res.json({ byteLength: fileSizeInBytes });
    } catch (error) {
        console.error("Error checking file size:", error);
        res.status(500).json({ error: error.message });
    }
});

// **9. Synthesize Endpoint (Name Audio Files Based on Original Text File)**
app.post('/synthesize', upload.none(), async (req, res) => {
    try {
        let text = req.body.textContent || '';
        const language = req.body.language;
        const voice = req.body.voice;
        const speakingRate = parseFloat(req.body.speakingRate) || 1.0;
        const pitch = parseFloat(req.body.pitch) || 0.0;
        const originalFileName = req.body.originalFileName || `audio_${Date.now()}`;
        const useSsml = req.body.useSsml === 'true';

        console.log(`Received synthesize request: Language=${language}, Voice=${voice}, SpeakingRate=${speakingRate}, Pitch=${pitch}, OriginalFileName=${originalFileName}, UseSsml=${useSsml}`);

        if (!text) {
            console.log("No text provided for synthesis.");
            return res.status(400).json({ success: false, error: 'No text provided.' });
        }

        // **Set Input Type Based on useSsml**
        let input;
        if (useSsml) {
            input = { ssml: text };
        } else {
            input = { text: text };
        }

        // **Adjust Character Counting for Quota**
        let count;
        if (useSsml) {
            count = countCharactersInSsml(text);
        } else {
            count = countCharacters(text);
        }

        console.log(`Character count for quota: ${count}`);

        // **Check Text Length**
        if (count > MAX_TEXT_LENGTH) {
            console.log(`Text exceeds maximum allowed size of ${MAX_TEXT_LENGTH} characters.`);
            return res.status(400).json({ 
                success: false, 
                error: `Text is too long (${count} characters). Maximum allowed is ${MAX_TEXT_LENGTH} characters.`
            });
        }

        const request = {
            input: input,
            voice: { languageCode: language, name: voice },
            audioConfig: { 
                audioEncoding: 'MP3',
                speakingRate: speakingRate,
                pitch: pitch
            },
        };

        const [response] = await client.synthesizeSpeech(request);
        console.log("Audio synthesized successfully.");

        // Determine voice type and count
        const voiceCategory = getVoiceCategory(voice);

        // Update quota
        await updateQuota(voiceCategory, count);
        console.log("Quota updated.");

        // Generate the output filename based on the original file name
        const sanitizedFileName = path.parse(originalFileName).name.replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
        const outputFileName = `${sanitizedFileName}_audio.mp3`;
        const outputFile = path.join(__dirname, 'public', outputFileName);

        await fs.writeFile(outputFile, response.audioContent, 'binary');
        console.log(`Audio file saved as ${outputFileName}`);

        res.json({ success: true, file: outputFileName, fileName: outputFileName });
        console.log("Synthesize response sent to client.");
    } catch (error) {
        console.error("Error generating speech:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// **10. Dashboard Endpoint**
app.get('/dashboard', async (req, res) => {
    try {
        const quotaFile = path.join(__dirname, 'quota.json');
        let quota = {};

        try {
            const data = await fs.readFile(quotaFile, 'utf8');
            quota = JSON.parse(data);
            console.log("Quota data loaded for dashboard:", quota);
        } catch (error) {
            console.log("Quota file not found or empty. Sending empty quota data.");
        }

        res.json({ quota: quota });
        console.log("Quota data sent to dashboard.");
    } catch (error) {
        console.error("Error fetching quota for dashboard:", error);
        res.status(500).json({ error: error.message });
    }
});

// **Function to Count Characters in SSML Input**
function countCharactersInSsml(ssmlText) {
    // Remove SSML tags
    const strippedText = ssmlText.replace(/<[^>]+>/g, '');
    return strippedText.length;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
