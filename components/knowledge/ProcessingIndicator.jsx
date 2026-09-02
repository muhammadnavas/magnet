import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useAppTheme } from "../../store/themeStore";

export const ProcessingIndicator = ({
  progress = 0, // 0 to 100
  statusMessage = "Analyzing document structure...",
  className = "",
  ...props
}) => {
  const { themeColors } = useAppTheme();

  return (
    <View
      style={{ backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1 }}
      className={`p-4 rounded-2xl flex-row items-center ${className}`}
      {...props}
    >
      <ActivityIndicator size="small" color={themeColors.primary} className="mr-3" />
      <View className="flex-1">
        <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold mb-1">
          Processing Knowledge Item
        </Text>
        <Text style={{ color: themeColors.text.secondary }} className="text-[10px]">
          {statusMessage}
        </Text>
        
        {/* Progress Bar container */}
        <View style={{ backgroundColor: themeColors.border }} className="h-1 rounded-full mt-2 w-full overflow-hidden">
          <View
            style={{ width: `${progress}%`, backgroundColor: themeColors.primary }}
            className="h-full rounded-full"
          />
        </View>
      </View>
      <Text style={{ color: themeColors.primary }} className="text-xs font-bold ml-3">
        {Math.round(progress)}%
      </Text>
    </View>
  );
};

export default ProcessingIndicator;

