import React, { useState } from "react";
import { View, Text, ScrollView, FlatList, Pressable, SafeAreaView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "../../constants/colors";
import SearchBar from "../../components/ui/SearchBar";
import Tag from "../../components/ui/Tag";
import EmptyState from "../../components/ui/EmptyState";
import KnowledgeCard from "../../components/knowledge/KnowledgeCard";
import useKnowledgeStore from "../../store/knowledgeStore";
import useSearch from "../../hooks/useSearch";

const CONTENT_TYPE_FILTERS = [
  "All",
  "Notes",
  "PDFs",
  "Images",
  "Code",
  "URLs",
  "Errors",
];

export default function KnowledgeScreen() {
  const store = useKnowledgeStore();
  const { searchQuery, setSearchQuery } = useSearch();
  const [showAdvanceFilters, setShowAdvanceFilters] = useState(false);

  const filteredItems = store.getFilteredItems();

  const handleTypeSelect = (type) => {
    store.setFilters({ contentType: type });
  };

  const handleProjectSelect = (project) => {
    store.setFilters({ project: project });
  };

  const handleTagSelect = (tag) => {
    store.setFilters({ tag: tag });
  };

  const clearAllFilters = () => {
    store.resetFilters();
    setSearchQuery("");
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Top Search Banner */}
      <View className="px-5 pt-4 pb-2 border-b border-border/40">
        <Text className="text-white text-lg font-black mb-3">
          Knowledge Library
        </Text>
        <View className="flex-row items-center">
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            style="flex-1"
          />
          <Pressable
            onPress={() => setShowAdvanceFilters(!showAdvanceFilters)}
            className={`w-11 h-11 rounded-xl items-center justify-center ml-2 border ${
              showAdvanceFilters
                ? "bg-primary/10 border-primary"
                : "bg-surface border-border"
            }`}
          >
            <Ionicons
              name={showAdvanceFilters ? "funnel" : "funnel-outline"}
              size={18}
              color={showAdvanceFilters ? colors.primaryLight : colors.text.secondary}
            />
          </Pressable>
        </View>

        {/* Content Type Filter Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row mt-4 mb-2 -mx-5 px-5"
        >
          {CONTENT_TYPE_FILTERS.map((filter) => {
            const isSelected = store.filters.contentType === filter;
            return (
              <Pressable
                key={filter}
                onPress={() => handleTypeSelect(filter)}
                className={`px-4 py-1.5 rounded-full mr-2 border ${
                  isSelected
                    ? "bg-primary border-primary"
                    : "bg-surface border-border"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    isSelected ? "text-white" : "text-text-secondary"
                  }`}
                >
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Advanced Filters Drawer */}
      {showAdvanceFilters && (
        <View className="bg-surface border-b border-border p-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white text-xs font-bold uppercase tracking-wider">
              Filter by Metadata
            </Text>
            <Pressable onPress={clearAllFilters}>
              <Text className="text-error text-xs font-semibold">Clear All</Text>
            </Pressable>
          </View>

          {/* Project Filtering */}
          <Text className="text-text-muted text-[10px] font-bold uppercase tracking-wider mb-2">
            Project
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
            <Pressable
              onPress={() => handleProjectSelect("All")}
              className={`px-3 py-1 rounded-lg mr-1.5 border ${
                store.filters.project === "All" ? "bg-primary/20 border-primary" : "bg-background border-border"
              }`}
            >
              <Text className="text-white text-[10px] font-bold">ALL PROJECTS</Text>
            </Pressable>
            {store.projects.map((proj) => {
              const isSelected = store.filters.project === proj;
              return (
                <Pressable
                  key={proj}
                  onPress={() => handleProjectSelect(proj)}
                  className={`px-3 py-1 rounded-lg mr-1.5 border ${
                    isSelected ? "bg-primary/20 border-primary" : "bg-background border-border"
                  }`}
                >
                  <Text className="text-white text-[10px] font-semibold">{proj}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Tag Filtering */}
          <Text className="text-text-muted text-[10px] font-bold uppercase tracking-wider mb-2">
            Tag
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            <Pressable
              onPress={() => handleTagSelect("All")}
              className={`px-3 py-1 rounded-lg mr-1.5 border ${
                store.filters.tag === "All" ? "bg-primary/20 border-primary" : "bg-background border-border"
              }`}
            >
              <Text className="text-white text-[10px] font-bold">ALL TAGS</Text>
            </Pressable>
            {store.tags.map((tag) => {
              const isSelected = store.filters.tag === tag;
              return (
                <Pressable
                  key={tag}
                  onPress={() => handleTagSelect(tag)}
                  className={`px-3 py-1 rounded-lg mr-1.5 border ${
                    isSelected ? "bg-primary/20 border-primary" : "bg-background border-border"
                  }`}
                >
                  <Text className="text-white text-[10px] font-semibold">#{tag}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Main List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <KnowledgeCard item={item} />}
        contentContainerStyle={{ padding: 20, flexGrow: 1 }}
        ListEmptyComponent={
          <EmptyState
            title="Library is empty"
            description="No items match your active filters or search criteria. Try modifying your settings."
            actionLabel="Reset Filters"
            onActionPress={clearAllFilters}
          />
        }
      />
    </SafeAreaView>
  );
}
