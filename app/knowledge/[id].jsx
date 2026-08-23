import React from "react";
import { View, Text, ScrollView, Pressable, SafeAreaView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Tag from "../../components/ui/Tag";
import LoadingState from "../../components/ui/LoadingState";
import useKnowledge from "../../hooks/useKnowledge";
import { formatDate } from "../../utils/formatting";

export default function KnowledgeDetailScreen() {
  const { id } = useLocalSearchParams();
  const { useGetItemDetail, toggleFavorite } = useKnowledge();
  const { data: item, isLoading, error } = useGetItemDetail(id);

  if (isLoading) {
    return <LoadingState message="Fetching item details..." fullScreen />;
  }

  if (error || !item) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center p-6">
        <Text className="text-white text-center text-base font-bold mb-4">
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
    <SafeAreaView className="flex-1 bg-background">
      {/* Detail Header */}
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-border/40 bg-surface">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </Pressable>
        <Text className="text-white text-sm font-bold uppercase tracking-wider">
          {contentType} detail
        </Text>
        <Pressable onPress={handleFavoriteToggle} className="p-1">
          <Ionicons
            name={isFavorite ? "star" : "star-outline"}
            size={20}
            color={isFavorite ? colors.warning : "#FFFFFF"}
          />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
        {/* Core Title Info */}
        <View className="mb-5">
          <View className="flex-row items-center mb-2">
            <Ionicons name={getHeaderIcon()} size={16} color={colors.primaryLight} className="mr-2" />
            <Text className="text-text-muted text-[10px] font-bold uppercase tracking-widest">
              Created {formatDate(createdAt)}
            </Text>
          </View>
          <Text className="text-white text-xl font-black mb-3 leading-snug">
            {title}
          </Text>

          {/* Project & Tag Badges */}
          <View className="flex-row flex-wrap gap-1.5 items-center">
            <View className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-full flex-row items-center mr-1.5">
              <Ionicons name="folder-outline" size={10} color={colors.primaryLight} className="mr-1" />
              <Text className="text-primary-light text-[9px] font-bold uppercase tracking-wider">{project}</Text>
            </View>
            {tags.map((tag) => (
              <Tag key={tag} text={tag} />
            ))}
          </View>
        </View>

        {/* AI Summary Section */}
        <Text className="text-white text-xs font-bold uppercase tracking-widest mb-2.5">
          AI Summary
        </Text>
        <Card className="p-4 mb-5 border-l-4 border-l-primary bg-primary/5">
          <Text className="text-text-secondary text-xs leading-relaxed font-medium">
            {summary}
          </Text>
        </Card>

        {/* Key Points Checklist */}
        {keyPoints && keyPoints.length > 0 && (
          <View className="mb-5">
            <Text className="text-white text-xs font-bold uppercase tracking-widest mb-2.5">
              Key Insights
            </Text>
            <Card className="p-4">
              {keyPoints.map((point, index) => (
                <View key={index} className="flex-row items-start mb-2.5 last:mb-0">
                  <Ionicons name="checkmark-circle-outline" size={14} color={colors.success} className="mr-2.5 mt-0.5" />
                  <Text className="text-text-secondary text-xs flex-1 leading-normal font-medium">
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
            <Text className="text-white text-xs font-bold uppercase tracking-widest mb-2.5">
              Identified Tech Stack
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {technologies.map((tech) => (
                <View key={tech} className="bg-surface border border-border px-3 py-1.5 rounded-xl items-center flex-row">
                  <Ionicons name="hardware-chip-outline" size={12} color={colors.accent} className="mr-1.5" />
                  <Text className="text-white text-[10px] font-bold">{tech}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Original Content block */}
        <Text className="text-white text-xs font-bold uppercase tracking-widest mb-2.5">
          Original Payload
        </Text>
        <Card className="p-4 bg-surface-hover mb-5">
          <Text
            selectable
            className="text-text-secondary text-xs leading-relaxed font-mono"
            style={{ fontFamily: Platform.OS === "ios" ? "CourierNewPSMT" : "monospace" }}
          >
            {rawContent}
          </Text>
        </Card>

        {/* Related Knowledge links */}
        {relatedItems && relatedItems.length > 0 && (
          <View className="mb-10">
            <Text className="text-white text-xs font-bold uppercase tracking-widest mb-2.5">
              Related Connections
            </Text>
            {relatedItems.map((rel) => (
              <Pressable
                key={rel.id}
                onPress={() => router.push(`/knowledge/${rel.id}`)}
                className="mb-2"
              >
                <Card className="p-3 flex-row items-center justify-between border-dashed border border-border/80">
                  <View className="flex-row items-center">
                    <Ionicons name="link-outline" size={14} color={colors.primaryLight} className="mr-2" />
                    <Text className="text-white text-xs font-bold">{rel.title}</Text>
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
import { Platform } from "react-native";
