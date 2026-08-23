import React from "react";
import { Text, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const CaptureButton = ({
  icon,
  label,
  onPress,
  color = "#6C63FF",
  className = "",
  ...props
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        pressed ? { opacity: 0.9, transform: [{ scale: 0.96 }] } : {}
      ]}
      className={`bg-surface border border-border p-5 rounded-2xl items-center justify-center flex-1 min-h-[100px] m-1.5 ${className}`}
      {...props}
    >
      <View
        style={{ backgroundColor: `${color}15` }}
        className="w-12 h-12 rounded-xl items-center justify-center mb-3"
      >
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text className="text-white text-xs font-bold uppercase tracking-wider text-center">
        {label}
      </Text>
    </Pressable>
  );
};

export default CaptureButton;
