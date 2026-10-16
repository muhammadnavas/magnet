# Orio Voice Workflows

## Features
- Native speech recognition for voice input in knowledge capture, Ask AI, and task creation.
- Turn-based conversational voice input in Ask AI.
- Optional text-to-speech playback for assistant messages using the device's built-in speech engine.
- No OpenAI transcription API, transcription API key, or voice-transcription backend endpoint.

## Setup
1. Install the updated dependencies with `npm install`.
2. Build a native development app because `expo-speech-recognition` uses native Android/iOS modules; Expo Go alone is not sufficient.
3. For Android, run `npx expo run:android` or build with EAS after installing dependencies and configuring the plugin.
4. Grant microphone and speech-recognition permissions when prompted. Ensure a speech-recognition service (commonly Google Speech Services) is enabled on the device.

## How it works
The app invokes the platform speech-recognition service and receives transcript events directly in the mobile app. The active screen sends the recognized text through its existing knowledge ingestion, RAG chat, or task parsing flow. Assistant speech is local device text-to-speech and starts only when the user taps the speaker icon.

## Cost and privacy notes
- Orio does not pay for a separate speech transcription API with this implementation.
- Whether recognition works offline depends on the device, installed recognition service, language pack, and OS version. The configured recognizer may use the device's speech service and network.
- Gemini remains the configured AI provider for Ask AI/RAG where the backend has a Gemini key; voice recognition itself does not require Gemini.
- This implementation defaults to Indian English (`en-IN`). Update the locale if you want another language.
