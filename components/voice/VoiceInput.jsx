import React, { useEffect, useRef, useState } from "react";
import { Alert, TouchableOpacity, Text, Linking, Platform } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useAppTheme } from "../../store/themeStore";

// Speech recognition is a shared native service. Only the component that starts
// a session should consume its events (Ask AI renders two voice controls).
let activeRecognitionId = null;
let nextRecognitionId = 1;

export default function VoiceInput({ onTranscript, mode = "quick", disabled = false }) {
  const { themeColors } = useAppTheme();
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const instanceId = useRef(null);
  const transcriptRef = useRef("");
  const onTranscriptRef = useRef(onTranscript);
  const errorRef = useRef(null);

  if (instanceId.current === null) instanceId.current = nextRecognitionId++;
  onTranscriptRef.current = onTranscript;

  useSpeechRecognitionEvent("result", (event) => {
    if (activeRecognitionId !== instanceId.current) return;
    const recognized = String(event.results?.[0]?.transcript || "").trim();
    if (!recognized) return;
    transcriptRef.current = recognized;
  });

  useSpeechRecognitionEvent("start", () => {
    if (activeRecognitionId !== instanceId.current) return;
    setStarting(false);
    setRecording(true);
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (activeRecognitionId !== instanceId.current) return;
    if (event.error === "aborted") return;
    errorRef.current = event.error || "unknown";
    setStarting(false);
    setRecording(false);
  });

  useSpeechRecognitionEvent("end", () => {
    if (activeRecognitionId !== instanceId.current) return;
    activeRecognitionId = null;
    setStarting(false);
    setRecording(false);
    const finalTranscript = transcriptRef.current.trim();
    if (finalTranscript) {
      onTranscriptRef.current?.(finalTranscript);
    } else if (!errorRef.current) {
      Alert.alert("No speech detected", "Try speaking a little closer to the microphone.");
    }
    if (errorRef.current) {
      const code = errorRef.current;
      errorRef.current = null;
      if (code !== "aborted") {
        Alert.alert(
          "Voice input unavailable",
          code === "not-allowed"
            ? "Android denied microphone access. If Magnet does not appear under Microphone permissions, install a fresh Magnet build with the microphone permission included. Otherwise enable it in Settings > Apps > Magnet > Permissions."
            : "Your device's speech service could not transcribe that. Check that Google Speech Services is installed and enabled, then try again."
        );
      }
    }
    transcriptRef.current = "";
  });

  useEffect(() => () => {
    if (activeRecognitionId === instanceId.current) {
      activeRecognitionId = null;
      try { ExpoSpeechRecognitionModule.abort(); } catch (_) {}
    }
  }, []);

  const openAppSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.warn("Could not open app settings:", error);
      Alert.alert("Open settings manually", "Go to Android Settings > Apps > Magnet > Permissions.");
    }
  };

  const toggleRecognition = async () => {
    if (recording || starting) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (error) {
        console.warn("Could not stop speech recognition:", error);
      }
      return;
    }

    try {
      // Request Android's native speech-recognition permission first. This
      // module is responsible for declaring RECORD_AUDIO in the built app.
      let speechPermission = null;
      try {
        speechPermission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      } catch (permissionError) {
        console.warn("Speech permission request failed:", permissionError);
      }

      // Also request through Expo AV as a compatibility fallback.
      let microphonePermission = null;
      try {
        microphonePermission = await Audio.requestPermissionsAsync();
      } catch (permissionError) {
        console.warn("Expo AV microphone permission request failed:", permissionError);
      }

      const microphoneGranted = microphonePermission?.granted === true;
      const speechGranted = speechPermission?.granted === true;
      const permanentlyBlocked =
        microphonePermission?.canAskAgain === false ||
        speechPermission?.canAskAgain === false;

      if (!microphoneGranted && !speechGranted) {
        Alert.alert(
          "Microphone permission required",
          permanentlyBlocked
            ? "Android is not showing a permission prompt. If Microphone is missing from Magnet's app permissions, the installed app was built without the required native permission. Install a new build after the app configuration is updated."
            : "Allow microphone access to use voice input.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: openAppSettings },
          ]
        );
        return;
      }

      // Speech recognition itself still needs to be permitted when the module
      // reports that permission separately from RECORD_AUDIO.
      if (speechPermission?.granted === false) {
        Alert.alert(
          "Speech recognition permission required",
          "Microphone access is available, but Android denied speech recognition. Enable it in app settings and check that a speech service is installed.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: openAppSettings },
          ]
        );
        return;
      }

      transcriptRef.current = "";
      errorRef.current = null;
      setStarting(true);
      activeRecognitionId = instanceId.current;
      ExpoSpeechRecognitionModule.start({
        lang: "en-IN",
        interimResults: true,
        continuous: false,
        addsPunctuation: true,
        requiresOnDeviceRecognition: false,
      });
    } catch (error) {
      activeRecognitionId = null;
      setStarting(false);
      setRecording(false);
      console.error("Could not start speech recognition:", error);
      Alert.alert(
        "Voice input unavailable",
        Platform.OS === "android"
          ? "Check that Magnet has microphone permission and that Google Speech Services is installed and enabled."
          : "Please allow microphone and speech-recognition access in your device settings."
      );
    }
  };

  const isActive = recording || starting;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={isActive ? "Stop voice input" : mode === "conversation" ? "Ask AI using voice" : "Dictate text"}
      accessibilityState={{ busy: starting }}
      disabled={disabled}
      onPress={toggleRecognition}
      style={{
        minWidth: 40,
        height: 40,
        paddingHorizontal: mode === "conversation" ? 12 : 0,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        backgroundColor: isActive ? "#DC2626" : themeColors.surfaceHover,
        borderWidth: 1,
        borderColor: isActive ? "#DC2626" : themeColors.border,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Ionicons name={isActive ? "stop" : mode === "conversation" ? "chatbubble-ellipses-outline" : "mic-outline"} size={19} color={isActive ? "#FFFFFF" : themeColors.primary} />
      {mode === "conversation" && (
        <Text style={{ color: isActive ? "#FFFFFF" : themeColors.text.primary, fontSize: 11, fontWeight: "700", marginLeft: 6 }}>
          {starting ? "Starting…" : recording ? "Stop voice" : "Voice turn"}
        </Text>
      )}
    </TouchableOpacity>
  );
}
