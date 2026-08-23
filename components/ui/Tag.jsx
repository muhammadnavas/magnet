import React from "react";
import { View, Text } from "react-native";

export const Tag = ({
  text,
  variant = "secondary", // primary, accent, success, warning, error, secondary
  className = "",
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return "bg-primary/10 border border-primary/20 text-primary-light";
      case "accent":
        return "bg-accent/10 border border-accent/20 text-accent";
      case "success":
        return "bg-success/10 border border-success/20 text-success";
      case "warning":
        return "bg-warning/10 border border-warning/20 text-warning";
      case "error":
        return "bg-error/10 border border-error/20 text-error";
      case "secondary":
      default:
        return "bg-surface border border-border text-text-secondary";
    }
  };

  return (
    <View
      className={`px-2.5 py-1 rounded-full items-center justify-center ${getVariantStyles()} ${className}`}
      {...props}
    >
      <Text className="text-[10px] font-semibold tracking-wider uppercase">
        {text}
      </Text>
    </View>
  );
};

export default Tag;
