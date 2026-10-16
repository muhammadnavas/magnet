import React, { useEffect, useRef, useState } from "react";
import { Alert, ActivityIndicator, TouchableOpacity, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import api from "../../lib/api";
import { useAppTheme } from "../../store/themeStore";

/**
 * Shared voice capture for quick dictation and turn-based conversational voice.
 * The caller decides what to do with the returned transcript.
 */
export default function VoiceInput({ onTranscript, mode = "quick", disabled = false }) {
  const { themeColors } = useAppTheme();
  const [recording, setRecording] = useState(null);
  const [busy, setBusy] = useState(false);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recording) recording.stopAndUnloadAsync().catch(() => {});
  }, [recording]);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Microphone permission", "Allow microphone access to use voice input.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const created = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(created.recording);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((value) => value + 1), 1000);
    } catch (error) {
      console.error("Could not start voice recording:", error);
      Alert.alert("Recording unavailable", "Orio could not start recording. Please try again.");
    }
  };

  const stopAndTranscribe = async () => {
    if (!recording || busy) return;
    setBusy(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      if (!uri) throw new Error("Recording file was not created.");
      const form = new FormData();
      form.append("file", { uri, name: "orio-voice.m4a", type: "audio/m4a" });
      const response = await api.post("/voice/transcribe", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      const transcript = String(response.data?.text || "").trim();
      if (!transcript) {
        Alert.alert("No speech detected", "Try speaking a little closer to the microphone.");
        return;
      }
      onTranscript?.(transcript);
    } catch (error) {
      console.error("Voice transcription failed:", error);
      const detail = error?.response?.data?.detail;
      Alert.alert("Voice input failed", typeof detail === "string" ? detail : "Check your connection and try again.");
    } finally {
      setRecording(null);
      setBusy(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const isRecording = Boolean(recording);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={isRecording ? "Stop recording and transcribe" : mode === "conversation" ? "Record a voice conversation turn" : "Dictate text"}
      disabled={disabled || busy}
      onPress={isRecording ? stopAndTranscribe : startRecording}
      style={{
        minWidth: 40, height: 40, paddingHorizontal: mode === "conversation" ? 12 : 0,
        borderRadius: 22, alignItems: "center", justifyContent: "center",
        flexDirection: "row", backgroundColor: isRecording ? "#DC2626" : themeColors.surfaceHover,
        borderWidth: 1, borderColor: isRecording ? "#DC2626" : themeColors.border,
        opacity: disabled || busy ? 0.55 : 1,
      }}
    >
      {busy ? <ActivityIndicator size="small" color={themeColors.primary} /> : <Ionicons name={isRecording ? "stop" : "mic-outline"} size={19} color={isRecording ? "#FFFFFF" : themeColors.primary} />}
      {mode === "conversation" && <Text style={{ color: isRecording ? "#FFFFFF" : themeColors.text.primary, fontSize: 11, fontWeight: "700", marginLeft: 6 }}>{busy ? "Transcribing" : isRecording ? `Stop ${duration}s` : "Voice turn"}</Text>}
    </TouchableOpacity>
  );
}
