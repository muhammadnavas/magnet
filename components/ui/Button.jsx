import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, View } from "react-native";
import colors from "../../constants/colors";

export const Button = ({
  children,
  onPress,
  variant = "primary", // primary, secondary, ghost, danger, outline
  size = "md", // sm, md, lg
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  style = "",
  textStyle = "",
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case "secondary":
        return "bg-surface-hover border border-border";
      case "ghost":
        return "bg-transparent";
      case "danger":
        return "bg-error";
      case "outline":
        return "bg-transparent border border-primary";
      case "primary":
      default:
        return "bg-primary";
    }
  };

  const getTextVariantStyles = () => {
    switch (variant) {
      case "ghost":
        return "text-text-secondary";
      case "outline":
        return "text-primary-light";
      case "secondary":
        return "text-text-primary";
      case "danger":
      case "primary":
      default:
        return "text-white";
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case "sm":
        return "py-2 px-3 rounded-lg";
      case "lg":
        return "py-4 px-6 rounded-xl";
      case "md":
      default:
        return "py-3 px-4 rounded-xl";
    }
  };

  const getTextSizeStyles = () => {
    switch (size) {
      case "sm":
        return "text-xs font-semibold";
      case "lg":
        return "text-base font-bold";
      case "md":
      default:
        return "text-sm font-semibold";
    }
  };

  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      className={`flex-row items-center justify-center ${getSizeStyles()} ${getVariantStyles()} ${
        isDisabled ? "opacity-50" : ""
      } ${style}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" ? colors.primary : "#FFFFFF"} size="small" />
      ) : (
        <View className="flex-row items-center justify-center">
          {iconLeft && <View className="mr-2">{iconLeft}</View>}
          <Text className={`text-center ${getTextSizeStyles()} ${getTextVariantStyles()} ${textStyle}`}>
            {children}
          </Text>
          {iconRight && <View className="ml-2">{iconRight}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default Button;
