import React, { useState, useEffect, useCallback } from "react";
import { View, FlatList, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import SearchBar from "../../components/ui/SearchBar";
import EmptyState from "../../components/ui/EmptyState";
import KnowledgeCard from "../../components/knowledge/KnowledgeCard";
import useKnowledgeStore from "../../store/knowledgeStore";
import useSearch from "../../hooks/useSearch";
import { useAppTheme } from "../../store/themeStore";

const FILTERS = ["All", "Notes", "PDFs", "Images", "Code", "URLs", "Errors"];

export default function KnowledgeScreen() {
  const store = useKnowledgeStore();
  const { themeColors } = useAppTheme();
  const { searchQuery, setSearchQuery } = useSearch();
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Refresh items on focus
  useFocusEffect(
    useCallback(() => {
      store.fetchItems();
    }, [])
  );

  // Poll for background worker updates when any item is pending or processing
  useEffect(() => {
    const hasActiveJobs = store.items.some(
      (item) => item.processingStatus === "pending" || item.processingStatus === "processing"
    );

    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      store.fetchItems();
    }, 3500);

    return () => clearInterval(interval);
  }, [store.items]);

  const onRefresh = async () => {
    setRefreshing(true);
    await store.fetchItems();
    setRefreshing(false);
  };

  const filteredItems = store.getFilteredItems();

  const clearAll = () => { store.resetFilters(); setSearchQuery(""); };

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1">
      <View style={{ borderBottomColor: themeColors.border }} className="px-5 pt-4 pb-2 border-b">
        <Text style={{ color: themeColors.text.primary }} className="text-xl font-black mb-3">Knowledge Library</Text>
        <View className="flex-row items-center">
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} style="flex-1" />
          <Pressable
            onPress={() => setShowFilters(!showFilters)}
            style={{ backgroundColor: showFilters ? `${themeColors.primary}20` : themeColors.card, borderColor: showFilters ? themeColors.primary : themeColors.border }}
            className="w-12 h-12 rounded-xl border items-center justify-center ml-2"
          >
            <Ionicons name="filter" size={20} color={showFilters ? themeColors.primary : themeColors.text.secondary} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-3" contentContainerStyle={{ paddingRight: 20 }}>
          {FILTERS.map((filter) => {
            const filterValue = filter === "All" ? null : filter.toLowerCase().replace(/s$/, "");
            const isSelected = store.filters?.contentType === filterValue;
            return (
              <Pressable
                key={filter}
                onPress={() => store.setFilters({ contentType: filterValue })}
                style={{ backgroundColor: isSelected ? themeColors.primary : themeColors.card, borderColor: isSelected ? themeColors.primary : themeColors.border }}
                className="px-4 py-2 rounded-full border mr-2"
              >
                <Text style={{ color: isSelected ? "#FFFFFF" : themeColors.text.secondary }} className="text-xs font-bold">{filter}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {filteredItems.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6">
          <EmptyState title="Library is empty" description="No items match your filters. Try modifying your settings." actionLabel="Reset Filters" onActionPress={clearAll} />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <KnowledgeCard item={item} />}
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.primary} colors={[themeColors.primary]} />
          }
        />
      )}
    </SafeAreaView>
  );
}
