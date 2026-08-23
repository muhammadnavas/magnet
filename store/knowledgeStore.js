import { create } from "zustand";

const MOCK_KNOWLEDGE = [
  {
    id: "1",
    title: "Docker Compose Multi-Stage Builds",
    contentType: "code",
    summary: "Optimized Dockerfile configurations using multi-stage builds to minimize image sizes. Employs a python:3.12-alpine base and installs runtime dependencies separately from build dependencies.",
    tags: ["docker", "devops", "containers"],
    technologies: ["Docker", "Python", "Alpine"],
    project: "Email Scheduler",
    processingStatus: "completed",
    isFavorite: true,
    isArchived: false,
    createdAt: "2026-08-22T10:15:30Z",
    rawContent: "FROM python:3.12-alpine as builder\nWORKDIR /app\nRUN apk add --no-cache gcc musl-dev postgresql-dev\nCOPY requirements.txt .\nRUN pip install --user -r requirements.txt\n\nFROM python:3.12-alpine\nWORKDIR /app\nCOPY --from=builder /root/.local /root/.local\nCOPY . .\nENV PATH=/root/.local/bin:$PATH\nCMD [\"python\", \"main.py\"]",
    extractedText: "FROM python:3.12-alpine as builder...",
    keyPoints: ["Uses multi-stage builds", "Installs gcc and musl-dev only for compilation", "Uses alpine to reduce size"],
    relatedItems: [
      { id: "2", title: "Redis Caching in Email Scheduler", type: "Note" },
      { id: "3", title: "FastAPI Database Sessions", type: "Code" }
    ]
  },
  {
    id: "2",
    title: "Redis Cache Key Eviction Strategy",
    contentType: "note",
    summary: "Configuring LFU eviction policy in Redis memory management. Outlines configuring maxmemory and maxmemory-policy volatile-lfu for project-specific metadata cache keys.",
    tags: ["redis", "caching", "performance"],
    technologies: ["Redis"],
    project: "Email Scheduler",
    processingStatus: "completed",
    isFavorite: false,
    isArchived: false,
    createdAt: "2026-08-21T14:30:00Z",
    rawContent: "For the Email Scheduler, we are using Redis to throttle email triggers. Since we have memory limits on the free tier, we configure redis.conf to include:\nmaxmemory 512mb\nmaxmemory-policy volatile-lfu\nThis ensures that only keys with an expiration set are evicted using Least Frequently Used policy.",
    extractedText: "For the Email Scheduler, we are using Redis to throttle email triggers...",
    keyPoints: ["Configured 512MB memory ceiling", "Use volatile-lfu to preserve non-expiring credentials", "Improves overall cache hits"],
    relatedItems: [
      { id: "1", title: "Docker Compose Multi-Stage Builds", type: "Code" }
    ]
  },
  {
    id: "3",
    title: "FastAPI Database Session Lifecycle",
    contentType: "code",
    summary: "Asynchronous SQLAlchemy database engine integration in FastAPI dependency injection lifecycle. Leverages async_sessionmaker and handles session closure correctly.",
    tags: ["fastapi", "sqlalchemy", "postgres"],
    technologies: ["FastAPI", "SQLAlchemy", "PostgreSQL"],
    project: "AI Interviewer",
    processingStatus: "completed",
    isFavorite: true,
    isArchived: false,
    createdAt: "2026-08-20T08:45:00Z",
    rawContent: "from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker\n\nengine = create_async_engine(DATABASE_URL, echo=True)\nasync_session = async_sessionmaker(engine, expire_on_commit=False)\n\nasync def get_db():\n    async with async_session() as session:\n        try:\n            yield session\n            await session.commit()\n        except Exception:\n            await session.rollback()\n            raise\n        finally:\n            await session.close()",
    extractedText: "from sqlalchemy.ext.asyncio import create_async_engine...",
    keyPoints: ["Uses async sessions", "Handles automatic rollback on failure", "Correctly closes session in finally block"],
    relatedItems: [
      { id: "4", title: "FastAPI Connection Pooling Error", type: "Error" }
    ]
  },
  {
    id: "4",
    title: "FastAPI Connection Pooling Error",
    contentType: "error",
    summary: "OperationalError: QueuePool limit of size 5 overflow 10 reached. Solved by increasing pool_size and max_overflow in the create_async_engine parameters.",
    tags: ["fastapi", "errors", "debugging"],
    technologies: ["FastAPI", "PostgreSQL"],
    project: "AI Interviewer",
    processingStatus: "completed",
    isFavorite: false,
    isArchived: false,
    createdAt: "2026-08-19T17:22:15Z",
    rawContent: "Error: sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10 reached, connection timed out.\nOccurred during load test of the chat response endpoint.\nFix:\nengine = create_async_engine(DATABASE_URL, pool_size=20, max_overflow=10)",
    extractedText: "Error: sqlalchemy.exc.TimeoutError...",
    keyPoints: ["Caused by pool exhaustion during parallel AI chat calls", "Fixed by expanding pool size from 5 to 20", "Added max_overflow of 10 to absorb transient spikes"],
    relatedItems: [
      { id: "3", title: "FastAPI Database Session Lifecycle", type: "Code" }
    ]
  },
  {
    id: "5",
    title: "Intro to Retrieval-Augmented Generation (RAG)",
    contentType: "pdf",
    summary: "An introductory whitepaper describing basic RAG concepts, embedding models, vector search with cosine similarity, and contextual prompting to reduce LLM hallucinations.",
    tags: ["rag", "llm", "ai"],
    technologies: ["OpenAI", "pgvector"],
    project: "Personal Projects",
    processingStatus: "completed",
    isFavorite: false,
    isArchived: false,
    createdAt: "2026-08-18T11:00:00Z",
    rawContent: "Retrieval-Augmented Generation (RAG) is a technique that enhances large language models by retrieving context from external data sources before generating a response. First, documents are parsed, chunked, and stored as vector embeddings using models like text-embedding-3-small. At query time, the query is also embedded and a similarity search is performed in a database (like PostgreSQL with pgvector) to fetch relevant chunks.",
    extractedText: "Retrieval-Augmented Generation (RAG) is a technique...",
    keyPoints: ["Reduces hallucination rate", "Decouples knowledge updates from LLM training", "Requires chunking strategies"],
    relatedItems: []
  }
];

export const useKnowledgeStore = create((set, get) => ({
  items: MOCK_KNOWLEDGE,
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

  addKnowledgeItem: (item) => set((state) => ({
    items: [
      {
        id: Math.random().toString(),
        processingStatus: "completed",
        createdAt: new Date().toISOString(),
        isFavorite: false,
        isArchived: false,
        tags: item.tags || [],
        technologies: item.technologies || [],
        keyPoints: item.keyPoints || [],
        relatedItems: [],
        ...item
      },
      ...state.items
    ]
  })),

  toggleFavorite: (id) => set((state) => ({
    items: state.items.map((item) => 
      item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
    )
  })),

  archiveItem: (id) => set((state) => ({
    items: state.items.map((item) => 
      item.id === id ? { ...item, isArchived: true } : item
    )
  })),

  deleteItem: (id) => set((state) => ({
    items: state.items.filter((item) => item.id !== id)
  })),

  queueOfflineCapture: (capture) => set((state) => ({
    offlineQueue: [...state.offlineQueue, capture],
    syncStatus: "offline"
  })),

  clearOfflineQueue: () => set({ offlineQueue: [], syncStatus: "synced" }),
  
  setSyncStatus: (status) => set({ syncStatus: status }),

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
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesSummary = item.summary.toLowerCase().includes(query);
        const matchesContent = item.rawContent?.toLowerCase().includes(query);
        const matchesTags = item.tags.some(t => t.toLowerCase().includes(query));
        const matchesTech = item.technologies?.some(t => t.toLowerCase().includes(query));

        if (!matchesTitle && !matchesSummary && !matchesContent && !matchesTags && !matchesTech) {
          return false;
        }
      }

      return !item.isArchived;
    });
  }
}));

export default useKnowledgeStore;
