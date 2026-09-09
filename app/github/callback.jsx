import React, { useEffect } from "react";
import { Alert, ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function GithubCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const connected = params.connected === "true";
    const error = typeof params.error === "string" ? params.error : "";

    if (connected) {
      Alert.alert("GitHub Connected", "Your GitHub account is now connected to Orio.", [
        { text: "OK", onPress: () => router.replace("/(tabs)/profile") },
      ]);
      return;
    }

    if (error) {
      Alert.alert("GitHub Connection Failed", error, [
        { text: "OK", onPress: () => router.replace("/(tabs)/profile") },
      ]);
      return;
    }

    router.replace("/(tabs)/profile");
  }, [params.connected, params.error, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0A0A0F" }}>
      <ActivityIndicator size="large" color="#6C63FF" />
      <Text style={{ color: "#FFFFFF", marginTop: 14, fontWeight: "700" }}>
        Completing GitHub connection...
      </Text>
    </View>
  );
}
