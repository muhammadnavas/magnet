import React from "react";
import { View, ActivityIndicator, Text } from "react-native";
import colors from "../../constants/colors";

export const LoadingState = ({
  message = "Loading data...",
  fullScreen = false,
  className = "",
  ...props
}) => {
  return (
    <View
      className={`flex-1 items-center justify-center p-6 ${
        fullScreen ? "h-full w-full bg-background" : ""
      } ${className}`}
      {...props}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? (
        <Text className="text-text-secondary text-sm mt-4 font-medium">
          {message}
        </Text>
      ) : null}
    </View>
  );
};

export default LoadingState;
