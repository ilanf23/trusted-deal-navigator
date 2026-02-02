import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Bot, 
  Send, 
  Loader2, 
  User, 
  Sparkles,
  X,
  Plus,
  History,
  Trash2,
  ChevronLeft,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAIAssistant } from '@/contexts/AIAssistantContext';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const FloatingAIChat = () => {
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
  } = useAIAssistant();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch Evan's team member ID
  const { data: evanTeamMember } = useQuery({
    queryKey: ['evan-team-member-ai'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .ilike('name', 'evan')
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch suggested tasks (incomplete, high priority or due soon)
  const { data: suggestedTasks = [] } = useQuery({
    queryKey: ['ai-suggested-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_tasks')
        .select('id, title, priority, due_date')
        .eq('is_completed', false)
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  // Auto-scroll and focus when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    // Create conversation if needed
    let convId = currentConversationId;
    if (!convId) {
      convId = await createConversation();
      if (!convId) {
        toast.error('Failed to create conversation');
        return;
      }
      setCurrentConversationId(convId);
    }

    const userMsg: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evan-ai-assistant`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            messages: newMessages,
            evanId: evanTeamMember?.id,
          }),
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

      // Save messages to database
      const finalMessages = [...newMessages, { role: 'assistant' as const, content: assistantContent }];
      setMessages(finalMessages);
      if (convId) {
        await saveMessages(convId, finalMessages);
      }
    } catch (error: any) {
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
      inputRef.current?.focus();
    }
  };

  const handleNewChat = () => {
    startNewConversation();
    setShowHistory(false);
  };

  const handleLoadConversation = async (id: string) => {
    await loadConversation(id);
    setShowHistory(false);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteConversation(id);
  };

  const generateTaskPrompt = (task: { title: string; priority: string | null; due_date: string | null }) => {
    return `Help me with this task: "${task.title}"`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 w-[400px] h-[520px] flex flex-col bg-background border rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          {showHistory && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(false)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              {showHistory ? 'Conversation History' : 'AI Assistant'}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {showHistory ? `${conversations.length} conversations` : 'Powered by Lovable AI'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!showHistory && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewChat} title="New Chat">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(true)} title="History">
                <History className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showHistory ? (
        /* History View */
        <ScrollArea className="flex-1 p-3">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <History className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleLoadConversation(conv.id)}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors group",
                    currentConversationId === conv.id && "bg-primary/5 border-primary/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conv.title || 'Untitled'}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(conv.updated_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      ) : (
        /* Chat View */
        <>
          <ScrollArea className="flex-1 p-3" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-4">
                <div className="p-3 rounded-full bg-primary/10 mb-3">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <h4 className="text-sm font-medium mb-1">How can I help?</h4>
                <p className="text-xs text-muted-foreground max-w-[250px] mb-4">
                  I have access to your leads, tasks, and pipeline data.
                </p>
                
                {suggestedTasks.length > 0 && (
                  <div className="w-full px-2">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Suggested from your tasks:
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {suggestedTasks.map((task) => (
                        <Button
                          key={task.id}
                          variant="outline"
                          size="sm"
                          className="text-xs h-auto py-2 px-3 justify-start text-left"
                          onClick={() => handleSubmit(generateTaskPrompt(task))}
                        >
                          <div className="flex items-start gap-2 w-full">
                            <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                            <span className="truncate">{task.title}</span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex gap-2",
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {msg.role === 'assistant' && (
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          <Bot className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      <div className="text-xs leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                    {msg.role === 'user' && (
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="bg-muted text-xs">
                          <User className="h-3 w-3" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {isLoading && messages[messages.length - 1]?.content === '' && (
                  <div className="flex gap-2">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        <Bot className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:0.1s]" />
                        <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:0.2s]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t bg-muted/30">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="flex gap-2"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
                disabled={isLoading}
                className="flex-1 h-9 text-sm"
              />
              <Button type="submit" size="sm" disabled={isLoading || !input.trim()} className="h-9 w-9 p-0">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default FloatingAIChat;
