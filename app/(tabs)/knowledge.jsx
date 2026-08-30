import React, { useState } from "react";
import { View, Text, ScrollView, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import SearchBar from "../../components/ui/SearchBar";
import Tag from "../../components/ui/Tag";
import EmptyState from "../../components/ui/EmptyState";
import KnowledgeCard from "../../components/knowledge/KnowledgeCard";
import useKnowledgeStore from "../../store/knowledgeStore";
import useSearch from "../../hooks/useSearch";
import useThemeStore from "../../store/themeStore";

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
  const { colors: themeColors } = useThemeStore();
  const { searchQuery, setSearchQuery } = useSearch();
  const [showAdvanceFilters, setShowAdvanceFilters] = useState(false);

  const filteredItems = store.getFilteredItems();

  const handleTypeSelect = (type) => {
    store.setFilters({ contentType: type });
  };

  const clearAllFilters = () => {
    store.resetFilters();
    setSearchQuery("");
  };

  return (
    <SafeAreaView style={{ backgroundColor: themeColors.background }} className="flex-1">
      {/* Top Search Banner */}
      <View style={{ borderBottomColor: themeColors.border }} className="px-5 pt-4 pb-2 border-b">
        <Text style={{ color: themeColors.text.primary }} className="text-xl font-black mb-3">
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
            style={{
              backgroundColor: showAdvanceFilters ? `${themeColors.primary}20` : themeColors.card,
              borderColor: showAdvanceFilters ? themeColors.primary : themeColors.border,
            }}
            className="w-12 h-12 rounded-xl border items-center justify-center ml-2"
          >
            <Ionicons
              name="filter"
              size={20}
              color={showAdvanceFilters ? themeColors.primary : themeColors.text.secondary}
            />
          </Pressable>
        </View>

        {/* Content Type Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="py-3"
          contentContainerStyle={{ paddingRight: 20 }}
        >
          {CONTENT_TYPE_FILTERS.map((filter) => {
            const filterValue = filter === "All" ? null : filter.toLowerCase().replace("s", "");
            const isSelected = store.filters.contentType === filterValue;

            return (
              <Pressable
                key={filter}
                onPress={() => handleTypeSelect(filterValue)}
                style={{
                  backgroundColor: isSelected ? themeColors.primary : themeColors.card,
                  borderColor: isSelected ? themeColors.primary : themeColors.border,
                }}
                className="px-4 py-2 rounded-full border mr-2"
              >
                <Text
                  style={{ color: isSelected ? "#FFFFFF" : themeColors.text.secondary }}
                  className="text-xs font-bold"
                >
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Knowledge Item List */}
      {filteredItems.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6">
          <EmptyState
            title="Library is empty"
            description="No items match your active filters or search criteria. Try modifying your settings."
            actionLabel="Reset Filters"
            onAction={clearAllFilters}
          />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <KnowledgeCard item={item} />}
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
