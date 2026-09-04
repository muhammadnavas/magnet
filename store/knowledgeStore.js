import { create } from "zustand";
import { Platform } from "react-native";
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
    technologies: item.meta?.technologies || item.technologies || [],
  };
};

const deduplicateById = (arr) => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  return arr.filter((item) => {
    if (!item || !item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export const useKnowledgeStore = create((set, get) => ({
  items: [],
  projects: ["Email Scheduler", "AI Interviewer", "Personal Projects", "AURA", "Nudi LLM"],
  tags: ["docker", "devops", "containers", "redis", "caching", "performance", "fastapi", "sqlalchemy", "postgres", "errors", "debugging", "rag", "llm", "ai"],
  filters: {
    contentType: "All",
    project: "All",
    tag: "All",
  },
  searchQuery: "",
  offlineQueue: [],
  syncStatus: "synced", // synced, syncing, offline

  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setFilters: (newFilters) => set((state) => ({ 
    filters: { ...state.filters, ...newFilters } 
  })),

  resetFilters: () => set({
    filters: { contentType: "All", project: "All", tag: "All" },
    searchQuery: ""
  }),

  fetchItems: async () => {
    set({ syncStatus: "syncing" });
    try {
      const response = await api.get("/knowledge");
      const normalized = response.data.map(normalizeItem).filter(Boolean);
      
      // Update dynamic project and tag lists based on loaded items
      const dynamicTags = [
        ...new Set(normalized.flatMap((item) => item.tags))
      ].filter(Boolean);
      
      const dynamicProjects = [
        ...new Set(normalized.map((item) => item.project))
      ].filter(Boolean);

      set({
        items: deduplicateById(normalized),
        tags: dynamicTags.length > 0 ? dynamicTags : get().tags,
        projects: dynamicProjects.length > 0 ? dynamicProjects : get().projects,
        syncStatus: "synced",
      });
    } catch (e) {
      console.error("Failed to fetch knowledge items", e);
      set({ syncStatus: "offline" });
    }
  },

  addKnowledgeItem: async (item) => {
    const isOnline = get().syncStatus !== "offline";
    
    // Construct FormData for multipart upload
    const formData = new FormData();
    formData.append("title", item.title || "Untitled Item");
    formData.append("content_type", item.contentType || "note");
    
    if (item.rawContent) formData.append("raw_content", item.rawContent);
    if (item.project) formData.append("project", item.project);
    
    if (item.tags) {
      const tagsStr = Array.isArray(item.tags) ? item.tags.join(",") : item.tags;
      formData.append("tags", tagsStr);
    }
    
    if (item.file) {
      if (Platform.OS === "web") {
        if (typeof File !== "undefined" && item.file.file instanceof File) {
          formData.append("file", item.file.file, item.file.name || "upload.pdf");
        } else if (item.file.uri) {
          try {
            const resp = await fetch(item.file.uri);
            const blob = await resp.blob();
            formData.append("file", blob, item.file.name || "upload.pdf");
          } catch (e) {
            console.error("Failed to convert web uri to blob:", e);
          }
        }
      } else {
        formData.append("file", {
          uri: item.file.uri,
          name: item.file.name || "upload.pdf",
          type: item.file.type || item.file.mimeType || "application/pdf"
        });
      }
    }


    if (!isOnline) {
      // Save offline and serialize content properties
      const serializedItem = {
        title: item.title,
        contentType: item.contentType || "note",
        rawContent: item.rawContent,
        project: item.project,
        tags: Array.isArray(item.tags) ? item.tags : (item.tags ? item.tags.split(",") : [])
      };
      
      get().queueOfflineCapture({ operation: "create", payload: serializedItem });
      
      // Add optimistically to local items list
      const mockOfflineItem = {
        id: `offline-${Math.random()}`,
        processingStatus: "pending",
        createdAt: new Date().toISOString(),
        isFavorite: false,
        isArchived: false,
        ...serializedItem,
        summary: "Item captured offline. Will be processed once online.",
        keyPoints: [],
        technologies: []
      };
      
      set((state) => ({
        items: [mockOfflineItem, ...state.items]
      }));
      return;
    }

    set({ syncStatus: "syncing" });
    try {
      const response = await api.post("/knowledge/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      
      const normalized = normalizeItem(response.data);
      set((state) => ({
        items: deduplicateById([normalized, ...state.items]),
        syncStatus: "synced",
      }));
      
      // Refresh to ensure tags and lists are aligned
      await get().fetchItems();
    } catch (e) {
      console.error("Failed to upload knowledge item, queueing offline", e);
      // Fallback: Queue offline sync
      const fallbackPayload = {
        title: item.title,
        contentType: item.contentType || "note",
        rawContent: item.rawContent,
        project: item.project,
        tags: Array.isArray(item.tags) ? item.tags : (item.tags ? item.tags.split(",") : [])
      };
      get().queueOfflineCapture({ operation: "create", payload: fallbackPayload });
    }
  },

  toggleFavorite: async (id) => {
    // Optimistic toggle
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
      ),
    }));

    const updatedItem = get().items.find((i) => i.id === id);
    if (!updatedItem) return;

    try {
      await api.patch(`/knowledge/${id}`, { is_favorite: updatedItem.isFavorite });
    } catch (e) {
      console.error("Failed to sync favorite patch, queueing offline", e);
      get().queueOfflineCapture({
        operation: "update",
        payload: { id, isFavorite: updatedItem.isFavorite },
      });
    }
  },

  archiveItem: async (id) => {
    // Optimistic archive
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, isArchived: true } : item
      ),
    }));

    try {
      await api.patch(`/knowledge/${id}`, { is_archived: true });
    } catch (e) {
      console.error("Failed to sync archive patch, queueing offline", e);
      get().queueOfflineCapture({
        operation: "update",
        payload: { id, isArchived: true },
      });
    }
  },

  deleteItem: async (id) => {
    // Optimistic delete
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));

    try {
      await api.delete(`/knowledge/${id}`);
    } catch (e) {
      console.error("Failed to sync delete, queueing offline", e);
      get().queueOfflineCapture({
        operation: "delete",
        payload: { id },
      });
    }
  },

  queueOfflineCapture: (capture) => set((state) => ({
    offlineQueue: [...state.offlineQueue, capture],
    syncStatus: "offline"
  })),

  clearOfflineQueue: () => set({ offlineQueue: [], syncStatus: "synced" }),
  
  setSyncStatus: (status) => set({ syncStatus: status }),

  syncOfflineQueue: async () => {
    const queue = get().offlineQueue;
    if (queue.length === 0) return;

    set({ syncStatus: "syncing" });
    try {
      const response = await api.post("/sync", queue);
      console.log("Offline sync batch response:", response.data);
      set({ offlineQueue: [], syncStatus: "synced" });
      await get().fetchItems();
    } catch (e) {
      console.error("Failed to process sync queue", e);
      set({ syncStatus: "offline" });
    }
  },

  getFilteredItems: () => {
    const { items, filters, searchQuery } = get();
    return items.filter((item) => {
      // Filter by type
      if (filters.contentType !== "All") {
        if (filters.contentType === "Notes" && item.contentType !== "note") return false;
        if (filters.contentType === "PDFs" && item.contentType !== "pdf") return false;
        if (filters.contentType === "Images" && item.contentType !== "image") return false;
        if (filters.contentType === "Code" && item.contentType !== "code") return false;
        if (filters.contentType === "URLs" && item.contentType !== "url") return false;
        if (filters.contentType === "Errors" && item.contentType !== "error") return false;
      }

      // Filter by project
      if (filters.project !== "All" && item.project !== filters.project) return false;

      // Filter by tag
      if (filters.tag !== "All" && !item.tags.includes(filters.tag.toLowerCase())) return false;

      // Search query filter
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(query);
        const matchesSummary = item.summary?.toLowerCase().includes(query);
        const matchesContent = item.rawContent?.toLowerCase().includes(query);
        const matchesTags = item.tags?.some((t) => t.toLowerCase().includes(query));
        const matchesTech = item.technologies?.some((t) => t.toLowerCase().includes(query));

        if (!matchesTitle && !matchesSummary && !matchesContent && !matchesTags && !matchesTech) {
          return false;
        }
      }

      return !item.isArchived;
    });
  }
}));

export default useKnowledgeStore;
