import React, { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ChatMessage from "../../components/chat/ChatMessage";
import TypingIndicator from "../../components/chat/TypingIndicator";
import Card from "../../components/ui/Card";
import useChat from "../../hooks/useChat";
import Logo from "../../components/ui/Logo";
import VoiceInput from "../../components/voice/VoiceInput";
import { useAppTheme } from "../../store/themeStore";

const SUGGESTED_QUESTIONS = [
  "What did I learn about Docker?",
  "Show everything related to RAG.",
  "What was the solution to my previous FastAPI error?",
  "Explain my AI Interviewer project."
];

export default function AskScreen() {
  const [inputText, setInputText] = useState("");
  const { theme, themeColors } = useAppTheme();
  const { messages, sendMessage, isSending, isTyping, clearChat } = useChat();
  const scrollViewRef = useRef(null);

  const handleSend = (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;
    sendMessage(text);
    setInputText("");
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1" keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>

        {/* Header */}
        <View style={{ backgroundColor: themeColors.card, borderBottomColor: themeColors.border }} className="flex-row items-center justify-between px-5 py-4 border-b">
          <View className="flex-row items-center">
            <Logo size="md" showText={true} />
            <View style={{ backgroundColor: `${themeColors.success || "#059669"}18`, borderRadius: 999 }} className="ml-3 px-2.5 py-1 flex-row items-center">
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#059669", marginRight: 5 }} />
              <Text style={{ color: "#059669" }} className="text-[10px] font-bold uppercase tracking-wider">RAG Active</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={clearChat}
            style={{ backgroundColor: themeColors.surfaceHover, borderColor: themeColors.border }}
            className="p-2.5 rounded-xl border"
          >
            <Ionicons name="trash-outline" size={18} color={themeColors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ flexGrow: 1, padding: 20 }}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          className="flex-1"
        >
          {messages.length === 0 ? (
            <View className="flex-1 justify-center py-6">
              <View className="items-center mb-8">
                <View style={{ backgroundColor: `${themeColors.primary}15`, borderColor: `${themeColors.primary}30`, borderWidth: 1 }} className="w-16 h-16 rounded-2xl items-center justify-center mb-4">
                  <Ionicons name="chatbubbles-outline" size={30} color={themeColors.primary} />
                </View>
                <Text style={{ color: themeColors.text.primary }} className="text-lg font-bold mb-2">No Active Conversations</Text>
                <Text style={{ color: themeColors.text.secondary }} className="text-xs text-center max-w-[280px] leading-relaxed">
                  Ask questions about your captured notes, code snippets, links, or PDF documents.
                </Text>
              </View>

              <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-3">Suggested Prompts</Text>
              {SUGGESTED_QUESTIONS.map((question, idx) => (
                <Pressable key={idx} onPress={() => handleSend(question)} className="mb-2.5">
                  <View style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }} className="border p-4 rounded-2xl flex-row items-center justify-between">
                    <Text style={{ color: themeColors.text.primary }} className="text-sm font-medium flex-1 mr-3 leading-snug">{question}</Text>
                    <Ionicons name="arrow-forward" size={16} color={themeColors.primary} />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
          )}

          {isTyping && <TypingIndicator />}
        </ScrollView>

        {/* Bottom Input Bar */}
        <View style={{ backgroundColor: themeColors.background, borderTopColor: themeColors.border }} className="p-4 border-t">
          <View style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }} className="flex-row items-center border rounded-3xl p-2.5 px-3">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Capture new content"
              onPress={() => router.push("/(tabs)/capture")}
              style={{ backgroundColor: themeColors.surfaceHover, borderColor: themeColors.border }}
              className="w-9 h-9 rounded-full items-center justify-center mr-2 border"
            >
              <Ionicons name="add" size={20} color={themeColors.text.secondary} />
            </TouchableOpacity>

            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message Magnet..."
              placeholderTextColor={themeColors.text.muted}
              className="flex-1 text-base max-h-28 px-1"
              multiline
              style={{ color: themeColors.text.primary, paddingTop: Platform.OS === "ios" ? 8 : 4, paddingBottom: Platform.OS === "ios" ? 8 : 4 }}
              editable={!isSending}
            />

            <VoiceInput
              mode="conversation"
              onTranscript={(transcript) => handleSend(transcript)}
              disabled={isSending}
            />

            <TouchableOpacity
              onPress={() => handleSend()}
              disabled={isSending || !inputText.trim()}
              style={{ backgroundColor: inputText.trim() ? themeColors.primary : themeColors.border }}
              className="w-9 h-9 rounded-full items-center justify-center ml-2"
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
