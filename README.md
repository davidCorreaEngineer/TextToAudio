# Text-to-Speech Generator

This project is a web application that converts text to speech using Google Cloud's Text-to-Speech API. It allows users to upload a text file, select a language and voice, and generate an audio file of the text being read aloud.

## Features

- Upload text files
- Select from multiple languages (English, Spanish, German)
- Choose from various voice options for each language
- Generate MP3 audio files from text
- Test voices before generating full audio
- Download generated audio files

## Prerequisites

- Node.js
- Google Cloud account with Text-to-Speech API enabled
- Google Cloud service account key

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up your Google Cloud credentials:
   - Create a service account and download the JSON key file
   - Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to the path of your JSON key file
4. Start the server: `node app.js`
5. Open a web browser and navigate to `http://localhost:3000`

## Usage

1. Upload a text file
2. Select a language and voice
3. (Optional) Test the selected voice
4. Click "Generate Audio" to create the MP3 file
5. Download the generated audio file

## Technologies Used

- Node.js
- Express.js
- Google Cloud Text-to-Speech API
- HTML/CSS/JavaScript

## License

[MIT License](LICENSE)
