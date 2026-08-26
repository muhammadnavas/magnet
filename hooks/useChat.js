import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";

export const useChat = () => {
  const queryClient = useQueryClient();
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);

  // Fetch list of all conversations
  const fetchConversations = useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: async () => {
      try {
        const response = await api.get("/conversations");
        return response.data;
      } catch (e) {
        console.error("Failed to fetch conversations", e);
        return [];
      }
    }
  });

  // Fetch messages if conversation changes (can be used if loading historical chat)
  const loadConversationMessages = async (convId) => {
    try {
      setIsTyping(true);
      const response = await api.get(`/conversations/${convId}/messages`);
      setMessages(response.data);
      setCurrentConversationId(convId);
    } catch (e) {
      console.error("Failed to load conversation messages", e);
    } finally {
      setIsTyping(false);
    }
  };

  const sendMessageMutation = useMutation({
    mutationFn: async (text) => {
      // 1. Immediately append user's local message to state
      const tempUserId = Math.random().toString();
      const userMessage = {
        id: tempUserId,
        role: "user",
        content: text,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsTyping(true);

      // 2. Call backend chat API
      const payload = {
        content: text,
        conversation_id: currentConversationId
      };

      const response = await api.post("/chat", payload);
      return response.data;
    },
    onSuccess: (data) => {
      setIsTyping(false);
      // Append real assistant response from server
      setMessages((prev) => [...prev, data]);
      // Save current conversation ID
      if (data.conversation_id) {
        setCurrentConversationId(data.conversation_id);
      }
      // Refresh list of conversations
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
    onError: (err) => {
      setIsTyping(false);
      console.error("Send message error:", err);
      // Append mock/error message so UI doesn't hang
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "assistant",
          content: "System Alert: I could not contact the Orio API service. Please verify your connection status.",
          sources: []
        }
      ]);
    }
  });

  const clearChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
  };

  return {
    messages,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
    isTyping,
    conversations: fetchConversations.data || [],
    currentConversationId,
    loadConversation: loadConversationMessages,
    clearChat
  };
};

export default useChat;
