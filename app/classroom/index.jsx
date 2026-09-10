import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import Card from "../../components/ui/Card";
import { useAppTheme } from "../../store/themeStore";

const STATUS_CARDS = [
  { label: "New", value: "0", icon: "sparkles-outline" },
  { label: "Due soon", value: "0", icon: "time-outline" },
  { label: "Overdue", value: "0", icon: "alert-circle-outline" },
];

export default function ClassroomScreen() {
  const { themeColors } = useAppTheme();

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1">
      <ScrollView className="flex-1 px-5 pt-5" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center mb-6">
          <Pressable
            onPress={() => router.back()}
            style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }}
            className="w-10 h-10 rounded-xl border items-center justify-center mr-3"
          >
            <Ionicons name="arrow-back" size={20} color={themeColors.text.primary} />
          </Pressable>
          <View className="flex-1">
            <Text style={{ color: themeColors.primary }} className="text-xs font-bold uppercase tracking-widest mb-1">
              College
            </Text>
            <Text style={{ color: themeColors.text.primary }} className="text-2xl font-black">
              Google Classroom
            </Text>
          </View>
          <View style={{ backgroundColor: themeColors.surfaceHover }} className="w-10 h-10 rounded-xl items-center justify-center">
            <Ionicons name="school-outline" size={21} color={themeColors.primary} />
          </View>
        </View>

        <Card className="p-5 mb-5">
          <View className="flex-row items-center">
            <View style={{ backgroundColor: `${themeColors.primary}18`, borderColor: `${themeColors.primary}35` }} className="w-12 h-12 rounded-2xl border items-center justify-center mr-4">
              <Ionicons name="school" size={23} color={themeColors.primary} />
            </View>
            <View className="flex-1">
              <Text style={{ color: themeColors.text.primary }} className="text-base font-extrabold">
                Stay on top of college work
              </Text>
              <Text style={{ color: themeColors.text.secondary }} className="text-xs leading-5 mt-1">
                Orio will turn Classroom assignments into clear tasks with deadlines and useful summaries.
              </Text>
            </View>
          </View>
        </Card>

        <View className="flex-row gap-2 mb-7">
          {STATUS_CARDS.map((item) => (
            <View key={item.label} style={{ flex: 1, backgroundColor: themeColors.card, borderColor: themeColors.border }} className="border rounded-2xl p-3">
              <Ionicons name={item.icon} size={17} color={themeColors.primary} />
              <Text style={{ color: themeColors.text.primary }} className="text-xl font-black mt-2">{item.value}</Text>
              <Text style={{ color: themeColors.text.muted }} className="text-[10px] font-bold mt-1">{item.label}</Text>
            </View>
          ))}
        </View>

        <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider mb-3">
          Needs Attention
        </Text>
        <Card className="p-6 mb-7 items-center">
          <View style={{ backgroundColor: themeColors.surfaceHover }} className="w-14 h-14 rounded-2xl items-center justify-center mb-3">
            <Ionicons name="checkmark-done-outline" size={27} color={themeColors.primary} />
          </View>
          <Text style={{ color: themeColors.text.primary }} className="text-base font-extrabold text-center">
            Nothing needs attention
          </Text>
          <Text style={{ color: themeColors.text.muted }} className="text-xs text-center leading-5 mt-1">
            New and upcoming assignments will appear here once Google Classroom is connected.
          </Text>
        </Card>

        <View className="flex-row items-center justify-between mb-3">
          <Text style={{ color: themeColors.text.muted }} className="text-xs font-bold uppercase tracking-wider">
            Recent Assignments
          </Text>
          <Text style={{ color: themeColors.text.muted }} className="text-[10px] font-semibold">
            Synced from Classroom
          </Text>
        </View>
        <Card className="p-5 mb-10">
          <View className="flex-row items-center">
            <Ionicons name="document-text-outline" size={21} color={themeColors.text.muted} style={{ marginRight: 12 }} />
            <Text style={{ color: themeColors.text.secondary }} className="text-xs flex-1 leading-5">
              Your assignments, AI summaries and Orio task links will appear here.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
