import React, { useEffect, useRef, useState } from "react";
import { Alert, TouchableOpacity, Text, Linking } from "react-native";
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
            ? "Allow microphone and speech-recognition permissions in your device settings."
            : "Your device's speech service could not transcribe that. Please try again."
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
      // Ask the speech-recognition native module first so Android can request
      // the permissions declared by its config plugin. Check RECORD_AUDIO via
      // Expo AV as a fallback because some Android service versions report
      // speech permission separately from microphone permission.
      let speechPermission = null;
      try {
        speechPermission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      } catch (permissionError) {
        console.warn("Speech permission request failed; checking microphone permission:", permissionError);
      }

      const microphonePermission = await Audio.requestPermissionsAsync();
      if (!microphonePermission.granted) {
        const canAskAgain = microphonePermission.canAskAgain !== false;
        Alert.alert(
          "Microphone permission required",
          canAskAgain
            ? "Allow microphone access when Android asks so voice input can work."
            : "Microphone access is blocked. Open Android Settings > Apps > Magnet > Permissions and enable Microphone.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      if (speechPermission?.granted === false) {
        Alert.alert(
          "Speech recognition unavailable",
          "Microphone access is allowed, but speech recognition is blocked. Check Android's speech service and app permissions, then try again.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
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
      Alert.alert("Voice input unavailable", "Check that a speech-recognition service is enabled on your device.");
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
