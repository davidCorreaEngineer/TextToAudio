const express = require('express');
const multer = require('multer');
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Check if the credentials are set
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set');
    process.exit(1);
}

const client = new textToSpeech.TextToSpeechClient();
const MAX_TEXT_LENGTH = 5000; // Maximum allowed bytes

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/voices', async (req, res) => {
    try {
        console.log('Fetching voices from Google TTS API...');
        const [result] = await client.listVoices({});
        console.log(`Total voices received: ${result.voices.length}`);
        
        const voices = result.voices.filter(voice => 
            voice.languageCodes[0].startsWith('es') || 
            voice.languageCodes[0].startsWith('de') ||
            voice.languageCodes[0].startsWith('en')
        );
        
        console.log(`Filtered voices: ${voices.length}`);
        console.log('Available language codes:');
        voices.forEach(voice => {
            console.log(`- ${voice.name}: ${voice.languageCodes.join(', ')}`);
        });
        
        res.json(voices);
    } catch (error) {
        console.error("Error fetching voices:", error);
        res.status(500).json({ error: error.message });
    }
});

const testSentences = {
    'en-US': "The quick brown fox jumps over the lazy dog.",
    'es-ES': "El veloz murciélago hindú comía feliz cardillo y kiwi.",
    'de-DE': "Zwölf Boxkämpfer jagen Viktor quer über den großen Sylter Deich."
};

app.post('/test-voice', express.json(), async (req, res) => {
    try {
        const { language, voice } = req.body;
        const testText = testSentences[language] || "This is a test of the selected voice.";
        const request = {
            input: { text: testText },
            voice: { languageCode: language, name: voice },
            audioConfig: { audioEncoding: 'MP3' },
        };

        const [response] = await client.synthesizeSpeech(request);
        const outputFileName = `test_${Date.now()}.mp3`;
        const outputFile = path.join(__dirname, 'public', outputFileName);
        await fs.writeFile(outputFile, response.audioContent, 'binary');
        res.json({ success: true, file: outputFileName, testText: testText });
    } catch (error) {
        console.error("Error testing voice:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/check-file-size', upload.single('textFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const stats = await fs.stat(req.file.path);
        const fileSizeInBytes = stats.size;
        await fs.unlink(req.file.path); // Clean up the uploaded file
        res.json({ byteLength: fileSizeInBytes });
    } catch (error) {
        console.error("Error checking file size:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/synthesize', upload.single('textFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const text = await fs.readFile(req.file.path, 'utf8');
        const textByteLength = Buffer.byteLength(text, 'utf8');
        
        if (textByteLength > MAX_TEXT_LENGTH) {
            await fs.unlink(req.file.path); // Clean up the uploaded file
            return res.status(400).json({ 
                success: false, 
                error: `Text is too long (${textByteLength} bytes). Maximum allowed is ${MAX_TEXT_LENGTH} bytes.`
            });
        }

        const { language, voice } = req.body;
        const request = {
            input: { text: text },
            voice: { languageCode: language, name: voice },
            audioConfig: { audioEncoding: 'MP3' },
        };

        const [response] = await client.synthesizeSpeech(request);
        const outputFileName = `output_${Date.now()}.mp3`;
        const outputFile = path.join(__dirname, 'public', outputFileName);
        await fs.writeFile(outputFile, response.audioContent, 'binary');
        await fs.unlink(req.file.path); // Clean up the uploaded file
        res.json({ success: true, file: outputFileName });
    } catch (error) {
        console.error("Error generating speech:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));