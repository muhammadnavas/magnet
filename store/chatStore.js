import { create } from "zustand";

export const useChatStore = create((set) => ({
  messages: [],
  currentConversationId: null,
  isTyping: false,

  setMessages: (updater) =>
    set((state) => ({
      messages: typeof updater === "function" ? updater(state.messages) : updater,
    })),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  setCurrentConversationId: (id) =>
    set({ currentConversationId: id }),

  setIsTyping: (isTyping) =>
    set({ isTyping }),

  clearChat: () =>
    set({ messages: [], currentConversationId: null, isTyping: false }),
}));

export default useChatStore;
