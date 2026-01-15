import { useState, useEffect, useRef } from 'react';
import { useGmail, GmailMessage } from '@/hooks/useGmail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Mail,
  Search,
  RefreshCw,
  Archive,
  Trash2,
  Reply,
  Send,
  Plus,
  Loader2,
  LogOut,
  Link as LinkIcon,
  X,
  Minimize2,
  Maximize2,
  ArrowLeft,
  GripVertical,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface PrefilledEmail {
  to: string;
  subject: string;
  body: string;
  leadId?: string;
}

interface FloatingInboxProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledEmail?: PrefilledEmail | null;
  onPrefilledEmailHandled?: () => void;
  leadId?: string; // For AI email generation without prefilled content
}

const FloatingInbox = ({ isOpen, onClose, prefilledEmail, onPrefilledEmailHandled, leadId }: FloatingInboxProps) => {
  const { toast } = useToast();
  const {
    status,
    messages,
    loading,
    hasMore,
    connect,
    disconnect,
    fetchMessages,
    sendMessage,
    archiveMessage,
    trashMessage,
    markAsRead,
    refresh,
  } = useGmail();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<GmailMessage | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [panelWidth, setPanelWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status.connected && isOpen && !isMinimized) {
      fetchMessages();
    }
  }, [status.connected, isOpen, isMinimized]);

  // Handle prefilled email data
  useEffect(() => {
    if (prefilledEmail && isOpen) {
      setComposeTo(prefilledEmail.to);
      setComposeSubject(prefilledEmail.subject);
      setComposeBody(prefilledEmail.body);
      if (prefilledEmail.leadId) {
        setCurrentLeadId(prefilledEmail.leadId);
      }
      setComposeOpen(true);
      onPrefilledEmailHandled?.();
    }
  }, [prefilledEmail, isOpen]);

  // Set leadId from prop when opening
  useEffect(() => {
    if (leadId && isOpen) {
      setCurrentLeadId(leadId);
    }
  }, [leadId, isOpen]);

  // Reset AI state when compose dialog opens
  useEffect(() => {
    if (composeOpen) {
      setAiMessages([]);
      setAiInput('');
      setShowAIPanel(false);
    }
  }, [composeOpen]);

  const generateAIEmail = async (emailType: string = 'general') => {
    if (!currentLeadId) {
      toast({
        title: "No lead selected",
        description: "AI email generation requires a lead to be selected.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-lead-email', {
        body: { leadId: currentLeadId, emailType },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setComposeTo(data.to || composeTo);
      setComposeSubject(data.subject);
      setComposeBody(data.body);

      toast({
        title: "Email generated",
        description: `AI-powered email created for ${data.leadName}`,
      });
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleAISend = async (messageText: string) => {
    if (!messageText.trim() || !currentLeadId) return;

    const userMessage = { role: 'user' as const, content: messageText };
    setAiMessages(prev => [...prev, userMessage]);
    setAiInput('');
    setAiLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-email-chat', {
        body: {
          leadId: currentLeadId,
          messages: [...aiMessages, userMessage],
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const assistantMessage = { role: 'assistant' as const, content: data.response };
      setAiMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('AI chat error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to get AI response',
        variant: 'destructive',
      });
      setAiMessages(prev => prev.slice(0, -1));
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.max(320, Math.min(800, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMessages(searchQuery);
  };

  const handleSelectMessage = (message: GmailMessage) => {
    setSelectedMessage(message);
    if (message.isUnread) {
      markAsRead(message.id, true);
    }
  };

  const handleSend = async () => {
    if (!composeTo || !composeSubject || !composeBody) return;
    
    setSending(true);
    const success = await sendMessage(composeTo, composeSubject, composeBody);
    setSending(false);
    
    if (success) {
      setComposeOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      refresh();
    }
  };

  const handleReply = async () => {
    if (!selectedMessage || !composeBody) return;
    
    const replyTo = selectedMessage.from.match(/<(.+)>/)?.[1] || selectedMessage.from;
    
    setSending(true);
    const success = await sendMessage(
      replyTo,
      `Re: ${selectedMessage.subject}`,
      composeBody,
      selectedMessage.threadId,
      selectedMessage.id
    );
    setSending(false);
    
    if (success) {
      setReplyOpen(false);
      setComposeBody('');
      refresh();
    }
  };

  const parseFromName = (from: string) => {
    const match = from.match(/^"?([^"<]+)"?\s*<?/);
    return match?.[1]?.trim() || from;
  };

  const parseFromEmail = (from: string) => {
    const match = from.match(/<(.+)>/);
    return match?.[1] || from;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      return isToday ? format(date, 'h:mm a') : format(date, 'MMM d');
    } catch {
      return dateString;
    }
  };

  if (!isOpen) return null;

  // Minimized state
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="gap-2 shadow-lg"
          size="lg"
        >
          <Mail className="w-5 h-5" />
          Inbox
          {messages.filter(m => m.isUnread).length > 0 && (
            <Badge variant="destructive" className="ml-1">
              {messages.filter(m => m.isUnread).length}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Resize overlay */}
      {isResizing && (
        <div className="fixed inset-0 z-40 cursor-ew-resize" />
      )}
      
      <div
        ref={panelRef}
        style={{ width: panelWidth }}
        className="fixed top-0 right-0 h-screen bg-card border-l shadow-2xl z-50 flex flex-col"
      >
        {/* Resize handle */}
        <div
          onMouseDown={() => setIsResizing(true)}
          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-primary/20 flex items-center justify-center group"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            <span className="font-semibold">Inbox</span>
            {status.connected && (
              <span className="text-xs text-muted-foreground">({status.email})</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setIsMinimized(true)} className="h-8 w-8">
              <Minimize2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Not connected state */}
        {!status.connected ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Mail className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Connect Gmail</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  View and manage emails directly here.
                </p>
              </div>
              <Button onClick={connect} className="gap-2">
                <LinkIcon className="w-4 h-4" />
                Connect Gmail
              </Button>
            </div>
          </div>
        ) : selectedMessage ? (
          /* Message Detail View */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-3 border-b flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedMessage(null)}
                className="gap-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setReplyOpen(true)}
                  className="h-8 w-8"
                >
                  <Reply className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    archiveMessage(selectedMessage.id);
                    setSelectedMessage(null);
                  }}
                  className="h-8 w-8"
                >
                  <Archive className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    trashMessage(selectedMessage.id);
                    setSelectedMessage(null);
                  }}
                  className="h-8 w-8"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-lg mb-2">{selectedMessage.subject}</h3>
              <div className="text-sm">
                <span className="font-medium">{parseFromName(selectedMessage.from)}</span>
                <span className="text-muted-foreground ml-1">&lt;{parseFromEmail(selectedMessage.from)}&gt;</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(selectedMessage.date).toLocaleString()}
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div 
                className="p-4 text-sm whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ 
                  __html: selectedMessage.body.replace(/\n/g, '<br/>') 
                }}
              />
            </ScrollArea>
          </div>
        ) : (
          /* Message List View */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Toolbar */}
            <div className="p-2 border-b flex items-center gap-2">
              <form onSubmit={handleSearch} className="flex-1 flex gap-1">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </form>
              <Button variant="ghost" size="icon" onClick={refresh} disabled={loading} className="h-8 w-8">
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setComposeOpen(true)} className="h-8 w-8">
                <Plus className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={disconnect} className="h-8 w-8">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1">
              {loading && messages.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Mail className="w-8 h-8 mb-2" />
                  <p className="text-sm">No emails found</p>
                </div>
              ) : (
                <div>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      onClick={() => handleSelectMessage(message)}
                      className={cn(
                        "p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors",
                        message.isUnread && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className={cn(
                          "text-sm truncate",
                          message.isUnread && "font-bold"
                        )}>
                          {parseFromName(message.from)}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(message.date)}
                        </span>
                      </div>
                      <div className={cn(
                        "text-sm truncate",
                        message.isUnread ? "font-medium" : "text-muted-foreground"
                      )}>
                        {message.subject}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {message.snippet}
                      </div>
                    </div>
                  ))}
                  {hasMore && (
                    <div className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchMessages(searchQuery, true)}
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load more'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Compose Dialog with AI Assistant Side Panel */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-[500px] overflow-visible">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                New Email
              </span>
              {currentLeadId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAIPanel(!showAIPanel)}
                  className="gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {showAIPanel ? 'Hide AI' : 'AI Generate'}
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                placeholder="recipient@example.com"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                placeholder="Subject"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Write your message..."
                rows={8}
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending || !composeTo || !composeSubject || !composeBody}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send
            </Button>
          </DialogFooter>
          
          {/* AI Assistant Side Panel - Attached to Dialog */}
          {showAIPanel && currentLeadId && (
            <div className="absolute left-0 top-0 -translate-x-full w-[420px] h-full bg-card border border-r-0 rounded-l-lg shadow-lg flex flex-col">
              {/* AI Header */}
              <div className="flex items-center justify-between p-3 border-b bg-muted/50 shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">AI Email Assistant</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowAIPanel(false)} className="h-7 w-7">
                  <X className="w-3 h-3" />
                </Button>
              </div>

              {/* Quick Prompts */}
              {aiMessages.length === 0 && (
                <div className="p-3 border-b shrink-0">
                  <p className="text-xs text-muted-foreground mb-2">Quick prompts:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Rate Alert', prompt: 'Write a compelling rate alert email. Their target rate has been reached and it\'s time to refinance.', Icon: Sparkles },
                      { label: 'Check-In', prompt: 'Write a friendly check-in email. Ask how they\'re doing and if their financing needs have changed.', Icon: RefreshCw },
                      { label: 'Follow Up', prompt: 'Write a professional follow-up email. Reference their loan inquiry and offer to answer questions.', Icon: Mail },
                      { label: 'Introduction', prompt: 'Write a warm introduction email. Thank them for their interest and explain how we can help.', Icon: Loader2 },
                    ].map((item) => (
                      <Button
                        key={item.label}
                        variant="outline"
                        size="sm"
                        className="justify-start h-7 text-xs"
                        onClick={() => handleAISend(item.prompt)}
                        disabled={aiLoading}
                      >
                        <item.Icon className="w-3 h-3 mr-1.5 shrink-0" />
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Messages */}
              <ScrollArea className="flex-1 p-3">
                {aiMessages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-6">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Select a prompt or type your request.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {aiMessages.map((message, index) => (
                      <div
                        key={index}
                        className={cn(
                          'flex gap-2',
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[90%] rounded-lg px-3 py-2',
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          )}
                        >
                          <p className="whitespace-pre-wrap text-xs">{message.content}</p>
                        </div>
                      </div>
                    ))}
                    {aiLoading && (
                      <div className="flex gap-2 justify-start">
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* Use Email Button */}
              {aiMessages.some(m => m.role === 'assistant') && (
                <div className="p-2 border-t bg-muted/30 shrink-0">
                  <Button 
                    size="sm" 
                    onClick={() => {
                      const lastAssistant = [...aiMessages].reverse().find(m => m.role === 'assistant');
                      if (lastAssistant) {
                        // Try to extract subject and body from the response
                        const lines = lastAssistant.content.split('\n').filter(l => l.trim());
                        let subject = `Email for Lead`;
                        let body = lastAssistant.content;
                        
                        // Check if first line looks like a subject
                        if (lines[0]?.toLowerCase().startsWith('subject:')) {
                          subject = lines[0].replace(/^subject:\s*/i, '').trim();
                          body = lines.slice(1).join('\n').trim();
                        }
                        
                        setComposeSubject(subject);
                        setComposeBody(body);
                        toast({ title: 'Email content applied' });
                      }
                    }}
                    className="w-full gap-1 h-8"
                  >
                    <Mail className="w-3 h-3" />
                    Use in Email
                  </Button>
                </div>
              )}

              {/* Input Area */}
              <div className="p-2 border-t shrink-0">
                <div className="flex gap-1.5">
                  <Input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Ask AI to write an email..."
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAISend(aiInput);
                      }
                    }}
                    disabled={aiLoading}
                  />
                  <Button 
                    size="icon" 
                    className="h-8 w-8 shrink-0" 
                    onClick={() => handleAISend(aiInput)}
                    disabled={aiLoading || !aiInput.trim()}
                  >
                    {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Reply className="w-5 h-5" />
              Reply
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <strong>Re: {selectedMessage?.subject}</strong>
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Write your reply..."
                rows={8}
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReply} disabled={sending || !composeBody}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send Reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FloatingInbox;
export type { PrefilledEmail };