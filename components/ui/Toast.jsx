import React, { useEffect, useRef } from "react";
import { View, Text, Animated, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "../../store/themeStore";

export default function Toast({ visible, title, message, type = "info", onClose }) {
  const { themeColors } = useAppTheme();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onClose) onClose();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: Platform.OS === "ios" ? 50 : 20,
        left: 20,
        right: 20,
        zIndex: 9999,
        transform: [{ translateY }],
        opacity,
      }}
    >
      <View
        style={{
          backgroundColor: themeColors.card,
          borderColor: themeColors.primary,
          borderWidth: 1.5,
          borderRadius: 16,
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <View
          style={{
            backgroundColor: `${themeColors.primary}20`,
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          <Ionicons name="notifications" size={20} color={themeColors.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: themeColors.text.primary, fontSize: 14, fontWeight: "800", marginBottom: 2 }}>
            {title}
          </Text>
          {message ? (
            <Text style={{ color: themeColors.text.secondary, fontSize: 12, fontWeight: "500" }}>
              {message}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity onPress={hideToast} style={{ padding: 4 }}>
          <Ionicons name="close" size={18} color={themeColors.text.muted} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
