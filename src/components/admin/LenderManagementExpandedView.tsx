import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { ExpandedLeftColumn, type LeadEmail, type LeadPhone, type LeadAddress } from '@/components/admin/ExpandedLeftColumn';
import LeadRelatedSidebar from '@/components/admin/shared/LeadRelatedSidebar';
import PeopleDetailPanel from '@/components/admin/PeopleDetailPanel';
import { CONTACT_TYPE_CONFIG } from '@/components/admin/shared/contactTypeConfig';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RichTextEditor } from '@/components/ui/rich-text-input';
import { HtmlContent } from '@/components/ui/html-content';
import { isHtmlEmpty } from '@/lib/sanitize';
import { getLeadDisplayName } from '@/lib/utils';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  X, ChevronDown, ChevronRight, ChevronUp,
  Users, CheckSquare,
  CalendarDays, Plus,
  MessageSquare, Pencil, Activity,
  Mail, Phone, Loader2,
  Check, List,
} from 'lucide-react';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useLeadEmailCompose } from '@/hooks/useLeadEmailCompose';
import GmailComposeDialog from '@/components/admin/GmailComposeDialog';
import { useCall } from '@/contexts/CallContext';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import { useUndo } from '@/contexts/UndoContext';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import { differenceInDays, parseISO, format } from 'date-fns';
import { extractSenderName, toRenderableHtml } from '@/components/gmail/gmailHelpers';


type Lead = Database['public']['Tables']['lender_management']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

// ── Pipeline stage config (7 stages) ──
const PIPELINE_STATUSES: LeadStatus[] = [
  'initial_review',
  'moving_to_underwriting',
  'onboarding',
  'underwriting',
  'ready_for_wu_approval',
  'pre_approval_issued',
  'won',
];

const pipelineStageConfig: Record<string, { title: string; color: string; bg: string; dot: string; pill: string }> = {
  initial_review: { title: 'Initial Review', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800', dot: 'bg-blue-500', pill: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  moving_to_underwriting: { title: 'Moving to UW', color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800', dot: 'bg-cyan-500', pill: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300' },
  onboarding: { title: 'Onboarding', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800', dot: 'bg-amber-500', pill: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  underwriting: { title: 'Underwriting', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800', dot: 'bg-orange-500', pill: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' },
  ready_for_wu_approval: { title: 'Ready for Approval', color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800', dot: 'bg-violet-500', pill: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' },
  pre_approval_issued: { title: 'Pre-Approval Issued', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800', dot: 'bg-purple-500', pill: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' },
  won: { title: 'Won', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500', pill: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' },
};

const VALUE_BUCKETS = [25000, 50000, 75000, 100000, 150000, 200000, 250000, 350000, 500000, 750000];

function seededRand(seed: string, index: number): number {
  let h = index * 2654435761;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h ^= h >>> 16;
  }
  return Math.abs(h) / 0xffffffff;
}

function fakeValue(id: string): number {
  return VALUE_BUCKETS[Math.floor(seededRand(id, 1) * VALUE_BUCKETS.length)];
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try { return differenceInDays(new Date(), parseISO(dateStr)); } catch { return null; }
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'M/d/yyyy'); } catch { return '—'; }
}

const ACTIVITY_TYPE_ICONS: Record<string, { icon: typeof Activity; color: string }> = {
  call: { icon: Phone, color: 'text-blue-500' },
  email: { icon: Mail, color: 'text-emerald-500' },
  meeting: { icon: Users, color: 'text-blue-500' },
  note: { icon: Pencil, color: 'text-amber-500' },
  todo: { icon: CheckSquare, color: 'text-muted-foreground' },
  follow_up: { icon: Users, color: 'text-blue-500' },
};

// Filterable activity types shown in the "Earlier" Filters dropdown.
// Types not listed here (todo, follow_up, comment, stage_change, etc.) always show.
const TIMELINE_TYPE_FILTERS = [
  { label: 'Notes',           value: 'note',           icon: Pencil },
  { label: 'Emails',          value: 'email',          icon: Mail },
  { label: 'Phone Calls',     value: 'call',           icon: Phone },
  { label: 'Meetings',        value: 'meeting',        icon: Users },
  { label: 'SMSs',            value: 'sms',            icon: MessageSquare },
  { label: 'Calendar Events', value: 'calendar_event', icon: CalendarDays },
] as const;
const ALL_TIMELINE_TYPE_VALUES = new Set<string>(TIMELINE_TYPE_FILTERS.map((f) => f.value));

/* ─── Stats Card (accent card style) ─── */
function StatBox({ value, label, icon, bg, border, valueColor, iconBg }: {
  value: string | number;
  label: string;
  icon: React.ReactNode;
  bg: string;
  border: string;
  valueColor: string;
  iconBg: string;
}) {
  return (
    <div className={`relative flex flex-col gap-0.5 rounded-lg px-3.5 py-2.5 border-2 ${bg} ${border} min-w-0 flex-1 shadow-sm`}>
      <span className={`absolute top-2 right-2.5 h-6 w-6 rounded-full flex items-center justify-center ${iconBg}`}>{icon}</span>
      <span className={`text-xl font-extrabold tabular-nums leading-tight ${valueColor}`}>{value}</span>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
  );
}

/* ─── Related Section ─── */
function RelatedSection({ icon, label, count, iconColor, onAdd, children }: {
  icon: React.ReactNode; label: string; count: number; iconColor?: string; onAdd?: () => void; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2.5 hover:bg-muted/50 px-4 rounded-lg transition-colors">
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <span className={iconColor}>{icon}</span> {label}
        </span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center rounded-full ml-1 bg-muted text-muted-foreground">
          {count}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 ml-auto text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            if (onAdd) onAdd();
            else toast.info('Coming soon');
          }}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function LenderManagementExpandedView() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { registerUndo, isUndoingRef } = useUndo();
  const { setSearchComponent } = useAdminTopBar();
  const [searchTerm, setSearchTerm] = useState('');

  // Email compose + click-to-call. See PipelineExpandedView for the pattern.
  const { openCompose, dialogProps: composeDialogProps } = useLeadEmailCompose({
    leadId,
    tableName: 'lender_management',
  });
  const { makeOutboundCall } = useCall();
  const handleCallPhone = useCallback(
    (phone: string) => {
      void makeOutboundCall(phone, leadId, undefined);
    },
    [makeOutboundCall, leadId],
  );

  useEffect(() => {
    setSearchComponent(
      <AdminTopBarSearch value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
    );
    return () => setSearchComponent(null);
  }, [searchTerm]);

  const [activityTab, setActivityTab] = useState<'log' | 'note'>('log');

  // Activity form state
  const [activityType, setActivityType] = useState('todo');
  const [activityNote, setActivityNote] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityDropdownOpen, setActivityDropdownOpen] = useState(false);

  // Activity expand / comments state
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [savingComment, setSavingComment] = useState<string | null>(null);
  const [selectedTimelineMembers, setSelectedTimelineMembers] = useState<Set<string>>(new Set());
  const [selectedTimelineTypes, setSelectedTimelineTypes] = useState<Set<string>>(
    () => new Set(TIMELINE_TYPE_FILTERS.map((f) => f.value))
  );

  const { teamMember } = useTeamMember();

  // ── Stage change handler ──
  const handleStageChange = useCallback(async (newStatus: LeadStatus) => {
    if (!leadId) return;
    const { data: current } = await supabase.from('lender_management').select('status').eq('id', leadId).single();
    const previousStatus = current?.status as LeadStatus | null;
    const { error } = await supabase
      .from('lender_management')
      .update({ status: newStatus })
      .eq('id', leadId);
    if (error) {
      toast.error('Failed to update stage');
      return;
    }
    registerUndo({
      label: `Stage changed to ${pipelineStageConfig[newStatus]?.title ?? newStatus}`,
      execute: async () => {
        const { error: e } = await supabase.from('lender_management').update({ status: previousStatus }).eq('id', leadId);
        if (e) throw e;
        queryClient.invalidateQueries({ queryKey: ['lm-expanded-lead', leadId] });
        queryClient.invalidateQueries({ queryKey: ['lm-leads'] });
      },
    });
    toast.success('Stage updated');
    queryClient.invalidateQueries({ queryKey: ['lm-expanded-lead', leadId] });
    queryClient.invalidateQueries({ queryKey: ['lm-leads'] });
  }, [leadId, queryClient, registerUndo]);

  // ── Deal-outcome change handler (Status dropdown: Open / Won / Lost / Abandoned) ──
  const handleDealOutcomeChange = useCallback(async (newOutcome: 'open' | 'won' | 'lost' | 'abandoned') => {
    if (!leadId) return;
    const { data: current } = await supabase.from('lender_management').select('deal_outcome').eq('id', leadId).single();
    const previousOutcome = (current?.deal_outcome ?? 'open') as 'open' | 'won' | 'lost' | 'abandoned';
    const { error } = await supabase
      .from('lender_management')
      .update({ deal_outcome: newOutcome })
      .eq('id', leadId);
    if (error) {
      toast.error('Failed to update status');
      return;
    }
    registerUndo({
      label: `Status changed to ${newOutcome}`,
      execute: async () => {
        const { error: e } = await supabase.from('lender_management').update({ deal_outcome: previousOutcome }).eq('id', leadId);
        if (e) throw e;
        queryClient.invalidateQueries({ queryKey: ['lm-expanded-lead', leadId] });
        queryClient.invalidateQueries({ queryKey: ['lm-leads'] });
      },
    });
    toast.success('Status updated');
    queryClient.invalidateQueries({ queryKey: ['lm-expanded-lead', leadId] });
    queryClient.invalidateQueries({ queryKey: ['lm-leads'] });
  }, [leadId, queryClient, registerUndo]);

  // ── Priority change handler (Priority dropdown: None / Low / Medium / High) ──
  const handlePriorityChange = useCallback(async (newPriority: 'low' | 'medium' | 'high' | null) => {
    if (!leadId) return;
    const { data: current } = await supabase.from('lender_management').select('priority').eq('id', leadId).single();
    const previousPriority = (current?.priority ?? null) as 'low' | 'medium' | 'high' | null;
    const { error } = await supabase
      .from('lender_management')
      .update({ priority: newPriority })
      .eq('id', leadId);
    if (error) {
      toast.error('Failed to update priority');
      return;
    }
    registerUndo({
      label: `Priority changed to ${newPriority ?? 'None'}`,
      execute: async () => {
        const { error: e } = await supabase.from('lender_management').update({ priority: previousPriority }).eq('id', leadId);
        if (e) throw e;
        queryClient.invalidateQueries({ queryKey: ['lm-expanded-lead', leadId] });
        queryClient.invalidateQueries({ queryKey: ['lm-leads'] });
      },
    });
    toast.success('Priority updated');
    queryClient.invalidateQueries({ queryKey: ['lm-expanded-lead', leadId] });
    queryClient.invalidateQueries({ queryKey: ['lm-leads'] });
  }, [leadId, queryClient, registerUndo]);

  // ── Field saved handler ──
  const handleFieldSaved = useCallback((_field: string, _newValue: string) => {
    queryClient.invalidateQueries({ queryKey: ['lm-expanded-lead', leadId] });
    queryClient.invalidateQueries({ queryKey: ['lm-leads'] });
    if (!isUndoingRef.current) toast.success('Updated');
  }, [leadId, queryClient, isUndoingRef]);

  const handleBooleanToggle = useCallback(async (field: string, currentVal: boolean) => {
    if (!leadId) return;
    const { error } = await supabase.from('lender_management').update({ [field]: !currentVal }).eq('id', leadId);
    if (error) { toast.error('Failed to save'); return; }
    registerUndo({
      label: `Toggled ${field}`,
      execute: async () => {
        const { error: e } = await supabase.from('lender_management').update({ [field]: currentVal }).eq('id', leadId);
        if (e) throw e;
        queryClient.invalidateQueries({ queryKey: ['lm-expanded-lead', leadId] });
        queryClient.invalidateQueries({ queryKey: ['lm-leads'] });
      },
    });
    queryClient.invalidateQueries({ queryKey: ['lm-expanded-lead', leadId] });
    queryClient.invalidateQueries({ queryKey: ['lm-leads'] });
    toast.success('Updated');
  }, [leadId, queryClient, registerUndo]);

  // ── Save activity ──
  const handleSaveActivity = useCallback(async () => {
    if (!leadId) return;
    const rawContent = activityTab === 'log' ? activityNote : noteContent;
    const content = rawContent.trim();
    const type = activityTab === 'log' ? activityType : 'note';
    if (!content || isHtmlEmpty(content)) {
      toast.error('Please enter some content');
      return;
    }
    setSavingActivity(true);
    const { error } = await supabase.from('activities').insert({
      entity_id: leadId,
      entity_type: 'lender_management',
      activity_type: type,
      content,
      title: type === 'note' ? 'Note' : type.charAt(0).toUpperCase() + type.slice(1),
    });
    setSavingActivity(false);
    if (error) {
      toast.error('Failed to save activity');
      return;
    }
    // Reset inactive days timer
    await supabase.from('lender_management').update({ last_activity_at: new Date().toISOString() }).eq('id', leadId);
    toast.success('Activity saved');
    if (activityTab === 'log') setActivityNote('');
    else setNoteContent('');
    queryClient.invalidateQueries({ queryKey: ['lm-lead-activities', leadId] });
    queryClient.invalidateQueries({ queryKey: ['lm-expanded-lead', leadId] });
  }, [leadId, activityTab, activityType, activityNote, noteContent, queryClient]);

  // ── Save activity comment ──
  const handleSaveComment = useCallback(async (activityId: string) => {
    const text = (commentTexts[activityId] ?? '').trim();
    if (!text || !leadId) return;
    setSavingComment(activityId);
    const { error } = await supabase.from('activity_comments').insert({
      activity_id: activityId,
      lead_id: leadId,
      content: text,
      created_by: teamMember?.name ?? null,
    });
    setSavingComment(null);
    if (error) {
      toast.error('Failed to save comment');
      return;
    }
    setCommentTexts((prev) => ({ ...prev, [activityId]: '' }));
    queryClient.invalidateQueries({ queryKey: ['lm-activity-comments', leadId] });
  }, [leadId, commentTexts, teamMember, queryClient]);

  // ── Queries ──
  const { data: lead, isLoading } = useQuery({
    queryKey: ['lm-expanded-lead', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lender_management')
        .select('*')
        .eq('id', leadId!)
        .single();
      if (error) throw error;
      return data as Lead;
    },
    enabled: !!leadId,
  });

  const { data: teamMembers = [] } = useAssignableUsers();

  const teamMemberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of teamMembers) map[m.id] = m.name;
    return map;
  }, [teamMembers]);

  // Selected person for person detail panel — sidebar's `onPersonSelect`
  // toggles this; when non-null we render <PeopleDetailPanel> in the right
  // column in place of <LeadRelatedSidebar>. `any` here mirrors
  // UnderwritingExpandedView — the sidebar returns a loose shape merged
  // from multiple sources that PeopleDetailPanel's Person type narrows.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedPerson, setSelectedPerson] = useState<any>(null);

  // ── Delete confirmation ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const handleDeleteLead = useCallback(async () => {
    if (!leadId) return;
    // Polymorphic children are cleaned up by the BEFORE DELETE trigger
    // (cleanup_deal_polymorphic_children).
    const { error } = await supabase.from('lender_management').delete().eq('id', leadId);
    if (error) {
      toast.error('Failed to delete');
      return;
    }
    toast.success('Deleted');
    queryClient.invalidateQueries({ queryKey: ['lm-leads'] });
    queryClient.invalidateQueries({ queryKey: ['lm-expanded-lead', leadId] });
    navigate(-1);
  }, [leadId, queryClient, navigate]);

  const { data: interactionCount = 0 } = useQuery({
    queryKey: ['lm-lead-interactions', leadId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('communications')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', leadId!);
      if (error) return 0;
      return count ?? 0;
    },
    enabled: !!leadId,
  });

  const { data: lastContactType = null } = useQuery({
    queryKey: ['lm-lead-last-contact-type', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select('communication_type')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return data.communication_type;
    },
    enabled: !!leadId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['lm-lead-activities', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('entity_id', leadId!)
        .eq('entity_type', 'lender_management')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!leadId,
  });

  // ── Activity comments query ──
  const { data: activityCommentsMap = {} } = useQuery({
    queryKey: ['lm-activity-comments', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_comments')
        .select('*')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      for (const c of data ?? []) {
        (map[c.activity_id] ??= []).push(c);
      }
      return map;
    },
    enabled: !!leadId,
  });

  // ── Satellite table queries ──
  const { data: leadEmails = [] } = useQuery({
    queryKey: ['lm-lead-emails', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('entity_emails').select('*').eq('entity_id', leadId!).eq('entity_type', 'lender_management');
      return (data || []) as LeadEmail[];
    },
    enabled: !!leadId,
  });

  const { data: leadPhones = [] } = useQuery({
    queryKey: ['lm-lead-phones', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('entity_phones').select('*').eq('entity_id', leadId!).eq('entity_type', 'lender_management');
      return (data || []) as LeadPhone[];
    },
    enabled: !!leadId,
  });

  const { data: leadAddresses = [] } = useQuery({
    queryKey: ['lm-lead-addresses', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('entity_addresses').select('*').eq('entity_id', leadId!).eq('entity_type', 'lender_management');
      return (data || []) as LeadAddress[];
    },
    enabled: !!leadId,
  });

  // ── Gmail email queries ──
  const { data: gmailConnection } = useQuery({
    queryKey: ['gmail-connection-for-lm-lead'],
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
    enabled: !!leadId,
  });

  const leadEmailAddresses = useMemo(() => {
    if (!lead) return [];
    const allEmails: string[] = [];
    if (lead.email) allEmails.push(lead.email.toLowerCase());
    leadEmails.forEach(e => allEmails.push(e.email.toLowerCase()));
    return [...new Set(allEmails)];
  }, [lead, leadEmails]);

  const { data: gmailEmails = [], isLoading: gmailEmailsLoading } = useQuery({
    queryKey: ['lm-lead-gmail-emails', leadId, leadEmailAddresses],
    queryFn: async () => {
      if (!gmailConnection || leadEmailAddresses.length === 0) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
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
        body: msg.body || '',
        isRead: !msg.isUnread,
      }));
    },
    enabled: !!gmailConnection && leadEmailAddresses.length > 0 && !!leadId,
  });

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
          messages: [{ id: email.id, from: email.from, to: email.to, date: email.date, body: email.body, subject: email.subject }],
        });
      } else {
        const existing = threadMap.get(email.threadId);
        existing.messageCount++;
        existing.messages.push({ id: email.id, from: email.from, to: email.to, date: email.date, body: email.body, subject: email.subject });
        if (new Date(email.date) > new Date(existing.last_message_date)) {
          existing.last_message_date = email.date;
          existing.snippet = email.snippet;
        }
      }
    });
    for (const thread of threadMap.values()) {
      thread.messages.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return Array.from(threadMap.values()).sort((a, b) =>
      new Date(b.last_message_date || 0).getTime() - new Date(a.last_message_date || 0).getTime()
    );
  }, [gmailEmails]);

  // Merge activities and email threads into a single timeline, sorted newest-first
  const timelineItems = useMemo(() => {
    const items: Array<{ type: 'activity'; data: typeof activities[number]; date: string } | { type: 'email_thread'; data: any; date: string }> = [];
    activities.forEach(act => items.push({ type: 'activity', data: act, date: act.created_at }));
    allEmailThreads.forEach(thread => items.push({ type: 'email_thread', data: thread, date: thread.last_message_date || '' }));
    return items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [activities, allEmailThreads]);

  // Timeline filtered by selected team members AND selected activity types.
  // Empty member selection = show all members. Types default to all 6 selected.
  const filteredTimelineItems = useMemo(() => {
    // Pass 1: filter by team member
    let memberFiltered = timelineItems;
    if (selectedTimelineMembers.size > 0) {
      const selectedNames = new Set<string>();
      const selectedEmails = new Set<string>();
      for (const m of teamMembers) {
        if (selectedTimelineMembers.has(m.id)) {
          if (m.name) selectedNames.add(m.name);
          if (m.email) selectedEmails.add(m.email.toLowerCase());
        }
      }
      memberFiltered = timelineItems.filter((item) => {
        if (item.type === 'activity') {
          return !!item.data.created_by && selectedNames.has(item.data.created_by);
        }
        const thread = item.data;
        return (thread.messages ?? []).some((msg: { from?: string }) => {
          if (!msg.from) return false;
          const match = msg.from.match(/<([^>]+)>/);
          const email = (match ? match[1] : msg.from).toLowerCase();
          return selectedEmails.has(email);
        });
      });
    }
    // Pass 2: filter by activity type. Types not in the filterable set always show.
    return memberFiltered.filter((item) => {
      if (item.type === 'email_thread') {
        return selectedTimelineTypes.has('email');
      }
      const t = item.data.activity_type;
      if (!ALL_TIMELINE_TYPE_VALUES.has(t)) return true;
      return selectedTimelineTypes.has(t);
    });
  }, [timelineItems, selectedTimelineMembers, selectedTimelineTypes, teamMembers]);

  // ── Satellite table mutations ──
  const addEmailMutation = useMutation({
    mutationFn: async ({ email, type }: { email: string; type: string }) => {
      if (!leadId) return;
      const { error } = await supabase.from('entity_emails').insert({ entity_id: leadId, entity_type: 'lender_management', email, email_type: type });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lm-lead-emails', leadId] });
      toast.success('Email added');
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase.from('entity_emails').delete().eq('id', emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lm-lead-emails', leadId] });
      toast.success('Email removed');
    },
  });

  const addPhoneMutation = useMutation({
    mutationFn: async ({ phone, type }: { phone: string; type: string }) => {
      if (!leadId) return;
      const { error } = await supabase.from('entity_phones').insert({ entity_id: leadId, entity_type: 'lender_management', phone_number: phone, phone_type: type });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lm-lead-phones', leadId] });
      toast.success('Phone added');
    },
  });

  const deletePhoneMutation = useMutation({
    mutationFn: async (phoneId: string) => {
      const { error } = await supabase.from('entity_phones').delete().eq('id', phoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lm-lead-phones', leadId] });
      toast.success('Phone removed');
    },
  });

  const addAddressMutation = useMutation({
    mutationFn: async ({ line1, city, state, zip, type }: { line1: string; city: string; state: string; zip: string; type: string }) => {
      if (!leadId || !line1) return;
      const { error } = await supabase.from('entity_addresses').insert({
        entity_id: leadId,
        entity_type: 'lender_management',
        address_line_1: line1,
        city: city || null,
        state: state || null,
        zip_code: zip || null,
        address_type: type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lm-lead-addresses', leadId] });
      toast.success('Address added');
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await supabase.from('entity_addresses').delete().eq('id', addressId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lm-lead-addresses', leadId] });
      toast.success('Address removed');
    },
  });

  // ── Owner change handler (passed to shared left column) ──
  const handleOwnerChange = useCallback(async (newOwnerId: string) => {
    if (!leadId) return;
    const previousOwner = lead?.assigned_to ?? null;
    const { error } = await supabase.from('lender_management').update({ assigned_to: newOwnerId || null }).eq('id', leadId);
    if (error) { toast.error('Failed to save'); return; }
    registerUndo({
      label: 'Owner changed',
      execute: async () => {
        const { error: e } = await supabase.from('lender_management').update({ assigned_to: previousOwner || null }).eq('id', leadId);
        if (e) throw e;
        handleFieldSaved('assigned_to', previousOwner ?? '');
      },
    });
    handleFieldSaved('assigned_to', newOwnerId);
  }, [leadId, lead?.assigned_to, registerUndo, handleFieldSaved]);

  if (isLoading || !lead) {
    return (
      <div className="flex items-center justify-center h-full">
        <Skeleton className="h-12 w-64" />
      </div>
    );
  }

  const dealValue = lead.deal_value ?? fakeValue(lead.id);
  const dealValueStr = lead.deal_value != null ? String(lead.deal_value) : '';
  const initial = lead.name[0]?.toUpperCase() ?? '?';
  const assignedName = lead.assigned_to ? (teamMemberMap[lead.assigned_to] ?? '—') : '—';
  const daysInStage = daysSince(lead.updated_at);
  const inactiveDays = daysSince(lead.last_activity_at);
  const lastContacted = formatShortDate(lead.last_activity_at);
  const stageCfg = pipelineStageConfig[lead.status];
  const inactiveColor = (inactiveDays ?? 0) > 30 ? 'text-red-600' : 'text-amber-600';
  const ownerOptions = teamMembers.map((m) => ({ value: m.id, label: m.name }));

  function goBack() {
    navigate('/admin/pipeline/lender-management');
  }

  return (
    <>
    <div data-full-bleed className="lender-management-expanded-view system-font flex flex-col bg-background md:overflow-hidden overflow-y-auto h-[calc(100vh-3.5rem)]">
      <style>{`
        .lender-management-expanded-view,
        .lender-management-expanded-view *:not(svg):not(svg *) {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        }
        .lender-management-expanded-view [data-radix-scroll-area-viewport] {
          overflow-x: hidden !important;
        }
      `}</style>
      {/* ── 3-Column Body ── */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 md:overflow-hidden">

        {/* LEFT: Details — shared component */}
        <ExpandedLeftColumn
          lead={lead}
          tableName="lender_management"
          currentPipeline="lender_management"
          stages={PIPELINE_STATUSES}
          stageConfig={pipelineStageConfig}
          ownerOptions={ownerOptions}
          assignedName={assignedName}
          dealValue={dealValue}
          goBack={goBack}
          onStageChange={handleStageChange}
          onDealOutcomeChange={handleDealOutcomeChange}
          onPriorityChange={handlePriorityChange}
          onFieldSaved={handleFieldSaved}
          onBooleanToggle={handleBooleanToggle}
          onOwnerChange={handleOwnerChange}
          onDelete={() => setShowDeleteConfirm(true)}
          onComposeEmail={({ to, recipientName }) =>
            openCompose({
              to,
              recipientName,
              subject: `Lender follow-up — ${lead.company_name ?? lead.name ?? ''}`.trim(),
            })
          }
          onCallPhone={handleCallPhone}
        />

        {/* CENTER: Activity */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f5f0fa] dark:bg-purple-950/20">
          <ScrollArea className="flex-1">
            <div className="px-3 md:px-4 lg:px-6 pt-5">
              {/* Stats — floating card */}
              <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card mb-5">
                <div className="flex flex-col items-center justify-center py-3 px-2">
                  <span className="text-lg font-bold text-foreground">{interactionCount}</span>
                  <span className="text-[11px] text-muted-foreground">Interactions</span>
                </div>
                <div className="flex flex-col items-center justify-center py-3 px-2">
                  <span className="text-lg font-bold text-foreground">{lastContacted}</span>
                  <span className="text-[11px] text-muted-foreground">Last Contacted</span>
                </div>
                <div className="flex flex-col items-center justify-center py-3 px-2">
                  <span className="text-lg font-bold text-foreground">{inactiveDays ?? '—'}</span>
                  <span className="text-[11px] text-muted-foreground">Inactive Days</span>
                </div>
              </div>

              {/* Activity tabs + form — floating card */}
              <div className="rounded-lg border border-border bg-card overflow-hidden mb-5">
                <div className="flex items-stretch border-b border-gray-200 dark:border-border">
                  {([
                    { key: 'log' as const, label: 'Log Activity' },
                    { key: 'note' as const, label: 'Create Note' },
                  ]).map((tab) => (
                    <button
                      key={tab.key}
                      className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
                        activityTab === tab.key
                          ? 'text-blue-700 dark:text-blue-400'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setActivityTab(tab.key)}
                    >
                      {tab.label}
                      {activityTab === tab.key && (
                        <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-700 dark:bg-blue-500" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-5">
              {activityTab === 'log' ? (
                <div className="space-y-4">
                  {/* Activity type dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setActivityDropdownOpen(!activityDropdownOpen)}
                      className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border hover:bg-muted/40 transition-colors text-sm font-medium text-foreground"
                    >
                      {(() => {
                        const types: Record<string, { label: string; icon: typeof CheckSquare }> = {
                          todo: { label: 'To Do', icon: CheckSquare },
                          call: { label: 'Phone Call', icon: Phone },
                          meeting: { label: 'Meeting', icon: CalendarDays },
                          email: { label: 'Email', icon: MessageSquare },
                          follow_up: { label: 'Follow Up', icon: Users },
                        };
                        const t = types[activityType] ?? types.todo;
                        const Icon = t.icon;
                        return <><Icon className="h-4 w-4 text-muted-foreground" />{t.label}</>;
                      })()}
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                    </button>

                    {activityDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setActivityDropdownOpen(false)} />
                        <div className="absolute z-50 top-full left-0 mt-1.5 w-[320px] bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                          <div className="py-1">
                            {([
                              { value: 'todo', label: 'To Do', icon: CheckSquare },
                              { value: 'call', label: 'Phone Call', icon: Phone },
                              { value: 'meeting', label: 'Meeting', icon: CalendarDays },
                              { value: 'email', label: 'Email', icon: MessageSquare },
                              { value: 'follow_up', label: 'Follow Up', icon: Users },
                            ] as const)
                              .map((opt) => {
                                const Icon = opt.icon;
                                return (
                                  <button
                                    key={opt.value}
                                    onClick={() => { setActivityType(opt.value); setActivityDropdownOpen(false); }}
                                    className={`flex items-center gap-3.5 w-full text-left px-4 py-3 text-sm transition-colors ${
                                      activityType === opt.value ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400' : 'text-foreground hover:bg-muted/50'
                                    }`}
                                  >
                                    <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                                    <span className="font-medium">{opt.label}</span>
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <RichTextEditor
                    value={activityNote}
                    onChange={setActivityNote}
                    placeholder="Add a note..."
                    minHeight="80px"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveActivity}
                      disabled={savingActivity || isHtmlEmpty(activityNote)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 rounded-lg"
                    >
                      {savingActivity && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                      Save Activity
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <RichTextEditor
                    value={noteContent}
                    onChange={setNoteContent}
                    placeholder="Write a note..."
                    minHeight="120px"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveActivity}
                      disabled={savingActivity || isHtmlEmpty(noteContent)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 rounded-lg"
                    >
                      {savingActivity && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                      Save Note
                    </Button>
                  </div>
                </div>
              )}
                </div>
              </div>

              {/* Earlier — Activity History + Email Threads */}
              <div className="flex items-center justify-between mb-4 gap-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Earlier</h3>
                <div className="flex items-center gap-3">
                  {teamMembers.length > 0 && (
                    <div className="flex items-center -space-x-1.5">
                      {teamMembers.map((member) => {
                        const isSelected = selectedTimelineMembers.has(member.id);
                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => {
                              const next = new Set(selectedTimelineMembers);
                              if (next.has(member.id)) next.delete(member.id);
                              else next.add(member.id);
                              setSelectedTimelineMembers(next);
                            }}
                            style={{ borderRadius: '9999px' }}
                            className={`w-7 h-7 aspect-square shrink-0 border-2 font-semibold text-[10px] leading-none flex items-center justify-center transition-all ${
                              isSelected
                                ? 'border-violet-500 text-white bg-violet-500 z-10'
                                : 'border-slate-300 text-violet-700 bg-violet-50 hover:border-violet-400'
                            }`}
                            title={member.name}
                            aria-label={member.name}
                          >
                            {member.name.charAt(0).toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs font-semibold text-foreground hover:text-violet-700 transition-colors"
                      >
                        <span>Filters ({filteredTimelineItems.length})</span>
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 p-0">
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = selectedTimelineTypes.size === TIMELINE_TYPE_FILTERS.length;
                          setSelectedTimelineTypes(
                            allSelected ? new Set() : new Set(TIMELINE_TYPE_FILTERS.map((f) => f.value))
                          );
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <List className="h-4 w-4 text-muted-foreground" />
                        <span className="flex-1 text-left text-sm text-foreground">All Activities</span>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center ${
                            selectedTimelineTypes.size === TIMELINE_TYPE_FILTERS.length
                              ? 'bg-violet-600 text-white'
                              : 'border border-slate-300'
                          }`}
                        >
                          {selectedTimelineTypes.size === TIMELINE_TYPE_FILTERS.length && (
                            <Check className="h-3 w-3" />
                          )}
                        </div>
                      </button>
                      <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground border-t border-border">
                        Default Filters
                      </div>
                      {TIMELINE_TYPE_FILTERS.map((f) => {
                        const Icon = f.icon;
                        const isSelected = selectedTimelineTypes.has(f.value);
                        return (
                          <button
                            key={f.value}
                            type="button"
                            onClick={() => {
                              const next = new Set(selectedTimelineTypes);
                              if (next.has(f.value)) next.delete(f.value);
                              else next.add(f.value);
                              setSelectedTimelineTypes(next);
                            }}
                            className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-muted/50 transition-colors"
                          >
                            <Icon className="h-4 w-4 text-foreground" />
                            <span className="flex-1 text-left text-sm text-foreground">{f.label}</span>
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center ${
                                isSelected ? 'bg-violet-600 text-white' : 'border border-slate-300'
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3" />}
                            </div>
                          </button>
                        );
                      })}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              {gmailEmailsLoading && (
                <div className="flex items-center gap-2 py-2 mb-3">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Loading emails...</span>
                </div>
              )}
              <div className="space-y-3">
                {filteredTimelineItems.length > 0 ? (
                  filteredTimelineItems.map((item) => {
                    if (item.type === 'email_thread') {
                      const thread = item.data;
                      const isThreadExpanded = !!expandedThreads[thread.id];
                      return (
                        <div
                          key={`email-${thread.id}`}
                          className={`rounded-xl bg-card border transition-colors ${isThreadExpanded ? 'border-emerald-200' : 'border-border hover:border-border'}`}
                        >
                          <button
                            type="button"
                            className="flex gap-3 p-3 w-full text-left cursor-pointer"
                            onClick={() => setExpandedThreads((prev) => ({ ...prev, [thread.id]: !prev[thread.id] }))}
                          >
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-emerald-500">
                              <Mail className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-semibold text-foreground">{thread.subject || '(No Subject)'}</span>
                                <span className="text-[10px] text-muted-foreground">{formatShortDate(thread.last_message_date)}</span>
                                {thread.messageCount > 1 && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                    <Mail className="h-2.5 w-2.5 mr-0.5" />{thread.messageCount}
                                  </Badge>
                                )}
                              </div>
                              {!isThreadExpanded && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{thread.snippet}</p>
                              )}
                            </div>
                            {isThreadExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                            )}
                          </button>
                          {isThreadExpanded && (
                            <div className="px-3 pb-3">
                              <Separator className="mb-3" />
                              <div className="divide-y divide-border">
                                {(thread.messages ?? []).map((msg: any) => {
                                  const senderName = extractSenderName(msg.from);
                                  const senderEmail = (msg.from.match(/<([^>]+)>/) || [])[1]?.toLowerCase() || msg.from.toLowerCase();
                                  const isTeam = senderEmail.includes('commerciallendingx.com');
                                  return (
                                    <div key={msg.id} className="py-2.5 first:pt-0 last:pb-0">
                                      <div className="flex gap-2">
                                        <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                          isTeam
                                            ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400'
                                            : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'
                                        }`}>
                                          {senderName[0]?.toUpperCase() ?? '?'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] font-medium text-foreground">{senderName}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                              {(() => { try { return format(new Date(msg.date), 'MMM d, h:mm a'); } catch { return ''; } })()}
                                            </span>
                                          </div>
                                          {msg.to && (
                                            <p className="text-[10px] text-muted-foreground truncate">To: {msg.to}</p>
                                          )}
                                          <div
                                            className="mt-1 pl-0 text-xs text-muted-foreground prose prose-xs max-w-none [&_img]:max-w-full [&_table]:text-xs"
                                            dangerouslySetInnerHTML={{ __html: toRenderableHtml(msg.body ?? '') }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Activity card with comment threading
                    const act = item.data;
                    const typeInfo = ACTIVITY_TYPE_ICONS[act.activity_type] ?? ACTIVITY_TYPE_ICONS.note;
                    const IconComp = typeInfo.icon;
                    const isExpanded = !!expandedActivities[act.id];
                    const comments = activityCommentsMap[act.id] ?? [];
                    const commentCount = comments.length;
                    return (
                      <div
                        key={act.id}
                        className={`rounded-xl bg-card border transition-colors ${isExpanded ? 'border-blue-200' : 'border-border hover:border-border'}`}
                      >
                        <button
                          type="button"
                          className="flex gap-3 p-3 w-full text-left cursor-pointer"
                          onClick={() => setExpandedActivities((prev) => ({ ...prev, [act.id]: !prev[act.id] }))}
                        >
                          <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 ${typeInfo.color}`}>
                            <IconComp className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-foreground">{act.title || act.activity_type}</span>
                              <span className="text-[10px] text-muted-foreground">{formatShortDate(act.created_at)}</span>
                              {commentCount > 0 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                  <MessageSquare className="h-2.5 w-2.5 mr-0.5" />{commentCount}
                                </Badge>
                              )}
                            </div>
                            {act.content && (
                              <div className={`text-xs text-muted-foreground ${isExpanded ? '' : 'line-clamp-3'}`}>
                                <HtmlContent value={act.content} className="text-xs text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3">
                            <Separator className="mb-3" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Comments</span>
                            {comments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {comments.map((c: any) => (
                                  <div key={c.id} className="flex gap-2">
                                    <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 shrink-0">
                                      {(c.created_by ?? '?')[0]?.toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-medium text-foreground">{c.created_by ?? 'Unknown'}</span>
                                        <span className="text-[10px] text-muted-foreground">{formatShortDate(c.created_at)}</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">{c.content}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 shrink-0">
                                {(teamMember?.name ?? '?')[0]?.toUpperCase()}
                              </div>
                              <input
                                className="flex-1 text-xs bg-muted/50 border border-border rounded-md px-2 py-1 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-300"
                                placeholder="Add a comment..."
                                value={commentTexts[act.id] ?? ''}
                                onChange={(e) => setCommentTexts((prev) => ({ ...prev, [act.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && (commentTexts[act.id] ?? '').trim()) {
                                    handleSaveComment(act.id);
                                  }
                                }}
                                disabled={savingComment === act.id}
                              />
                              {savingComment === act.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="border border-dashed border-border rounded-xl py-10 flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Activity className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT: Related — shared component, or Person Detail Panel when a
            contact row is expanded via the sidebar's chevron button. */}
        {selectedPerson ? (
          <PeopleDetailPanel
            person={selectedPerson}
            contactTypeConfig={CONTACT_TYPE_CONFIG}
            teamMemberMap={teamMemberMap}
            teamMembers={teamMembers}
            onClose={() => setSelectedPerson(null)}
            onExpand={() => navigate(`/admin/contacts/people/expanded-view/${selectedPerson.id}`)}
            onPersonUpdate={(updated) => setSelectedPerson(updated)}
          />
        ) : (
          <LeadRelatedSidebar
            entityType="lender_management"
            leadId={leadId!}
            lead={{
              id: lead.id,
              name: lead.name,
              email: lead.email,
              phone: lead.phone,
              company_name: lead.company_name,
              status: lead.status,
            }}
            leadEmails={leadEmails}
            stageCfg={stageCfg ? { label: stageCfg.title, bg: stageCfg.bg, color: stageCfg.color } : null}
            teamMembers={teamMembers}
            currentUserName={teamMember?.name ?? null}
            leadQueryKey={['lm-expanded-lead', leadId]}
            leadsListQueryKey={['lm-leads']}
            onPersonSelect={(person) => setSelectedPerson(person)}
            onProjectClick={(projectId) => navigate(`/admin/pipeline/projects/expanded-view/${projectId}`)}
          />
        )}
      </div>
    </div>
    <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader><DialogTitle>Delete Record</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Are you sure you want to delete this record? This will permanently remove all associated data.</p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => { setShowDeleteConfirm(false); handleDeleteLead(); }}>Delete</Button>
        </div>
      </DialogContent>
    </Dialog>
    <GmailComposeDialog {...composeDialogProps} />
    </>
  );
}
