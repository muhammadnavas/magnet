import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import Button from "./Button";

export const EmptyState = ({
  icon = "folder-open-outline",
  title = "No items found",
  description = "Get started by capturing a note, code snippet, or document.",
  actionLabel,
  onActionPress,
  className = "",
  ...props
}) => {
  return (
    <View
      className={`flex-1 items-center justify-center p-8 bg-transparent text-center ${className}`}
      {...props}
    >
      <View className="w-16 h-16 rounded-2xl bg-surface border border-border items-center justify-center mb-4">
        <Ionicons name={icon} size={30} color={colors.text.secondary} />
      </View>
      <Text className="text-white text-base font-bold mb-2 text-center">
        {title}
      </Text>
      <Text className="text-text-secondary text-sm text-center mb-6 max-w-[240px] leading-relaxed">
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
