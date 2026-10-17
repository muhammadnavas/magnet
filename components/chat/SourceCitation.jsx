import React from "react";
import { Pressable, Text, Linking } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../store/themeStore";

export const SourceCitation = ({ source }) => {
  const { id, title, type } = source;
  const { themeColors } = useAppTheme();

  const handlePress = () => {
    if (type === "web" && source.url) {
      Linking.openURL(source.url).catch((error) => console.warn("Could not open web source:", error));
      return;
    }
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
      case "web":
        return "globe-outline";
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
        { backgroundColor: themeColors.surfaceHover, borderColor: themeColors.border, borderWidth: 1 },
        pressed ? { opacity: 0.8 } : {}
      ]}
      className="flex-row items-center px-2.5 py-1.5 rounded-lg mr-1.5 mb-1"
    >
      <Ionicons name={getSourceIcon()} size={12} color={themeColors.primaryLight} className="mr-1.5" />
      <Text style={{ color: themeColors.text.primary }} className="text-[10px] font-semibold max-w-[120px]" numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
};

export default SourceCitation;
