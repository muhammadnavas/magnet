import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "../../store/themeStore";

export const Tag = ({
  text,
  variant = "secondary", // primary, accent, success, warning, error, secondary
  className = "",
  size = "md",
  ...props
}) => {
  const { themeColors } = useAppTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return { bg: `${themeColors.primary}18`, border: `${themeColors.primary}30`, text: themeColors.primary };
      case "accent":
        return { bg: `${themeColors.accent}18`, border: `${themeColors.accent}30`, text: themeColors.accent };
      case "success":
        return { bg: `${themeColors.success}18`, border: `${themeColors.success}30`, text: themeColors.success };
      case "warning":
        return { bg: `${themeColors.warning}18`, border: `${themeColors.warning}30`, text: themeColors.warning };
      case "error":
        return { bg: `${themeColors.error}18`, border: `${themeColors.error}30`, text: themeColors.error };
      case "secondary":
      default:
        return { bg: themeColors.surfaceHover, border: themeColors.border, text: themeColors.text.secondary };
    }
  };

  const style = getVariantStyles();

  return (
    <View
      style={{
        backgroundColor: style.bg,
        borderColor: style.border,
        borderWidth: 1,
      }}
      className={`px-2.5 py-0.5 rounded-full items-center justify-center ${className}`}
      {...props}
    >
      <Text style={{ color: style.text }} className="text-[10px] font-bold tracking-wider uppercase">
        {text}
      </Text>
    </View>
  );
};

export default Tag;

