import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import useThemeStore from "../../store/themeStore";

export const Input = ({
  label,
  error,
  secureTextEntry,
  iconLeft,
  style = "",
  containerStyle = "",
  ...props
}) => {
  const { colors: themeColors } = useThemeStore();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const showPasswordToggle = secureTextEntry;

  return (
    <View className={`mb-4 w-full ${containerStyle}`}>
      {label && (
        <Text
          style={{ color: themeColors.text.muted }}
          className="text-xs font-bold uppercase tracking-wider mb-2 ml-1"
        >
          {label}
        </Text>
      )}
      <View
        style={{
          backgroundColor: themeColors.card,
          borderColor: isFocused ? themeColors.primary : error ? themeColors.error : themeColors.border,
        }}
        className="flex-row items-center border rounded-2xl px-4 h-13 w-full"
      >
        {iconLeft && <View className="mr-3">{iconLeft}</View>}

        <TextInput
          placeholderTextColor={themeColors.text.muted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          className={`flex-1 text-base h-full ${style}`}
          style={{ color: themeColors.text.primary, paddingVertical: 0 }}
          {...props}
        />

        {showPasswordToggle && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            activeOpacity={0.7}
            className="p-1"
          >
            <Ionicons
              name={isPasswordVisible ? "eye-off" : "eye"}
              size={20}
              color={themeColors.text.secondary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={{ color: themeColors.error }} className="text-xs font-medium mt-1 ml-1">
          {error}
        </Text>
      )}
    </View>
  );
};

export default Input;
