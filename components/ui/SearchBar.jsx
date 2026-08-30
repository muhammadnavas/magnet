import React from "react";
import { View, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../store/themeStore";

export const SearchBar = ({ value, onChangeText, placeholder = "Search your Orio brain...", onClear, style = "", ...props }) => {
  const { themeColors } = useAppTheme();

  return (
    <View
      style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }}
      className={`flex-row items-center border rounded-xl px-3 h-12 w-full ${style}`}
    >
      <Ionicons name="search" size={18} color={themeColors.text.muted} style={{ marginRight: 8 }} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={themeColors.text.muted}
        className="flex-1 text-sm h-full"
        style={{ color: themeColors.text.primary, paddingVertical: 0 }}
        {...props}
      />
      {value?.length > 0 && (
        <TouchableOpacity onPress={onClear || (() => onChangeText(""))} activeOpacity={0.7} className="p-1">
          <Ionicons name="close-circle" size={16} color={themeColors.text.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default SearchBar;
