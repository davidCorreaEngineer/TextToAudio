# VoiceCraft - Text-to-Speech Generator

A modern web application that converts text to speech using Google Cloud's Text-to-Speech API. Upload text files or write directly in the editor, select from dozens of voices, and generate high-quality audio files. Now includes advanced language learning features like shadowing and dictation practice.

![TTS Web App Interface](webApp.jpg "TTS Web App Main Screen")

## Features

### Core Text-to-Speech
- **Dual Input Modes**: Upload text files or write/paste directly in the built-in editor
- **SSML Support**: Advanced text editor with SSML toolbar for precise control:
  - Insert pauses with custom duration
  - Add emphasis to specific words
  - Control speech speed for sections
  - Whisper effect and advanced prosody controls
- **Multiple Languages**: Support for 13 languages including:
  - English (US, UK, AU)
  - Spanish (Spain, US)
  - German
  - Dutch
  - Japanese
  - Italian
  - French
  - Portuguese (Portugal, Brazil)
  - Turkish
- **High-Quality Voices**: Access to various voice types:
  - Standard
  - WaveNet (premium neural voices)
  - Neural2 (latest generation)
  - Polyglot
  - Studio (highest quality)
- **Customizable Audio Settings**:
  - Speaking rate (0.25x - 4.0x)
  - Pitch adjustment (-20 to +20)
  - Optional pauses between sentences
  - Code comment stripping for programming content
- **Voice Preview**: Test any voice before generating full audio
- **Quota Tracking**: Real-time usage monitoring with monthly quota visualization

### Language Learning Features

#### Shadowing Practice
- **Phrase-by-Phrase Playback**: Break audio into individual phrases for focused practice
- **Automatic Gaps**: Configurable pause after each phrase for repetition (1.0x - 3.0x)
- **Speed Control**: Slow down audio (0.7x - 1.0x) for beginners
- **Loop Mode**: Repeat phrases 1x, 2x, 3x, or infinitely
- **Visual Progress**: Track current phrase with highlighted phrase list
- **Import Support**: Drag and drop audio + text files for practice with any content

#### Dictation Practice
- **Listen & Type**: Test listening comprehension phrase by phrase
- **Limited Replays**: 3 replays per phrase to encourage focus
- **Smart Evaluation**: Real-time accuracy scoring with word-by-word comparison
- **Visual Feedback**: Color-coded diff showing correct, wrong, missing, and extra words
- **Session Statistics**: Track overall accuracy and progress
- **Speed Adjustment**: Customize playback speed (0.7x - 1.0x)

### User Interface
- **Modern Design**: Clean, minimal interface with teal accent colors
- **Card-Based Layout**: Logical grouping of features for easy navigation
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Header Usage Indicator**: Quick view of monthly quota usage with detailed tooltip
- **Audio Player**: Built-in player for generated audio with import support

## Prerequisites

Before you begin, ensure you have met the following requirements:

- [Node.js](https://nodejs.org/) (v14 or later) installed on your system
- A Google Cloud account with the Text-to-Speech API enabled
- A Google Cloud service account key (JSON file)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/davidCorreaEngineer/TextToAudio.git
   cd TextToAudio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your Google Cloud credentials:
   - Place your Google Cloud service account JSON key file in the project root directory.
   - Rename it to `keyfile.json` (or update the path in `app_server.js` if using a different name).

## Configuration

1. Open `app_server.js` and ensure the `keyFilename` path is correct:
   ```javascript
   const client = new textToSpeech.TextToSpeechClient({
     keyFilename: path.join(__dirname, 'keyfile.json')
   });
   ```

2. (Optional) Modify the `MAX_TEXT_LENGTH` constant in `app_server.js` if you want to change the maximum allowed text length.

## Recent Updates

### Version 3.0 (December 2025)
- **Shadowing Practice Mode**: New interactive feature for language learning with phrase-by-phrase playback, configurable gaps, and loop functionality
- **Dictation Practice Mode**: Comprehensive dictation system with smart evaluation, replay limits, and visual feedback
- **UI Redesign**: Complete visual overhaul with modern card-based layout, custom CSS design system, and improved mobile responsiveness
- **Dual Input System**: Toggle between file upload and text editor modes
- **SSML Toolbar**: User-friendly toolbar for adding SSML tags without manual coding
- **Header Usage Indicator**: Compact quota display in header with detailed tooltip
- **Import Support**: Drag-and-drop support for audio and text files to enable practice with external content
- **German Lessons Loader**: Built-in quick loader for German language learning content

## Running the Application

1. Start the server:
   ```bash
   node app_server.js
   ```

2. Open a web browser and navigate to `http://localhost:3000`

## Usage

### Basic Text-to-Speech Generation

1. **Choose Input Method**:
   - **File Upload**: Drag and drop a `.txt` file or click to browse
   - **Text Editor**: Switch to "Write Text" mode and type/paste your content directly

2. **Select Language and Voice**:
   - Choose your desired language from the dropdown menu
   - Select a voice from the filtered options for that language
   - Use the play button to test the selected voice

3. **Customize Audio Settings**:
   - Adjust speaking rate using the speed slider (0.25x - 4.0x)
   - Modify pitch using the pitch slider (-20 to +20)
   - Optional: Enable "Add pauses between sentences" with custom duration

4. **Advanced SSML Editing** (Text Editor Mode):
   - Select text in the editor and use toolbar buttons to add SSML tags:
     - **Pause**: Insert timed pauses (`<break time='500ms'/>`)
     - **Emphasis**: Add strong/moderate emphasis
     - **Slow/Fast**: Control speed for specific sections
     - **Whisper**: Add whisper effect
     - **Say As**: Format numbers, dates, etc.

5. **Generate Audio**:
   - Click "Generate Audio" to create an MP3 file
   - Monitor progress with the progress bar
   - Download your generated audio file when complete

### Shadowing Practice

1. **Import Audio**:
   - Generate audio using the TTS generator above, or
   - Drag and drop an audio file (MP3/WAV) + optional text file into the Output/Import section

2. **Start Practice**:
   - Click "Start Practice" in the Shadowing Practice card
   - Audio is automatically split into phrases based on punctuation

3. **Configure Settings**:
   - **Gap Duration**: Set pause length after each phrase (1.0x - 3.0x)
   - **Speed**: Adjust playback speed (0.7x - 1.0x for beginners)
   - **Repeat**: Choose how many times to repeat each phrase (1x, 2x, 3x, or infinite loop)

4. **Practice**:
   - Listen to each phrase as it plays
   - Repeat the phrase aloud during the gap
   - Navigate phrases using Previous/Next buttons
   - Track progress in the visual phrase list

### Dictation Practice

1. **Import Audio** (same as Shadowing Practice)

2. **Start Dictation**:
   - Click "Start Dictation" in the Dictation Practice card

3. **Listen and Type**:
   - Click "Play" to hear the phrase (up to 3 replays available)
   - Adjust speed if needed (0.7x - 1.0x)
   - Type what you hear in the text area

4. **Check Your Answer**:
   - Click "Check Answer" to see results
   - View color-coded feedback showing:
     - Green: Correct words
     - Red: Wrong words
     - Yellow: Missing words
     - Blue: Extra words
   - See your accuracy score
   - Replay the audio to hear it again

5. **Continue**:
   - Click "Next Phrase" to move to the next dictation item
   - Track overall session accuracy and progress
   - Complete all phrases to see final statistics

## Monitoring Usage

The header displays a compact usage indicator showing your monthly quota consumption:
- Hover over the indicator to see detailed breakdown by voice type
- Visual progress bar with color coding (green/yellow/red)
- Percentage of quota used
- Character and byte counts per voice type

## Use Cases

### For Language Learners
- **Listening Practice**: Generate native-speaker audio in your target language
- **Shadowing**: Improve pronunciation by repeating phrases with controlled gaps
- **Dictation**: Test and improve listening comprehension
- **Custom Content**: Practice with any text (news articles, dialogues, vocabulary lists)
- **Speed Control**: Start slow and gradually increase to native speed

### For Content Creators
- **Voiceovers**: Generate audio for videos, podcasts, or presentations
- **Audiobooks**: Convert written content to spoken audio
- **Accessibility**: Create audio versions of text content
- **Multilingual Content**: Produce audio in 13 different languages

### For Developers
- **Code Reading**: Convert code comments and documentation to audio
- **Learning**: Listen to tutorials and documentation while coding
- **Code Comment Stripping**: Automatically remove comments before conversion

## Technical Details

### Audio Processing
- Automatic phrase splitting based on punctuation (periods, question marks, exclamation points)
- Support for SSML (Speech Synthesis Markup Language) for fine-grained control
- MP3 output format for broad compatibility
- Real-time audio playback with browser controls

### Language Learning Algorithms
- **Shadowing**: Smart gap calculation based on phrase duration
- **Dictation**: Levenshtein distance-based accuracy scoring with word-level comparison
- **Progress Tracking**: Session statistics and performance metrics

## Troubleshooting

- If you encounter CORS issues, ensure your Google Cloud project has the necessary permissions set up.
- For "Quota Exceeded" errors, check your Google Cloud Console for current quota limits and usage.
- **Audio playback issues**: Ensure your browser supports HTML5 audio and MP3 format
- **SSML not working**: Make sure SSML tags are properly formatted and closed
- **Import not working**: Verify audio files are in MP3 or WAV format, text files are UTF-8 encoded .txt files

## Contributing

Contributions to improve the Text-to-Speech Generator are welcome. Please follow these steps:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

"Commons Clause" License Condition v1.0

The Software is provided to you by the Licensor under the License, as defined below, subject to the following condition.

Without limiting other conditions in the License, the grant of rights under the License will not include, and the License does not grant to you, the right to Sell the Software.

For purposes of the foregoing, "Sell" means practicing any or all of the rights granted to you under the License to provide to third parties, for a fee or other consideration (including without limitation fees for hosting or consulting/ support services related to the Software), a product or service whose value derives, entirely or substantially, from the functionality of the Software.
MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Google Cloud** for providing the high-quality Text-to-Speech API
- **Inter Font Family** by Rasmus Andersson for the clean UI typography
- **Font Awesome** for comprehensive icon library
- **Claude Code** for development assistance and code review
- The **open-source community** for various libraries and inspiration

## Technologies Used

- **Backend**: Node.js with Express
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **API**: Google Cloud Text-to-Speech API
- **Audio**: HTML5 Audio API with Web Audio API features
- **Design**: Custom CSS design system with CSS variables
- **Fonts**: Inter (UI), JetBrains Mono (code editor)

## Browser Compatibility

VoiceCraft works best on modern browsers with HTML5 audio support:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Future Enhancements

Potential features for future releases:
- Speech recognition for automated shadowing feedback
- Spaced repetition system for vocabulary learning
- Export practice session history and statistics
- Support for custom phrase splitting rules
- Multi-language parallel text display
- Phonetic transcription display
- Integration with popular language learning platforms