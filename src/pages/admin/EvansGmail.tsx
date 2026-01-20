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

// Email templates for quick draft creation
const EMAIL_TEMPLATES = [
  {
    id: 'deal-status',
    name: 'Deal Status Update',
    subject: 'Deal status update and next steps',
    body: `Hi {{Borrower Name}},

Quick update on where things stand with the lenders.

Wendy has completed outreach and we are currently in active review with {{Lender Name}}. They are working through the file now, with initial feedback expected shortly. On our side, the package is in good shape and nothing additional is needed from you at the moment.

While the lender reviews, we're:
• Monitoring timing closely
• Preparing for likely follow-up questions
• Keeping a backup option warm in parallel

Next step will be lender feedback, and I'll update you as soon as that comes in. If anything changes on your timeline or priorities, let me know so we can factor it in.

Best,
Evan`,
  },
  {
    id: 'lender-quiet',
    name: 'Lender Review Timing',
    subject: 'Update on lender review timing',
    body: `Hi {{Borrower Name}},

I wanted to proactively check in and share where we are.

Lender review is still in progress. This part of the process can take a bit longer than expected while credit and committee align internally, and that's what's happening here. Wendy is actively following up and keeping pressure on timing.

Importantly:
• Your deal is still moving forward
• There are no red flags at this point
• No new requests are outstanding from you

If review extends beyond our comfort window, we're prepared to escalate or pivot as needed. I'll continue to manage that on our end and keep you posted.

Thanks,
Evan`,
  },
  {
    id: 'closing-progress',
    name: 'Closing Progress Update',
    subject: 'Closing progress and remaining items',
    body: `Hi {{Borrower Name}},

We're making good progress toward closing, and I want to outline where things stand and what's left.

On the lender side:
• Wendy is finalizing outstanding conditions with {{Lender Name}}
• Closing checklist items are actively being cleared

On your side, the remaining items are:
• {{Condition / Document 1}}
• {{Condition / Document 2}}

Once those are in, we'll be in position to push toward clear-to-close. Timing still looks aligned with our target, assuming no surprises from third parties.

As always, I'll let you know immediately if anything shifts. Appreciate the momentum here.

Best,
Evan`,
  },
];

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

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: string;
  updated_at: string;
}

const formatEmailDate = (dateString: string) => {
  const date = new Date(dateString);
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  // Check if within this year
  const now = new Date();
  if (date.getFullYear() === now.getFullYear()) {
    return format(date, 'MMM d');
  }
  return format(date, 'MMM d, yyyy');
};

const extractSenderName = (from: string) => {
  // Extract name from "Name <email@example.com>" format
  const match = from.match(/^([^<]+)/);
  if (match) {
    return match[1].trim().replace(/"/g, '');
  }
  return from.split('@')[0];
};

const extractEmailAddress = (value: string) => {
  // Extract email from "Name <email@example.com>" format (or return as-is)
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value || '').trim();
};

const EvansGmail = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeFolder, setActiveFolder] = useState<'inbox' | 'starred' | 'sent' | 'drafts' | 'templates'>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [editingDraftMessageId, setEditingDraftMessageId] = useState<string | null>(null);
  const [editingDraftThreadId, setEditingDraftThreadId] = useState<string | null>(null);
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
  const { data: emailsData, isLoading: emailsLoading, refetch: refetchEmails } = useQuery({
    queryKey: ['gmail-emails', activeFolder],
    queryFn: async () => {
      if (!gmailConnection) return { emails: [], totalCount: 0 };
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { emails: [], totalCount: 0 };
      
      let query = 'in:inbox';
      if (activeFolder === 'sent') query = 'in:sent';
      else if (activeFolder === 'starred') query = 'is:starred';
      else if (activeFolder === 'drafts') query = 'in:drafts';
      else if (activeFolder === 'templates') query = 'in:inbox'; // placeholder for templates
      
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
        totalCount: data?.resultSizeEstimate || emails.length 
      };
    },
    enabled: !!gmailConnection,
  });

  const emails = emailsData?.emails || [];
  const currentFolderCount = emailsData?.totalCount || 0;

  // Fetch inbox count separately (for sidebar display when not on inbox)
  const { data: inboxCountData } = useQuery({
    queryKey: ['gmail-inbox-count'],
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
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch drafts count separately (for sidebar display when not on drafts)
  const { data: draftsCountData } = useQuery({
    queryKey: ['gmail-drafts-count'],
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
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch Evan's team member ID
  const { data: evanTeamMember } = useQuery({
    queryKey: ['evan-team-member'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id')
        .ilike('name', 'evan')
        .single();
      if (error) throw error;
      return data;
    },
  });

  const evanId = evanTeamMember?.id;

  // Fetch leads needing nudges (no contact in 7+ days)
  const { data: nudgeLeads = [], isLoading: nudgesLoading } = useQuery({
    queryKey: ['gmail-nudge-leads', evanId],
    queryFn: async () => {
      if (!evanId) return [];
      
      const oneWeekAgo = subDays(new Date(), 7).toISOString();
      
      // Get leads assigned to Evan that haven't been updated in a week
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, name, email, phone, company_name, status, updated_at')
        .eq('assigned_to', evanId)
        .neq('status', 'funded')
        .lt('updated_at', oneWeekAgo)
        .order('updated_at', { ascending: true })
        .limit(20);
      
      if (error) throw error;

      // Filter to only leads with emails
      return (leads || []).filter(l => l.email) as Lead[];
    },
    enabled: !!evanId,
  });

  // Create nudge email draft
  const createNudgeDraft = useMutation({
    mutationFn: async (lead: Lead) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const daysSince = differenceInDays(new Date(), new Date(lead.updated_at));
      const subject = `Following up - ${lead.company_name || lead.name}`;
      const body = `Hi ${lead.name.split(' ')[0]},\n\nI wanted to follow up and see if you had any questions about the financing options we discussed.\n\nPlease let me know if there's anything I can help with.\n\nBest regards,\nEvan`;

      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=create-draft`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            to: lead.email, 
            subject, 
            body 
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create draft');
      }

      // Update lead's updated_at to prevent repeated nudges
      await supabase
        .from('leads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', lead.id);

      return { lead, draftId: data.id };
    },
    onSuccess: ({ lead }) => {
      toast.success(`Draft created for ${lead.name}`);
      queryClient.invalidateQueries({ queryKey: ['gmail-nudge-leads'] });
      queryClient.invalidateQueries({ queryKey: ['gmail-emails'] });
    },
    onError: (error: any) => {
      toast.error('Failed to create draft: ' + error.message);
    },
  });

  // Create template draft
  const createTemplateDraft = useMutation({
    mutationFn: async (template: typeof EMAIL_TEMPLATES[0]) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=create-draft`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            to: '', 
            subject: template.subject, 
            body: template.body 
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create draft');
      }

      return { template, draftId: data.id };
    },
    onSuccess: ({ template }) => {
      toast.success(`Draft created from "${template.name}" template`);
      setActiveFolder('drafts');
      queryClient.invalidateQueries({ queryKey: ['gmail-emails'] });
    },
    onError: (error: any) => {
      toast.error('Failed to create draft: ' + error.message);
    },
  });

  // Use real counts from API
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

    const draftMessageId = editingDraftMessageId;
    const draftThreadId = editingDraftThreadId || undefined;

    setSending(true);
    try {
      await sendEmailMutation.mutateAsync({
        to: composeTo.trim(),
        subject: composeSubject.trim(),
        body: composeBody.trim(),
        threadId: draftThreadId,
      });

      // If we were editing a draft, remove it from Drafts after sending
      if (draftMessageId) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const res = await fetch(
              `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=trash`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messageId: draftMessageId }),
              }
            );

            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err?.error || 'Failed to remove draft');
            }
          }
        } catch (e: any) {
          toast.error(`Sent, but couldn't remove draft: ${e.message}`);
        } finally {
          setEditingDraftMessageId(null);
          setEditingDraftThreadId(null);
          setSelectedEmail(null);
          queryClient.invalidateQueries({ queryKey: ['gmail-emails'] });
        }
      }
    } finally {
      setSending(false);
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in first');
        return;
      }

      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=disconnect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        toast.success('Gmail disconnected successfully');
        queryClient.invalidateQueries({ queryKey: ['gmail-connection'] });
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to disconnect Gmail');
      }
    } catch (error: any) {
      toast.error('Failed to disconnect Gmail: ' + error.message);
    }
  };

  const handleConnectGmail = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in first');
        return;
      }

      // Must match the route in src/App.tsx and the redirect URI registered in Google Console
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
        localStorage.setItem('gmail_return_path', '/team/evan/gmail');
        window.location.href = data.url;
      } else {
        toast.error('Failed to get OAuth URL');
      }
    } catch (error: any) {
      toast.error('Failed to start Gmail connection: ' + error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logged out');
      navigate('/auth');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to log out');
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
      <div className="h-[calc(100vh-120px)] flex bg-white rounded-lg overflow-hidden">
        {/* Left Sidebar - Gmail style */}
        <div className="w-56 flex flex-col bg-[#f6f8fc]">
          {/* Compose Button */}
          <div className="p-4 pt-2">
            <Button 
              onClick={() => setComposeOpen(true)}
              className="w-auto justify-start gap-3 h-14 px-6 rounded-2xl bg-[#c2e7ff] hover:bg-[#b3d9f2] text-[#001d35] shadow-sm hover:shadow-md transition-all font-medium"
              variant="ghost"
            >
              <Pencil className="w-5 h-5" />
              Compose
            </Button>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 pr-3">
            <button
              onClick={() => setActiveFolder('inbox')}
              className={`w-full flex items-center gap-4 pl-6 pr-3 py-1.5 rounded-r-full text-sm transition-colors ${
                activeFolder === 'inbox' 
                  ? 'bg-[#d3e3fd] text-[#001d35] font-bold' 
                  : 'hover:bg-[#e8eaed] text-[#444746]'
              }`}
            >
              <Inbox className="w-5 h-5" />
              <span className="flex-1 text-left">Inbox</span>
              <span className="text-xs font-bold">{inboxCount.toLocaleString()}</span>
            </button>
            
            <button
              onClick={() => setActiveFolder('starred')}
              className={`w-full flex items-center gap-4 pl-6 pr-3 py-1.5 rounded-r-full text-sm transition-colors ${
                activeFolder === 'starred' 
                  ? 'bg-[#d3e3fd] text-[#001d35] font-bold' 
                  : 'hover:bg-[#e8eaed] text-[#444746]'
              }`}
            >
              <Star className="w-5 h-5" />
              <span className="flex-1 text-left">Starred</span>
            </button>
            
            <button
              onClick={() => setActiveFolder('sent')}
              className={`w-full flex items-center gap-4 pl-6 pr-3 py-1.5 rounded-r-full text-sm transition-colors ${
                activeFolder === 'sent' 
                  ? 'bg-[#d3e3fd] text-[#001d35] font-bold' 
                  : 'hover:bg-[#e8eaed] text-[#444746]'
              }`}
            >
              <Send className="w-5 h-5" />
              <span className="flex-1 text-left">Sent</span>
            </button>
            
            <button
              onClick={() => setActiveFolder('drafts')}
              className={`w-full flex items-center gap-4 pl-6 pr-3 py-1.5 rounded-r-full text-sm transition-colors ${
                activeFolder === 'drafts' 
                  ? 'bg-[#d3e3fd] text-[#001d35] font-bold' 
                  : 'hover:bg-[#e8eaed] text-[#444746]'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span className="flex-1 text-left">Drafts</span>
              <span className="text-xs font-medium">{draftsCount}</span>
            </button>
            
            <HoverCard openDelay={100} closeDelay={200}>
              <HoverCardTrigger asChild>
                <button
                  className={`w-full flex items-center gap-4 pl-6 pr-3 py-1.5 rounded-r-full text-sm transition-colors ${
                    activeFolder === 'templates' 
                      ? 'bg-[#d3e3fd] text-[#001d35] font-bold' 
                      : 'hover:bg-[#e8eaed] text-[#444746]'
                  }`}
                >
                  <File className="w-5 h-5" />
                  <span className="flex-1 text-left">Templates</span>
                  <span className="text-xs text-[#5f6368]">{EMAIL_TEMPLATES.length}</span>
                </button>
              </HoverCardTrigger>
              <HoverCardContent side="right" align="start" className="w-72 p-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                    Click a template to create a draft
                  </p>
                  {EMAIL_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => createTemplateDraft.mutate(template)}
                      disabled={createTemplateDraft.isPending}
                      className="w-full flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg text-left transition-colors hover:bg-[#e8eaed] disabled:opacity-50"
                    >
                      <span className="text-sm font-medium text-[#202124]">
                        {template.name}
                      </span>
                      <span className="text-xs text-[#5f6368] line-clamp-1">
                        {template.subject}
                      </span>
                    </button>
                  ))}
                </div>
              </HoverCardContent>
            </HoverCard>
            
            {/* Nudges section - Waiting on Borrower */}
            <div className="mt-4 pt-2 border-t border-[#e8eaed]">
              <div className="flex items-center justify-between pl-6 pr-3 py-1.5 text-sm text-[#444746]">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Nudges</span>
                  {nudgeLeads.length > 0 && (
                    <span className="flex items-center justify-center min-w-5 h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
                      {nudgeLeads.length}
                    </span>
                  )}
                </div>
                <Link to="/user/evan/pipeline">
                  <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-[#e8eaed]" title="View Pipeline">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
              
              {/* Nudge subtitle */}
              <div className="pl-6 pr-3 pb-2 text-xs text-[#5f6368]">
                Waiting on borrower (7+ days)
              </div>
              
              {/* Nudge items - one-click follow-ups */}
              {nudgesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-[#5f6368]" />
                </div>
              ) : nudgeLeads.length === 0 ? (
                <div className="pl-6 pr-3 py-3 text-xs text-[#5f6368]">
                  ✓ All caught up!
                </div>
              ) : (
                <ScrollArea className="max-h-48">
                  {nudgeLeads.slice(0, 8).map((lead) => {
                    const daysSince = differenceInDays(new Date(), new Date(lead.updated_at));
                    return (
                      <Tooltip key={lead.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => createNudgeDraft.mutate(lead)}
                            disabled={createNudgeDraft.isPending}
                            className="w-full flex items-center gap-3 pl-6 pr-3 py-2 rounded-r-full text-sm text-[#444746] hover:bg-[#fef7e0] transition-colors group disabled:opacity-50"
                          >
                            <Zap className="w-4 h-4 text-amber-500 group-hover:text-amber-600" />
                            <span className="flex-1 text-left truncate text-xs">
                              {lead.name.split(' ')[0]}
                              {lead.company_name && <span className="text-[#5f6368]"> · {lead.company_name.slice(0, 12)}</span>}
                            </span>
                            <span className="text-[10px] text-red-500 font-medium">{daysSince}d</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          <p className="font-medium">{lead.name}</p>
                          <p className="text-muted-foreground">{lead.email}</p>
                          <p className="text-amber-600 mt-1">Click to create follow-up draft</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {nudgeLeads.length > 8 && (
                    <Link 
                      to="/user/evan/pipeline"
                      className="block pl-6 pr-3 py-2 text-xs text-[#1a73e8] hover:underline"
                    >
                      +{nudgeLeads.length - 8} more in pipeline
                    </Link>
                  )}
                </ScrollArea>
              )}
            </div>
          </nav>
          
          {/* Account actions */}
          <div className="p-3 border-t border-[#e8eaed] space-y-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleDisconnectGmail}
              className="w-full justify-start gap-2 text-xs text-[#5f6368] hover:text-red-600 hover:bg-red-50"
            >
              <Mail className="w-4 h-4" />
              Disconnect Gmail
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start gap-2 text-xs text-[#5f6368] hover:text-[#202124] hover:bg-[#e8eaed]"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </Button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Search Bar */}
          <div className="px-4 py-2">
            <div className="relative max-w-3xl">
              <Input
                placeholder="Search mail"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-4 pr-4 h-12 rounded-full bg-[#eaf1fb] border-0 focus-visible:ring-1 focus-visible:bg-white focus-visible:shadow-md text-[#202124] placeholder:text-[#5f6368]"
              />
            </div>
          </div>
          
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-2 py-1 border-b">
            <div className="flex items-center">
              <Checkbox 
                checked={selectedEmails.size === emails.length && emails.length > 0}
                onCheckedChange={toggleSelectAll}
                className="mx-2"
              />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5f6368]">
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5f6368]" onClick={() => refetchEmails()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5f6368]">
              <MoreVertical className="w-4 h-4" />
            </Button>
            <div className="flex-1" />
            <span className="text-sm text-[#5f6368] mr-2">
              1–{Math.min(50, emails.length)} of {emails.length > 0 ? emails.length.toLocaleString() : '5,658'}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5f6368]">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#5f6368]">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Email List */}
          <ScrollArea className="flex-1">
            {emailsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#5f6368]">
                <Inbox className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg">No emails in {activeFolder}</p>
              </div>
            ) : (
              <div>
                {emails.map((email) => (
                  <div
                    key={email.id}
                    className={`group flex items-center gap-0 px-2 py-1 border-b border-[#f1f3f4] cursor-pointer transition-colors hover:shadow-sm ${
                      !email.isRead ? 'bg-white' : 'bg-[#f2f6fc]'
                    } ${selectedEmails.has(email.id) ? 'bg-[#c2dbff]' : ''} hover:z-10`}
                  >
                    <div className="flex items-center gap-1 shrink-0">
                      <Checkbox 
                        checked={selectedEmails.has(email.id)}
                        onCheckedChange={() => toggleEmailSelection(email.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mx-2"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Toggle star logic here
                        }}
                        className="p-1 hover:bg-[#e8eaed] rounded"
                      >
                        <Star className={`w-5 h-5 ${email.isStarred ? 'fill-[#f4b400] text-[#f4b400]' : 'text-[#c4c7c5]'}`} />
                      </button>
                    </div>
                    
                    <div 
                      className="flex-1 flex items-center min-w-0 py-1"
                      onClick={() => setSelectedEmail(email)}
                    >
                      {/* Sender */}
                      <div className={`w-44 shrink-0 truncate text-sm pr-4 ${!email.isRead ? 'font-bold text-[#202124]' : 'text-[#202124]'}`}>
                        {activeFolder === 'sent' ? `To: ${email.to.split('<')[0].trim()}` : extractSenderName(email.from)}
                      </div>
                      
                      {/* Subject and snippet */}
                      <div className="flex-1 flex items-center min-w-0 pr-4">
                        <span className={`shrink-0 text-sm ${!email.isRead ? 'font-bold text-[#202124]' : 'text-[#202124]'}`}>
                          {email.subject}
                        </span>
                        <span className="text-sm text-[#5f6368] truncate ml-1">
                          - {email.snippet}
                        </span>
                      </div>
                      
                      {/* Attachments */}
                      {email.attachments && email.attachments.length > 0 && (
                        <div className="flex items-center gap-1 shrink-0 mr-4">
                          {email.attachments.slice(0, 2).map((att, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-[#e8eaed] text-[#5f6368] rounded border border-[#dadce0]">
                              {att.type === 'pdf' && <span className="text-red-600">📄</span>}
                              {att.name.length > 15 ? att.name.substring(0, 12) + '...' : att.name}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Date */}
                      <div className={`shrink-0 text-sm whitespace-nowrap ${!email.isRead ? 'font-bold text-[#202124]' : 'text-[#5f6368]'}`}>
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
