import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import colors from "../../constants/colors";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Tag from "../ui/Tag";
import { formatDistanceToNow } from "date-fns";
import useThemeStore from "../../store/themeStore";

export const KnowledgeCard = ({ item }) => {
  const { id, title, contentType, summary, tags, createdAt, processingStatus } = item;
  const { colors: themeColors } = useThemeStore();

  const getTypeIcon = () => {
    switch (contentType?.toLowerCase()) {
      case "pdf":
        return { name: "document-text", color: "#6C63FF" };
      case "image":
      case "screenshot":
        return { name: "image", color: "#00E5A0" };
      case "code":
        return { name: "code-working", color: "#00D4FF" };
      case "url":
        return { name: "link", color: "#FF9F43" };
      case "error":
        return { name: "bug", color: "#FF6B6B" };
      case "note":
      default:
        return { name: "pencil", color: themeColors.text.secondary };
    }
  };

  const typeIcon = getTypeIcon();
  
  let formattedDate = "";
  try {
    formattedDate = formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  } catch (e) {
    formattedDate = createdAt;
  }

  const handlePress = () => {
    router.push(`/knowledge/${id}`);
  };

  return (
    <Card onPress={handlePress} className="p-4 mb-3">
      {/* Header with Icon, Type, and Status */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View
            style={{ backgroundColor: `${typeIcon.color}15` }}
            className="w-8 h-8 rounded-lg items-center justify-center mr-2.5"
          >
            <Ionicons name={typeIcon.name} size={16} color={typeIcon.color} />
          </View>
          <Text style={{ color: themeColors.text.secondary }} className="text-[10px] font-bold uppercase tracking-widest">
            {contentType}
          </Text>
        </View>
        
        {processingStatus !== "completed" && (
          <Badge status={processingStatus} />
        )}
      </View>

      {/* Title */}
      <Text style={{ color: themeColors.text.primary }} className="text-base font-bold mb-1.5 leading-snug">
        {title}
      </Text>

      {/* Summary */}
      <Text numberOfLines={2} style={{ color: themeColors.text.secondary }} className="text-xs leading-relaxed mb-3">
        {summary}
      </Text>

      {/* Footer: Tags and Date */}
      <View style={{ borderTopColor: themeColors.border }} className="flex-row items-center justify-between border-t pt-3">
        <View className="flex-row flex-wrap gap-1.5 flex-1 mr-2">
          {tags.slice(0, 3).map((tag, idx) => (
            <Tag key={`${tag}-${idx}`} text={tag} />
          ))}
        </View>
        <Text style={{ color: themeColors.text.muted }} className="text-[10px] font-semibold">
          {formattedDate}
        </Text>
      </View>
    </Card>
  );
};

export default KnowledgeCard;
