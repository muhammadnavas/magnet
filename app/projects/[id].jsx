import React from "react";
import { View, Text, Pressable, SafeAreaView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import Button from "../../components/ui/Button";

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams();

  return (
    <SafeAreaView className="flex-1 bg-background justify-center items-center p-6">
      <View className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center mb-4">
        <Ionicons name="folder-open" size={32} color={colors.primaryLight} />
      </View>
      <Text className="text-white text-lg font-bold mb-1 text-center">
        Project Details
      </Text>
      <Text className="text-text-secondary text-xs text-center mb-6 max-w-[240px]">
        Project ID: {id}. Database relationships, repository sources, and file categorization will be wired up during Phase 4.
      </Text>
      <Button onPress={() => router.back()}>Go Back</Button>
    </SafeAreaView>
  );
}
