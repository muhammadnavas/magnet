import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Platform, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Tag from "../../components/ui/Tag";
import LoadingState from "../../components/ui/LoadingState";
import useKnowledge from "../../hooks/useKnowledge";
import { formatDate } from "../../utils/formatting";
import { useAppTheme } from "../../store/themeStore";

export default function KnowledgeDetailScreen() {
  const { id } = useLocalSearchParams();
  const { useGetItemDetail, toggleFavorite, deleteItem } = useKnowledge();
  const { data: item, isLoading, error } = useGetItemDetail(id);
  const { themeColors } = useAppTheme();
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (isLoading) {
    return <LoadingState message="Fetching item details..." fullScreen />;
  }

  if (error || !item) {
    return (
      <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1 justify-center p-6" edges={["top", "left", "right"]}>
        <Text style={{ color: themeColors.text.primary }} className="text-center text-base font-bold mb-4">
          Error Loading Item
        </Text>
        <Button onPress={() => router.back()}>Go Back</Button>
      </SafeAreaView>
    );
  }

  const { title, contentType, summary, tags, technologies, project, createdAt, rawContent, keyPoints = [], relatedItems = [], isFavorite } = item;

  const handleFavoriteToggle = () => {
    toggleFavorite(id);
  };

  const handleDelete = () => {
    deleteItem(id, { onSuccess: () => router.back() });
  };

  const getHeaderIcon = () => {
    switch (contentType?.toLowerCase()) {
      case "pdf": return "document-text";
      case "code": return "code-working";
      case "error": return "bug";
      case "url": return "link";
      case "note":
      default:
        return "pencil";
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1" edges={["top", "left", "right"]}>
      
      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade">
        <View style={{ backgroundColor: "rgba(0,0,0,0.5)" }} className="flex-1 justify-center items-center px-6">
          <View style={{ backgroundColor: themeColors.card, borderColor: themeColors.border }} className="w-full max-w-sm rounded-3xl p-6 border shadow-xl">
            <View style={{ backgroundColor: `${themeColors.error || "#EF4444"}15` }} className="w-14 h-14 rounded-full items-center justify-center self-center mb-4">
              <Ionicons name="warning" size={28} color={themeColors.error || "#EF4444"} />
            </View>
            <Text style={{ color: themeColors.text.primary }} className="text-xl font-black text-center mb-2">Delete Item?</Text>
            <Text style={{ color: themeColors.text.secondary }} className="text-sm text-center mb-6 leading-relaxed">
              Are you sure you want to permanently delete this item? This action cannot be undone.
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowDeleteConfirm(false)}
                style={{ backgroundColor: themeColors.surfaceHover }}
                className="flex-1 py-3.5 rounded-2xl items-center"
              >
                <Text style={{ color: themeColors.text.primary }} className="font-bold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                style={{ backgroundColor: themeColors.error || "#EF4444" }}
                className="flex-1 py-3.5 rounded-2xl items-center"
              >
                <Text className="font-bold text-white">Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Detail Header */}
      <View style={{ backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }} className="flex-row items-center justify-between px-5 py-3 border-b">
        <Pressable onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} className="p-1 -ml-1">
          <Ionicons name="arrow-back" size={22} color={themeColors.text.primary} />
        </Pressable>
        <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold uppercase tracking-wider text-center flex-1 px-2" numberOfLines={1}>
          {contentType} detail
        </Text>
        <View className="flex-row items-center gap-2">
          <Pressable 
            onPress={() => setShowDeleteConfirm(true)} 
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ backgroundColor: `${themeColors.error || '#EF4444'}18` }} 
            className="w-9 h-9 rounded-full items-center justify-center"
          >
            <Ionicons name="trash-outline" size={18} color={themeColors.error || "#EF4444"} />
          </Pressable>
          <Pressable 
            onPress={handleFavoriteToggle} 
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ backgroundColor: isFavorite ? `${themeColors.warning}18` : themeColors.surfaceHover }}
            className="w-9 h-9 rounded-full items-center justify-center"
          >
            <Ionicons
              name={isFavorite ? "star" : "star-outline"}
              size={18}
              color={isFavorite ? themeColors.warning : themeColors.text.primary}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Core Title Info */}
        <View className="mb-5">
          <View className="flex-row items-center mb-2">
            <Ionicons name={getHeaderIcon()} size={16} color={themeColors.primaryLight} className="mr-2" />
            <Text style={{ color: themeColors.text.muted }} className="text-[10px] font-bold uppercase tracking-widest">
              Created {formatDate(createdAt)}
            </Text>
          </View>
          <Text style={{ color: themeColors.text.primary }} className="text-xl font-black mb-3 leading-snug">
            {title}
          </Text>

          {/* Project & Tag Badges */}
          <View className="flex-row flex-wrap gap-1.5 items-center">
            <View style={{ backgroundColor: `${themeColors.primary}18`, borderColor: `${themeColors.primary}30` }} className="border px-3 py-1 rounded-full flex-row items-center mr-1.5">
              <Ionicons name="folder-outline" size={10} color={themeColors.primaryLight} className="mr-1" />
              <Text style={{ color: themeColors.primaryLight }} className="text-[9px] font-bold uppercase tracking-wider">{project}</Text>
            </View>
            {displayTags.map((tag) => (
              <Tag key={tag} text={tag} />
            ))}
          </View>
        </View>

        {/* AI Summary Section */}
        <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold uppercase tracking-widest mb-2.5">
          AI Summary
        </Text>
        <Card style={{ backgroundColor: `${themeColors.primary}10`, borderLeftColor: themeColors.primary, borderLeftWidth: 4 }} className="p-4 mb-5">
          <Text style={{ color: themeColors.text.secondary }} className="text-xs leading-relaxed font-medium">
            {summary}
          </Text>
        </Card>

        {/* Key Points Checklist */}
        {keyPoints && keyPoints.length > 0 && (
          <View className="mb-5">
            <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold uppercase tracking-widest mb-2.5">
              Key Insights
            </Text>
            <Card className="p-4">
              {keyPoints.map((point, index) => (
                <View key={index} className="flex-row items-start mb-2.5 last:mb-0">
                  <Ionicons name="checkmark-circle-outline" size={14} color={themeColors.success} className="mr-2.5 mt-0.5" />
                  <Text style={{ color: themeColors.text.secondary }} className="text-xs flex-1 leading-normal font-medium">
                    {point}
                  </Text>
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Technologies / Entities Extracted */}
        {technologies && technologies.length > 0 && (
          <View className="mb-5">
            <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold uppercase tracking-widest mb-2.5">
              Identified Tech Stack
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {technologies.map((tech) => (
                <View key={tech} style={{ backgroundColor: themeColors.surface, borderColor: themeColors.border }} className="border px-3 py-1.5 rounded-xl items-center flex-row">
                  <Ionicons name="hardware-chip-outline" size={12} color={themeColors.accent} className="mr-1.5" />
                  <Text style={{ color: themeColors.text.primary }} className="text-[10px] font-bold">{tech}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Original Content block */}
        <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold uppercase tracking-widest mb-2.5">
          Original Payload
        </Text>
        <Card style={{ backgroundColor: themeColors.surfaceHover }} className="p-4 mb-5">
          <Text
            selectable
            style={{ color: themeColors.text.secondary, fontFamily: Platform.OS === "ios" ? "CourierNewPSMT" : "monospace" }}
            className="text-xs leading-relaxed font-mono"
          >
            {rawContent}
          </Text>
        </Card>

        {/* Related Knowledge links */}
        {relatedItems && relatedItems.length > 0 && (
          <View className="mb-10">
            <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold uppercase tracking-widest mb-2.5">
              Related Connections
            </Text>
            {relatedItems.map((rel) => (
              <Pressable
                key={rel.id}
                onPress={() => router.push(`/knowledge/${rel.id}`)}
                className="mb-2"
              >
                <Card style={{ borderStyle: 'dashed' }} className="p-3 flex-row items-center justify-between border">
                  <View className="flex-row items-center">
                    <Ionicons name="link-outline" size={14} color={themeColors.primaryLight} className="mr-2" />
                    <Text style={{ color: themeColors.text.primary }} className="text-xs font-bold">{rel.title}</Text>
                  </View>
                  <Tag text={rel.type} />
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
