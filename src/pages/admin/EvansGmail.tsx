import { useState, useMemo, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
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
  LogOut,
  User,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, isToday, isYesterday, differenceInDays, subDays } from 'date-fns';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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

interface LeadEmailInfo {
  id: string;
  name: string;
  company_name: string | null;
  status: string;
  lastEmailedAt: string | null;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  discovery: { label: 'Discovery', color: 'text-blue-700', bg: 'bg-blue-100' },
  questionnaire: { label: 'Questionnaire', color: 'text-purple-700', bg: 'bg-purple-100' },
  pre_qualification: { label: 'Pre-Qual', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  document_collection: { label: 'Docs', color: 'text-orange-700', bg: 'bg-orange-100' },
  underwriting: { label: 'Underwriting', color: 'text-amber-700', bg: 'bg-amber-100' },
  approval: { label: 'Approval', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  funded: { label: 'Funded', color: 'text-green-700', bg: 'bg-green-100' },
};

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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [composeHandled, setComposeHandled] = useState(false);
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

  // Fetch all CRM leads for email matching
  const { data: allCrmLeads = [] } = useQuery({
    queryKey: ['crm-leads-for-gmail', evanId],
    queryFn: async () => {
      if (!evanId) return [];
      
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, name, email, company_name, status')
        .eq('assigned_to', evanId)
        .not('email', 'is', null);
      
      if (error) throw error;
      return leads || [];
    },
    enabled: !!evanId,
  });

  // Fetch last email dates for leads (from evan_communications)
  const { data: lastEmailDates = {} } = useQuery({
    queryKey: ['lead-last-email-dates', evanId],
    queryFn: async () => {
      if (!evanId) return {};
      
      // Get the most recent email communication for each lead
      const { data: comms, error } = await supabase
        .from('evan_communications')
        .select('lead_id, created_at')
        .eq('communication_type', 'email')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Build a map of lead_id -> last email date
      const dateMap: Record<string, string> = {};
      (comms || []).forEach(comm => {
        if (comm.lead_id && !dateMap[comm.lead_id]) {
          dateMap[comm.lead_id] = comm.created_at;
        }
      });
      
      return dateMap;
    },
    enabled: !!evanId,
  });

  // Build a map of email -> lead info for quick lookup
  const emailToLeadMap = useMemo(() => {
    const map = new Map<string, LeadEmailInfo>();
    allCrmLeads.forEach(lead => {
      if (lead.email) {
        const normalizedEmail = lead.email.toLowerCase().trim();
        map.set(normalizedEmail, {
          id: lead.id,
          name: lead.name,
          company_name: lead.company_name,
          status: lead.status,
          lastEmailedAt: lastEmailDates[lead.id] || null,
        });
      }
    });
    return map;
  }, [allCrmLeads, lastEmailDates]);

  // Helper to find lead info from email address
  const findLeadFromEmail = (emailStr: string): LeadEmailInfo | null => {
    const extracted = extractEmailAddress(emailStr).toLowerCase().trim();
    return emailToLeadMap.get(extracted) || null;
  };

  // Format last emailed time
  const formatLastEmailed = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const days = differenceInDays(new Date(), date);
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return format(date, 'MMM d');
  };

  // Create nudge email draft and follow-up task
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

      // Create a follow-up task linked to the lead
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // Set to 9 AM tomorrow

      await supabase
        .from('evan_tasks')
        .insert({
          title: `Follow up with ${lead.name}`,
          description: `Nudge triggered: No contact in ${daysSince} days. Draft email created - review and send follow-up to ${lead.email}.${lead.company_name ? ` Company: ${lead.company_name}` : ''}`,
          lead_id: lead.id,
          priority: daysSince > 14 ? 'high' : 'medium',
          status: 'todo',
          group_name: 'To Do',
          due_date: tomorrow.toISOString(),
          assignee_name: 'Evan',
          tags: ['follow-up', 'nudge'],
        });

      return { lead, draftId: data.id, daysSince };
    },
    onSuccess: ({ lead }) => {
      toast.success(`Draft & follow-up task created for ${lead.name}`);
      queryClient.invalidateQueries({ queryKey: ['gmail-nudge-leads'] });
      queryClient.invalidateQueries({ queryKey: ['gmail-emails'] });
      queryClient.invalidateQueries({ queryKey: ['evan-tasks'] });
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

  // Handle compose query params from CRM navigation
  useEffect(() => {
    if (composeHandled || connectionLoading || !gmailConnection) return;
    
    const composeParam = searchParams.get('compose');
    const toParam = searchParams.get('to');
    const nameParam = searchParams.get('name');
    const emailType = searchParams.get('emailType');
    const leadId = searchParams.get('leadId');
    
    if (composeParam === 'true' && toParam) {
      // Clear the query params to prevent re-triggering
      setSearchParams({}, { replace: true });
      setComposeHandled(true);
      
      // Handle custom email - just open blank compose
      if (emailType === 'custom') {
        setComposeTo(toParam);
        setComposeSubject('');
        setComposeBody('');
        setComposeOpen(true);
        toast.success('Compose window opened');
        return;
      }

      // For AI-generated emails, use the generate-lead-email edge function
      const createAIDraftAndOpen = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            toast.error('Not authenticated');
            return;
          }

          // Show loading toast
          const loadingToast = toast.loading('Generating email with AI...');

          // Call the generate-lead-email edge function
          const { data: generatedEmail, error: generateError } = await supabase.functions.invoke('generate-lead-email', {
            body: { leadId, emailType: emailType || 'follow_up' },
          });

          toast.dismiss(loadingToast);

          if (generateError || !generatedEmail) {
            throw new Error(generateError?.message || 'Failed to generate email');
          }

          const subject = generatedEmail.subject || (nameParam ? `Following up - ${nameParam}` : 'Following up');
          const body = generatedEmail.body || `Hi ${nameParam?.split(' ')[0] || ''},\n\nI wanted to follow up with you.\n\nBest regards,\nEvan`;

          // Create draft via Gmail API
          const response = await fetch(
            `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=create-draft`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ to: toParam, subject, body }),
            }
          );

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || 'Failed to create draft');
          }

          toast.success(`AI draft created for ${nameParam || toParam}`);
          
          // Switch to drafts folder and open compose with the draft content
          setActiveFolder('drafts');
          setComposeTo(toParam);
          setComposeSubject(subject);
          setComposeBody(body);
          setComposeOpen(true);
          
          // Refresh emails to show new draft
          queryClient.invalidateQueries({ queryKey: ['gmail-emails'] });
          queryClient.invalidateQueries({ queryKey: ['gmail-drafts-count'] });
        } catch (error: any) {
          toast.error('Failed to generate email: ' + error.message);
          // Fallback to basic template if AI fails
          const fallbackSubject = nameParam ? `Following up - ${nameParam}` : 'Following up';
          const fallbackBody = nameParam 
            ? `Hi ${nameParam.split(' ')[0]},\n\nI wanted to follow up with you regarding our recent conversation.\n\nPlease let me know if you have any questions or if there is anything I can help with.\n\nBest regards,\nEvan`
            : 'Hi,\n\nI wanted to follow up with you regarding our recent conversation.\n\nPlease let me know if you have any questions or if there is anything I can help with.\n\nBest regards,\nEvan';
          setComposeTo(toParam);
          setComposeSubject(fallbackSubject);
          setComposeBody(fallbackBody);
          setComposeOpen(true);
        }
      };

      createAIDraftAndOpen();
    }
  }, [searchParams, setSearchParams, gmailConnection, connectionLoading, composeHandled, queryClient]);

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
            <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-6 border border-slate-200">
              <Mail className="w-8 h-8 text-slate-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Connect Your Gmail</h2>
            <p className="text-sm text-slate-500 mb-6">
              Connect your Gmail account to send and receive emails directly from this portal.
            </p>
            <Button onClick={handleConnectGmail} size="lg" className="gap-2 rounded-md">
              <Mail className="w-4 h-4" />
              Connect Gmail Account
            </Button>
            <p className="text-xs text-slate-400 mt-4">
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
        <div className="h-[calc(100vh-120px)] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSelectedEmail(null)}
              className="gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Email content */}
          <ScrollArea className="flex-1 p-6 bg-white dark:bg-slate-900">
            <div className="max-w-3xl">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6">{selectedEmail.subject}</h1>
              
              <div className="flex items-start gap-3 mb-6">
                <div className="w-9 h-9 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-semibold text-sm border border-slate-200 dark:border-slate-700">
                  {extractSenderName(selectedEmail.from).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{extractSenderName(selectedEmail.from)}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {format(new Date(selectedEmail.date), 'MMM d, yyyy, h:mm a')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    to me
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md">
                  <Star className={`w-4 h-4 ${selectedEmail.isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                </Button>
              </div>
              
              <div className="prose prose-sm prose-slate max-w-none pl-12 text-sm leading-relaxed">
                <div dangerouslySetInnerHTML={{ __html: selectedEmail.body || selectedEmail.snippet }} />
              </div>
              
              <div className="flex gap-2 mt-8 pl-12">
                <Button variant="outline" size="sm" className="rounded-md text-xs h-8">
                  <Reply className="w-3.5 h-3.5 mr-1.5" />
                  Reply
                </Button>
                <Button variant="outline" size="sm" className="rounded-md text-xs h-8">
                  <Forward className="w-3.5 h-3.5 mr-1.5" />
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
      <div className="h-[calc(100vh-120px)] flex border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-52 flex flex-col bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
          {/* Compose Button */}
          <div className="p-3">
            <Button 
              onClick={() => setComposeOpen(true)}
              className="w-full justify-center gap-2 h-9 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium shadow-sm"
            >
              <Pencil className="w-4 h-4" />
              Compose
            </Button>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-2 space-y-0.5">
            <button
              onClick={() => setActiveFolder('inbox')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                activeFolder === 'inbox' 
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span className="flex-1 text-left">Inbox</span>
              <span className="text-xs font-medium text-slate-500">{inboxCount.toLocaleString()}</span>
            </button>
            
            <button
              onClick={() => setActiveFolder('starred')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                activeFolder === 'starred' 
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Star className="w-4 h-4" />
              <span className="flex-1 text-left">Starred</span>
            </button>
            
            <button
              onClick={() => setActiveFolder('sent')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                activeFolder === 'sent' 
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Send className="w-4 h-4" />
              <span className="flex-1 text-left">Sent</span>
            </button>
            
            <button
              onClick={() => setActiveFolder('drafts')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                activeFolder === 'drafts' 
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span className="flex-1 text-left">Drafts</span>
              <span className="text-xs font-medium text-slate-500">{draftsCount}</span>
            </button>
            
            <HoverCard openDelay={100} closeDelay={200}>
              <HoverCardTrigger asChild>
                <button
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    activeFolder === 'templates' 
                      ? 'bg-slate-200 text-slate-900 font-medium' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <File className="w-4 h-4" />
                  <span className="flex-1 text-left">Templates</span>
                  <span className="text-xs text-slate-400">{EMAIL_TEMPLATES.length}</span>
                </button>
              </HoverCardTrigger>
              <HoverCardContent side="right" align="start" className="w-64 p-2 rounded-md">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500 px-2 py-1">
                    Click a template to create a draft
                  </p>
                  {EMAIL_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => createTemplateDraft.mutate(template)}
                      disabled={createTemplateDraft.isPending}
                      className="w-full flex flex-col items-start gap-0.5 px-3 py-2 rounded-md text-left transition-colors hover:bg-slate-100 disabled:opacity-50"
                    >
                      <span className="text-sm font-medium text-slate-900">
                        {template.name}
                      </span>
                      <span className="text-xs text-slate-500 line-clamp-1">
                        {template.subject}
                      </span>
                    </button>
                  ))}
                </div>
              </HoverCardContent>
            </HoverCard>
            
            {/* Nudges section */}
            <div className="mt-4 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between px-3 py-1.5 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-xs uppercase tracking-wide text-slate-500">Nudges</span>
                  {nudgeLeads.length > 0 && (
                    <span className="flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-semibold text-white bg-red-500 rounded">
                      {nudgeLeads.length}
                    </span>
                  )}
                </div>
                <Link to="/user/evan/pipeline">
                  <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-slate-100 rounded-md" title="View Pipeline">
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </Button>
                </Link>
              </div>
              
              {/* Nudge subtitle */}
              <div className="px-3 pb-2 text-[10px] text-slate-400 uppercase tracking-wide">
                Waiting 7+ days
              </div>
              
              {/* Nudge items */}
              {nudgesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                </div>
              ) : nudgeLeads.length === 0 ? (
                <div className="px-3 py-3 text-xs text-slate-500">
                  ✓ All caught up
                </div>
              ) : (
                <ScrollArea className="max-h-40">
                  {nudgeLeads.slice(0, 8).map((lead) => {
                    const daysSince = differenceInDays(new Date(), new Date(lead.updated_at));
                    return (
                      <Tooltip key={lead.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => createNudgeDraft.mutate(lead)}
                            disabled={createNudgeDraft.isPending}
                            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-slate-600 hover:bg-amber-50 transition-colors group disabled:opacity-50"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                            <span className="flex-1 text-left truncate text-xs">
                              {lead.name.split(' ')[0]}
                            </span>
                            <span className="text-[10px] text-red-500 font-medium">{daysSince}d</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs rounded-md">
                          <p className="font-medium">{lead.name}</p>
                          <p className="text-slate-400">{lead.email}</p>
                          <p className="text-amber-600 mt-1">Click to create follow-up</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {nudgeLeads.length > 8 && (
                    <Link 
                      to="/user/evan/pipeline"
                      className="block px-3 py-2 text-xs text-primary hover:underline"
                    >
                      +{nudgeLeads.length - 8} more
                    </Link>
                  )}
                </ScrollArea>
              )}
            </div>
          </nav>
          
          {/* Account actions */}
          <div className="p-2 border-t border-slate-200 dark:border-slate-700 space-y-0.5">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleDisconnectGmail}
              className="w-full justify-start gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md h-8"
            >
              <Mail className="w-3.5 h-3.5" />
              Disconnect
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md h-8"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log out
            </Button>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900">
          {/* Search Bar */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="relative max-w-xl">
              <Input
                placeholder="Search mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-3 pr-4 h-9 rounded-md bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-1 focus-visible:ring-primary focus-visible:bg-white dark:focus-visible:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>
          
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-1">
              <Checkbox 
                checked={selectedEmails.size === emails.length && emails.length > 0}
                onCheckedChange={toggleSelectAll}
                className="rounded-sm"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md">
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md" onClick={() => refetchEmails()}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
            <div className="flex-1" />
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-2 font-medium">
              {emails.length > 0 ? `1–${Math.min(50, emails.length)} of ${emails.length}` : '0 emails'}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md">
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md">
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          
          {/* Email List */}
          <ScrollArea className="flex-1">
            {emailsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Inbox className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm font-medium">No emails in {activeFolder}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {emails.map((email) => {
                  // Check if email is from/to a CRM lead
                  const emailAddress = activeFolder === 'sent' ? email.to : email.from;
                  const leadInfo = findLeadFromEmail(emailAddress);
                  const status = leadInfo ? statusConfig[leadInfo.status] : null;
                  
                  return (
                    <div
                      key={email.id}
                      className={`group flex items-center gap-0 px-3 py-2 cursor-pointer transition-colors ${
                        !email.isRead ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/50'
                      } ${selectedEmails.has(email.id) ? 'bg-primary/5 dark:bg-primary/10' : ''} hover:bg-slate-50 dark:hover:bg-slate-800`}
                    >
                      <div className="flex items-center gap-2 shrink-0">
                        <Checkbox 
                          checked={selectedEmails.has(email.id)}
                          onCheckedChange={() => toggleEmailSelection(email.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-sm"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Toggle star logic here
                          }}
                          className="p-1 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Star className={`w-4 h-4 ${email.isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-slate-400'}`} />
                        </button>
                      </div>
                      
                      <div 
                        className="flex-1 flex items-center min-w-0 py-0.5 ml-2"
                        onClick={() => setSelectedEmail(email)}
                      >
                        {/* Sender with CRM badge */}
                        <div className={`w-44 shrink-0 flex items-center gap-1.5 pr-2 ${!email.isRead ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                          <span className="truncate text-sm">
                            {activeFolder === 'sent' ? `To: ${email.to.split('<')[0].trim()}` : extractSenderName(email.from)}
                          </span>
                          {leadInfo && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="shrink-0 w-4 h-4 rounded bg-primary/10 flex items-center justify-center">
                                  <User className="w-2.5 h-2.5 text-primary" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs rounded-md">
                                <p className="font-medium">{leadInfo.name}</p>
                                {leadInfo.company_name && <p className="text-slate-400">{leadInfo.company_name}</p>}
                                <p className="text-primary mt-1">CRM Lead</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        
                        {/* CRM Status Badge */}
                        {leadInfo && status && (
                          <div className="shrink-0 mr-2">
                            <Badge 
                              variant="secondary" 
                              className={`text-[10px] px-1.5 py-0 h-4 font-medium rounded ${status.bg} ${status.color} border-0`}
                            >
                              {status.label}
                            </Badge>
                          </div>
                        )}
                        
                        {/* Subject and snippet */}
                        <div className="flex-1 flex items-center min-w-0 pr-2">
                          <span className={`shrink-0 text-sm ${!email.isRead ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>
                            {email.subject}
                          </span>
                          <span className="text-sm text-slate-400 dark:text-slate-500 truncate ml-1.5">
                            — {email.snippet}
                          </span>
                        </div>
                        
                        {/* Last emailed button for CRM leads */}
                        {leadInfo && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button 
                                className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 mr-2 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                {formatLastEmailed(leadInfo.lastEmailedAt)}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs rounded-md">
                              Last email: {leadInfo.lastEmailedAt ? format(new Date(leadInfo.lastEmailedAt), 'MMM d, yyyy h:mm a') : 'Never'}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        
                        {/* Attachments */}
                        {email.attachments && email.attachments.length > 0 && (
                          <div className="flex items-center gap-1 shrink-0 mr-2">
                            {email.attachments.slice(0, 2).map((att, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-500 rounded font-medium">
                                {att.type === 'pdf' && <span className="text-red-500">📄</span>}
                                {att.name.length > 12 ? att.name.substring(0, 10) + '...' : att.name}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* Date */}
                        <div className={`shrink-0 text-xs whitespace-nowrap ${!email.isRead ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>
                          {formatEmailDate(email.date)}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
