import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 520;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 400;
const MAX_WIDTH = 800;
const MAX_HEIGHT = 900;
const STORAGE_KEY = 'ai-assistant-size';

const getSavedSize = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, parsed.width || DEFAULT_WIDTH)),
        height: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, parsed.height || DEFAULT_HEIGHT)),
      };
    }
  } catch {}
  return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
};

const saveSize = (width: number, height: number) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ width, height }));
  } catch {}
};

const CLXAssistant = () => {
  const {
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
  const inputRef = useRef<HTMLInputElement>(null!);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Resizable state
  const [size, setSize] = useState(getSavedSize);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number; corner: string } | null>(null);

  // Fetch team member info
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
    enabled: isOpen,
  });

  // Fetch suggested tasks
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
    enabled: isOpen,
  });

  // Auto-scroll and focus
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Consume a pending seed prompt from the context when the panel opens.
  // Parent surfaces (e.g. expanded views) can call `openWithPrompt(...)` to
  // pre-fill the input with deal-specific context, then the caret focuses
  // so the user can send or edit immediately.
  useEffect(() => {
    if (isOpen && pendingPrompt) {
      setInput(pendingPrompt);
      setPendingPrompt(null);
      setTimeout(() => {
        inputRef.current?.focus();
        // Move caret to end so the user can keep typing.
        const el = inputRef.current;
        if (el) {
          const len = el.value.length;
          try { el.setSelectionRange(len, len); } catch { /* input types without selection */ }
        }
      }, 150);
    }
  }, [isOpen, pendingPrompt, setPendingPrompt]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, assistMessages, agentMessages]);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent, corner: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: size.width,
      startHeight: size.height,
      corner,
    };
  }, [size]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { startX, startY, startWidth, startHeight, corner } = resizeRef.current;
      let newWidth = startWidth;
      let newHeight = startHeight;

      if (corner.includes('e')) newWidth = startWidth + (e.clientX - startX);
      if (corner.includes('w')) newWidth = startWidth - (e.clientX - startX);
      if (corner.includes('s')) newHeight = startHeight + (e.clientY - startY);
      if (corner.includes('n')) newHeight = startHeight - (e.clientY - startY);

      newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
      newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, newHeight));
      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (resizeRef.current) saveSize(size.width, size.height);
      resizeRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, size]);

  // Mode switching
  const handleModeChange = (mode: AIMode) => {
    if (mode === activeMode) return;
    const currentMessages = activeMode === 'chat' ? messages : activeMode === 'assist' ? assistMessages : agentMessages;
    if (currentMessages.length > 0) {
      // Just switch — don't require confirmation for simplicity
      startNewConversation();
    }
    setActiveMode(mode);
    setAssistMessages([]);
    setAgentMessages([]);
    setPendingActions([]);
  };

  // Submit handler
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

  // Chat mode submit (same as original)
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

  // Assist mode submit
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

      // Parse actions from the final content
      const { cleanText, actions } = parseActions(fullContent);
      const finalMsg: AssistMessage = { role: 'assistant', content: cleanText, actions };

      setAssistMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = finalMsg;
        return updated;
      });
      setPendingActions(prev => [...prev, ...actions]);

      // Save to DB as regular messages
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

  // Agent mode submit
  const handleAgentSubmit = async (userMsg: Message, convId: string, file: UploadedFile | null, abortController: AbortController) => {
    const newMessages: AgentMessage[] = [...agentMessages, { ...userMsg }];
    // Add placeholder assistant message immediately so loading dots show
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
        // Handle non-JSON error responses (e.g. 404 HTML pages)
        let errorMsg = `Agent request failed (${response.status})`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch {
          // Response wasn't JSON, use status text
          errorMsg = `Agent request failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      // Stream SSE for agent mode
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

      // Finalize — if no log entries came through, add a fallback text
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
      // Show error in the agent log instead of silently removing the message
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

  // Action handlers for Assist mode
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
    setIsOpen(false);
  }, [navigate, setIsOpen]);

  // Determine which messages to show
  const currentMessages = activeMode === 'chat' ? messages : activeMode === 'assist' ? assistMessages : agentMessages;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          drag={!isResizing}
          dragMomentum={false}
          dragElastic={0}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={{ width: size.width, height: size.height }}
          className="fixed bottom-4 left-4 z-50 flex flex-col bg-background border rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Resize handles */}
          <div className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-10 hover:bg-primary/10 rounded-bl transition-colors" onMouseDown={(e) => handleResizeStart(e, 'ne')} />
          <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10 hover:bg-primary/10 rounded-tl transition-colors" onMouseDown={(e) => handleResizeStart(e, 'se')} />
          <div className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-10 hover:bg-primary/10 rounded-tr transition-colors" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
          <div className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10 hover:bg-primary/10 rounded-br transition-colors" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
          <div className="absolute top-0 left-4 right-4 h-1 cursor-n-resize z-10 hover:bg-primary/20 transition-colors" onMouseDown={(e) => handleResizeStart(e, 'n')} />
          <div className="absolute bottom-0 left-4 right-4 h-1 cursor-s-resize z-10 hover:bg-primary/20 transition-colors" onMouseDown={(e) => handleResizeStart(e, 's')} />
          <div className="absolute left-0 top-4 bottom-4 w-1 cursor-w-resize z-10 hover:bg-primary/20 transition-colors" onMouseDown={(e) => handleResizeStart(e, 'w')} />
          <div className="absolute right-0 top-4 bottom-4 w-1 cursor-e-resize z-10 hover:bg-primary/20 transition-colors" onMouseDown={(e) => handleResizeStart(e, 'e')} />

          {/* Header with mode switcher */}
          <CLXAssistantHeader
            activeMode={activeMode}
            onModeChange={handleModeChange}
            showHistorySidebar={showHistorySidebar}
            onToggleHistory={() => setShowHistorySidebar(prev => !prev)}
            onNewChat={() => {
              startNewConversation();
              setAssistMessages([]);
              setAgentMessages([]);
              setPendingActions([]);
            }}
            onClose={() => setIsOpen(false)}
          />

          {/* Main content area */}
          <div className="flex-1 flex overflow-hidden">
            {/* History Sidebar */}
            <AnimatePresence>
              {showHistorySidebar && (
                <CLXAssistantHistory
                  conversations={conversations}
                  isLoading={isLoadingConversations}
                  currentConversationId={currentConversationId}
                  onLoad={async (id) => {
                    await loadConversation(id);
                    // Reset mode-specific state when loading history
                    setAssistMessages([]);
                    setAgentMessages([]);
                    setPendingActions([]);
                    setActiveMode('chat');
                  }}
                  onDelete={async (e, id) => {
                    e.stopPropagation();
                    await deleteConversation(id);
                  }}
                />
              )}
            </AnimatePresence>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 p-3" ref={scrollRef}>
                {currentMessages.length === 0 ? (
                  <CLXAssistantEmptyState
                    mode={activeMode}
                    currentPage={location.pathname}
                    suggestedTasks={suggestedTasks}
                    onSubmit={handleSubmit}
                  />
                ) : activeMode === 'chat' ? (
                  <ChatMessages
                    messages={messages}
                    isLoading={isLoading}
                    userAvatarUrl={teamMember?.avatar_url}
                    userName={teamMember?.name}
                  />
                ) : activeMode === 'assist' ? (
                  <AssistMessages
                    messages={assistMessages}
                    isLoading={isLoading}
                    userAvatarUrl={teamMember?.avatar_url}
                    userName={teamMember?.name}
                    onConfirmAction={handleConfirmAction}
                    onDismissAction={handleDismissAction}
                  />
                ) : (
                  <AgentMessages
                    messages={agentMessages}
                    isLoading={isLoading}
                    userAvatarUrl={teamMember?.avatar_url}
                    userName={teamMember?.name}
                    onUndoBatch={handleUndoBatch}
                    onViewChanges={handleViewChanges}
                  />
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
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CLXAssistant;
