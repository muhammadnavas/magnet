import React from "react";
import { View, Pressable } from "react-native";

export const Card = ({
  children,
  onPress,
  className = "",
  style = {},
  ...props
}) => {
  const cardStyle = "bg-surface border border-border rounded-2xl overflow-hidden";
  
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
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
    <View style={style} className={`${cardStyle} ${className}`} {...props}>
      {children}
    </View>
  );
};

export default Card;
