import React from "react";
import { View, Text, Image } from "react-native";
import useThemeStore from "../../store/themeStore";

const logoDark = require("../../assets/images/logo-dark.png");
const logoLight = require("../../assets/images/logo-light.png");

export const Logo = ({
  size = "md",
  showText = true,
  className = "",
  style = {},
}) => {
  const { theme } = useThemeStore();

  // Pick white/light logo on dark backgrounds, and dark/black logo on light backgrounds
  const logoSource = theme === "dark" ? logoLight : logoDark;

  const dimensions = {
    sm: { width: 28, height: 28, textSize: "text-base" },
    md: { width: 36, height: 36, textSize: "text-xl" },
    lg: { width: 52, height: 52, textSize: "text-3xl" },
  }[size] || { width: 36, height: 36, textSize: "text-xl" };

  return (
    <View className={`flex-row items-center ${className}`} style={style}>
      <Image
        source={logoSource}
        style={{ width: dimensions.width, height: dimensions.height }}
        resizeMode="contain"
      />
      {showText && (
        <Text className={`font-black tracking-tight ml-2.5 ${dimensions.textSize} ${
          theme === "dark" ? "text-white" : "text-slate-900"
        }`}>
          Orio
        </Text>
      )}
    </View>
  );
};

export default Logo;
