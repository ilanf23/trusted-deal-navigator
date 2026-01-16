import { useState, useEffect } from 'react';
import { useGmail, GmailMessage } from '@/hooks/useGmail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DraggableBox } from '@/components/ui/draggable-box';
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
  ArrowLeft,
  Sparkles,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import gmailLogo from '@/assets/gmail-logo.png';

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
  leadId?: string;
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
  const [generatingAI, setGeneratingAI] = useState(false);
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (status.connected && isOpen && !isMinimized) {
      fetchMessages();
    }
  }, [status.connected, isOpen, isMinimized]);

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

  useEffect(() => {
    if (leadId && isOpen) {
      setCurrentLeadId(leadId);
    }
  }, [leadId, isOpen]);

  useEffect(() => {
    if (composeOpen) {
      setAiMessages([]);
      setAiInput('');
      setShowAIPanel(false);
    }
  }, [composeOpen]);

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

  // Minimized button
  if (isMinimized && isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="gap-2 shadow-lg"
          size="lg"
        >
          <img src={gmailLogo} alt="Gmail" className="w-5 h-5 object-contain" />
          Email
          {messages.filter(m => m.isUnread).length > 0 && (
            <Badge variant="destructive" className="ml-1">
              {messages.filter(m => m.isUnread).length}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  const headerContent = status.connected ? (
    <span className="text-xs text-muted-foreground mr-2">({status.email})</span>
  ) : null;

  return (
    <>
      <DraggableBox
        id="inbox"
        title="Email"
        icon={<img src={gmailLogo} alt="Gmail" className="w-5 h-5 object-contain" />}
        isOpen={isOpen}
        onClose={onClose}
        defaultWidth={450}
        defaultHeight={600}
        minWidth={350}
        minHeight={400}
        maxWidth={700}
        maxHeight={800}
        defaultCorner="bottom-right"
        headerContent={headerContent}
        onMinimize={() => setIsMinimized(true)}
      >
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
            <div className="p-3 border-b flex items-center justify-between shrink-0">
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
            <div className="p-4 border-b shrink-0">
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
            <div className="p-2 border-b flex items-center gap-2 shrink-0">
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
      </DraggableBox>

      {/* Compose Box */}
      <DraggableBox
        id="compose"
        title="New Email"
        icon={<Send className="w-4 h-4 text-primary" />}
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        defaultWidth={450}
        defaultHeight={550}
        minWidth={350}
        minHeight={400}
        maxWidth={700}
        maxHeight={800}
        defaultCorner="bottom-left"
        headerContent={
          currentLeadId && (
            <Button
              variant={showAIPanel ? "default" : "outline"}
              size="sm"
              onClick={() => setShowAIPanel(!showAIPanel)}
              className="gap-1.5 h-7 text-xs mr-2"
            >
              <Sparkles className="w-3 h-3" />
              AI
            </Button>
          )
        }
      >
        {/* AI Assistant Section */}
        {showAIPanel && currentLeadId && (
          <div className="border-b flex flex-col shrink-0" style={{ maxHeight: '45%' }}>
            {/* Quick Prompts */}
            {aiMessages.length === 0 && (
              <div className="p-3 border-b shrink-0 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-2">Quick prompts:</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Rate Alert', prompt: 'Write a compelling rate alert email.', Icon: Sparkles },
                    { label: 'Check-In', prompt: 'Write a friendly check-in email.', Icon: RefreshCw },
                    { label: 'Follow Up', prompt: 'Write a professional follow-up email.', Icon: Mail },
                    { label: 'Introduction', prompt: 'Write a warm introduction email.', Icon: User },
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

            {/* AI Messages */}
            <ScrollArea className="flex-1 min-h-0 p-3">
              {aiMessages.length === 0 ? (
                <div className="text-center text-muted-foreground py-2">
                  <p className="text-xs">AI-powered email generation</p>
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
              <div className="px-3 py-2 border-t bg-muted/30 shrink-0">
                <Button 
                  size="sm" 
                  onClick={() => {
                    const lastAssistant = [...aiMessages].reverse().find(m => m.role === 'assistant');
                    if (lastAssistant) {
                      const lines = lastAssistant.content.split('\n').filter(l => l.trim());
                      let subject = `Email for Lead`;
                      let body = lastAssistant.content;
                      
                      if (lines[0]?.toLowerCase().startsWith('subject:')) {
                        subject = lines[0].replace(/^subject:\s*/i, '').trim();
                        body = lines.slice(1).join('\n').trim();
                      }
                      
                      setComposeSubject(subject);
                      setComposeBody(body);
                      toast({ title: 'Email content applied' });
                    }
                  }}
                  className="w-full gap-1 h-7 text-xs"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Use in Email Below
                </Button>
              </div>
            )}

            {/* AI Input */}
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

        {/* Email Compose Form */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 flex flex-col p-4 space-y-3 overflow-y-auto">
            <div className="space-y-1.5 shrink-0">
              <Label className="text-xs">To</Label>
              <Input
                placeholder="recipient@example.com"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5 shrink-0">
              <Label className="text-xs">Subject</Label>
              <Input
                placeholder="Subject"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5 flex-1 flex flex-col min-h-[100px]">
              <Label className="text-xs">Message</Label>
              <Textarea
                placeholder="Write your message..."
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                className="flex-1 min-h-[80px] resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t flex justify-end gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setComposeOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSend} disabled={sending || !composeTo || !composeSubject || !composeBody}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            Send
          </Button>
        </div>
      </DraggableBox>

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
