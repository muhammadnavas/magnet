import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";

export const Input = ({
  label,
  error,
  secureTextEntry,
  iconLeft,
  style = "",
  containerStyle = "",
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const showPasswordToggle = secureTextEntry;

  return (
    <View className={`mb-4 w-full ${containerStyle}`}>
      {label && (
        <Text className="text-text-secondary text-xs font-semibold mb-2 ml-1">
          {label}
        </Text>
      )}
      <View
        className={`flex-row items-center bg-surface border rounded-xl px-3 py-1 h-12 w-full ${
          isFocused ? "border-primary" : error ? "border-error" : "border-border"
        }`}
      >
        {iconLeft && <View className="mr-2">{iconLeft}</View>}
        
        <TextInput
          placeholderTextColor={colors.text.muted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          className={`flex-1 text-white text-sm h-full ${style}`}
          style={{ paddingVertical: 0 }}
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
              color={colors.text.secondary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text className="text-error text-xs font-medium mt-1 ml-1">
          {error}
        </Text>
      )}
    </View>
  );
};

export default Input;
