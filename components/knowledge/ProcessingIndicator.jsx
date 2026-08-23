import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import colors from "../../constants/colors";

export const ProcessingIndicator = ({
  progress = 0, // 0 to 100
  statusMessage = "Analyzing document structure...",
  className = "",
  ...props
}) => {
  return (
    <View className={`bg-surface border border-border p-4 rounded-xl flex-row items-center ${className}`} {...props}>
      <ActivityIndicator size="small" color={colors.accent} className="mr-3" />
      <View className="flex-1">
        <Text className="text-white text-xs font-bold mb-1">
          Processing Knowledge Item
        </Text>
        <Text className="text-text-secondary text-[10px]">
          {statusMessage}
        </Text>
        
        {/* Progress Bar container */}
        <View className="h-1 bg-border rounded-full mt-2 w-full overflow-hidden">
          <View
            style={{ width: `${progress}%` }}
            className="h-full bg-accent rounded-full"
          />
        </View>
      </View>
      <Text className="text-accent text-xs font-bold ml-3">
        {Math.round(progress)}%
      </Text>
    </View>
  );
};

export default ProcessingIndicator;
