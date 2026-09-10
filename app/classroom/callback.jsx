import React, { useEffect } from "react";
import { View, Text } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

/**
 * Handles the orio://classroom/callback deep-link that Google redirects to
 * after OAuth authorization. The actual callback processing is done by the
 * listener in classroom/index.jsx — this screen simply navigates back to it.
 */
export default function ClassroomCallbackScreen() {
  const params = useLocalSearchParams();

  useEffect(() => {
    // Navigate back to the classroom screen so its deep-link listener can pick up the params
    router.replace("/classroom");
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#888", fontSize: 14 }}>Connecting to Google Classroom...</Text>
    </View>
  );
}
