import React, { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import ChatMessage from "../../components/chat/ChatMessage";
import Card from "../../components/ui/Card";
import useChat from "../../hooks/useChat";

const SUGGESTED_QUESTIONS = [
  "What did I learn about Docker?",
  "Show everything related to RAG.",
  "What was the solution to my previous FastAPI error?",
  "Explain my AI Interviewer project."
];

import Logo from "../../components/ui/Logo";
import useThemeStore from "../../store/themeStore";

export default function AskScreen() {
  const [inputText, setInputText] = useState("");
  const { colors: themeColors } = useThemeStore();
  const { messages, sendMessage, isSending, isTyping, clearChat } = useChat();
  const scrollViewRef = useRef(null);

  const handleSend = (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    sendMessage(text);
    setInputText("");

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Chat Header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-border/40 bg-surface">
          <View className="flex-row items-center">
            <Logo size="sm" showText={true} />
            <Text className="text-[11px] font-bold text-success uppercase tracking-wider ml-3">
              • RAG Search Active
            </Text>
          </View>
          <TouchableOpacity
            onPress={clearChat}
            className="p-2.5 rounded-xl bg-surface-hover border border-border"
          >
            <Ionicons name="trash-outline" size={18} color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Message Panel */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ flexGrow: 1, padding: 20 }}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          className="flex-1"
        >
          {messages.length === 0 ? (
            /* Suggestions view when chat is empty */
            <View className="flex-1 justify-center py-6">
              <View className="items-center mb-8">
                <View className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center mb-4">
                  <Ionicons name="chatbubbles-outline" size={32} color={colors.primaryLight} />
                </View>
                <Text className="text-white text-lg font-bold mb-2">
                  No Active Conversations
                </Text>
                <Text className="text-text-secondary text-xs text-center max-w-[280px] leading-relaxed">
                  Ask questions about your captured notes, code snippets, links, or PDF documents.
                </Text>
              </View>

              <Text className="text-text-muted text-xs font-bold uppercase tracking-wider mb-3 px-1">
                Suggested Prompts
              </Text>
              {SUGGESTED_QUESTIONS.map((question, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => handleSend(question)}
                  style={({ pressed }) => [pressed ? { opacity: 0.8 } : {}]}
                  className="mb-2.5"
                >
                  <Card className="p-4 flex-row items-center justify-between border border-border/80">
                    <Text className="text-text-secondary text-xs font-semibold flex-1 mr-3 leading-snug">
                      {question}
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.primaryLight} />
                  </Card>
                </Pressable>
              ))}
            </View>
          ) : (
            /* Normal Chat Message flow */
            messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
          )}

          {/* Typing/Thinking indicator */}
          {isTyping && (
            <View className="flex-row items-center mb-4 self-start bg-surface border border-border rounded-2xl px-4 py-3 rounded-tl-none ml-2">
              <View className="w-2 h-2 rounded-full bg-text-secondary animate-bounce mr-1.5" />
              <View className="w-2 h-2 rounded-full bg-text-secondary animate-bounce mr-1.5" />
              <View className="w-2 h-2 rounded-full bg-text-secondary animate-bounce" />
            </View>
          )}
        </ScrollView>

        {/* ChatGPT-Style Bottom Input Bar */}
        <View className="p-4 bg-background border-t border-border/40">
          <View className="flex-row items-center bg-card border border-border rounded-3xl p-2 px-3">
            {/* Attachment Button */}
            <TouchableOpacity
              onPress={() => handleSend("Show everything related to RAG.")}
              className="w-9 h-9 rounded-full bg-surface items-center justify-center mr-2 border border-border/60"
            >
              <Ionicons name="add" size={20} color={colors.text.secondary} />
            </TouchableOpacity>

            {/* ChatGPT Expanding Text Input */}
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Message Orio..."
              placeholderTextColor={colors.text.muted}
              className="flex-1 text-white text-base max-h-28 px-1"
              multiline
              style={{ paddingTop: Platform.OS === "ios" ? 8 : 4, paddingBottom: Platform.OS === "ios" ? 8 : 4 }}
              editable={!isSending}
            />

            {/* ChatGPT Circular Send Button */}
            <TouchableOpacity
              onPress={() => handleSend()}
              disabled={isSending || !inputText.trim()}
              className={`w-9 h-9 rounded-full items-center justify-center ml-2 ${
                inputText.trim() ? "bg-primary" : "bg-surface-hover opacity-40"
              }`}
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
