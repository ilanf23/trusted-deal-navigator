import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { aiAssistantUrl } from '@/lib/aiAssistantRouter';
import { toast } from 'sonner';
import { useAIAssistant } from '@/contexts/AIAssistantContext';
import CLXAssistantHeader from './CLXAssistantHeader';
import CLXAssistantInput from './CLXAssistantInput';
import CLXAssistantHistory from './CLXAssistantHistory';
import CLXAssistantEmptyState from './CLXAssistantEmptyState';
import ChatMessages from './ChatMessages';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface UploadedFile {
  name: string;
  type: string;
  content: string;
}

const CLXAssistant = () => {
  const {
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
  } = useAIAssistant();

  const location = useLocation();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null!);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { data: teamMember } = useQuery({
    queryKey: ['current-team-member-ai'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .eq('user_id', user.id)
        .single();
      if (error) return null;
      return data;
    },
  });

  const { data: suggestedTasks = [] } = useQuery({
    queryKey: ['ai-suggested-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, priority, due_date')
        .eq('is_completed', false)
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (pendingPrompt) {
      setInput(pendingPrompt);
      setPendingPrompt(null);
      setTimeout(() => {
        inputRef.current?.focus();
        const el = inputRef.current;
        if (el) {
          const len = el.value.length;
          try { el.setSelectionRange(len, len); } catch { /* input types without selection */ }
        }
      }, 150);
    }
  }, [pendingPrompt, setPendingPrompt]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (messageText?: string) => {
    const text = messageText || input.trim();
    if ((!text && !uploadedFile) || isLoading) return;

    let convId = currentConversationId;
    if (!convId) {
      convId = await createConversation();
      if (!convId) {
        toast.error('Failed to create conversation');
        return;
      }
      setCurrentConversationId(convId);
    }

    const userContent = uploadedFile ? `${text}\n\n[Attached PDF: ${uploadedFile.name}]` : text;
    const userMsg: Message = { role: 'user', content: userContent };

    setInput('');
    const fileToSend = uploadedFile;
    setUploadedFile(null);
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const requestBody = {
        messages: newMessages,
        teamMemberId: teamMember?.id,
        file: fileToSend,
        mode: 'chat',
        currentPage: location.pathname,
      };
      const response = await fetch(
        aiAssistantUrl(requestBody),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Rate limit exceeded. Please try again later.');
          setIsLoading(false);
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let assistantContent = '';
      setMessages([...newMessages, { role: 'assistant', content: '' }]);

      // ai-assistant-chat now streams plain text (Vercel AI SDK
      // toTextStreamResponse), not OpenAI SSE — append each chunk directly.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
          return updated;
        });
      }

      const finalMessages = [...newMessages, { role: 'assistant' as const, content: assistantContent }];
      setMessages(finalMessages);
      if (convId) await saveMessages(convId, finalMessages);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('AI error:', error);
      toast.error(error.message || 'Failed to get AI response');
      setMessages(prev => {
        if (prev[prev.length - 1]?.role === 'assistant' && prev[prev.length - 1]?.content === '') {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      inputRef.current?.focus();
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-violet-500/[0.05] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-[36rem] rounded-full bg-amber-400/[0.04] blur-3xl" />
      </div>

      <AnimatePresence initial={false}>
        {showHistorySidebar && (
          <CLXAssistantHistory
            conversations={conversations}
            isLoading={isLoadingConversations}
            currentConversationId={currentConversationId}
            onLoad={async (id) => {
              await loadConversation(id);
            }}
            onDelete={async (id) => {
              await deleteConversation(id);
            }}
            onNewChat={startNewConversation}
          />
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <CLXAssistantHeader
          showHistorySidebar={showHistorySidebar}
          onToggleHistory={() => setShowHistorySidebar((prev) => !prev)}
          onNewChat={startNewConversation}
        />

        <ScrollArea className="flex-1" ref={scrollRef}>
          {messages.length === 0 ? (
            <CLXAssistantEmptyState
              currentPage={location.pathname}
              suggestedTasks={suggestedTasks}
              onSubmit={handleSubmit}
              greetingName={teamMember?.name}
            />
          ) : (
            <ChatMessages
              messages={messages}
              isLoading={isLoading}
              userAvatarUrl={teamMember?.avatar_url}
              userName={teamMember?.name}
            />
          )}
        </ScrollArea>

        <CLXAssistantInput
          input={input}
          onInputChange={setInput}
          onSubmit={() => handleSubmit()}
          onStop={handleStopGeneration}
          isLoading={isLoading}
          uploadedFile={uploadedFile}
          onFileUpload={setUploadedFile}
          onRemoveFile={() => setUploadedFile(null)}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
};

export default CLXAssistant;
