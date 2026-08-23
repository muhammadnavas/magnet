import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useKnowledgeStore from "../store/knowledgeStore";
import api from "../lib/api";

export const useKnowledge = () => {
  const queryClient = useQueryClient();
  const store = useKnowledgeStore();

  // Fetch list of items
  const useGetItems = (filters) => {
    return useQuery({
      queryKey: ["knowledge", "list", filters],
      queryFn: async () => {
        try {
          const response = await api.get("/knowledge", { params: filters });
          return response.data;
        } catch (e) {
          console.warn("Backend offline or error fetching knowledge. Using store cache.");
          return store.getFilteredItems();
        }
      },
      initialData: store.getFilteredItems(),
    });
  };

  // Fetch single item detail
  const useGetItemDetail = (id) => {
    return useQuery({
      queryKey: ["knowledge", "detail", id],
      queryFn: async () => {
        try {
          const response = await api.get(`/knowledge/${id}`);
          return response.data;
        } catch (e) {
          // Fallback to store matching item
          const localItem = store.items.find(item => item.id === id);
          if (!localItem) throw new Error("Item not found in local cache");
          return localItem;
        }
      },
      enabled: !!id,
    });
  };

  // Add new item mutation
  const addItemMutation = useMutation({
    mutationFn: async (itemData) => {
      try {
        const response = await api.post("/knowledge/upload", itemData);
        return response.data;
      } catch (err) {
        console.warn("Backend offline. Saving item locally in store.");
        // Add locally
        store.addKnowledgeItem(itemData);
        return { success: true, local: true, item: itemData };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", "list"] });
    },
  });

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: async (id) => {
      try {
        const response = await api.patch(`/knowledge/${id}`, { is_favorite: true });
        return response.data;
      } catch (err) {
        store.toggleFavorite(id);
        return { success: true, local: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    },
  });

  // Archive mutation
  const archiveItemMutation = useMutation({
    mutationFn: async (id) => {
      try {
        const response = await api.patch(`/knowledge/${id}`, { is_archived: true });
        return response.data;
      } catch (err) {
        store.archiveItem(id);
        return { success: true, local: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    },
  });

  return {
    useGetItems,
    useGetItemDetail,
    addItem: addItemMutation.mutate,
    isAdding: addItemMutation.isPending,
    toggleFavorite: toggleFavoriteMutation.mutate,
    archiveItem: archiveItemMutation.mutate,
    items: store.items,
    projects: store.projects,
    tags: store.tags,
  };
};

export default useKnowledge;
