import React from "react";
import { View, Pressable } from "react-native";
import useThemeStore from "../../store/themeStore";

export const Card = ({
  children,
  onPress,
  className = "",
  style = {},
  ...props
}) => {
  const { colors: themeColors } = useThemeStore();

  const dynamicStyle = {
    backgroundColor: themeColors.card,
    borderColor: themeColors.border,
  };

  const cardStyle = "border rounded-2xl overflow-hidden";

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          dynamicStyle,
          style,
          pressed ? { opacity: 0.9, transform: [{ scale: 0.98 }] } : {}
        ]}
        className={`${cardStyle} ${className}`}
        {...props}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[dynamicStyle, style]} className={`${cardStyle} ${className}`} {...props}>
      {children}
    </View>
  );
};

export default Card;
