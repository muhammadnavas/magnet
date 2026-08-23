import React, { useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform } from "react-native";
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

export default function AskScreen() {
  const [inputText, setInputText] = useState("");
  const { messages, sendMessage, isSending, isTyping, clearChat } = useChat();
  const scrollViewRef = useRef(null);

  const handleSend = (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    sendMessage(text);
    setInputText("");

    // Auto scroll down
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Chat Header */}
        <View className="flex-row items-center justify-between px-5 py-3.5 border-b border-border/40 bg-surface">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 items-center justify-center mr-2.5">
              <Ionicons name="sparkles" size={16} color={colors.primaryLight} />
            </View>
            <View>
              <Text className="text-white text-sm font-bold">Ask Orio</Text>
              <Text className="text-[9px] font-bold text-success uppercase tracking-wider">
                RAG Ingestion Active
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={clearChat}
            className="p-1.5 rounded-lg bg-surface-hover border border-border"
          >
            <Ionicons name="trash-outline" size={16} color={colors.text.secondary} />
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
                <Text className="text-white text-base font-bold mb-2">
                  No Active Conversations
                </Text>
                <Text className="text-text-secondary text-xs text-center max-w-[260px] leading-relaxed">
                  Query your private technical library. Answers will dynamically resolve with citations to notes, code snippets, and PDFs.
                </Text>
              </View>

              <Text className="text-text-muted text-[10px] font-bold uppercase tracking-wider mb-3 px-1">
                Suggested Prompts
              </Text>
              {SUGGESTED_QUESTIONS.map((question, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => handleSend(question)}
                  style={({ pressed }) => [pressed ? { opacity: 0.8 } : {}]}
                  className="mb-2"
                >
                  <Card className="p-3.5 flex-row items-center justify-between border border-border/60">
                    <Text className="text-text-secondary text-xs font-semibold flex-1 mr-3">
                      {question}
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.primaryLight} />
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
            <View className="flex-row items-center mb-4 self-start bg-surface border border-border rounded-2xl px-4 py-2.5 rounded-tl-none ml-10">
              <View className="w-1.5 h-1.5 rounded-full bg-text-secondary animate-bounce mr-1" />
              <View className="w-1.5 h-1.5 rounded-full bg-text-secondary animate-bounce mr-1" />
              <View className="w-1.5 h-1.5 rounded-full bg-text-secondary animate-bounce" />
            </View>
          )}
        </ScrollView>

        {/* Input Bar */}
        <View className="p-4 border-t border-border/40 bg-surface">
          <View className="flex-row items-center bg-background border border-border rounded-xl px-3 py-1.5 h-12 w-full">
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask anything about your knowledge..."
              placeholderTextColor={colors.text.muted}
              className="flex-1 text-white text-sm h-full"
              style={{ paddingVertical: 0 }}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
              editable={!isSending}
            />
            <TouchableOpacity
              onPress={() => handleSend()}
              disabled={isSending || !inputText.trim()}
              className={`w-9 h-9 rounded-lg items-center justify-center ${
                inputText.trim() ? "bg-primary" : "bg-surface-hover opacity-50"
              }`}
            >
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
