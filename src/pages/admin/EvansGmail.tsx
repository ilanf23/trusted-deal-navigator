import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Mail, 
  Send, 
  Inbox, 
  FileEdit, 
  Loader2, 
  RefreshCw,
  Star,
  Clock,
  ArrowLeft,
  Trash2,
  Reply,
  Forward,
  Search,
  MoreVertical,
  ChevronDown,
  File,
  Pencil
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, isToday, isYesterday } from 'date-fns';

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
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
}

const formatEmailDate = (dateString: string) => {
  const date = new Date(dateString);
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  return format(date, 'MMM d');
};

const extractSenderName = (from: string) => {
  // Extract name from "Name <email@example.com>" format
  const match = from.match(/^([^<]+)/);
  if (match) {
    return match[1].trim().replace(/"/g, '');
  }
  return from.split('@')[0];
};

const EvansGmail = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'starred' | 'snoozed' | 'sent' | 'drafts'>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  // Check Gmail connection status
  const { data: gmailConnection, isLoading: connectionLoading } = useQuery({
    queryKey: ['gmail-connection'],
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
  const { data: emails = [], isLoading: emailsLoading, refetch: refetchEmails } = useQuery({
    queryKey: ['gmail-emails', activeFolder],
    queryFn: async () => {
      if (!gmailConnection) return [];
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      
      let query = 'in:inbox';
      if (activeFolder === 'sent') query = 'in:sent';
      else if (activeFolder === 'starred') query = 'is:starred';
      else if (activeFolder === 'drafts') query = 'in:drafts';
      else if (activeFolder === 'snoozed') query = 'is:snoozed';
      
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
        throw new Error(data.error || 'Failed to fetch emails');
      }
      
      return (data?.messages || []).map((msg: any) => ({
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
      })) as Email[];
    },
    enabled: !!gmailConnection,
  });

  // Inbox count
  const inboxCount = emails.filter(e => !e.isRead && activeFolder === 'inbox').length || 0;

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async ({ to, subject, body }: { to: string; subject: string; body: string }) => {
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
          body: JSON.stringify({ to, subject, body }),
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
      setSelectedLead(null);
      queryClient.invalidateQueries({ queryKey: ['gmail-emails'] });
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
        to: composeTo.trim(),
        subject: composeSubject.trim(),
        body: composeBody.trim(),
      });
    } finally {
      setSending(false);
    }
  };

  const handleConnectGmail = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in first');
        return;
      }

      const redirectUri = `${window.location.origin}/admin/inbox/callback`;
      
      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=get-oauth-url`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ redirect_uri: redirectUri }),
        }
      );
      
      const data = await response.json();
      
      if (data?.url) {
        localStorage.setItem('gmail_return_path', '/user/evan/gmail');
        window.location.href = data.url;
      } else {
        toast.error('Failed to get OAuth URL');
      }
    } catch (error: any) {
      toast.error('Failed to start Gmail connection: ' + error.message);
    }
  };

  const toggleEmailSelection = (emailId: string) => {
    const newSelection = new Set(selectedEmails);
    if (newSelection.has(emailId)) {
      newSelection.delete(emailId);
    } else {
      newSelection.add(emailId);
    }
    setSelectedEmails(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map(e => e.id)));
    }
  };

  if (connectionLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  // Show connection prompt if not connected
  if (!gmailConnection) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Connect Your Gmail</h2>
            <p className="text-muted-foreground mb-6">
              Connect your Gmail account to send and receive emails directly from this portal.
            </p>
            <Button onClick={handleConnectGmail} size="lg" className="gap-2">
              <Mail className="w-5 h-5" />
              Connect Gmail Account
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              We'll only access your email with your permission.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Email detail view
  if (selectedEmail) {
    return (
      <AdminLayout>
        <div className="h-[calc(100vh-120px)] flex flex-col bg-background">
          {/* Top bar */}
          <div className="flex items-center gap-2 p-2 border-b">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSelectedEmail(null)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="icon">
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Email content */}
          <ScrollArea className="flex-1 p-6">
            <div className="max-w-4xl">
              <h1 className="text-2xl font-normal mb-6">{selectedEmail.subject}</h1>
              
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                  {extractSenderName(selectedEmail.from).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{extractSenderName(selectedEmail.from)}</span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(selectedEmail.date), 'MMM d, yyyy, h:mm a')}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    to me
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <Star className={`w-5 h-5 ${selectedEmail.isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                </Button>
              </div>
              
              <div className="prose prose-sm max-w-none pl-14">
                <div dangerouslySetInnerHTML={{ __html: selectedEmail.body || selectedEmail.snippet }} />
              </div>
              
              <div className="flex gap-2 mt-8 pl-14">
                <Button variant="outline" size="sm">
                  <Reply className="w-4 h-4 mr-2" />
                  Reply
                </Button>
                <Button variant="outline" size="sm">
                  <Forward className="w-4 h-4 mr-2" />
                  Forward
                </Button>
              </div>
            </div>
          </ScrollArea>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="h-[calc(100vh-120px)] flex bg-background rounded-lg border overflow-hidden">
        {/* Left Sidebar - Gmail style */}
        <div className="w-64 border-r flex flex-col bg-card/50">
          {/* Compose Button */}
          <div className="p-4">
            <Button 
              onClick={() => setComposeOpen(true)}
              className="w-full justify-start gap-3 h-14 rounded-2xl shadow-md hover:shadow-lg transition-shadow"
              size="lg"
            >
              <Pencil className="w-5 h-5" />
              Compose
            </Button>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-2">
            <button
              onClick={() => setActiveFolder('inbox')}
              className={`w-full flex items-center gap-4 px-4 py-2 rounded-r-full text-sm font-medium transition-colors ${
                activeFolder === 'inbox' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Inbox className="w-5 h-5" />
              <span className="flex-1 text-left">Inbox</span>
              {inboxCount > 0 && (
                <span className="text-xs font-bold">{inboxCount}</span>
              )}
            </button>
            
            <button
              onClick={() => setActiveFolder('starred')}
              className={`w-full flex items-center gap-4 px-4 py-2 rounded-r-full text-sm font-medium transition-colors ${
                activeFolder === 'starred' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Star className="w-5 h-5" />
              <span className="flex-1 text-left">Starred</span>
            </button>
            
            <button
              onClick={() => setActiveFolder('snoozed')}
              className={`w-full flex items-center gap-4 px-4 py-2 rounded-r-full text-sm font-medium transition-colors ${
                activeFolder === 'snoozed' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span className="flex-1 text-left">Snoozed</span>
            </button>
            
            <button
              onClick={() => setActiveFolder('sent')}
              className={`w-full flex items-center gap-4 px-4 py-2 rounded-r-full text-sm font-medium transition-colors ${
                activeFolder === 'sent' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Send className="w-5 h-5" />
              <span className="flex-1 text-left">Sent</span>
            </button>
            
            <button
              onClick={() => setActiveFolder('drafts')}
              className={`w-full flex items-center gap-4 px-4 py-2 rounded-r-full text-sm font-medium transition-colors ${
                activeFolder === 'drafts' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <File className="w-5 h-5" />
              <span className="flex-1 text-left">Drafts</span>
            </button>
            
            <button className="w-full flex items-center gap-4 px-4 py-2 rounded-r-full text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <ChevronDown className="w-5 h-5" />
              <span className="flex-1 text-left">More</span>
            </button>
          </nav>
          
          {/* Labels section */}
          <div className="p-4 border-t">
            <div className="flex items-center justify-between text-sm font-medium text-muted-foreground mb-2">
              <span>Labels</span>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <span className="text-lg">+</span>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Search Bar */}
          <div className="p-4 border-b">
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search mail"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 rounded-full bg-muted/50 border-0 focus-visible:ring-1"
              />
            </div>
          </div>
          
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b">
            <Checkbox 
              checked={selectedEmails.size === emails.length && emails.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetchEmails()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="w-4 h-4" />
            </Button>
            <div className="flex-1" />
            <span className="text-sm text-muted-foreground">
              1–{emails.length} of {emails.length}
            </span>
          </div>
          
          {/* Email List */}
          <ScrollArea className="flex-1">
            {emailsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Inbox className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg">No emails in {activeFolder}</p>
              </div>
            ) : (
              <div>
                {emails.map((email) => (
                  <div
                    key={email.id}
                    className={`flex items-center gap-2 px-4 py-2 border-b cursor-pointer transition-colors hover:shadow-sm ${
                      !email.isRead ? 'bg-white font-medium' : 'bg-muted/20'
                    } ${selectedEmails.has(email.id) ? 'bg-blue-50' : ''}`}
                  >
                    <Checkbox 
                      checked={selectedEmails.has(email.id)}
                      onCheckedChange={() => toggleEmailSelection(email.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Toggle star logic here
                      }}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <Star className={`w-4 h-4 ${email.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                    </button>
                    
                    <div 
                      className="flex-1 flex items-center gap-4 min-w-0"
                      onClick={() => setSelectedEmail(email)}
                    >
                      {/* Sender */}
                      <div className={`w-48 truncate ${!email.isRead ? 'font-semibold' : ''}`}>
                        {activeFolder === 'sent' ? `To: ${email.to.split('<')[0].trim()}` : extractSenderName(email.from)}
                      </div>
                      
                      {/* Subject and snippet */}
                      <div className="flex-1 flex items-baseline gap-2 min-w-0">
                        <span className={`truncate ${!email.isRead ? 'font-semibold' : ''}`}>
                          {email.subject}
                        </span>
                        <span className="text-muted-foreground truncate text-sm">
                          - {email.snippet}
                        </span>
                      </div>
                      
                      {/* Date */}
                      <div className={`text-sm whitespace-nowrap ${!email.isRead ? 'font-semibold' : 'text-muted-foreground'}`}>
                        {formatEmailDate(email.date)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Compose Dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {selectedLead ? `Email to ${selectedLead.name}` : 'New Message'}
            </DialogTitle>
            <DialogDescription>
              Compose and send an email
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="email"
                placeholder="recipient@example.com"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Email subject"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                placeholder="Write your message..."
                className="min-h-[200px]"
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setComposeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={sending}>
              {sending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default EvansGmail;
