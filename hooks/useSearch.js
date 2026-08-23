import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import useKnowledgeStore from "../store/knowledgeStore";
import api from "../lib/api";

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
        return response.data;
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
