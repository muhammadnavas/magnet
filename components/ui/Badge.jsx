import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "../../store/themeStore";

export const Badge = ({
  status, // completed, processing, failed, pending
  className = "",
  ...props
}) => {
  const { theme, themeColors } = useAppTheme();
  const isLight = theme === "light";

  const getBadgeConfig = () => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "done":
      case "synced":
        return {
          bg: isLight ? "#DCFCE7" : "rgba(5, 150, 105, 0.2)",
          dot: "#059669",
          text: isLight ? "#166534" : "#10B981",
          label: "RAG Ready"
        };
      case "processing":
      case "syncing":
        return {
          bg: isLight ? "#E0F2FE" : "rgba(2, 132, 199, 0.2)",
          dot: "#0284C7",
          text: isLight ? "#075985" : "#38BDF8",
          label: "processing"
        };
      case "failed":
      case "error":
        return {
          bg: isLight ? "#FEE2E2" : "rgba(220, 38, 38, 0.2)",
          dot: "#DC2626",
          text: isLight ? "#991B1B" : "#F87171",
          label: "failed"
        };
      case "pending":
      case "offline":
      default:
        return {
          bg: isLight ? "#FEF3C7" : "rgba(217, 119, 6, 0.2)",
          dot: "#D97706",
          text: isLight ? "#92400E" : "#FBBF24",
          label: status || "pending"
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <View
      style={{ backgroundColor: config.bg }}
      className={`flex-row items-center px-2.5 py-1 rounded-full ${className}`}
      {...props}
    >
      <View style={{ backgroundColor: config.dot }} className="w-1.5 h-1.5 rounded-full mr-1.5" />
      <Text style={{ color: config.text }} className="text-[9px] font-extrabold uppercase tracking-wider">
        {config.label}
      </Text>
    </View>
  );
};

export default Badge;

