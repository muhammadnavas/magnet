import React from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { useAppTheme } from "../../store/themeStore";

export const LoadingState = ({
  message = "Loading data...",
  fullScreen = false,
  className = "",
  ...props
}) => {
  const { themeColors } = useAppTheme();

  return (
    <View
      style={{
        backgroundColor: fullScreen ? themeColors.background : "transparent",
      }}
      className={`flex-1 items-center justify-center p-6 ${className}`}
      {...props}
    >
      <ActivityIndicator size="large" color={themeColors.primary} />
      {message ? (
        <Text
          style={{ color: themeColors.text.secondary }}
          className="text-sm mt-4 font-medium"
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
};

export default LoadingState;
