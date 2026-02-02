import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Bot, 
  Send, 
  Loader2, 
  User, 
  X,
  Plus,
  History,
  Trash2,
  CheckCircle2,
  GripVertical,
  PanelLeftClose,
  PanelLeft,
  Paperclip,
  FileText,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAIAssistant } from '@/contexts/AIAssistantContext';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import chatgptLogo from '@/assets/chatgpt-logo.png';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface UploadedFile {
  name: string;
  type: string;
  content: string; // base64
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
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Resizable state
  const [size, setSize] = useState(getSavedSize);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number; corner: string } | null>(null);

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
    enabled: isOpen,
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
    enabled: isOpen,
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

      // Calculate delta based on corner
      if (corner.includes('e')) {
        newWidth = startWidth + (e.clientX - startX);
      }
      if (corner.includes('w')) {
        newWidth = startWidth - (e.clientX - startX);
      }
      if (corner.includes('s')) {
        newHeight = startHeight + (e.clientY - startY);
      }
      if (corner.includes('n')) {
        newHeight = startHeight - (e.clientY - startY);
      }

      // Clamp to min/max
      newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));
      newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, newHeight));

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (resizeRef.current) {
        saveSize(size.width, size.height);
      }
      resizeRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, size]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('File size must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setUploadedFile({
        name: file.name,
        type: file.type,
        content: base64,
      });
      toast.success(`Attached: ${file.name}`);
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeUploadedFile = () => {
    setUploadedFile(null);
  };

  const handleSubmit = async (messageText?: string) => {
    const text = messageText || input.trim();
    if ((!text && !uploadedFile) || isLoading) return;

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

    const userContent = uploadedFile 
      ? `${text}\n\n[Attached PDF: ${uploadedFile.name}]`
      : text;
    const userMsg: Message = { role: 'user', content: userContent };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    const fileToSend = uploadedFile;
    setUploadedFile(null);
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
            file: fileToSend,
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
  };

  const handleLoadConversation = async (id: string) => {
    await loadConversation(id);
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteConversation(id);
  };

  const toggleHistorySidebar = () => {
    setShowHistorySidebar(prev => !prev);
  };

  const generateTaskPrompt = (task: { title: string; priority: string | null; due_date: string | null }) => {
    return `Help me with this task: "${task.title}"`;
  };

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
          <div 
            className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-10 hover:bg-primary/10 rounded-bl transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'ne')}
          />
          <div 
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10 hover:bg-primary/10 rounded-tl transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'se')}
          />
          <div 
            className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-10 hover:bg-primary/10 rounded-tr transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
          />
          <div 
            className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10 hover:bg-primary/10 rounded-br transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'nw')}
          />
          {/* Edge resize handles */}
          <div 
            className="absolute top-0 left-4 right-4 h-1 cursor-n-resize z-10 hover:bg-primary/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'n')}
          />
          <div 
            className="absolute bottom-0 left-4 right-4 h-1 cursor-s-resize z-10 hover:bg-primary/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 's')}
          />
          <div 
            className="absolute left-0 top-4 bottom-4 w-1 cursor-w-resize z-10 hover:bg-primary/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'w')}
          />
          <div 
            className="absolute right-0 top-4 bottom-4 w-1 cursor-e-resize z-10 hover:bg-primary/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'e')}
          />
      {/* Draggable Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 text-muted-foreground/50">
            <GripVertical className="h-4 w-4" />
          </div>
          <img src={chatgptLogo} alt="ChatGPT" className="h-7 w-7 rounded-lg dark:invert dark:brightness-0 dark:invert" />
          <div>
            <h3 className="text-sm font-semibold">AI Assistant</h3>
            <p className="text-[10px] text-muted-foreground">Powered by OpenAI</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewChat} title="New Chat">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("h-7 w-7", showHistorySidebar && "bg-muted")} 
            onClick={toggleHistorySidebar} 
            title="Toggle History"
          >
            {showHistorySidebar ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content area with optional sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* History Sidebar */}
        <AnimatePresence>
          {showHistorySidebar && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 200, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-r bg-muted/30 overflow-hidden flex-shrink-0"
            >
              <ScrollArea className="h-full">
                <div className="p-2">
                  <div className="flex items-center gap-2 px-2 py-1 mb-2">
                    <img src={chatgptLogo} alt="ChatGPT" className="h-5 w-5 rounded dark:invert dark:brightness-0 dark:invert" />
                    <p className="text-xs font-medium text-muted-foreground">
                      History ({conversations.length})
                    </p>
                  </div>
                  {isLoadingConversations ? (
                    <div className="flex items-center justify-center h-20">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-20 text-center">
                      <History className="h-5 w-5 text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">No history</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {conversations.map((conv) => (
                        <div
                          key={conv.id}
                          onClick={() => handleLoadConversation(conv.id)}
                          className={cn(
                            "p-2 rounded-md cursor-pointer hover:bg-muted transition-colors group text-left",
                            currentConversationId === conv.id && "bg-primary/10 border border-primary/20"
                          )}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{conv.title || 'Untitled'}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {format(new Date(conv.updated_at), 'MMM d')}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={(e) => handleDeleteConversation(e, conv.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">(
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
                
                {/* Prompt Suggestions */}
                <div className="w-full px-2 space-y-3">
                  {/* Quick action prompts */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <Bot className="h-3 w-3" />
                      Quick prompts:
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-auto py-2 px-3 justify-start text-left"
                        onClick={() => handleSubmit("What leads need follow-up today?")}
                      >
                        <span className="truncate">What leads need follow-up today?</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-auto py-2 px-3 justify-start text-left"
                        onClick={() => handleSubmit("Summarize my pipeline status")}
                      >
                        <span className="truncate">Summarize my pipeline status</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-auto py-2 px-3 justify-start text-left"
                        onClick={() => handleSubmit("What are my overdue tasks?")}
                      >
                        <span className="truncate">What are my overdue tasks?</span>
                      </Button>
                    </div>
                  </div>
                  
                  {/* Task-based suggestions */}
                  {suggestedTasks.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Help with your tasks:
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
            {/* Uploaded file indicator */}
            {uploadedFile && (
              <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-md">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs truncate flex-1">{uploadedFile.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  onClick={removeUploadedFile}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="flex gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Attach PDF"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
                disabled={isLoading}
                className="flex-1 h-9 text-sm"
              />
              <Button type="submit" size="sm" disabled={isLoading || (!input.trim() && !uploadedFile)} className="h-9 w-9 p-0">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingAIChat;
