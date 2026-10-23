import React, { useEffect, useState } from "react";
import * as Speech from "expo-speech";
import * as Clipboard from "expo-clipboard";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Markdown from "react-native-markdown-display";
import SourceCitation from "./SourceCitation";
import { useAppTheme } from "../../store/themeStore";

export const ChatMessage = ({ message, onEdit, onRetry }) => {
  const { role, content, sources } = message;
  const isUser = role === "user";
  const { themeColors } = useAppTheme();
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => () => { Speech.stop(); }, []);

  const markdownStyles = {
    body: { color: isUser ? "#FFFFFF" : themeColors.text.primary, fontSize: 14, lineHeight: 20 },
    paragraph: { marginVertical: 4 },
    code_inline: {
      backgroundColor: isUser ? "rgba(255,255,255,0.15)" : themeColors.surfaceHover,
      color: isUser ? "#FFFFFF" : themeColors.primary,
      fontFamily: "monospace", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, fontSize: 12,
    },
    code_block: {
      backgroundColor: themeColors.background, borderColor: themeColors.border, borderWidth: 1,
      color: themeColors.text.secondary, fontFamily: "monospace", padding: 10, borderRadius: 8, fontSize: 12, marginVertical: 8,
    },
    link: { color: themeColors.primary, textDecorationLine: "underline" },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    heading1: { color: themeColors.text.primary, fontSize: 20, fontWeight: "bold", marginVertical: 8 },
    heading2: { color: themeColors.text.primary, fontSize: 18, fontWeight: "bold", marginVertical: 6 },
    heading3: { color: themeColors.text.primary, fontSize: 16, fontWeight: "bold", marginVertical: 4 },
  };

  return (
    <View className={`flex-row mb-4 w-full ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <View style={{ backgroundColor: `${themeColors.primary}20`, borderColor: `${themeColors.primary}30`, borderWidth: 1 }} className="w-7 h-7 rounded-full items-center justify-center mr-2 mt-1 self-start">
          <Ionicons name="sparkles" size={14} color={themeColors.primary} />
        </View>
      )}

      <View
        style={isUser
          ? { backgroundColor: themeColors.primary }
          : { backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1 }
        }
        className={`max-w-[84%] rounded-2xl px-3 py-2 ${isUser ? "rounded-tr-none" : "rounded-tl-none"}`}
      >
        <Markdown style={markdownStyles}>{content}</Markdown>
        {message.isError && message.retryText ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Retry sending message"
            onPress={() => onRetry?.(message.retryText)}
            style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", marginTop: 10, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, backgroundColor: themeColors.surfaceHover }}
          >
            <Ionicons name="refresh" size={14} color={themeColors.primary} style={{ marginRight: 6 }} />
            <Text style={{ color: themeColors.primary, fontSize: 12, fontWeight: "800" }}>Retry message</Text>
          </TouchableOpacity>
        ) : null}
        {!isUser && Boolean(content) && (
          <View className="flex-row items-center justify-end mt-1.5" style={{ gap: 14 }}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Copy AI response"
              onPress={async () => {
                try {
                  await Clipboard.setStringAsync(String(content));
                } catch (error) {
                  console.warn("Could not copy AI response:", error);
                }
              }}
              hitSlop={8}
              style={{ padding: 4 }}
            >
              <Ionicons name="copy-outline" size={17} color={themeColors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={isSpeaking ? "Stop reading answer" : "Read answer aloud"}
              onPress={async () => {
                if (isSpeaking) {
                  await Speech.stop();
                  setIsSpeaking(false);
                  return;
                }
                // Clear any queued utterance first so repeated taps never
                // append the same response to the speech queue.
                await Speech.stop();
                setIsSpeaking(true);
                Speech.speak(String(content).replace(/[`*_#>]/g, ""), {
                  rate: 0.95,
                  onDone: () => setIsSpeaking(false),
                  onStopped: () => setIsSpeaking(false),
                  onError: () => setIsSpeaking(false),
                });
              }}
              hitSlop={8}
              style={{ padding: 4 }}
            >
              <Ionicons name={isSpeaking ? "stop-circle-outline" : "volume-medium-outline"} size={18} color={isSpeaking ? themeColors.primary : themeColors.text.secondary} />
            </TouchableOpacity>
          </View>
        )}
        {isUser && Boolean(content) && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Edit your message"
            onPress={() => onEdit?.(String(content))}
            hitSlop={8}
            style={{ alignSelf: "flex-end", marginTop: 6, padding: 4 }}
          >
            <Ionicons name="create-outline" size={17} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {!isUser && sources?.length > 0 && (
          <View style={{ borderTopColor: themeColors.border }} className="border-t mt-2.5 pt-2">
            <Text style={{ color: themeColors.text.muted }} className="text-[10px] font-bold uppercase tracking-wider mb-1.5">Sources</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {sources.map((source, index) => <SourceCitation key={source.id || index} source={source} />)}
            </View>
          </View>
        )}
      </View>

      {isUser && (
        <View style={{ backgroundColor: themeColors.surfaceHover, borderColor: themeColors.border, borderWidth: 1 }} className="w-7 h-7 rounded-full items-center justify-center ml-2 mt-1 self-start">
          <Ionicons name="person" size={14} color={themeColors.text.secondary} />
        </View>
      )}
    </View>
  );
};

export default ChatMessage;
