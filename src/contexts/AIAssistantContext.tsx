import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface AIAssistantContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  conversations: Conversation[];
  isLoadingConversations: boolean;
  createConversation: () => Promise<string | null>;
  loadConversation: (id: string) => Promise<void>;
  saveMessages: (conversationId: string, messages: Message[]) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  startNewConversation: () => void;
  /** Pending seed prompt — consumed by CLXAssistant the next time the panel opens. */
  pendingPrompt: string | null;
  /** Set (or clear) the pending seed prompt without opening the panel. */
  setPendingPrompt: (prompt: string | null) => void;
  /** Convenience: seed the input with a prompt and open the assistant in one call. */
  openWithPrompt: (prompt: string) => void;
}

const AIAssistantContext = createContext<AIAssistantContextType | null>(null);

export const useAIAssistant = () => {
  const context = useContext(AIAssistantContext);
  if (!context) {
    throw new Error('useAIAssistant must be used within an AIAssistantProvider');
  }
  return context;
};

interface AIAssistantProviderProps {
  children: ReactNode;
}

export const AIAssistantProvider = ({ children }: AIAssistantProviderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const openWithPrompt = useCallback((prompt: string) => {
    setPendingPrompt(prompt);
    setIsOpen(true);
  }, []);

  // Fetch all conversations
  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as Conversation[];
    },
  });

  // Create a new conversation
  const createConversation = useCallback(async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('ai_conversations')
      .insert({ user_id: user.id, title: 'New conversation' })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return null;
    }

    queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    return data.id;
  }, [queryClient]);

  // Load a conversation's messages
  const loadConversation = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('ai_conversation_messages')
      .select('role, content')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading conversation:', error);
      return;
    }

    setMessages(data as Message[]);
    setCurrentConversationId(id);
  }, []);

  // Save messages to a conversation
  const saveMessages = useCallback(async (conversationId: string, newMessages: Message[]) => {
    // Get existing message count
    const { count } = await supabase
      .from('ai_conversation_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId);

    // Only insert new messages
    const messagesToInsert = newMessages.slice(count || 0).map(msg => ({
      conversation_id: conversationId,
      role: msg.role,
      content: msg.content,
    }));

    if (messagesToInsert.length > 0) {
      await supabase
        .from('ai_conversation_messages')
        .insert(messagesToInsert);

      // Update conversation title based on first user message if it's a new conversation
      if (count === 0 && newMessages.length > 0) {
        const firstUserMsg = newMessages.find(m => m.role === 'user');
        if (firstUserMsg) {
          const title = firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
          await supabase
            .from('ai_conversations')
            .update({ title, updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        }
      } else {
        // Just update the timestamp
        await supabase
          .from('ai_conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      }

      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    }
  }, [queryClient]);

  // Delete a conversation
  const deleteConversation = useCallback(async (id: string) => {
    await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', id);

    if (currentConversationId === id) {
      setCurrentConversationId(null);
      setMessages([]);
    }

    queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
  }, [currentConversationId, queryClient]);

  // Start a fresh conversation
  const startNewConversation = useCallback(() => {
    setCurrentConversationId(null);
    setMessages([]);
  }, []);

  return (
    <AIAssistantContext.Provider
      value={{
        isOpen,
        setIsOpen,
        messages,
        setMessages,
        currentConversationId,
        setCurrentConversationId,
        conversations,
        isLoadingConversations,
        createConversation,
        loadConversation,
        saveMessages,
        deleteConversation,
        startNewConversation,
        pendingPrompt,
        setPendingPrompt,
        openWithPrompt,
      }}
    >
      {children}
    </AIAssistantContext.Provider>
  );
};
