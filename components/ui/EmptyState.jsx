import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Button from "./Button";
import useThemeStore from "../../store/themeStore";

export const EmptyState = ({
  icon = "folder-open-outline",
  title = "No items found",
  description = "Get started by capturing a note, code snippet, or document.",
  actionLabel,
  onActionPress,
  className = "",
  ...props
}) => {
  const { colors: themeColors } = useThemeStore();

  return (
    <View
      className={`flex-1 items-center justify-center p-8 bg-transparent text-center ${className}`}
      {...props}
    >
      <View
        style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }}
        className="w-16 h-16 rounded-2xl border items-center justify-center mb-4 shadow-sm"
      >
        <Ionicons name={icon} size={30} color={themeColors.primary} />
      </View>
      <Text style={{ color: themeColors.text.primary }} className="text-lg font-bold mb-2 text-center">
        {title}
      </Text>
      <Text style={{ color: themeColors.text.secondary }} className="text-sm text-center mb-6 max-w-[260px] leading-relaxed">
        {description}
      </Text>
      {actionLabel && onActionPress ? (
        <Button size="sm" onPress={onActionPress}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
};

export default EmptyState;
