import React from "react";
import { View, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";

export const SearchBar = ({
  value,
  onChangeText,
  placeholder = "Search your Orio brain...",
  onClear,
  style = "",
  ...props
}) => {
  return (
    <View className={`flex-row items-center bg-surface border border-border rounded-xl px-3 py-1 h-11 w-full ${style}`}>
      <Ionicons name="search" size={18} color={colors.text.secondary} className="mr-2" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        className="flex-1 text-white text-sm h-full"
        style={{ paddingVertical: 0 }}
        {...props}
      />
      {value && value.length > 0 ? (
        <TouchableOpacity
          onPress={onClear || (() => onChangeText(""))}
          activeOpacity={0.7}
          className="p-1"
        >
          <Ionicons name="close-circle" size={16} color={colors.text.secondary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export default SearchBar;
