# Text-to-Speech Generator

This project is a web application that converts text to speech using Google Cloud's Text-to-Speech API. Users can upload a text file, select a language and corresponding voice, and generate an audio file of the text being read aloud.

## Features

- Upload text files for conversion
- Select from multiple languages, including:
  - English (US, UK, AU)
  - Spanish
  - German
  - Dutch
  - Japanese
- Filtered voice options based on the selected language to prevent mismatches
- Support for various voice types:
  - Standard
  - WaveNet
  - Neural2
  - Polyglot
  - Studio
- Customize speaking rate and pitch for generated audio
- Test selected voices before generating the full audio file
- Track and monitor quota usage for characters and bytes consumed per voice type
- Download generated MP3 audio files

## Prerequisites

- Node.js
- Google Cloud account with Text-to-Speech API enabled
- Google Cloud service account key

## Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/davidCorreaEngineer/TextToAudio.git
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up your Google Cloud credentials**:
   - Create a service account and download the JSON key file.
   - Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the path of your JSON key file:
     ```bash
     export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/keyfile.json"
     ```

4. **Start the server**:
   ```bash
   node app.js
   ```

5. **Open a web browser and navigate to** `http://localhost:3000`

## Usage

1. **Upload a text file**: Drag and drop a text file or select one using the file picker.
2. **Select a language and voice**: Choose the desired language and voice from the filtered options.
3. **(Optional) Test the selected voice**: Test the selected voice to preview how it sounds.
4. **Generate Audio**: Click "Generate Audio" to create an MP3 file of the text.
5. **Download the audio file**: After generation, download the audio file directly.

## Technologies Used

- Node.js
- Express.js
- Google Cloud Text-to-Speech API
- Bootstrap (for responsive UI)
- Chart.js (for visualizing usage data)
- HTML/CSS/JavaScript

## License

[MIT License](LICENSE)