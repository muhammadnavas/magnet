import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import Button from "./Button";

export const ErrorState = ({
  title = "Connection Error",
  message = "Failed to synchronize with your Orio backend.",
  onRetry,
  className = "",
  ...props
}) => {
  return (
    <View
      className={`flex-1 items-center justify-center p-8 bg-transparent text-center ${className}`}
      {...props}
    >
      <View className="w-16 h-16 rounded-2xl bg-error/10 border border-error/20 items-center justify-center mb-4">
        <Ionicons name="cloud-offline-outline" size={30} color={colors.error} />
      </View>
      <Text className="text-white text-base font-bold mb-2 text-center">
        {title}
      </Text>
      <Text className="text-text-secondary text-sm text-center mb-6 max-w-[260px] leading-relaxed">
        {message}
      </Text>
      {onRetry ? (
        <Button variant="secondary" size="sm" onPress={onRetry}>
          Try Again
        </Button>
      ) : null}
    </View>
  );
};

export default ErrorState;
