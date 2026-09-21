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
    sm: { width: 28, height: 28, textSize: 14 },
    md: { width: 42, height: 42, textSize: 28 },
    lg: { width: 60, height: 60, textSize: 36 },
  }[size] || { width: 42, height: 42, textSize: 28 };

  return (
    <View className={`flex-row items-center ${className}`} style={style}>
      <Image
        source={logoSource}
        style={{ width: dimensions.width, height: dimensions.height }}
        resizeMode="contain"
      />
      {showText && (
        <Text
          style={{
            fontSize: dimensions.textSize,
            fontWeight: "900",
            letterSpacing: -0.5,
            marginLeft: 10,
            color: theme === "dark" ? "#FFFFFF" : "#0F172A",
          }}
        >
          Magnet
        </Text>
      )}
    </View>
  );
};

export default Logo;
