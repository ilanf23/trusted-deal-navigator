import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { aiAssistantUrl } from '@/lib/aiAssistantRouter';
import { toast } from 'sonner';
import { useAIAssistant } from '@/contexts/AIAssistantContext';
import { useActionParser } from '@/hooks/useActionParser';
import { useActionExecutor } from '@/hooks/useActionExecutor';
import CLXAssistantHeader, { type AIMode } from './CLXAssistantHeader';
import CLXAssistantInput from './CLXAssistantInput';
import CLXAssistantHistory from './CLXAssistantHistory';
import CLXAssistantEmptyState from './CLXAssistantEmptyState';
import ChatMessages from './modes/ChatMessages';
import AssistMessages from './modes/AssistMessages';
import AgentMessages, { type AgentLogEntry } from './modes/AgentMessages';
import type { ActionProposal } from './actions/ActionCard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistMessage extends Message {
  actions?: ActionProposal[];
}

interface AgentMessage extends Message {
  agentLog?: AgentLogEntry[];
  batchId?: string;
  totalChanges?: number;
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
  const navigate = useNavigate();
  const { parseActions } = useActionParser();
  const { executeAction, undoBatch: undoBatchAction } = useActionExecutor();

  const [activeMode, setActiveMode] = useState<AIMode>('chat');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [pendingActions, setPendingActions] = useState<ActionProposal[]>([]);
  const [assistMessages, setAssistMessages] = useState<AssistMessage[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);

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
  }, [messages, assistMessages, agentMessages]);

  const handleModeChange = (mode: AIMode) => {
    if (mode === activeMode) return;
    const currentMessages = activeMode === 'chat' ? messages : activeMode === 'assist' ? assistMessages : agentMessages;
    if (currentMessages.length > 0) {
      startNewConversation();
    }
    setActiveMode(mode);
    setAssistMessages([]);
    setAgentMessages([]);
    setPendingActions([]);
  };

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

    if (activeMode === 'agent') {
      await handleAgentSubmit(userMsg, convId, fileToSend, abortController);
    } else if (activeMode === 'assist') {
      await handleAssistSubmit(userMsg, convId, fileToSend, abortController);
    } else {
      await handleChatSubmit(userMsg, convId, fileToSend, abortController);
    }
  };

  const handleChatSubmit = async (userMsg: Message, convId: string, file: UploadedFile | null, abortController: AbortController) => {
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const requestBody = {
        messages: newMessages,
        teamMemberId: teamMember?.id,
        file,
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

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                return updated;
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
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

  const handleAssistSubmit = async (userMsg: Message, convId: string, file: UploadedFile | null, abortController: AbortController) => {
    const newMessages: AssistMessage[] = [...assistMessages, { ...userMsg }];
    setAssistMessages(newMessages);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const requestBody = {
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        teamMemberId: teamMember?.id,
        file,
        mode: 'assist',
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
          toast.error('Rate limit exceeded.');
          setIsLoading(false);
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let fullContent = '';
      setAssistMessages([...newMessages, { role: 'assistant', content: '' }]);

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              setAssistMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: fullContent };
                return updated;
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      const { cleanText, actions } = parseActions(fullContent);
      const finalMsg: AssistMessage = { role: 'assistant', content: cleanText, actions };

      setAssistMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = finalMsg;
        return updated;
      });
      setPendingActions(prev => [...prev, ...actions]);

      const dbMessages = [...newMessages.map(m => ({ role: m.role, content: m.content })), { role: 'assistant' as const, content: cleanText }];
      if (convId) await saveMessages(convId, dbMessages);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('Assist error:', error);
      toast.error(error.message || 'Failed to get AI response');
      setAssistMessages(prev => {
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

  const handleAgentSubmit = async (userMsg: Message, convId: string, file: UploadedFile | null, abortController: AbortController) => {
    const newMessages: AgentMessage[] = [...agentMessages, { ...userMsg }];
    const placeholderMsg: AgentMessage = { role: 'assistant', content: '', agentLog: [{ type: 'text', content: 'Processing your request...' }] };
    setAgentMessages([...newMessages, placeholderMsg]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const requestBody = {
        action: 'agent',
        prompt: userMsg.content,
        conversationId: convId,
        teamMemberId: teamMember?.id,
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
          throw new Error('Rate limit exceeded. Please try again later.');
        }
        let errorMsg = `Agent request failed (${response.status})`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch {
          errorMsg = `Agent request failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      const agentLog: AgentLogEntry[] = [];
      let batchId: string | undefined;
      let totalChanges = 0;

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr) as AgentLogEntry;
            agentLog.push(parsed);
            if (parsed.type === 'batch_complete') {
              batchId = parsed.batchId;
              totalChanges = parsed.totalChanges || 0;
            }
            setAgentMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: 'assistant',
                content: '',
                agentLog: [...agentLog],
                batchId,
                totalChanges,
              };
              return updated;
            });
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      if (agentLog.length === 0) {
        agentLog.push({ type: 'text', content: 'No actions were taken.' });
      }

      setAgentMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: '',
          agentLog,
          batchId,
          totalChanges,
        };
        return updated;
      });
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('Agent error:', error);
      const errorMessage = error.message || 'Agent execution failed';
      toast.error(errorMessage);
      setAgentMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: '',
          agentLog: [{ type: 'error', content: errorMessage }],
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      inputRef.current?.focus();
    }
  };

  const handleConfirmAction = useCallback(async (actionId: string) => {
    setAssistMessages(prev =>
      prev.map(msg => ({
        ...msg,
        actions: msg.actions?.map(a =>
          a.id === actionId ? { ...a, status: 'executing' as const } : a
        ),
      }))
    );

    const action = pendingActions.find(a => a.id === actionId);
    if (!action) return;

    const result = await executeAction(action, currentConversationId);

    setAssistMessages(prev =>
      prev.map(msg => ({
        ...msg,
        actions: msg.actions?.map(a =>
          a.id === actionId
            ? { ...a, status: result.success ? 'completed' as const : 'failed' as const, result: result.result, changeId: result.changeId }
            : a
        ),
      }))
    );

    setPendingActions(prev => prev.filter(a => a.id !== actionId));
  }, [pendingActions, executeAction, currentConversationId]);

  const handleDismissAction = useCallback((actionId: string) => {
    setAssistMessages(prev =>
      prev.map(msg => ({
        ...msg,
        actions: msg.actions?.map(a =>
          a.id === actionId ? { ...a, status: 'dismissed' as const } : a
        ),
      }))
    );
    setPendingActions(prev => prev.filter(a => a.id !== actionId));
  }, []);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleUndoBatch = useCallback(async (batchId: string) => {
    await undoBatchAction(batchId);
  }, [undoBatchAction]);

  const handleViewChanges = useCallback((batchId: string) => {
    navigate(`/superadmin/ai-changes?batch=${batchId}`);
  }, [navigate]);

  const currentMessages = activeMode === 'chat' ? messages : activeMode === 'assist' ? assistMessages : agentMessages;

  const resetMode = () => {
    startNewConversation();
    setAssistMessages([]);
    setAgentMessages([]);
    setPendingActions([]);
  };

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      {/* Ambient backdrop — subtle radial glows that hint at "AI surface" without shouting */}
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
              setAssistMessages([]);
              setAgentMessages([]);
              setPendingActions([]);
              setActiveMode('chat');
            }}
            onDelete={async (e, id) => {
              e.stopPropagation();
              await deleteConversation(id);
            }}
            onNewChat={resetMode}
          />
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <CLXAssistantHeader
          activeMode={activeMode}
          onModeChange={handleModeChange}
          showHistorySidebar={showHistorySidebar}
          onToggleHistory={() => setShowHistorySidebar((prev) => !prev)}
          onNewChat={resetMode}
        />

        <ScrollArea className="flex-1" ref={scrollRef}>
          {currentMessages.length === 0 ? (
            <CLXAssistantEmptyState
              mode={activeMode}
              currentPage={location.pathname}
              suggestedTasks={suggestedTasks}
              onSubmit={handleSubmit}
              greetingName={teamMember?.name}
            />
          ) : activeMode === 'chat' ? (
            <ChatMessages
              messages={messages}
              isLoading={isLoading}
              userAvatarUrl={teamMember?.avatar_url}
              userName={teamMember?.name}
            />
          ) : activeMode === 'assist' ? (
            <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
              <AssistMessages
                messages={assistMessages}
                isLoading={isLoading}
                userAvatarUrl={teamMember?.avatar_url}
                userName={teamMember?.name}
                onConfirmAction={handleConfirmAction}
                onDismissAction={handleDismissAction}
              />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6">
              <AgentMessages
                messages={agentMessages}
                isLoading={isLoading}
                userAvatarUrl={teamMember?.avatar_url}
                userName={teamMember?.name}
                onUndoBatch={handleUndoBatch}
                onViewChanges={handleViewChanges}
              />
            </div>
          )}
        </ScrollArea>

        <CLXAssistantInput
          mode={activeMode}
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
