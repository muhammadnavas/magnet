import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useChatStore from "../store/chatStore";
import api from "../lib/api";

const getChatErrorMessage = (error) => {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;
  if (status === 401) return "Your session could not be authenticated. Please sign in again.";
  if (status === 404) return "The chat endpoint was not found. The backend deployment may be out of date.";
  if (status === 429) return "The AI service is receiving too many requests. Please try again shortly.";
  if (status >= 500) return "Magnet's backend returned an error while generating the answer. Tap Retry to try again.";
  if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") return "The AI response timed out. The server may be busy; tap Retry.";
  if (!error?.response) return "Couldn't get a response from Magnet's backend. Check the connection, then tap Retry. If it keeps failing, the deployed backend or chat provider may be unavailable.";
  if (typeof detail === "string" && detail.length < 180) return `Chat request failed: ${detail}`;
  return "Your message could not be sent. Please try again.";
};

export const useChat = () => {
  const queryClient = useQueryClient();
  const { 
    messages, 
    setMessages, 
    addMessage, 
    currentConversationId, 
    setCurrentConversationId, 
    isTyping, 
    setIsTyping, 
    clearChat 
  } = useChatStore();

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
      // Keep the submitted text in the mutation so failures can be retried.
      setIsTyping(true);
      let lastError;
      // One guarded retry for transient mobile-network drops. Do not retry
      // authentication, validation, rate-limit, or server errors blindly.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await api.post("/chat", {
            content: text,
            conversation_id: currentConversationId
          });
          return { ...response.data, __submittedText: text };
        } catch (error) {
          lastError = error;
          const transientNetworkFailure = !error?.response && ["ECONNABORTED", "ETIMEDOUT"].includes(error?.code);
          if (attempt === 0 && transientNetworkFailure) {
            await new Promise((resolve) => setTimeout(resolve, 700));
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    },
    onSuccess: (data) => {
      setIsTyping(false);
      // Only show the user bubble after the server confirms the request.
      // This avoids duplicate-looking bubbles when a failed message is retried.
      addMessage({
        id: "user-" + (data.id || Date.now()),
        role: "user",
        content: data.__submittedText,
        created_at: new Date().toISOString()
      });
      const { __submittedText, ...assistantMessage } = data;
      addMessage(assistantMessage);
      if (data.conversation_id) setCurrentConversationId(data.conversation_id);
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
    onError: (err, text) => {
      setIsTyping(false);
      console.error("Send message error:", err);
      addMessage({
        id: "error-" + Date.now(),
        role: "assistant",
        content: getChatErrorMessage(err),
        sources: [],
        retryText: text,
        isError: true
      });
    }
  });

  return {
    messages,
    sendMessage: sendMessageMutation.mutate,
    retryMessage: (text) => sendMessageMutation.mutate(text),
    isSending: sendMessageMutation.isPending,
    isTyping,
    conversations: fetchConversations.data || [],
    currentConversationId,
    loadConversation: loadConversationMessages,
    clearChat
  };
};

export default useChat;
