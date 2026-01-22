import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Mail, 
  Send, 
  Inbox, 
  Loader2, 
  RefreshCw,
  Star,
  ArrowLeft,
  Trash2,
  Reply,
  Forward,
  Search,
  MoreVertical,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  File,
  Pencil,
  Bell,
  Plus,
  FileText,
  Zap,
  ExternalLink,
  LogOut
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, isToday, isYesterday, differenceInDays, subDays } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

// Dynamic callback URL based on current environment
const getGmailCallbackUrl = () => {
  const host = window.location.hostname;
  if (host.endsWith('.lovableproject.com')) {
    const id = host.replace('.lovableproject.com', '');
    return `https://id-preview--${id}.lovable.app/admin/inbox/callback`;
  }
  return `${window.location.origin}/admin/inbox/callback`;
};

interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body?: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  attachments?: { name: string; type: string }[];
}

const formatEmailDate = (dateString: string) => {
  const date = new Date(dateString);
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  const now = new Date();
  if (date.getFullYear() === now.getFullYear()) {
    return format(date, 'MMM d');
  }
  return format(date, 'MMM d, yyyy');
};

const extractSenderName = (from: string) => {
  const match = from.match(/^([^<]+)/);
  if (match) {
    return match[1].trim().replace(/"/g, '');
  }
  return from.split('@')[0];
};

const extractEmailAddress = (value: string) => {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value || '').trim();
};

const IlansGmail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'starred' | 'sent' | 'drafts'>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [isConnecting, setIsConnecting] = useState(false);

  // Check Gmail connection status for Ilan
  const { data: gmailConnection, isLoading: connectionLoading, refetch: refetchConnection } = useQuery({
    queryKey: ['ilan-gmail-connection'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_connections')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch emails from Gmail API
  const { data: emailsData, isLoading: emailsLoading, refetch: refetchEmails, error: emailsError } = useQuery({
    queryKey: ['ilan-gmail-emails', activeFolder],
    queryFn: async () => {
      if (!gmailConnection) return { emails: [], totalCount: 0, needsAuth: false };
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { emails: [], totalCount: 0, needsAuth: false };
      
      let query = 'in:inbox';
      if (activeFolder === 'sent') query = 'in:sent';
      else if (activeFolder === 'starred') query = 'is:starred';
      else if (activeFolder === 'drafts') query = 'in:drafts';
      
      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=list&q=${encodeURIComponent(query)}&maxResults=50`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        // Check if token is invalid and needs re-auth
        if (data.needsAuth) {
          return { emails: [], totalCount: 0, needsAuth: true };
        }
        throw new Error(data.error || 'Failed to fetch emails');
      }
      
      const emails = (data?.messages || []).map((msg: any) => ({
        id: msg.id,
        threadId: msg.threadId,
        subject: msg.subject || '(No Subject)',
        from: msg.from || '',
        to: msg.to || '',
        date: msg.date || new Date().toISOString(),
        snippet: msg.snippet || '',
        body: msg.body || '',
        isRead: !msg.isUnread,
        isStarred: msg.labelIds?.includes('STARRED') || false,
        labels: msg.labelIds || [],
        attachments: msg.attachments || [],
      })) as Email[];

      return { 
        emails, 
        totalCount: data?.resultSizeEstimate || emails.length,
        needsAuth: false
      };
    },
    enabled: !!gmailConnection,
    retry: false,
  });

  const emails = emailsData?.emails || [];
  const currentFolderCount = emailsData?.totalCount || 0;
  const needsReauth = emailsData?.needsAuth === true;

  // Fetch inbox count separately
  const { data: inboxCountData } = useQuery({
    queryKey: ['ilan-gmail-inbox-count'],
    queryFn: async () => {
      if (!gmailConnection) return 0;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return 0;
      
      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=list&q=${encodeURIComponent('in:inbox')}&maxResults=1`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      
      const data = await response.json();
      return data?.resultSizeEstimate || 0;
    },
    enabled: !!gmailConnection,
    staleTime: 60000,
  });

  // Fetch drafts count separately
  const { data: draftsCountData } = useQuery({
    queryKey: ['ilan-gmail-drafts-count'],
    queryFn: async () => {
      if (!gmailConnection) return 0;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return 0;
      
      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=list&q=${encodeURIComponent('in:drafts')}&maxResults=1`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      
      const data = await response.json();
      return data?.resultSizeEstimate || 0;
    },
    enabled: !!gmailConnection,
    staleTime: 60000,
  });

  const inboxCount = activeFolder === 'inbox' ? currentFolderCount : (inboxCountData || 0);
  const draftsCount = activeFolder === 'drafts' ? currentFolderCount : (draftsCountData || 0);

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async ({
      to,
      subject,
      body,
      threadId,
      inReplyTo,
    }: {
      to: string;
      subject: string;
      body: string;
      threadId?: string;
      inReplyTo?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ to, subject, body, threadId, inReplyTo }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      return data;
    },
    onSuccess: () => {
      toast.success('Email sent successfully!');
      setComposeOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      queryClient.invalidateQueries({ queryKey: ['ilan-gmail-emails'] });
    },
    onError: (error: any) => {
      toast.error('Failed to send email: ' + error.message);
    },
  });

  const handleSendEmail = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setSending(true);
    try {
      await sendEmailMutation.mutateAsync({
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
      });
    } finally {
      setSending(false);
    }
  };

  // Connect Gmail - full page redirect
  const connectGmail = async () => {
    setIsConnecting(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Please log in to connect Gmail');
      setIsConnecting(false);
      return;
    }

    try {
      const callbackUrl = getGmailCallbackUrl();
      
      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=get-oauth-url`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ redirect_uri: callbackUrl }),
        }
      );
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get auth URL');
      if (!data?.url) throw new Error('Missing auth URL');

      // Full page redirect instead of popup
      window.location.href = data.url;
    } catch (err) {
      console.error('Failed to get auth URL:', err);
      toast.error('Failed to connect Gmail');
      setIsConnecting(false);
    }
  };

  // Disconnect Gmail
  const disconnectGmail = async () => {
    try {
      const { error } = await supabase
        .from('gmail_connections')
        .delete()
        .eq('user_id', user?.id);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['ilan-gmail-connection'] });
      toast.success('Gmail disconnected');
    } catch (err) {
      toast.error('Failed to disconnect Gmail');
    }
  };

  const filteredEmails = useMemo(() => {
    if (!searchQuery.trim()) return emails;
    const query = searchQuery.toLowerCase();
    return emails.filter(
      (email) =>
        email.subject.toLowerCase().includes(query) ||
        email.from.toLowerCase().includes(query) ||
        email.snippet.toLowerCase().includes(query)
    );
  }, [emails, searchQuery]);

  if (connectionLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!gmailConnection) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] space-y-6">
          <div className="p-6 rounded-full bg-muted">
            <Mail className="h-16 w-16 text-muted-foreground" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold">Connect Your Gmail</h2>
            <p className="text-muted-foreground max-w-md">
              Connect your Gmail account to send and receive emails directly from your dashboard.
            </p>
          </div>
          <Button onClick={connectGmail} size="lg" disabled={isConnecting}>
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Connect Gmail
              </>
            )}
          </Button>
        </div>
      </AdminLayout>
    );
  }

  // Token expired/revoked - need to reconnect
  if (needsReauth) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] space-y-6">
          <div className="p-6 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Mail className="h-16 w-16 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold">Gmail Session Expired</h2>
            <p className="text-muted-foreground max-w-md">
              Your Gmail connection needs to be refreshed. Please reconnect to continue accessing your emails.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={disconnectGmail}>
              <Trash2 className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
            <Button onClick={async () => {
              await disconnectGmail();
              setTimeout(() => connectGmail(), 500);
            }} size="lg" disabled={isConnecting}>
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reconnecting...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reconnect Gmail
                </>
              )}
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-4rem)] bg-background">
        {/* Sidebar */}
        <div className="w-64 border-r flex flex-col">
          <div className="p-4">
            <Button onClick={() => setComposeOpen(true)} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Compose
            </Button>
          </div>
          
          <nav className="flex-1 px-2 space-y-1">
            <button
              onClick={() => { setActiveFolder('inbox'); setSelectedEmail(null); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                activeFolder === 'inbox' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-3">
                <Inbox className="h-4 w-4" />
                Inbox
              </div>
              {inboxCount > 0 && (
                <span className="text-xs font-medium">{inboxCount}</span>
              )}
            </button>
            
            <button
              onClick={() => { setActiveFolder('starred'); setSelectedEmail(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeFolder === 'starred' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
              }`}
            >
              <Star className="h-4 w-4" />
              Starred
            </button>
            
            <button
              onClick={() => { setActiveFolder('sent'); setSelectedEmail(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeFolder === 'sent' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
              }`}
            >
              <Send className="h-4 w-4" />
              Sent
            </button>
            
            <button
              onClick={() => { setActiveFolder('drafts'); setSelectedEmail(null); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                activeFolder === 'drafts' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4" />
                Drafts
              </div>
              {draftsCount > 0 && (
                <span className="text-xs font-medium">{draftsCount}</span>
              )}
            </button>
          </nav>

          {/* Connected account info */}
          <div className="p-4 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="truncate">{gmailConnection.email}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2"
                onClick={disconnectGmail}
              >
                <LogOut className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="border-b px-4 py-2 flex items-center gap-4">
            {selectedEmail && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEmail(null)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            <div className="flex-1 relative">
              <Input
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-3 max-w-md"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchEmails()}
              disabled={emailsLoading}
            >
              <RefreshCw className={`h-4 w-4 ${emailsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Email list or detail */}
          <ScrollArea className="flex-1">
            {selectedEmail ? (
              <div className="p-6 space-y-4">
                <h2 className="text-xl font-semibold">{selectedEmail.subject}</h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>From: {selectedEmail.from}</span>
                  <span>•</span>
                  <span>{formatEmailDate(selectedEmail.date)}</span>
                </div>
                <div className="border rounded-lg p-4 bg-muted/30">
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.body || selectedEmail.snippet }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setComposeTo(extractEmailAddress(selectedEmail.from));
                      setComposeSubject(`Re: ${selectedEmail.subject}`);
                      setComposeOpen(true);
                    }}
                  >
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                  </Button>
                </div>
              </div>
            ) : emailsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Mail className="h-12 w-12 mb-4" />
                <p>No emails found</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredEmails.map((email) => (
                  <div
                    key={email.id}
                    onClick={() => setSelectedEmail(email)}
                    className={`px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                      !email.isRead ? 'bg-primary/5 font-medium' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm">
                            {extractSenderName(email.from)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatEmailDate(email.date)}
                          </span>
                        </div>
                        <p className="text-sm truncate">{email.subject}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {email.snippet}
                        </p>
                      </div>
                      {email.isStarred && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Compose dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="recipient@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Subject"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Write your message..."
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default IlansGmail;
