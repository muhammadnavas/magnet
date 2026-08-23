import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import Markdown from "react-native-markdown-display";
import SourceCitation from "./SourceCitation";

export const ChatMessage = ({ message }) => {
  const { role, content, sources } = message;
  const isUser = role === "user";

  const markdownStyles = {
    body: {
      color: isUser ? "#FFFFFF" : colors.text.primary,
      fontSize: 14,
      lineHeight: 20,
    },
    paragraph: {
      marginVertical: 4,
    },
    code_inline: {
      backgroundColor: isUser ? "rgba(255, 255, 255, 0.15)" : "#242433",
      color: isUser ? "#FFFFFF" : colors.accent,
      fontFamily: "monospace",
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 12,
    },
    code_block: {
      backgroundColor: "#0A0A0F",
      borderColor: "#242433",
      borderWidth: 1,
      color: "#D0D0D5",
      fontFamily: "monospace",
      padding: 10,
      borderRadius: 8,
      fontSize: 12,
      marginVertical: 8,
    },
    link: {
      color: colors.primaryLight,
      textDecorationLine: "underline",
    },
    bullet_list: {
      marginVertical: 4,
    },
    ordered_list: {
      marginVertical: 4,
    },
    heading1: { color: "#FFFFFF", fontSize: 20, fontWeight: "bold", marginVertical: 8 },
    heading2: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold", marginVertical: 6 },
    heading3: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold", marginVertical: 4 },
  };

  return (
    <View className={`flex-row mb-4 w-full ${isUser ? "justify-end" : "justify-start"}`}>
      {/* Icon/Avatar for AI */}
      {!isUser && (
        <View className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 items-center justify-center mr-2.5 mt-1 self-start">
          <Ionicons name="sparkles" size={14} color={colors.primary} />
        </View>
      )}

      {/* Message Bubble */}
      <View
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary rounded-tr-none"
            : "bg-surface border border-border rounded-tl-none"
        }`}
      >
        <Markdown style={markdownStyles}>{content}</Markdown>

        {/* Citations section if sources exist */}
        {!isUser && sources && sources.length > 0 && (
          <View className="border-t border-border/40 mt-3 pt-2">
            <Text className="text-text-muted text-[10px] font-bold uppercase tracking-wider mb-1.5">
              Sources
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {sources.map((source, index) => (
                <SourceCitation key={source.id || index} source={source} />
              ))}
            </View>
          </View>
        )}
      </View>

      {/* User icon */}
      {isUser && (
        <View className="w-8 h-8 rounded-full bg-surface-hover border border-border items-center justify-center ml-2.5 mt-1 self-start">
          <Ionicons name="person" size={14} color={colors.text.secondary} />
        </View>
      )}
    </View>
  );
};

export default ChatMessage;
