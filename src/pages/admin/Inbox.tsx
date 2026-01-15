import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useGmail, GmailMessage } from '@/hooks/useGmail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  MailOpen,
  LogOut,
  Link as LinkIcon,
  Inbox as InboxIcon,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const Inbox = () => {
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

  useEffect(() => {
    if (status.connected) {
      fetchMessages();
    }
  }, [status.connected]);

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

  // Not connected state
  if (!status.connected) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Connect Gmail</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Connect your Gmail account to view and manage emails directly from the admin dashboard.
              </p>
              <Button onClick={connect} size="lg" className="gap-2">
                <LinkIcon className="w-4 h-4" />
                Connect Gmail Account
              </Button>
              <p className="text-xs text-muted-foreground">
                We only request access to read and send emails. Your credentials are stored securely.
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <InboxIcon className="w-8 h-8" />
              Inbox
            </h1>
            <p className="text-muted-foreground">
              Connected as {status.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={disconnect} className="gap-2">
              <LogOut className="w-4 h-4" />
              Disconnect
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-4">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" variant="secondary">Search</Button>
          </form>
          <Button onClick={refresh} variant="outline" size="icon" disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button onClick={() => setComposeOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Compose
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Message List */}
          <Card className={cn(
            "flex-shrink-0 transition-all",
            selectedMessage ? "w-96" : "flex-1"
          )}>
            <ScrollArea className="h-full">
              {loading && messages.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Mail className="w-10 h-10 mb-2" />
                  <p>No emails found</p>
                </div>
              ) : (
                <div>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      onClick={() => handleSelectMessage(message)}
                      className={cn(
                        "p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors",
                        message.isUnread && "bg-primary/5",
                        selectedMessage?.id === message.id && "bg-muted"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className={cn(
                          "font-medium truncate",
                          message.isUnread && "font-bold"
                        )}>
                          {parseFromName(message.from)}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(message.date)}
                        </span>
                      </div>
                      <div className={cn(
                        "text-sm truncate mb-1",
                        message.isUnread ? "font-medium" : "text-muted-foreground"
                      )}>
                        {message.subject}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {message.snippet}
                      </div>
                      {message.isUnread && (
                        <Badge variant="secondary" className="mt-2 text-xs">Unread</Badge>
                      )}
                    </div>
                  ))}
                  {hasMore && (
                    <div className="p-4 text-center">
                      <Button
                        variant="outline"
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
          </Card>

          {/* Message Detail */}
          {selectedMessage && (
            <Card className="flex-1 flex flex-col min-w-0">
              <CardHeader className="flex-shrink-0 pb-2">
                <div className="flex items-start justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMessage(null)}
                    className="gap-2 -ml-2 mb-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReplyOpen(true)}
                      className="gap-2"
                    >
                      <Reply className="w-4 h-4" />
                      Reply
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        archiveMessage(selectedMessage.id);
                        setSelectedMessage(null);
                      }}
                    >
                      <Archive className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        trashMessage(selectedMessage.id);
                        setSelectedMessage(null);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-xl">{selectedMessage.subject}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{parseFromName(selectedMessage.from)}</span>
                  <span>&lt;{parseFromEmail(selectedMessage.from)}&gt;</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(selectedMessage.date).toLocaleString()}
                </div>
              </CardHeader>
              <Separator />
              <ScrollArea className="flex-1 p-6">
                <div 
                  className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ 
                    __html: selectedMessage.body.replace(/\n/g, '<br/>') 
                  }}
                />
              </ScrollArea>
            </Card>
          )}
        </div>
      </div>

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              New Email
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
                rows={10}
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
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Reply className="w-5 h-5" />
              Reply to {selectedMessage && parseFromName(selectedMessage.from)}
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
                rows={10}
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
    </AdminLayout>
  );
};

export default Inbox;