import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
    sourceUrl: item.source_url || item.sourceUrl || "",
    filePath: item.file_path || item.filePath || "",
    meta: item.meta || {},
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

export const useKnowledge = () => {
  const queryClient = useQueryClient();
  const store = useKnowledgeStore();

  const useGetItems = (filters) => {
    return useQuery({
      queryKey: ["knowledge", "list", filters],
      queryFn: async () => {
        try {
          const response = await api.get("/knowledge", { params: filters });
          const normalized = response.data.map(normalizeItem).filter(Boolean);
          useKnowledgeStore.setState({ items: normalized });
          return normalized;
        } catch (e) {
          console.warn("Backend offline or error fetching knowledge. Using store cache.");
          return store.getFilteredItems();
        }
      },
      initialData: store.getFilteredItems(),
    });
  };

  const useGetItemDetail = (id) => {
    return useQuery({
      queryKey: ["knowledge", "detail", id],
      queryFn: async () => {
        try {
          const response = await api.get(`/knowledge/${id}`);
          const normalized = normalizeItem(response.data);
          useKnowledgeStore.setState((state) => ({
            items: state.items.map((item) => (item.id === id ? normalized : item)),
          }));
          return normalized;
        } catch (e) {
          const localItem = store.items.find((item) => item.id === id);
          if (!localItem) throw new Error("Item not found in local cache");
          return localItem;
        }
      },
      enabled: !!id,
    });
  };

  const addItemMutation = useMutation({
    mutationFn: async (itemData) => {
      await store.addKnowledgeItem(itemData);
      return { success: true };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge"] }),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async (id) => {
      await store.toggleFavorite(id);
      return { success: true };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge"] }),
  });

  const archiveItemMutation = useMutation({
    mutationFn: async (id) => {
      await store.archiveItem(id);
      return { success: true };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge"] }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id) => {
      await store.deleteItem(id);
      return { success: true };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["knowledge"] }),
  });

  return {
    useGetItems,
    useGetItemDetail,
    addItem: addItemMutation.mutate,
    isAdding: addItemMutation.isPending,
    toggleFavorite: toggleFavoriteMutation.mutate,
    archiveItem: archiveItemMutation.mutate,
    deleteItem: deleteItemMutation.mutate,
    items: store.items,
    projects: store.projects,
    tags: store.tags,
    fetchItems: store.fetchItems,
    syncOfflineQueue: store.syncOfflineQueue,
  };
};

export default useKnowledge;
