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
    mutationFn: async ({ text, pendingId }) => {
      setIsTyping(true);
      let lastError;
      // One guarded retry for transient mobile-network drops.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await api.post("/chat", {
            content: text,
            conversation_id: currentConversationId
          });
          return { ...response.data, __submittedText: text, __pendingId: pendingId };
        } catch (error) {
          lastError = error;
          const transientNetworkFailure =
            !error?.response &&
            (["ECONNABORTED", "ETIMEDOUT", "ERR_NETWORK"].includes(error?.code) || error?.code == null);
          if (attempt === 0 && transientNetworkFailure) {
            await new Promise((resolve) => setTimeout(resolve, 700));
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    },
    onMutate: ({ text, pendingId }) => {
      // Show the user's message immediately instead of leaving an empty screen
      // with an indefinite typing indicator while the server responds.
      addMessage({
        id: pendingId,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
        pending: true
      });
      setIsTyping(true);
      return { pendingId, text };
    },
    onSuccess: (data) => {
      setIsTyping(false);
      setMessages((current) => [
        ...current.filter((message) => message.id !== data.__pendingId),
        {
          id: "user-" + (data.id || Date.now()),
          role: "user",
          content: data.__submittedText,
          created_at: new Date().toISOString()
        },
        ...[(({ __submittedText, __pendingId, ...assistantMessage }) => assistantMessage)(data)]
      ]);
      if (data.conversation_id) setCurrentConversationId(data.conversation_id);
      queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
    onError: (err, variables, context) => {
      setIsTyping(false);
      console.error("Send message error:", err);
      setMessages((current) => current.map((message) =>
        message.id === (context?.pendingId || variables?.pendingId)
          ? { ...message, pending: false, failed: true }
          : message
      ));
      addMessage({
        id: "error-" + Date.now(),
        role: "assistant",
        content: getChatErrorMessage(err),
        sources: [],
        retryText: variables?.text,
        isError: true
      });
    }
  });

  return {
    messages,
    sendMessage: (text) => sendMessageMutation.mutate({ text, pendingId: "pending-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) }),
    retryMessage: (text) => sendMessageMutation.mutate({ text, pendingId: "pending-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) }),
    isSending: sendMessageMutation.isPending,
    isTyping,
    conversations: fetchConversations.data || [],
    currentConversationId,
    loadConversation: loadConversationMessages,
    clearChat
  };
};

export default useChat;
