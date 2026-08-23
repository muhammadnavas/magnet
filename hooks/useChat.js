import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";

const MOCK_CONVERSATION_HISTORY = [
  {
    id: "1",
    role: "user",
    content: "What did I learn about Docker?"
  },
  {
    id: "2",
    role: "assistant",
    content: "According to your **Docker Compose Multi-Stage Builds** code snippet in the *Email Scheduler* project:\n\n1. You optimized your Docker image size by separating build tools (like `gcc` and `musl-dev`) from the final runtime image.\n2. You are using `python:3.12-alpine` as the base image.\n3. The multi-stage copy uses `COPY --from=builder /root/.local /root/.local` to import compiled Python packages without carrying over compilation compilers.",
    sources: [
      { id: "1", title: "Docker Compose Multi-Stage Builds", type: "code" }
    ]
  }
];

export const useChat = () => {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState(MOCK_CONVERSATION_HISTORY);
  const [isTyping, setIsTyping] = useState(false);

  const fetchConversations = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: async () => {
      try {
        const response = await api.get("/conversations");
        return response.data;
      } catch (e) {
        return [{ id: "1", title: "Docker Multi-stage Builds Setup" }];
      }
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (text) => {
      // Create user message object
      const userMessage = { id: Math.random().toString(), role: "user", content: text };
      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);

      // Hit API if online
      try {
        const response = await api.post("/chat", { message: text });
        return response.data;
      } catch (err) {
        // Return structured mock AI answers based on query keywords
        await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate thinking latency
        
        const textLower = text.toLowerCase();
        let reply = "I searched your Orio brain, but couldn't find any specific documents relating directly to that query. Try asking about 'Docker', 'FastAPI', or 'Redis'.";
        let sources = [];

        if (textLower.includes("docker") || textLower.includes("container")) {
          reply = "Orio contains details about **Docker Compose Multi-Stage Builds** under the *Email Scheduler* project. You are using a multi-stage Dockerfile to compile Python packages in a `builder` container before transferring them to a lightweight final `alpine` container.";
          sources = [{ id: "1", title: "Docker Compose Multi-Stage Builds", type: "code" }];
        } else if (textLower.includes("redis") || textLower.includes("cache")) {
          reply = "Your notes indicate you configure Redis using `volatile-lfu` eviction policy under `maxmemory 512mb`. This ensures transient email throttling tokens get evicted when memory limits are reached without touching persistent config values.";
          sources = [{ id: "2", title: "Redis Cache Key Eviction Strategy", type: "note" }];
        } else if (textLower.includes("fastapi") || textLower.includes("session")) {
          reply = "Based on your FastAPI codebase notes:\n- You use `async_sessionmaker` inside a dependency injector function (`get_db()`).\n- You resolved a connection pooling exhaustion crash (`QueuePool limit of size 5 reached`) by scaling pool parameters: `pool_size=20, max_overflow=10` on the `create_async_engine` config.";
          sources = [
            { id: "3", title: "FastAPI Database Session Lifecycle", type: "code" },
            { id: "4", title: "FastAPI Connection Pooling Error", type: "error" }
          ];
        }

        return {
          id: Math.random().toString(),
          role: "assistant",
          content: reply,
          sources
        };
      }
    },
    onSuccess: (data) => {
      setIsTyping(false);
      setMessages((prev) => [...prev, data]);
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
    onError: () => {
      setIsTyping(false);
    }
  });

  const clearChat = () => {
    setMessages([]);
  };

  return {
    messages,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
    isTyping,
    conversations: fetchConversations.data || [],
    clearChat
  };
};

export default useChat;
