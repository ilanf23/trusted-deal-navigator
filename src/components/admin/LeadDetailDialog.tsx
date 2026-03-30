import { useEffect, useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-input';
import { isHtmlEmpty } from '@/lib/sanitize';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Loader2, Mail, Phone, Building2, Calendar, FileText, User, Clock,
  PhoneCall, ChevronDown, ChevronUp, ChevronRight, Play, PhoneIncoming, PhoneOutgoing,
  MessageSquare, History, Plus, Trash2, Globe, Linkedin, MapPin,
  Link2, Users, ListTodo, Tag, CheckCircle2, Circle, X, GripVertical,
  Briefcase, FileSpreadsheet, MessagesSquare, Video, Sparkles, HelpCircle, Columns, Handshake, DollarSign
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, differenceInDays, differenceInHours } from 'date-fns';
import { TaskDetailDialog } from '@/components/evan/tasks/TaskDetailDialog';
import { Task } from '@/components/evan/tasks/types';
import { LeadTodosSection } from '@/components/admin/LeadTodosSection';
import { CrmAvatar } from '@/components/admin/CrmAvatar';
import { FormattedPhoneInput } from '@/components/admin/FormattedPhoneInput';
import { LeadFilesSection } from '@/components/admin/LeadFilesSection';
import { LeadDealSheetTab } from '@/components/admin/LeadDealSheetTab';

// Helper to format activity timestamps - show time if <24h, otherwise show date and time
const formatActivityTimestamp = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const hoursDiff = differenceInHours(new Date(), d);
  
  if (hoursDiff < 24) {
    // Less than 24 hours - show just the time
    return format(d, 'h:mm a');
  } else {
    // More than 24 hours - show date and time
    return format(d, 'M/d/yy h:mm a');
  }
};

// Helper to format phone numbers to American format (XXX) XXX-XXXX
const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Handle different lengths
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    // Handle 1 + 10 digits (country code)
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  // Return original if format doesn't match
  return phone;
};
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type LeadStatus = Database['public']['Enums']['lead_status'];

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  questionnaire_sent_at: string | null;
  questionnaire_completed_at: string | null;
  known_as: string | null;
  title: string | null;
  contact_type: string | null;
  tags: string[] | null;
  about: string | null;
  website: string | null;
  linkedin: string | null;
  twitter: string | null;
  clx_file_name: string | null;
  bank_relationships: string | null;
  last_activity_at: string | null;
  history: string | null;
  description: string | null;
}

interface LeadPhone {
  id: string;
  lead_id: string;
  phone_number: string;
  phone_type: string;
  is_primary: boolean;
}

interface LeadEmail {
  id: string;
  lead_id: string;
  email: string;
  email_type: string;
  is_primary: boolean;
}

interface LeadAddress {
  id: string;
  lead_id: string;
  address_type: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  is_primary: boolean;
}

interface LeadContact {
  id: string;
  lead_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
}

interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  title: string | null;
  content: string | null;
  created_by: string | null;
  created_at: string;
}

interface LeadTask {
  id: string;
  lead_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
}

interface TeamMember {
  id: string;
  name: string;
  avatar_url?: string | null;
}

interface Communication {
  id: string;
  communication_type: string;
  direction: string;
  phone_number: string | null;
  content: string | null;
  duration_seconds: number | null;
  status: string | null;
  transcript: string | null;
  created_at: string;
}

const stages = [
  { status: 'initial_review', title: 'Initial Review', color: '#0066FF' },
  { status: 'moving_to_underwriting', title: 'Moving to UW', color: '#0891b2' },
  { status: 'onboarding', title: 'Onboarding', color: '#d97706' },
  { status: 'underwriting', title: 'Underwriting', color: '#FF8000' },
  { status: 'ready_for_wu_approval', title: 'Ready for Approval', color: '#7c3aed' },
  { status: 'pre_approval_issued', title: 'Pre-Approval Issued', color: '#8b5cf6' },
  { status: 'won', title: 'Won', color: '#059669' },
];

// Lender association type (data now sourced from lead_lender_programs DB table)
interface LeadLenderAssociation {
  lenderName: string;
  programName: string;
  status: 'matched' | 'submitted' | 'approved' | 'declined' | 'pending_review';
  matchScore?: number;
  submittedAt?: string;
  notes?: string;
}

// Lender data is now loaded from the lead_lender_programs database table via useQuery

// Lead placeholder data is now sourced from the lead_responses database table via useQuery

interface LeadDetailDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadUpdated?: () => void;
}

const LeadDetailDialog = ({ lead, open, onOpenChange, onLeadUpdated }: LeadDetailDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({});
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  
  // Collapsible sections state (legacy - kept for compatibility)
  const [customColumnsOpen, setCustomColumnsOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [magicColumnsOpen, setMagicColumnsOpen] = useState(true);

  // Query lead_responses from database for placeholder/custom field data
  const { data: leadResponseData } = useQuery({
    queryKey: ['lead-response-data', lead?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_responses')
        .select('loan_type, loan_amount, business_type, address_line_1, city, state, zip_code, collateral_description, purpose_of_loan, funding_amount')
        .eq('lead_id', lead!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!lead?.id && open,
  });

  // Custom column values (local state for demo)
  const [customFields, setCustomFields] = useState({
    address: '',
    loanType: '',
    loanAmount: '',
    businessType: '',
    propertyType: '',
    urgency: false,
  });

  // Contact info state
  const [contactInfo, setContactInfo] = useState({
    knownAs: '',
    contactTitle: '',
    contactType: 'potential_customer' as 'customer' | 'potential_customer' | 'referral_source' | 'lender',
    website: '',
    linkedin: '',
    twitter: '',
    other: [] as string[],
    about: '',
    tags: [] as string[],
    clxFileName: '',
    bankRelationships: '',
  });

  // Notes state
  const [notesContent, setNotesContent] = useState('');
  
  // Collapsible section states
  const [contactInfoOpen, setContactInfoOpen] = useState(true);
  const [phonesOpen, setPhonesOpen] = useState(true);
  const [emailsOpen, setEmailsOpen] = useState(true);
  const [addressesOpen, setAddressesOpen] = useState(true);
  const [socialOpen, setSocialOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(true);
  const [bankRelOpen, setBankRelOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [emailThreadsOpen, setEmailThreadsOpen] = useState(true);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(true);
  const [contactsOpen, setContactsOpen] = useState(true);
  
  // New phone/email/address input states
  const [newPhone, setNewPhone] = useState('');
  const [newPhoneType, setNewPhoneType] = useState('mobile');
  const [newEmail, setNewEmail] = useState('');
  const [newEmailType, setNewEmailType] = useState('work');
  const [newTag, setNewTag] = useState('');
  const [showAddPhone, setShowAddPhone] = useState(false);
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [showAddTag, setShowAddTag] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddressLine1, setNewAddressLine1] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('');
  const [newAddressState, setNewAddressState] = useState('');
  const [newAddressZip, setNewAddressZip] = useState('');
  const [newAddressType, setNewAddressType] = useState('business');
  
  // Contact person states
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactTitle, setNewContactTitle] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactIsPrimary, setNewContactIsPrimary] = useState(false);

  // Lender states
  const [showAddLender, setShowAddLender] = useState(false);
  const [newLenderName, setNewLenderName] = useState('');
  const [newLenderProgram, setNewLenderProgram] = useState('');
  const [localLenders, setLocalLenders] = useState<LeadLenderAssociation[]>([]);
  const [lenderInputFocused, setLenderInputFocused] = useState(false);

  // AI states
  const [aiLoading, setAiLoading] = useState<'summarize' | 'ask' | 'autofill' | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [showAskDialog, setShowAskDialog] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [showAiBar, setShowAiBar] = useState(true);
  
  // Activity search state
  const [activitySearch, setActivitySearch] = useState('');
  
  // Quick action states
  const [showAddComment, setShowAddComment] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showScheduleMeeting, setShowScheduleMeeting] = useState(false);
  const [showAttachFile, setShowAttachFile] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  
  // Expanded tasks state for viewing descriptions
  const [expandedTasksInDialog, setExpandedTasksInDialog] = useState<Set<string>>(new Set());

  // Reset when lead changes
  useEffect(() => {
    if (lead && open) {
      setActiveTab('all');
      const addr = [leadResponseData?.address_line_1, leadResponseData?.city, leadResponseData?.state, leadResponseData?.zip_code].filter(Boolean).join(', ');
      const amt = leadResponseData?.loan_amount ? `$${Number(leadResponseData.loan_amount).toLocaleString()}` : (leadResponseData?.funding_amount || '');
      setCustomFields({
        address: addr,
        loanType: leadResponseData?.loan_type || 'Conventional',
        loanAmount: amt,
        businessType: leadResponseData?.business_type || '',
        propertyType: leadResponseData?.collateral_description || '',
        urgency: false,
      });
      setContactInfo({
        knownAs: lead.known_as || '',
        contactTitle: lead.title || '',
        contactType: (lead.contact_type as any) || 'potential_customer',
        website: lead.website || '',
        linkedin: lead.linkedin || '',
        twitter: lead.twitter || '',
        other: [],
        about: lead.about || '',
        tags: lead.tags || [],
        clxFileName: lead.clx_file_name || '',
        bankRelationships: lead.bank_relationships || '',
      });
      setNotesContent(leadResponseData?.purpose_of_loan || lead.notes || '');
      setAiSummary(null);
      setAiAnswer(null);
      setShowAskDialog(false);
      setAiQuestion('');
      setShowAddPhone(false);
      setShowAddEmail(false);
      setShowAddTag(false);
      setSelectedThreadId(null);
    }
  }, [lead, open, leadResponseData]);

  // Queries
  // Fetch partner referral for this lead
  const { data: partnerReferral } = useQuery({
    queryKey: ['lead-partner-referral', lead?.id],
    queryFn: async () => {
      if (!lead) return null;
      const { data: referral } = await supabase
        .from('partner_referrals')
        .select('id, partner_id, name')
        .eq('lead_id', lead.id)
        .limit(1)
        .maybeSingle();
      if (!referral) return null;
      // Fetch partner profile for display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('contact_person, company_name')
        .eq('user_id', referral.partner_id)
        .maybeSingle();
      return { ...referral, partnerName: profile?.contact_person, companyName: profile?.company_name };
    },
    enabled: !!lead?.id && open,
  });

  // Fetch the latest lead data to ensure we have current email
  const { data: currentLead } = useQuery({
    queryKey: ['lead-detail', lead?.id],
    queryFn: async () => {
      if (!lead) return null;
      const { data } = await supabase.from('leads').select('*').eq('id', lead.id).maybeSingle();
      return data;
    },
    enabled: !!lead && open,
  });

  const { data: phones = [] } = useQuery({
    queryKey: ['lead-phones', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_phones').select('*').eq('lead_id', lead.id);
      return (data || []) as LeadPhone[];
    },
    enabled: !!lead && open,
  });

  const { data: emails = [] } = useQuery({
    queryKey: ['lead-emails', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_emails').select('*').eq('lead_id', lead.id);
      return (data || []) as LeadEmail[];
    },
    enabled: !!lead && open,
  });

  const { data: addresses = [] } = useQuery({
    queryKey: ['lead-addresses', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_addresses').select('*').eq('lead_id', lead.id);
      return (data || []) as LeadAddress[];
    },
    enabled: !!lead && open,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['lead-contacts', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_contacts').select('*').eq('lead_id', lead.id).order('is_primary', { ascending: false });
      return (data || []) as LeadContact[];
    },
    enabled: !!lead && open,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['lead-activities', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('lead_activities').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false });
      return (data || []) as LeadActivity[];
    },
    enabled: !!lead && open,
  });

  const { data: rawTasks = [] } = useQuery({
    queryKey: ['lead-tasks', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      // Query from tasks which has richer data (descriptions, etc)
      const { data } = await supabase
        .from('tasks')
        .select('id, title, description, due_date, status, priority, estimated_hours')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });
      return (data || []) as Array<{
        id: string;
        title: string;
        description: string | null;
        due_date: string | null;
        status: string | null;
        priority: string | null;
        estimated_hours: number | null;
      }>;
    },
    enabled: !!lead && open,
  });

  // Sort tasks: incomplete first, completed at bottom
  const tasks = useMemo(() => {
    return [...rawTasks].sort((a, b) => {
      const aCompleted = a.status === 'done' || a.status === 'completed';
      const bCompleted = b.status === 'done' || b.status === 'completed';
      if (aCompleted && !bCompleted) return 1;
      if (!aCompleted && bCompleted) return -1;
      return 0;
    });
  }, [rawTasks]);

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_members')
        .select('id, name, avatar_url')
        .eq('is_active', true)
        .not('name', 'ilike', 'adam')
        .not('name', 'ilike', 'ilan');
      return (data || []) as TeamMember[];
    },
    enabled: open,
  });

  // Query lead's lender associations from database
  const { data: dbLeadLenders = [] } = useQuery({
    queryKey: ['lead-lender-associations', lead?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_lender_programs')
        .select('id, status, notes, program_id, lender_programs!lead_lender_programs_program_id_fkey(lender_name, program_name)')
        .eq('lead_id', lead!.id)
        .order('created_at', { ascending: false });
      return (data || []).map((item: any) => ({
        lenderName: item.lender_programs?.lender_name || 'Unknown Lender',
        programName: item.lender_programs?.program_name || 'Unknown Program',
        status: (item.status === 'approved' ? 'approved' : item.status === 'submitted' ? 'submitted' : item.status === 'declined' ? 'declined' : item.status === 'pending' ? 'pending_review' : 'matched') as LeadLenderAssociation['status'],
        notes: item.notes || undefined,
      })) as LeadLenderAssociation[];
    },
    enabled: !!lead?.id && open,
  });

  // Query lender programs for autocomplete - fetch when dialog is open (cache for when needed)
  const { data: lenderPrograms = [], isLoading: lenderProgramsLoading } = useQuery({
    queryKey: ['lender-programs-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('lender_programs')
        .select('id, lender_name, program_name, program_type, loan_types, states')
        .order('lender_name');
      return data || [];
    },
    enabled: open, // Fetch when dialog opens so data is ready
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Filter lender programs based on input
  const filteredLenderPrograms = useMemo(() => {
    if (!newLenderName.trim() || !lenderInputFocused) return [];
    const searchTerm = newLenderName.toLowerCase();
    return lenderPrograms
      .filter(lp => 
        lp.lender_name?.toLowerCase().includes(searchTerm) ||
        lp.program_name?.toLowerCase().includes(searchTerm)
      )
      .slice(0, 10); // Show up to 10 suggestions
  }, [lenderPrograms, newLenderName, lenderInputFocused]);

  const { data: communications = [] } = useQuery({
    queryKey: ['lead-communications', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase.from('communications').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false });
      return (data || []) as Communication[];
    },
    enabled: !!lead && open,
  });

  // Query email threads linked to this lead from database
  const { data: dbEmailThreads = [] } = useQuery({
    queryKey: ['lead-email-threads', lead?.id],
    queryFn: async () => {
      if (!lead) return [];
      const { data } = await supabase
        .from('email_threads')
        .select('*')
        .eq('lead_id', lead.id)
        .order('last_message_date', { ascending: false });
      return data || [];
    },
    enabled: !!lead && open,
  });

  // Fetch Gmail connection to get emails
  const { data: gmailConnection } = useQuery({
    queryKey: ['gmail-connection-for-lead'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data } = await supabase
        .from('gmail_connections')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      return data;
    },
    enabled: open,
  });

  // Get all email addresses for this lead (use currentLead for latest data)
  const leadEmailAddresses = useMemo(() => {
    const leadData = currentLead || lead;
    if (!leadData) return [];
    const allEmails: string[] = [];
    if (leadData.email) allEmails.push(leadData.email.toLowerCase());
    emails.forEach(e => allEmails.push(e.email.toLowerCase()));
    return [...new Set(allEmails)];
  }, [currentLead, lead, emails]);

  // Fetch emails from Gmail that match lead's email addresses
  const { data: gmailEmails = [], isLoading: gmailEmailsLoading } = useQuery({
    queryKey: ['lead-gmail-emails', lead?.id, leadEmailAddresses],
    queryFn: async () => {
      if (!gmailConnection || leadEmailAddresses.length === 0) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      // Build search query for all lead email addresses
      const searchQuery = leadEmailAddresses.map(email => `from:${email} OR to:${email}`).join(' OR ');
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-api?action=list&q=${encodeURIComponent(searchQuery)}&maxResults=50`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );

      if (!response.ok) return [];
      const data = await response.json();
      return (data?.messages || []).map((msg: any) => ({
        id: msg.id,
        threadId: msg.threadId,
        subject: msg.subject || '(No Subject)',
        from: msg.from || '',
        to: msg.to || '',
        date: msg.date || new Date().toISOString(),
        snippet: msg.snippet || '',
        isRead: !msg.isUnread,
      }));
    },
    enabled: !!gmailConnection && leadEmailAddresses.length > 0 && open,
  });

  // Email threads and messages are now sourced from the email_threads database table and Gmail API

  // Combine database threads with Gmail emails
  const allEmailThreads = useMemo(() => {
    const threadMap = new Map<string, any>();
    
    gmailEmails.forEach((email: any) => {
      if (!threadMap.has(email.threadId)) {
        threadMap.set(email.threadId, {
          id: email.threadId,
          thread_id: email.threadId,
          subject: email.subject,
          last_message_date: email.date,
          snippet: email.snippet,
          from: email.from,
          messageCount: 1,
        });
      } else {
        const existing = threadMap.get(email.threadId);
        existing.messageCount++;
        if (new Date(email.date) > new Date(existing.last_message_date)) {
          existing.last_message_date = email.date;
          existing.snippet = email.snippet;
        }
      }
    });

    // Merge with database threads (database threads have priority for metadata)
    dbEmailThreads.forEach((dbThread: any) => {
      if (threadMap.has(dbThread.thread_id)) {
        const gmailThread = threadMap.get(dbThread.thread_id);
        threadMap.set(dbThread.thread_id, {
          ...gmailThread,
          ...dbThread,
          messageCount: gmailThread.messageCount,
        });
      } else {
        threadMap.set(dbThread.thread_id, dbThread);
      }
    });

    return Array.from(threadMap.values()).sort((a, b) => 
      new Date(b.last_message_date || 0).getTime() - new Date(a.last_message_date || 0).getTime()
    );
  }, [gmailEmails, dbEmailThreads, leadEmailAddresses]);

  // Mutations
  const updateLeadStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!lead) return;
      const { error } = await supabase.from('leads').update({ status: newStatus as LeadStatus }).eq('id', lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      onLeadUpdated?.();
      toast({ title: 'Stage updated' });
    },
  });

  const updateLeadAssignment = useMutation({
    mutationFn: async (assignedTo: string) => {
      if (!lead) return;
      const { error } = await supabase.from('leads').update({ assigned_to: assignedTo }).eq('id', lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      onLeadUpdated?.();
      toast({ title: 'Assignment updated' });
    },
  });

  const saveNotes = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const { error } = await supabase.from('leads').update({ notes: notesContent }).eq('id', lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      onLeadUpdated?.();
      toast({ title: 'Notes saved' });
    },
  });

  const addContactEmail = useMutation({
    mutationFn: async (email: string) => {
      if (!lead) return;
      const { error } = await supabase.from('lead_emails').insert({ lead_id: lead.id, email, email_type: newEmailType });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-emails', lead?.id] });
      setNewEmail('');
      setShowAddEmail(false);
      toast({ title: 'Email added' });
    },
  });

  const addContactPhone = useMutation({
    mutationFn: async (phone: string) => {
      if (!lead) return;
      const { error } = await supabase.from('lead_phones').insert({ lead_id: lead.id, phone_number: phone, phone_type: newPhoneType });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-phones', lead?.id] });
      setNewPhone('');
      setShowAddPhone(false);
      toast({ title: 'Phone added' });
    },
  });

  const deletePhone = useMutation({
    mutationFn: async (phoneId: string) => {
      const { error } = await supabase.from('lead_phones').delete().eq('id', phoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-phones', lead?.id] });
      toast({ title: 'Phone removed' });
    },
  });

  const deleteEmail = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase.from('lead_emails').delete().eq('id', emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-emails', lead?.id] });
      toast({ title: 'Email removed' });
    },
  });

  const addContactAddress = useMutation({
    mutationFn: async () => {
      if (!lead || !newAddressLine1.trim()) return;
      const { error } = await supabase.from('lead_addresses').insert({ 
        lead_id: lead.id, 
        address_line_1: newAddressLine1.trim(),
        city: newAddressCity.trim() || null,
        state: newAddressState.trim() || null,
        zip_code: newAddressZip.trim() || null,
        address_type: newAddressType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-addresses', lead?.id] });
      setNewAddressLine1('');
      setNewAddressCity('');
      setNewAddressState('');
      setNewAddressZip('');
      setNewAddressType('business');
      setShowAddAddress(false);
      toast({ title: 'Address added' });
    },
  });

  const deleteAddress = useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await supabase.from('lead_addresses').delete().eq('id', addressId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-addresses', lead?.id] });
      toast({ title: 'Address removed' });
    },
  });

  const addLeadContact = useMutation({
    mutationFn: async (contact: { name: string; title?: string; email?: string; phone?: string; is_primary?: boolean }) => {
      if (!lead) return;
      const { error } = await supabase.from('lead_contacts').insert({ 
        lead_id: lead.id, 
        name: contact.name,
        title: contact.title || null,
        email: contact.email || null,
        phone: contact.phone || null,
        is_primary: contact.is_primary || false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-contacts', lead?.id] });
      setNewContactName('');
      setNewContactTitle('');
      setNewContactEmail('');
      setNewContactPhone('');
      setNewContactIsPrimary(false);
      setShowAddContact(false);
      toast({ title: 'Contact added' });
    },
  });

  const deleteLeadContact = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase.from('lead_contacts').delete().eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-contacts', lead?.id] });
      toast({ title: 'Contact removed' });
    },
  });

  const updateContactInfo = useMutation({
    mutationFn: async (updates: Partial<typeof contactInfo>) => {
      if (!lead) return;
      const { error } = await supabase.from('leads').update({
        known_as: updates.knownAs ?? contactInfo.knownAs,
        title: updates.contactTitle ?? contactInfo.contactTitle,
        contact_type: updates.contactType ?? contactInfo.contactType,
        website: updates.website ?? contactInfo.website,
        linkedin: updates.linkedin ?? contactInfo.linkedin,
        twitter: updates.twitter ?? contactInfo.twitter,
        about: updates.about ?? contactInfo.about,
        tags: updates.tags ?? contactInfo.tags,
        clx_file_name: updates.clxFileName ?? contactInfo.clxFileName,
        bank_relationships: updates.bankRelationships ?? contactInfo.bankRelationships,
      }).eq('id', lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      onLeadUpdated?.();
    },
  });

  // Update lead core fields (name, company, email, phone, etc.)
  const updateLead = useMutation({
    mutationFn: async (updates: { name?: string; company_name?: string | null; email?: string | null; phone?: string | null }) => {
      if (!lead) return;
      const { error } = await supabase.from('leads').update(updates).eq('id', lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['gmail-all-leads'] });
      onLeadUpdated?.();
      toast({ title: 'Lead updated' });
    },
  });

  // Update phone in lead_phones table
  const updatePhone = useMutation({
    mutationFn: async ({ id, phone_number, phone_type }: { id: string; phone_number?: string; phone_type?: string }) => {
      const updates: { phone_number?: string; phone_type?: string } = {};
      if (phone_number !== undefined) updates.phone_number = phone_number;
      if (phone_type !== undefined) updates.phone_type = phone_type;
      const { error } = await supabase.from('lead_phones').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-phones', lead?.id] });
      toast({ title: 'Phone updated' });
    },
  });

  // Update email in lead_emails table
  const updateEmail = useMutation({
    mutationFn: async ({ id, email, email_type }: { id: string; email?: string; email_type?: string }) => {
      const updates: { email?: string; email_type?: string } = {};
      if (email !== undefined) updates.email = email;
      if (email_type !== undefined) updates.email_type = email_type;
      const { error } = await supabase.from('lead_emails').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-emails', lead?.id] });
      toast({ title: 'Email updated' });
    },
  });

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    const updatedTags = [...contactInfo.tags, newTag.trim()];
    setContactInfo(prev => ({ ...prev, tags: updatedTags }));
    updateContactInfo.mutate({ tags: updatedTags });
    setNewTag('');
    setShowAddTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = contactInfo.tags.filter(t => t !== tagToRemove);
    setContactInfo(prev => ({ ...prev, tags: updatedTags }));
    updateContactInfo.mutate({ tags: updatedTags });
  };

  // Quick action mutations
  const addComment = useMutation({
    mutationFn: async (comment: string) => {
      if (!lead) return;
      const { error } = await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'comment',
        title: 'Comment added',
        content: comment,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', lead?.id] });
      setNewComment('');
      setShowAddComment(false);
      toast({ title: 'Comment added' });
    },
  });

  const addTask = useMutation({
    mutationFn: async ({ title, dueDate }: { title: string; dueDate?: string }) => {
      if (!lead) return;
      
      // Add to unified tasks table
      const { error: evanTaskError } = await supabase.from('tasks').insert({
        title,
        description: `Task for ${lead.name}${lead.company_name ? ` (${lead.company_name})` : ''}`,
        due_date: dueDate || null,
        priority: 'medium',
        status: 'todo',
        lead_id: lead.id,
        source: 'lead',
        team_member_id: '5e2d8710-7a23-4c33-87a2-4ad9ced4e936',
      });
      if (evanTaskError) throw evanTaskError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-tasks', lead?.id] });
      queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
      setNewTaskTitle('');
      setNewTaskDueDate('');
      setShowAddTask(false);
      toast({ title: 'Task created' });
    },
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { status?: string } }) => {
      const isDone = updates.status === 'done' || updates.status === 'completed';
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: updates.status,
          is_completed: isDone,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-tasks', lead?.id] });
      queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'] });
    },
  });

  const addMeeting = useMutation({
    mutationFn: async ({ title, date }: { title: string; date: string }) => {
      if (!lead) return;
      const { error } = await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'meeting',
        title: title || 'Scheduled meeting',
        content: `Meeting scheduled for ${date}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', lead?.id] });
      setMeetingTitle('');
      setMeetingDate('');
      setShowScheduleMeeting(false);
      toast({ title: 'Meeting scheduled' });
    },
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // AI action handlers
  const buildLeadContext = () => ({
    name: lead?.name || '',
    email: lead?.email,
    phone: lead?.phone,
    company: lead?.company_name,
    status: lead?.status || '',
    source: lead?.source,
    notes: notesContent,
    activities: activities.map(a => ({
      type: a.activity_type,
      content: a.content || a.title || '',
      date: format(new Date(a.created_at), 'MMM d, yyyy'),
    })),
    communications: communications.map(c => ({
      type: c.communication_type,
      direction: c.direction,
      duration: c.duration_seconds,
      transcript: c.transcript,
      date: format(new Date(c.created_at), 'MMM d, yyyy'),
    })),
    tasks: tasks.map(t => ({
      title: t.title,
      status: t.status,
      due_date: t.due_date ? format(new Date(t.due_date), 'MMM d, yyyy') : null,
      priority: t.priority,
    })),
    customFields: {
      address: customFields.address,
      loanType: customFields.loanType,
      loanAmount: customFields.loanAmount,
      businessType: customFields.businessType,
      propertyType: customFields.propertyType,
    },
  });

  const handleSummarize = async () => {
    if (!lead) return;
    setAiLoading('summarize');
    setAiSummary(null);
    
    try {
      const response = await supabase.functions.invoke('lead-ai-assistant', {
        body: { action: 'summarize', leadContext: buildLeadContext() }
      });
      
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) {
        toast({ title: response.data.error, variant: 'destructive' });
      } else {
        setAiSummary(response.data?.result || 'No summary generated');
      }
    } catch (err) {
      console.error('Summarize error:', err);
      toast({ title: 'Failed to generate summary', variant: 'destructive' });
    } finally {
      setAiLoading(null);
    }
  };

  const handleAskQuestion = async () => {
    if (!lead || !aiQuestion.trim()) return;
    setAiLoading('ask');
    setAiAnswer(null);
    
    try {
      const response = await supabase.functions.invoke('lead-ai-assistant', {
        body: { action: 'ask', leadContext: buildLeadContext(), question: aiQuestion }
      });
      
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) {
        toast({ title: response.data.error, variant: 'destructive' });
      } else {
        setAiAnswer(response.data?.result || 'No answer generated');
      }
    } catch (err) {
      console.error('Ask error:', err);
      toast({ title: 'Failed to get answer', variant: 'destructive' });
    } finally {
      setAiLoading(null);
    }
  };

  const handleAutofill = async () => {
    if (!lead) return;
    setAiLoading('autofill');
    
    try {
      const response = await supabase.functions.invoke('lead-ai-assistant', {
        body: { action: 'autofill', leadContext: buildLeadContext() }
      });
      
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) {
        toast({ title: response.data.error, variant: 'destructive' });
      } else if (response.data?.result) {
        const result = response.data.result;
        setCustomFields(prev => ({
          ...prev,
          address: result.address || prev.address,
          loanType: result.loanType || prev.loanType,
          loanAmount: result.loanAmount || prev.loanAmount,
          businessType: result.businessType || prev.businessType,
          propertyType: result.propertyType || prev.propertyType,
        }));
        toast({ title: 'Fields autofilled by AI' });
      }
    } catch (err) {
      console.error('Autofill error:', err);
      toast({ title: 'Failed to autofill fields', variant: 'destructive' });
    } finally {
      setAiLoading(null);
    }
  };

  if (!lead) return null;

  // Get assigned team member
  const assignedMember = teamMembers.find(t => t.id === lead.assigned_to);
  const currentStage = stages.find(s => s.status === lead.status);

  // Get all emails for contacts section
  const allEmails = emails.length > 0 ? emails : (lead.email ? [{ id: 'legacy', email: lead.email, email_type: 'primary' }] : []);

  // Calculate magic column values
  const daysInStage = differenceInDays(new Date(), new Date(lead.updated_at));
  const lastEmailDate = communications.find(c => c.communication_type === 'email')?.created_at;
  const lastInteractionDate = communications.length > 0 ? communications[0].created_at : null;
  const nextDueTask = tasks.find(t => t.status !== 'completed' && t.status !== 'done' && t.due_date);

  // Combine activities for timeline (including emails)
  const timelineItems = [
    ...activities.map(a => ({ ...a, _type: 'activity' as const })),
    ...communications.map(c => ({ ...c, _type: 'communication' as const, activity_type: c.communication_type, title: null, content: null })),
    ...allEmailThreads.map((thread: any) => ({ 
      ...thread, 
      _type: 'email' as const, 
      id: thread.id || thread.thread_id,
      created_at: thread.last_message_date || new Date().toISOString(),
    }))
  ]
    .filter(item => {
      if (!activitySearch.trim()) return true;
      const searchLower = activitySearch.toLowerCase();
      if (item._type === 'activity') {
        const activity = item as LeadActivity & { _type: 'activity' };
        return (
          activity.title?.toLowerCase().includes(searchLower) ||
          activity.content?.toLowerCase().includes(searchLower) ||
          activity.activity_type?.toLowerCase().includes(searchLower)
        );
      } else if (item._type === 'communication') {
        const comm = item as Communication & { _type: 'communication' };
        return (
          comm.communication_type?.toLowerCase().includes(searchLower) ||
          comm.content?.toLowerCase().includes(searchLower) ||
          comm.transcript?.toLowerCase().includes(searchLower) ||
          comm.direction?.toLowerCase().includes(searchLower)
        );
      } else {
        // Email thread
        return (
          item.subject?.toLowerCase().includes(searchLower) ||
          item.snippet?.toLowerCase().includes(searchLower)
        );
      }
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-6xl max-h-[90vh] p-0 gap-0 overflow-hidden [&>button.absolute]:hidden flex flex-col"
        onPointerDownOutside={(e) => {
          // Prevent closing when clicking within lender dropdown or other popover content
          const target = e.target as HTMLElement;
          if (target.closest('[data-lender-dropdown]') || target.closest('[data-radix-popper-content-wrapper]')) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          // Prevent closing when interacting with lender dropdown
          const target = e.target as HTMLElement;
          if (target.closest('[data-lender-dropdown]') || target.closest('[data-radix-popper-content-wrapper]')) {
            e.preventDefault();
          }
        }}
      >
        {/* Hidden accessibility elements for Radix */}
        <DialogHeader className="sr-only">
          <DialogTitle>{lead.name}</DialogTitle>
          <DialogDescription>Lead detail view</DialogDescription>
        </DialogHeader>

        {/* Header Bar */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-border bg-background">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
          <CrmAvatar name={lead.name ?? ''} size="xl" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground truncate leading-tight">{lead.name}</h2>
            {lead.company_name && (
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <Building2 className="h-3 w-3 shrink-0" />
                {lead.company_name}
              </p>
            )}
          </div>
          {customFields.loanAmount && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800 shrink-0">
              <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Opportunity</span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{customFields.loanAmount}</span>
            </div>
          )}
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Activity Timeline */}
          <div className="flex-1 flex flex-col border-r border-border">
            {/* Search Bar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-background">
              <div className="flex-1">
                <Input
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  placeholder="Search activity, emails, calls..."
                  className="h-9 text-sm border-border bg-muted focus:bg-background pl-3"
                />
              </div>
              {/* Add Comment */}
              <Popover open={showAddComment} onOpenChange={setShowAddComment}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" title="Add comment">
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="end">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Add Comment</p>
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a comment..."
                      className="min-h-[80px] text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowAddComment(false)}>Cancel</Button>
                      <Button size="sm" onClick={() => addComment.mutate(newComment)} disabled={!newComment.trim()}>
                        Add
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Add Task */}
              <Button variant="ghost" size="icon" title="Add task" onClick={() => setShowAddTask(true)}>
                <CheckCircle2 className="w-4 h-4" />
              </Button>

              {/* Schedule Meeting */}
              <Popover open={showScheduleMeeting} onOpenChange={setShowScheduleMeeting}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" title="Schedule meeting">
                    <Calendar className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="end">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Schedule Meeting</p>
                    <Input
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      placeholder="Meeting title"
                      className="text-sm"
                    />
                    <Input
                      type="datetime-local"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowScheduleMeeting(false)}>Cancel</Button>
                      <Button size="sm" onClick={() => addMeeting.mutate({ title: meetingTitle, date: meetingDate })} disabled={!meetingDate}>
                        Schedule
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Attach File */}
              <Popover open={showAttachFile} onOpenChange={setShowAttachFile}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" title="Attach file">
                    <FileText className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3" align="end">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Attach File</p>
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm text-slate-500">Drag & drop files here</p>
                      <p className="text-xs text-slate-400 mt-1">or click to browse</p>
                      <input type="file" className="hidden" />
                    </div>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setShowAttachFile(false)}>Close</Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="px-4 border-b">
                <TabsList className="h-12 bg-transparent p-0 gap-0">
                  <TabsTrigger value="all" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">All</TabsTrigger>
                  <TabsTrigger value="emails" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">Emails</TabsTrigger>
                  <TabsTrigger value="lenders" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">Lenders</TabsTrigger>
                  <TabsTrigger value="deal-sheet" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">Deal Sheet</TabsTrigger>
                  <TabsTrigger value="files" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">Files</TabsTrigger>
                  <TabsTrigger value="comments" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">Comments</TabsTrigger>
                  <TabsTrigger value="tasks" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">Tasks</TabsTrigger>
                  <TabsTrigger value="calls" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">Call Logs</TabsTrigger>
                  <TabsTrigger value="meetings" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-4 py-3 text-sm">Meeting Notes</TabsTrigger>
                </TabsList>
              </div>

              {/* AI Action Bar */}
              {showAiBar && (
                <div className="flex items-center gap-3 px-4 py-3 border-b bg-background">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-blue-600 hover:bg-blue-500/10 hover:text-blue-600"
                    onClick={handleSummarize}
                    disabled={aiLoading !== null}
                  >
                    {aiLoading === 'summarize' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 mr-2" />
                    )}
                    Summarize
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-blue-600 hover:bg-blue-500/10 hover:text-blue-600"
                    onClick={() => setShowAskDialog(true)}
                    disabled={aiLoading !== null}
                  >
                    <HelpCircle className="w-4 h-4 mr-2" />
                    Ask a question
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-blue-600 hover:bg-blue-500/10 hover:text-blue-600"
                    onClick={handleAutofill}
                    disabled={aiLoading !== null}
                  >
                    {aiLoading === 'autofill' ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Columns className="w-4 h-4 mr-2" />
                    )}
                    Autofill columns
                  </Button>
                  <X 
                    className="w-4 h-4 text-muted-foreground ml-auto cursor-pointer hover:text-foreground" 
                    onClick={() => setShowAiBar(false)}
                  />
                </div>
              )}

              {/* Ask Question Dialog */}
              {showAskDialog && (
                <div className="px-4 py-3 border-b bg-blue-50 dark:bg-blue-950/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Ask a question about this lead</span>
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="e.g., What's the best next step for this deal?"
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                      className="flex-1 text-sm"
                    />
                    <Button 
                      size="sm" 
                      onClick={handleAskQuestion}
                      disabled={aiLoading === 'ask' || !aiQuestion.trim()}
                    >
                      {aiLoading === 'ask' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => { setShowAskDialog(false); setAiAnswer(null); setAiQuestion(''); }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {aiAnswer && (
                    <div className="p-3 bg-background rounded-md border border-blue-200 dark:border-blue-800 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {aiAnswer}
                    </div>
                  )}
                </div>
              )}

              {/* AI Summary Display */}
              {aiSummary && (
                <div className="px-4 py-3 border-b bg-purple-50 dark:bg-purple-950/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-800">AI Summary</span>
                    </div>
                    <X 
                      className="w-4 h-4 text-purple-400 cursor-pointer hover:text-purple-600" 
                      onClick={() => setAiSummary(null)}
                    />
                  </div>
                  <div className="p-3 bg-background rounded-md border border-purple-200 dark:border-purple-800 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {aiSummary}
                  </div>
                </div>
              )}

              {/* Timeline Content */}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-1">
                  {/* All Tab Content */}
                  <TabsContent value="all" className="m-0 space-y-1">
                    {timelineItems.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No activity yet</p>
                      </div>
                    ) : (
                      timelineItems.map((item, idx) => (
                        <div 
                          key={item.id} 
                          className="flex items-start gap-3 py-3 border-b border-border hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            if (item._type === 'email') {
                              setActiveTab('emails');
                              setSelectedThreadId(item.thread_id);
                            }
                          }}
                        >
                          <div className="w-5 h-5 mt-1">
                            {item._type === 'communication' ? (
                              item.direction === 'inbound' ? 
                                <PhoneIncoming className="w-5 h-5 text-green-600" /> : 
                                <PhoneOutgoing className="w-5 h-5 text-blue-600" />
                            ) : item._type === 'email' ? (
                              <Mail className="w-5 h-5 text-blue-500" />
                            ) : (
                              <MessageSquare className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                {item._type === 'activity' && (item as LeadActivity).activity_type === 'comment' ? (
                                  <>
                                    <p className="font-medium text-sm text-foreground">Comment:</p>
                                    <p className="font-medium text-sm text-foreground mt-0.5">
                                      {(item as LeadActivity).content}
                                    </p>
                                  </>
                                ) : item._type === 'email' ? (
                                  <>
                                    <p className="font-medium text-sm text-foreground">
                                      {item.subject || '(No Subject)'}
                                    </p>
                                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                                      {item.snippet || 'Email thread'}
                                    </p>
                                    {item.messageCount > 1 && (
                                      <span className="text-xs text-muted-foreground">
                                        {item.messageCount} messages
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <p className="font-medium text-sm text-foreground">
                                      {item._type === 'communication' 
                                        ? `${item.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call`
                                        : item.title || 'Activity'}
                                    </p>
                                    <p className="text-sm text-muted-foreground truncate mt-0.5">
                                      {item._type === 'activity' 
                                        ? (item as LeadActivity).content 
                                        : `Duration: ${formatDuration((item as Communication).duration_seconds)}`}
                                    </p>
                                  </>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatActivityTimestamp(item.created_at)}
                              </span>
                            </div>
                            {item._type === 'communication' && (item as Communication).transcript && (
                              <Collapsible open={expandedTranscripts[item.id]} onOpenChange={() => setExpandedTranscripts(p => ({ ...p, [item.id]: !p[item.id] }))}>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="mt-1 text-xs">
                                    {expandedTranscripts[item.id] ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                                    View Transcript
                                  </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="mt-2 p-2 bg-muted rounded text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                                    {(item as Communication).transcript}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}
                          </div>
                        </div>
                      ))
                    )}

                    <LeadTodosSection
                      tasks={tasks}
                      onAddTask={() => setShowAddTask(true)}
                      onViewAll={() => setActiveTab('tasks')}
                      onUpdateTask={(id, updates) => updateTaskStatus.mutate({ id, updates })}
                    />

                    {/* Stage Change Event */}
                    <div className="flex items-center gap-3 py-3 text-sm text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                      <span className="font-medium">Stage changed to</span>
                      <Badge 
                        className="text-white text-xs"
                        style={{ backgroundColor: currentStage?.color }}
                      >
                        {currentStage?.title}
                      </Badge>
                    </div>
                  </TabsContent>

                  {/* Emails Tab */}
                  <TabsContent value="emails" className="m-0 h-[calc(90vh-200px)] overflow-hidden">
                    {gmailEmailsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                        <span className="ml-2 text-slate-400">Loading emails...</span>
                      </div>
                    ) : selectedThreadId ? (
                      // Thread Detail View
                      <div className="flex flex-col h-full overflow-hidden">
                        {/* Thread Header */}
                        <div className="flex items-center gap-2 p-3 border-b bg-muted/50">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setSelectedThreadId(null)}
                            className="gap-1"
                          >
                            <ChevronDown className="w-4 h-4 rotate-90" />
                            Back
                          </Button>
                          <span className="text-sm font-medium truncate">
                            {allEmailThreads.find(t => t.thread_id === selectedThreadId)?.subject || 'Email Thread'}
                          </span>
                        </div>
                        {/* Thread Messages */}
                        <ScrollArea className="h-[calc(90vh-280px)]">
                          <div className="p-4 space-y-4">
                            {/* Thread content from Gmail API or snippet fallback */}
                            <div className="p-4 text-center text-slate-400">
                              <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">
                                {allEmailThreads.find(t => t.thread_id === selectedThreadId)?.snippet || 'No message content available'}
                              </p>
                              <p className="text-xs mt-2 text-muted-foreground">Connect Gmail to view full thread messages</p>
                            </div>
                          </div>
                        </ScrollArea>
                      </div>
                    ) : allEmailThreads.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No emails yet</p>
                      </div>
                    ) : (
                      // Thread List View
                      <ScrollArea className="h-[calc(90vh-280px)]">
                        <div className="divide-y">
                          {allEmailThreads.map((thread: any) => (
                            <div
                              key={thread.id}
                              onClick={() => setSelectedThreadId(thread.thread_id)}
                              className="flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer group transition-colors"
                            >
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                                <Mail className="w-4 h-4 text-slate-500 group-hover:text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary">
                                    {thread.subject || '(No Subject)'}
                                  </p>
                                  {thread.messageCount > 1 && (
                                    <span className="text-xs text-slate-400 shrink-0">({thread.messageCount})</span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2">{thread.snippet}</p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {thread.last_message_date 
                                    ? format(new Date(thread.last_message_date), 'MMM d, yyyy • h:mm a')
                                    : ''}
                                </p>
                              </div>
                              {thread.waiting_on && (
                                <Badge variant="outline" className="text-xs shrink-0 mt-1">
                                  {thread.waiting_on}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </TabsContent>

                  {/* Lenders Tab */}
                  <TabsContent value="lenders" className="m-0">
                    {(() => {
                      const baseLenders = dbLeadLenders;
                      const allLenders = [...baseLenders, ...localLenders];
                      
                      const getStatusConfig = (status: LeadLenderAssociation['status']) => {
                        switch (status) {
                          case 'approved':
                            return { label: 'Approved', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' };
                          case 'submitted':
                            return { label: 'Submitted', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' };
                          case 'pending_review':
                            return { label: 'Pending Review', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' };
                          case 'declined':
                            return { label: 'Declined', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' };
                          case 'matched':
                          default:
                            return { label: 'Matched', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-400' };
                        }
                      };

                      const handleAddLender = () => {
                        if (!newLenderName.trim() || !newLenderProgram.trim()) return;
                        setLocalLenders(prev => [...prev, {
                          lenderName: newLenderName.trim(),
                          programName: newLenderProgram.trim(),
                          status: 'matched',
                        }]);
                        setNewLenderName('');
                        setNewLenderProgram('');
                        setShowAddLender(false);
                        toast({ title: 'Lender added' });
                      };

                      return (
                        <ScrollArea className="max-h-[450px]">
                          <div className="space-y-3 p-1">
                            {allLenders.length === 0 && !showAddLender ? (
                              <div className="text-center py-12 text-slate-400">
                                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>No lenders matched yet</p>
                                <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowAddLender(true)}>
                                  <Plus className="w-4 h-4 mr-2" />
                                  Add Lender
                                </Button>
                              </div>
                            ) : (
                              <>
                                {allLenders.map((lender, idx) => {
                                  const statusConfig = getStatusConfig(lender.status);
                                  return (
                                    <div
                                      key={idx}
                                      className="p-4 border border-border rounded-lg bg-background hover:bg-muted/50 transition-colors"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-semibold text-sm text-foreground">{lender.lenderName}</h4>
                                            <Badge className={`text-xs font-medium border-0 ${statusConfig.bg} ${statusConfig.text}`}>
                                              {statusConfig.label}
                                            </Badge>
                                          </div>
                                          <p className="text-sm text-muted-foreground">{lender.programName}</p>
                                          
                                          {lender.submittedAt && (
                                            <p className="text-xs text-muted-foreground mt-2">
                                              Submitted {format(new Date(lender.submittedAt), 'MMM d, yyyy')}
                                            </p>
                                          )}
                                          
                                          {lender.notes && (
                                            <p className="text-xs text-muted-foreground mt-2 italic">{lender.notes}</p>
                                          )}
                                        </div>
                                        
                                        {lender.status === 'approved' && (
                                          <Button variant="outline" size="sm" className="text-xs h-7 text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                                            View Terms
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                
                                {/* Add Lender Form */}
                                {showAddLender ? (
                                  <div className="p-4 border border-border rounded-lg bg-muted/50 space-y-3 overflow-visible">
                                    <p className="text-sm font-medium">Add Lender</p>
                                    <div className="relative" style={{ zIndex: 50 }}>
                                      <Input
                                        value={newLenderName}
                                        onChange={(e) => setNewLenderName(e.target.value)}
                                        onFocus={() => setLenderInputFocused(true)}
                                        onBlur={() => setTimeout(() => setLenderInputFocused(false), 200)}
                                        placeholder="Search lenders..."
                                        className="text-sm"
                                      />
                                      {lenderInputFocused && newLenderName.trim() && (
                                        <div 
                                          data-lender-dropdown
                                          className="absolute top-full left-0 right-0 mt-1 z-[9999] bg-background border border-border rounded-lg shadow-lg max-h-[480px] overflow-y-auto"
                                          onMouseDown={(e) => e.preventDefault()}
                                        >
                                          {lenderProgramsLoading ? (
                                            <div className="px-3 py-4 text-center">
                                              <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                                              <p className="text-xs text-muted-foreground mt-1">Loading lenders...</p>
                                            </div>
                                          ) : filteredLenderPrograms.length > 0 ? (
                                            filteredLenderPrograms.map((lp) => (
                                              <button
                                                key={lp.id}
                                                type="button"
                                                className="w-full px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0"
                                                onMouseDown={(e) => {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  setNewLenderName(lp.lender_name);
                                                  setNewLenderProgram(lp.program_name);
                                                  setLenderInputFocused(false);
                                                }}
                                              >
                                                <p className="text-sm font-medium text-foreground">{lp.lender_name}</p>
                                                <p className="text-xs text-muted-foreground">{lp.program_name} • {lp.program_type}</p>
                                              </button>
                                            ))
                                          ) : (
                                            <div className="px-3 py-3 text-center">
                                              <p className="text-sm text-muted-foreground">No lenders found for "{newLenderName}"</p>
                                              <p className="text-xs text-muted-foreground mt-1">You can still add a custom entry</p>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <Input
                                      value={newLenderProgram}
                                      onChange={(e) => setNewLenderProgram(e.target.value)}
                                      placeholder="Program name"
                                      className="text-sm"
                                    />
                                    <div className="flex justify-end gap-2">
                                      <Button variant="ghost" size="sm" onClick={() => { setShowAddLender(false); setNewLenderName(''); setNewLenderProgram(''); }}>
                                        Cancel
                                      </Button>
                                      <Button size="sm" onClick={handleAddLender} disabled={!newLenderName.trim() || !newLenderProgram.trim()}>
                                        Add
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="w-full mt-2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowAddLender(true)}
                                  >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add More Lenders
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </ScrollArea>
                      );
                    })()}
                  </TabsContent>

                  {/* Deal Sheet Tab */}
                  <TabsContent value="deal-sheet" className="m-0">
                    <ScrollArea className="h-[calc(100vh-280px)]">
                      <LeadDealSheetTab
                        lead={lead}
                        onFieldSaved={(field, newValue) => {
                          queryClient.invalidateQueries({ queryKey: ['volume-log-leads'] });
                          queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
                        }}
                      />
                    </ScrollArea>
                  </TabsContent>

                  {/* Files Tab */}
                  <TabsContent value="files" className="m-0 p-4">
                    <LeadFilesSection leadId={lead.id} leadName={lead.name} companyName={lead.company_name} />
                  </TabsContent>

                  {/* Comments Tab */}
                  <TabsContent value="comments" className="m-0 space-y-3">
                    {/* Add Comment Form */}
                    <div className="p-3 border border-border rounded-lg bg-muted/50">
                      <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Write a comment..."
                        className="min-h-[80px] text-sm border-border bg-background mb-2"
                      />
                      <div className="flex justify-end">
                        <Button 
                          size="sm" 
                          onClick={() => addComment.mutate(newComment)} 
                          disabled={!newComment.trim() || addComment.isPending}
                        >
                          {addComment.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                          Add Comment
                        </Button>
                      </div>
                    </div>
                    
                    {/* Comments List */}
                    {activities.filter(a => a.activity_type === 'comment').length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <MessagesSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No comments yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activities.filter(a => a.activity_type === 'comment').map(comment => (
                          <div key={comment.id} className="p-3 bg-background border border-border rounded-lg">
                            <p className="text-sm text-foreground">{comment.content}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {formatActivityTimestamp(comment.created_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Tasks Tab */}
                  <TabsContent value="tasks" className="m-0 space-y-3">
                    {/* Add Task Button - opens full dialog like To Do's page */}
                    <Button 
                      onClick={() => setShowAddTask(true)}
                      className="w-full gap-2"
                      variant="outline"
                    >
                      <Plus className="h-4 w-4" />
                      Add New Task
                    </Button>
                    
                    {/* Tasks List - Card Style */}
                    {tasks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <ListTodo className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No tasks yet</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {tasks.map(task => {
                          const completed = task.status === 'completed' || task.status === 'done';
                          const isExpanded = expandedTasksInDialog.has(task.id);
                          const hasDescription = task.description && task.description.trim().length > 0;

                          const priorityConfig: Record<string, { color: string; stars: number }> = {
                            critical: { color: '#ef4444', stars: 6 },
                            high: { color: '#f97316', stars: 4 },
                            medium: { color: '#eab308', stars: 3 },
                            low: { color: '#22c55e', stars: 2 },
                            none: { color: '#94a3b8', stars: 0 },
                          };
                          const pConfig = priorityConfig[task.priority || 'none'];

                          const taskStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
                            todo: { label: 'To Do', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
                            working: { label: 'Working', bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400' },
                            in_progress: { label: 'In Progress', bg: 'bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400' },
                            blocked: { label: 'Blocked', bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400' },
                            done: { label: 'Done', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
                            completed: { label: 'Completed', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
                          };
                          const sConfig = taskStatusConfig[task.status || 'todo'] || taskStatusConfig.todo;

                          return (
                            <div
                              key={task.id}
                              className={cn(
                                "group rounded-xl border border-border bg-card/50 backdrop-blur-sm overflow-hidden transition-all duration-200",
                                "hover:border-muted-foreground/30 hover:shadow-sm cursor-pointer",
                                completed && "opacity-60"
                              )}
                            >
                              {/* Main task row */}
                              <div className="flex items-start gap-3 p-3">
                                {/* Checkbox */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Toggle completion
                                  }}
                                  className="mt-0.5 flex-shrink-0"
                                >
                                  {completed ? (
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-muted-foreground hover:text-emerald-500 transition-colors" />
                                  )}
                                </button>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  {/* Title row with priority */}
                                  <div className="flex items-start gap-2">
                                    {/* Priority indicator */}
                                    <div className="flex items-center gap-0.5 mt-1">
                                      {[1, 2, 3].map((level) => (
                                        <div
                                          key={level}
                                          className={`w-1 rounded-full transition-all ${
                                            level <= Math.ceil(pConfig.stars / 2) 
                                              ? 'h-2.5 opacity-100' 
                                              : 'h-1.5 opacity-25'
                                          }`}
                                          style={{ backgroundColor: pConfig.color }}
                                        />
                                      ))}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                      <p className={cn(
                                        "text-sm font-medium leading-snug",
                                        completed && "line-through text-muted-foreground"
                                      )}>
                                        {task.title}
                                      </p>
                                      
                                      {/* Meta row */}
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                                        {task.due_date && (
                                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(task.due_date), 'MMM d')}
                                          </span>
                                        )}
                                        {task.estimated_hours && (
                                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            {task.estimated_hours}h
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Right side - Status + Expand */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${sConfig.bg} ${sConfig.text}`}>
                                    {sConfig.label}
                                  </span>
                                  
                                  {hasDescription && (
                                    <button 
                                      className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedTasksInDialog(prev => {
                                          const next = new Set(prev);
                                          if (next.has(task.id)) {
                                            next.delete(task.id);
                                          } else {
                                            next.add(task.id);
                                          }
                                          return next;
                                        });
                                      }}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Expanded description */}
                              {isExpanded && hasDescription && (
                                <div className="px-3 pb-3 pl-11">
                                  <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 whitespace-pre-wrap">
                                    {task.description}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>

                  {/* Call Logs Tab */}
                  <TabsContent value="calls" className="m-0 space-y-2">
                    {communications.filter(c => c.communication_type === 'call').length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Phone className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No call logs</p>
                      </div>
                    ) : (
                      communications.filter(c => c.communication_type === 'call').map(call => (
                        <div key={call.id} className="flex items-start gap-3 py-2 px-3 hover:bg-muted/50 rounded">
                          {call.direction === 'inbound' ? (
                            <PhoneIncoming className="w-5 h-5 text-green-600" />
                          ) : (
                            <PhoneOutgoing className="w-5 h-5 text-blue-600" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{call.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDuration(call.duration_seconds)} • {format(new Date(call.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  {/* Meeting Notes Tab */}
                  <TabsContent value="meetings" className="m-0">
                    <div className="text-center py-12 text-muted-foreground">
                      <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No meeting notes</p>
                    </div>
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>

          {/* Right Sidebar */}
          <div className="w-[380px] flex flex-col bg-background">
            {/* Stage & Assigned To Header */}
            <div className="flex items-start justify-between px-4 py-4 border-b">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Stage</p>
                <Select value={lead.status} onValueChange={(v) => updateLeadStatus.mutate(v)}>
                  <SelectTrigger className="w-[180px] h-9 border-border">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-sm" 
                        style={{ backgroundColor: currentStage?.color }}
                      />
                      <span className="text-sm">{currentStage?.title}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {stages.map(s => (
                      <SelectItem key={s.status} value={s.status}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
                          {s.title}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Assigned To</p>
                <Select value={lead.assigned_to || ''} onValueChange={(v) => updateLeadAssignment.mutate(v)}>
                  <SelectTrigger className="w-[120px] h-9 border-border">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs bg-emerald-600 text-white">
                          {assignedMember?.name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">{assignedMember?.name || 'Unassigned'}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {teamMembers.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-5 h-5">
                            <AvatarFallback className="text-[10px] bg-emerald-600 text-white">
                              {t.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          {t.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {partnerReferral && (
              <div className="px-4 py-3 border-b bg-indigo-600/20 border-indigo-500/30">
                <div className="flex items-center gap-2">
                  <Handshake className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-semibold text-black">Referred by</span>
                  <span className="text-sm font-bold text-black">{partnerReferral.partnerName || partnerReferral.name}</span>
                  {partnerReferral.companyName && (
                    <span className="text-xs text-black/70">· {partnerReferral.companyName}</span>
                  )}
                </div>
              </div>
            )}

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {/* Contact Info Section */}
                <Collapsible open={contactInfoOpen} onOpenChange={setContactInfoOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-foreground">Contact Info</span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground ml-auto transition-transform", !contactInfoOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3 pl-6">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Contact Name</p>
                        <Input 
                          defaultValue={lead.name}
                          onBlur={(e) => {
                            if (e.target.value !== lead.name && e.target.value.trim()) {
                              updateLead.mutate({ name: e.target.value.trim() });
                            }
                          }}
                          className="h-8 text-sm border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600 font-medium"
                          placeholder="Contact name"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Known As</p>
                        <Input 
                          value={contactInfo.knownAs} 
                          onChange={(e) => setContactInfo(p => ({ ...p, knownAs: e.target.value }))}
                          onBlur={() => updateContactInfo.mutate({ knownAs: contactInfo.knownAs })}
                          className="h-8 text-sm border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600"
                          placeholder="Nickname or alias"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Company</p>
                        <Input 
                          defaultValue={lead.company_name || ''}
                          onBlur={(e) => {
                            if (e.target.value !== (lead.company_name || '')) {
                              updateLead.mutate({ company_name: e.target.value.trim() || null });
                            }
                          }}
                          className="h-8 text-sm border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600"
                          placeholder="Company name"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Title</p>
                        <Input 
                          value={contactInfo.contactTitle} 
                          onChange={(e) => setContactInfo(p => ({ ...p, contactTitle: e.target.value }))}
                          onBlur={() => updateContactInfo.mutate({ contactTitle: contactInfo.contactTitle })}
                          className="h-8 text-sm border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600"
                          placeholder="Job title"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Contact Type</p>
                        <Select 
                          value={contactInfo.contactType} 
                          onValueChange={(v: 'customer' | 'potential_customer' | 'referral_source' | 'lender') => {
                            setContactInfo(p => ({ ...p, contactType: v }));
                            updateContactInfo.mutate({ contactType: v });
                          }}
                        >
                          <SelectTrigger className="h-8 text-sm border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="potential_customer">Potential Customer</SelectItem>
                            <SelectItem value="referral_source">Referral Source</SelectItem>
                            <SelectItem value="lender">Lender</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">CLX File Name</p>
                        <Input
                          value={contactInfo.clxFileName}
                          onChange={(e) => setContactInfo(p => ({ ...p, clxFileName: e.target.value }))}
                          onBlur={() => updateContactInfo.mutate({ clxFileName: contactInfo.clxFileName })}
                          className="h-8 text-sm border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600"
                          placeholder="CLX file name"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Phone Numbers Section */}
                <Collapsible open={phonesOpen} onOpenChange={setPhonesOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-foreground">Phone Numbers</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{phones.length || (lead.phone ? 1 : 0)}</Badge>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", !phonesOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-3 pl-6">
                    {lead.phone && phones.length === 0 && (
                      <div className="flex items-center justify-between py-1 group">
                        <div className="flex-1">
                          <FormattedPhoneInput
                            value={lead.phone}
                            onSave={(newValue) => updateLead.mutate({ phone: newValue })}
                          />
                          <p className="text-xs text-muted-foreground">Primary</p>
                        </div>
                      </div>
                    )}
                    {phones.map(p => (
                      <div key={p.id} className="flex items-center justify-between py-1 group">
                        <div className="flex-1">
                          <FormattedPhoneInput
                            value={p.phone_number}
                            onSave={(newValue) => updatePhone.mutate({ id: p.id, phone_number: newValue })}
                          />
                          <p className="text-xs text-muted-foreground capitalize">{p.phone_type}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-6 h-6 opacity-0 group-hover:opacity-100"
                          onClick={() => deletePhone.mutate(p.id)}
                        >
                          <Trash2 className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                    {showAddPhone ? (
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Input 
                            value={newPhone}
                            onChange={(e) => setNewPhone(e.target.value)}
                            placeholder="Phone number"
                            className="h-8 text-sm"
                          />
                        </div>
                        <Select value={newPhoneType} onValueChange={setNewPhoneType}>
                          <SelectTrigger className="w-24 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            <SelectItem value="mobile">Mobile</SelectItem>
                            <SelectItem value="work">Work</SelectItem>
                            <SelectItem value="home">Home</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-8" onClick={() => addContactPhone.mutate(newPhone)}>Add</Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowAddPhone(false)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="link" className="text-blue-600 text-sm p-0 h-auto" onClick={() => setShowAddPhone(true)}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add phone
                      </Button>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Email Addresses Section */}
                <Collapsible open={emailsOpen} onOpenChange={setEmailsOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-foreground">Email Addresses</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{emails.length || (lead.email ? 1 : 0)}</Badge>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", !emailsOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-3 pl-6">
                    {lead.email && emails.length === 0 && (
                      <div className="flex items-center justify-between py-1 group">
                        <div className="flex-1">
                          <Input
                            defaultValue={lead.email}
                            onBlur={(e) => {
                              const newValue = e.target.value.trim();
                              if (newValue !== lead.email && newValue) {
                                updateLead.mutate({ email: newValue });
                              }
                            }}
                            className="h-7 text-sm border-0 border-b border-transparent hover:border-border focus:border-blue-600 rounded-none px-0 focus-visible:ring-0"
                            placeholder="Email address"
                          />
                          <p className="text-xs text-muted-foreground">Primary</p>
                        </div>
                      </div>
                    )}
                    {emails.map(e => (
                      <div key={e.id} className="flex items-center justify-between py-1 group">
                        <div className="flex-1">
                          <Input
                            defaultValue={e.email}
                            onBlur={(ev) => {
                              const newValue = ev.target.value.trim();
                              if (newValue !== e.email && newValue) {
                                updateEmail.mutate({ id: e.id, email: newValue });
                              }
                            }}
                            className="h-7 text-sm border-0 border-b border-transparent hover:border-border focus:border-blue-600 rounded-none px-0 focus-visible:ring-0"
                            placeholder="Email address"
                          />
                          <p className="text-xs text-muted-foreground capitalize">{e.email_type}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="w-6 h-6 opacity-0 group-hover:opacity-100"
                          onClick={() => deleteEmail.mutate(e.id)}
                        >
                          <Trash2 className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                    {showAddEmail ? (
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Input 
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            placeholder="Email address"
                            className="h-8 text-sm"
                          />
                        </div>
                        <Select value={newEmailType} onValueChange={setNewEmailType}>
                          <SelectTrigger className="w-24 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover z-50">
                            <SelectItem value="work">Work</SelectItem>
                            <SelectItem value="personal">Personal</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-8" onClick={() => addContactEmail.mutate(newEmail)}>Add</Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowAddEmail(false)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="link" className="text-blue-600 text-sm p-0 h-auto" onClick={() => setShowAddEmail(true)}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add email
                      </Button>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Addresses Section */}
                <Collapsible open={addressesOpen} onOpenChange={setAddressesOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-foreground">Addresses</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{addresses.length}</Badge>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", !addressesOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-3 pl-6">
                    {addresses.length === 0 && !showAddAddress ? (
                      <p className="text-sm text-muted-foreground italic">No addresses on file</p>
                    ) : (
                      addresses.map(addr => (
                        <div key={addr.id} className="py-1 group flex items-start justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground capitalize mb-1">{addr.address_type}</p>
                            <p className="text-sm text-foreground">
                              {[addr.address_line_1, addr.address_line_2, addr.city, addr.state, addr.zip_code].filter(Boolean).join(', ')}
                            </p>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteAddress.mutate(addr.id)}
                          >
                            <X className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </div>
                      ))
                    )}
                    {showAddAddress ? (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <Select value={newAddressType} onValueChange={setNewAddressType}>
                          <SelectTrigger className="h-8 text-sm w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="business">Business</SelectItem>
                            <SelectItem value="property">Property</SelectItem>
                            <SelectItem value="mailing">Mailing</SelectItem>
                            <SelectItem value="home">Home</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={newAddressLine1}
                          onChange={(e) => setNewAddressLine1(e.target.value)}
                          placeholder="Street address"
                          className="h-8 text-sm"
                        />
                        <div className="flex gap-2">
                          <Input
                            value={newAddressCity}
                            onChange={(e) => setNewAddressCity(e.target.value)}
                            placeholder="City"
                            className="h-8 text-sm flex-1"
                          />
                          <Input
                            value={newAddressState}
                            onChange={(e) => setNewAddressState(e.target.value)}
                            placeholder="State"
                            className="h-8 text-sm w-16"
                          />
                          <Input
                            value={newAddressZip}
                            onChange={(e) => setNewAddressZip(e.target.value)}
                            placeholder="ZIP"
                            className="h-8 text-sm w-20"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button variant="ghost" size="sm" onClick={() => {
                            setShowAddAddress(false);
                            setNewAddressLine1('');
                            setNewAddressCity('');
                            setNewAddressState('');
                            setNewAddressZip('');
                          }}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => addContactAddress.mutate()} disabled={!newAddressLine1.trim()}>
                            Add
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="link" className="text-blue-600 text-sm p-0 h-auto" onClick={() => setShowAddAddress(true)}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add address
                      </Button>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Social & Web Section */}
                <Collapsible open={socialOpen} onOpenChange={setSocialOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-foreground">Social & Web</span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground ml-auto transition-transform", !socialOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3 pl-6">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Website</p>
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <Input 
                          value={contactInfo.website} 
                          onChange={(e) => setContactInfo(p => ({ ...p, website: e.target.value }))}
                          onBlur={() => updateContactInfo.mutate({ website: contactInfo.website })}
                          className="h-8 text-sm border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600 flex-1"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">LinkedIn</p>
                      <div className="flex items-center gap-2">
                        <Linkedin className="w-4 h-4 text-blue-600" />
                        <Input 
                          value={contactInfo.linkedin} 
                          onChange={(e) => setContactInfo(p => ({ ...p, linkedin: e.target.value }))}
                          onBlur={() => updateContactInfo.mutate({ linkedin: contactInfo.linkedin })}
                          className="h-8 text-sm border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600 flex-1"
                          placeholder="LinkedIn profile URL"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">X</p>
                      <div className="flex items-center gap-2">
                        <X className="w-4 h-4 text-foreground" />
                        <Input 
                          value={contactInfo.twitter} 
                          onChange={(e) => setContactInfo(p => ({ ...p, twitter: e.target.value }))}
                          onBlur={() => updateContactInfo.mutate({ twitter: contactInfo.twitter })}
                          className="h-8 text-sm border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-blue-600 flex-1"
                          placeholder="@handle"
                        />
                      </div>
                    </div>
                    <Button variant="link" className="text-blue-600 text-sm p-0 h-auto">
                      <Plus className="w-4 h-4 mr-1" />
                      Add other link
                    </Button>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Tags Section */}
                <Collapsible open={tagsOpen} onOpenChange={setTagsOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-foreground">Tags</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{contactInfo.tags.length}</Badge>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", !tagsOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-3 pl-6">
                    <div className="flex flex-wrap gap-2">
                      {contactInfo.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs flex items-center gap-1">
                          {tag}
                          <X 
                            className="w-3 h-3 cursor-pointer hover:text-red-500" 
                            onClick={() => handleRemoveTag(tag)}
                          />
                        </Badge>
                      ))}
                    </div>
                    {showAddTag ? (
                      <div className="flex gap-2 items-center">
                        <Input 
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          placeholder="e.g., attorney, referral source"
                          className="h-8 text-sm flex-1"
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                        />
                        <Button size="sm" className="h-8" onClick={handleAddTag}>Add</Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowAddTag(false)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button variant="link" className="text-blue-600 text-sm p-0 h-auto" onClick={() => setShowAddTag(true)}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add tag
                      </Button>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* About Section */}
                <Collapsible open={aboutOpen} onOpenChange={setAboutOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-foreground">About</span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground ml-auto transition-transform", !aboutOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 pl-6">
                    <Textarea
                      value={contactInfo.about}
                      onChange={(e) => setContactInfo(p => ({ ...p, about: e.target.value }))}
                      onBlur={() => updateContactInfo.mutate({ about: contactInfo.about })}
                      placeholder="Background info about this contact..."
                      className="min-h-[80px] text-sm border-border resize-none"
                    />
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Bank Relationships Section */}
                <Collapsible open={bankRelOpen} onOpenChange={setBankRelOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <Handshake className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-foreground">Bank Relationships</span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground ml-auto transition-transform", !bankRelOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 pl-6">
                    <Textarea
                      value={contactInfo.bankRelationships}
                      onChange={(e) => setContactInfo(p => ({ ...p, bankRelationships: e.target.value }))}
                      onBlur={() => updateContactInfo.mutate({ bankRelationships: contactInfo.bankRelationships })}
                      placeholder="Excluded lender names from CLX agreement..."
                      className="min-h-[80px] text-sm border-border resize-none"
                    />
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* History / Log Activity Section */}
                <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <History className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-foreground">History</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{activities.length + communications.length}</Badge>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", !historyOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-3 pl-6">
                    <div className="flex gap-2 mb-3">
                      <Button variant="outline" size="sm" className="text-xs">
                        <PhoneCall className="w-3 h-3 mr-1" />
                        Log Call
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs">
                        <Mail className="w-3 h-3 mr-1" />
                        Log Email
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        Add Note
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {[...activities, ...communications.map(c => ({ 
                        ...c, 
                        activity_type: c.communication_type,
                        title: `${c.direction === 'inbound' ? 'Inbound' : 'Outbound'} ${c.communication_type}`,
                        content: c.content 
                      }))].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10).map((item) => (
                        <div key={item.id} className="flex items-start gap-2 py-1 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5" />
                          <div>
                            <p className="text-foreground">{item.title || item.activity_type}</p>
                            <p className="text-muted-foreground">{format(new Date(item.created_at), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Email Threads Section */}
                <Collapsible open={emailThreadsOpen} onOpenChange={setEmailThreadsOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-foreground">Email Threads</span>
                    {gmailEmailsLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin ml-auto text-muted-foreground" />
                    ) : (
                      <Badge variant="secondary" className="ml-auto text-xs">{allEmailThreads.length}</Badge>
                    )}
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", !emailThreadsOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-3 pl-6">
                    {gmailEmailsLoading ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Loading emails...</span>
                      </div>
                    ) : allEmailThreads.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No email threads found</p>
                    ) : (
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {allEmailThreads.map((thread: any) => (
                          <a
                            key={thread.id}
                            href={`/admin/gmail?thread=${thread.thread_id}`}
                            className="flex items-start gap-2 py-2 px-2 -mx-2 rounded hover:bg-muted/50 cursor-pointer group"
                          >
                            <Mail className="w-4 h-4 text-muted-foreground mt-0.5 group-hover:text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-foreground truncate group-hover:text-primary flex-1">
                                  {thread.subject || '(No Subject)'}
                                </p>
                                {thread.messageCount > 1 && (
                                  <span className="text-xs text-muted-foreground shrink-0">({thread.messageCount})</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{thread.snippet}</p>
                              <p className="text-xs text-muted-foreground">
                                {thread.last_message_date 
                                  ? formatActivityTimestamp(thread.last_message_date)
                                  : 'No date'}
                              </p>
                            </div>
                            {thread.waiting_on && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {thread.waiting_on}
                              </Badge>
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                    <Button 
                      variant="link" 
                      className="text-blue-600 text-sm p-0 h-auto"
                      onClick={() => window.location.href = '/admin/gmail'}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      View all emails
                    </Button>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Connections Section */}
                <Collapsible open={connectionsOpen} onOpenChange={setConnectionsOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-foreground">Connections</span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground ml-auto transition-transform", !connectionsOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-3 pl-6">
                    <p className="text-sm text-muted-foreground italic">No connections linked</p>
                    <Button variant="link" className="text-blue-600 text-sm p-0 h-auto">
                      <Plus className="w-4 h-4 mr-1" />
                      Link person or company
                    </Button>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Tasks Section */}
                <Collapsible open={tasksOpen} onOpenChange={setTasksOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <ListTodo className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm text-foreground">Tasks</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{tasks.filter(t => t.status !== 'completed' && t.status !== 'done').length}</Badge>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", !tasksOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-3 pl-6">
                    {tasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No tasks assigned</p>
                    ) : (
                      tasks.slice(0, 5).map(task => (
                        <div key={task.id} className="flex items-start gap-2 py-1">
                          {task.status === 'completed' || task.status === 'done' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className={cn("text-sm", (task.status === 'completed' || task.status === 'done') && "line-through text-muted-foreground")}>{task.title}</p>
                            {task.due_date && (
                              <p className="text-xs text-muted-foreground">Due {format(new Date(task.due_date), 'MMM d')}</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    <Button variant="link" className="text-blue-600 text-sm p-0 h-auto" onClick={() => setShowAddTask(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add task
                    </Button>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Notes Section - No header, content displayed prominently */}
                <div className="py-3">
                  <RichTextEditor
                    value={notesContent}
                    onChange={setNotesContent}
                    onBlur={() => notesContent !== lead.notes && saveNotes.mutate()}
                    placeholder="Add notes..."
                    minHeight="100px"
                  />
                  {lead.updated_at && notesContent && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last updated: {format(new Date(lead.updated_at), 'M/d/yy')}
                    </p>
                  )}
                </div>

                <Separator />

                {/* Magic Columns Section */}
                <Collapsible open={magicColumnsOpen} onOpenChange={setMagicColumnsOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded px-2 -mx-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span className="font-medium text-sm text-foreground">Magic Columns</span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground ml-auto transition-transform", !magicColumnsOpen && "-rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3 pl-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Days in Stage</p>
                        <p className="text-sm text-foreground font-medium">{daysInStage}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Last Interaction</p>
                        <p className="text-sm text-foreground">
                          {lastInteractionDate ? format(new Date(lastInteractionDate), 'MMM d') : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Next Due Task</p>
                        <p className="text-sm text-foreground">
                          {nextDueTask?.due_date ? format(new Date(nextDueTask.due_date), 'MMM d') : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Last Email</p>
                        <p className="text-sm text-foreground">
                          {lastEmailDate ? format(new Date(lastEmailDate), 'MMM d') : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Last Contacted</p>
                        <p className="text-sm text-foreground">
                          {lead.last_activity_at ? format(new Date(lead.last_activity_at), 'MMM d') : '—'}
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>

      {/* Add Task Dialog - uses same dialog as To Do page */}
      <TaskDetailDialog
        task={null}
        open={showAddTask}
        onClose={() => setShowAddTask(false)}
        onUpdateTask={() => {}}
        onAddComment={() => {}}
        onCreateTask={async (task) => {
          if (!lead) return;
          
          // Add to unified tasks table
          const { error: evanTaskError } = await supabase.from('tasks').insert({
            title: task.title || '',
            description: task.description || `Task for ${lead.name}${lead.company_name ? ` (${lead.company_name})` : ''}`,
            due_date: task.due_date || null,
            priority: task.priority || 'medium',
            status: task.status || 'todo',
            lead_id: lead.id,
            source: 'lead',
            team_member_id: (task as any).team_member_id || '5e2d8710-7a23-4c33-87a2-4ad9ced4e936',
            estimated_hours: task.estimated_hours || null,
          });
          if (evanTaskError) {
            toast({ title: 'Failed to sync task', variant: 'destructive' });
            return;
          }
          
          queryClient.invalidateQueries({ queryKey: ['lead-tasks', lead.id], refetchType: 'all' });
          queryClient.invalidateQueries({ queryKey: ['evan-tasks-full'], refetchType: 'all' });
          setShowAddTask(false);
          toast({ title: 'Task created' });
        }}
        isNewTask
      />
    </>
  );
};

export default LeadDetailDialog;
