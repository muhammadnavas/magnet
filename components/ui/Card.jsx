import React from "react";
import { View, Pressable } from "react-native";
import { useAppTheme } from "../../store/themeStore";

export const Card = ({ children, onPress, className = "", style = {}, ...props }) => {
  const { themeColors } = useAppTheme();

  const dynamicStyle = { backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1 };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [dynamicStyle, style, pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : {}]}
        className={`rounded-2xl overflow-hidden ${className}`}
        {...props}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[dynamicStyle, style]} className={`rounded-2xl overflow-hidden ${className}`} {...props}>
      {children}
    </View>
  );
};

export default Card;
