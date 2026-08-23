import React from "react";
import { View, Text } from "react-native";

export const Badge = ({
  status, // completed, processing, failed, pending
  className = "",
  ...props
}) => {
  const getBadgeConfig = () => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "done":
      case "synced":
        return {
          bg: "bg-success/15",
          dot: "bg-success",
          text: "text-success",
          label: "completed"
        };
      case "processing":
      case "syncing":
        return {
          bg: "bg-accent/15",
          dot: "bg-accent",
          text: "text-accent",
          label: "processing"
        };
      case "failed":
      case "error":
        return {
          bg: "bg-error/15",
          dot: "bg-error",
          text: "text-error",
          label: "failed"
        };
      case "pending":
      case "offline":
      default:
        return {
          bg: "bg-warning/15",
          dot: "bg-warning",
          text: "text-warning",
          label: status || "pending"
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <View
      className={`flex-row items-center px-2 py-0.5 rounded-full ${config.bg} ${className}`}
      {...props}
    >
      <View className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dot}`} />
      <Text className={`text-[9px] font-bold uppercase tracking-wider ${config.text}`}>
        {config.label}
      </Text>
    </View>
  );
};

export default Badge;
