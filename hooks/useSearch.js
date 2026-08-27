import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import useKnowledgeStore from "../store/knowledgeStore";
import api from "../lib/api";

const normalizeItem = (item) => {
  if (!item) return null;
  return {
    id: item.id,
    title: item.title,
    contentType: item.content_type || item.contentType || "note",
    summary: item.summary || "",
    rawContent: item.raw_content || item.rawContent || "",
    extractedText: item.extracted_text || item.extractedText || "",
    keyPoints: item.key_points || item.keyPoints || [],
    processingStatus: item.processing_status || item.processingStatus || "pending",
    isFavorite: item.is_favorite !== undefined ? item.is_favorite : (item.isFavorite || false),
    isArchived: item.is_archived !== undefined ? item.is_archived : (item.isArchived || false),
    createdAt: item.created_at || item.createdAt || new Date().toISOString(),
    updatedAt: item.updated_at || item.updatedAt || new Date().toISOString(),
    tags: Array.isArray(item.tags)
      ? item.tags.map((t) => (typeof t === "string" ? t : (t && t.name ? t.name : ""))).filter(Boolean)
      : [],
    project: Array.isArray(item.projects) && item.projects.length > 0 && item.projects[0]
      ? (item.projects[0].name || "Personal Projects")
      : (item.project || "Personal Projects"),
    technologies: item.meta?.technologies || item.technologies || [],
  };
};

export const useSearch = (initialQuery = "") => {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const store = useKnowledgeStore();

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      store.setSearchQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  const searchQueryResults = useQuery({
    queryKey: ["search", "results", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return store.getFilteredItems();
      
      try {
        const response = await api.get("/search", { params: { q: debouncedQuery } });
        return response.data.map(normalizeItem).filter(Boolean);
      } catch (e) {
        console.warn("Search backend offline. Filtering local storage.");
        return store.getFilteredItems();
      }
    },
    enabled: true,
  });

  return {
    searchQuery,
    setSearchQuery,
    results: searchQueryResults.data || [],
    isLoading: searchQueryResults.isLoading,
    isError: searchQueryResults.isError,
    refetch: searchQueryResults.refetch,
  };
};

export default useSearch;
