# Orio Voice Workflows

## Features
- Shared push-to-talk audio capture for knowledge capture, Ask AI, and task creation.
- Turn-based conversational voice input in Ask AI.
- Optional text-to-speech playback for assistant messages.
- Server-side transcription through OpenAI's transcription API; API credentials never ship in the mobile app.

## Setup
1. Set `OPENAI_API_KEY` in the backend environment. Never place it in Expo app config or a mobile bundle.
2. Install the updated Expo dependencies with `npm install`.
3. Rebuild/restart the Expo app so native audio and speech modules are available.
4. Grant microphone permission when prompted.

## How it works
The app records a short audio clip, uploads it to the authenticated `POST /api/v1/voice/transcribe` endpoint, and receives a transcript. The active screen then sends that text through its existing knowledge, RAG chat, or task parsing flow. Assistant speech is local device text-to-speech and is started only when the user taps the speaker icon.

## Notes
- Transcription requires network connectivity and a configured backend provider key.
- Voice input is user initiated; recording stops when the user taps the active microphone.
- The conversational control supports repeated voice turns rather than keeping the microphone open in the background.
