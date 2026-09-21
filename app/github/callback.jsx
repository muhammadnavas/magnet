import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function GithubCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    const connected = params.connected === "true";
    const error = typeof params.error === "string" ? params.error : "";

    if (connected) {
      setDialog({
        type: "success",
        title: "GitHub Connected",
        message: "Your GitHub account is now connected to Magnet.",
      });
      return;
    }

    if (error) {
      setDialog({
        type: "error",
        title: "GitHub Connection Failed",
        message: error,
      });
      return;
    }

    router.replace("/(tabs)/profile");
  }, [params.connected, params.error, router]);

  const closeDialog = () => {
    setDialog(null);
    router.replace("/(tabs)/profile");
  };

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0A0A0F" }}>
      <ActivityIndicator size="large" color="#6C63FF" />
      <Text style={{ color: "#FFFFFF", marginTop: 14, fontWeight: "700" }}>
        Completing GitHub connection...
      </Text>

      <Modal visible={Boolean(dialog)} transparent animationType="fade" onRequestClose={closeDialog}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, backgroundColor: "rgba(0,0,0,0.72)" }}>
          <View style={{ width: "100%", maxWidth: 390, backgroundColor: "#17171F", borderRadius: 24, padding: 24, borderWidth: 1, borderColor: "#2A2A38" }}>
            <View style={{ width: 54, height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: dialog?.type === "success" ? "#10B98120" : "#EF444420", marginBottom: 18 }}>
              <Ionicons
                name={dialog?.type === "success" ? "checkmark-circle" : "alert-circle"}
                size={30}
                color={dialog?.type === "success" ? "#10B981" : "#EF4444"}
              />
            </View>

            <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginBottom: 8 }}>
              {dialog?.title}
            </Text>
            <Text style={{ color: "#A1A1B2", fontSize: 14, lineHeight: 21 }}>
              {dialog?.message}
            </Text>

            <Pressable onPress={closeDialog} style={{ marginTop: 24, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#6C63FF" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "800" }}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
