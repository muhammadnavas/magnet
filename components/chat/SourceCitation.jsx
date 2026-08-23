import React from "react";
import { Pressable, Text } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";

export const SourceCitation = ({ source }) => {
  const { id, title, type } = source;

  const handlePress = () => {
    if (id) {
      router.push(`/knowledge/${id}`);
    }
  };

  const getSourceIcon = () => {
    switch (type?.toLowerCase()) {
      case "pdf":
        return "document-text-outline";
      case "code":
        return "code-working-outline";
      case "url":
        return "link-outline";
      case "error":
        return "bug-outline";
      case "note":
      default:
        return "pencil-outline";
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        pressed ? { opacity: 0.8 } : {}
      ]}
      className="flex-row items-center bg-surface-hover border border-border px-2.5 py-1.5 rounded-lg mr-1.5 mb-1"
    >
      <Ionicons name={getSourceIcon()} size={12} color={colors.primaryLight} className="mr-1.5" />
      <Text className="text-[10px] font-semibold text-text-primary max-w-[120px]" numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
};

export default SourceCitation;
