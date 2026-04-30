import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RichTextEditor } from '@/components/ui/rich-text-input';
import { HtmlContent } from '@/components/ui/html-content';
import { isHtmlEmpty } from '@/lib/sanitize';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  X, ChevronDown, ChevronRight, ChevronUp, Users, CheckSquare,
  CalendarDays, MessageSquare, Pencil, Activity,
  Mail, Phone, Briefcase, Loader2,
  Check, List, Copy, MoreHorizontal, Trash2, UserPlus, UserCheck,
  Building2, FileText,
} from 'lucide-react';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { CrmAvatar } from '@/components/admin/CrmAvatar';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import { useCall } from '@/contexts/CallContext';
import { useLeadEmailCompose } from '@/hooks/useLeadEmailCompose';
import GmailComposeDialog from '@/components/admin/GmailComposeDialog';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import {
  StackedEditableField, StackedReadOnlyField, EditableNotesField, formatPhoneNumber,
} from './InlineEditableFields';
import { differenceInDays, parseISO, format } from 'date-fns';
import { extractSenderName, toRenderableHtml } from '@/components/gmail/gmailHelpers';
import type { LenderProgram } from './LenderDetailPanel';

const ENTITY_TYPE = 'lender_programs';

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try { return differenceInDays(new Date(), parseISO(dateStr)); } catch { return null; }
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'M/d/yyyy'); } catch { return '—'; }
}

function formatLongDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'MMM d, yyyy'); } catch { return '—'; }
}

const ACTIVITY_TYPE_ICONS: Record<string, { icon: typeof Activity; color: string }> = {
  call: { icon: Phone, color: 'text-blue-500' },
  email: { icon: Mail, color: 'text-emerald-500' },
  meeting: { icon: Users, color: 'text-blue-500' },
  note: { icon: Pencil, color: 'text-amber-500' },
  todo: { icon: CheckSquare, color: 'text-muted-foreground' },
  follow_up: { icon: Users, color: 'text-blue-500' },
};

const TIMELINE_TYPE_FILTERS = [
  { label: 'Notes',           value: 'note',           icon: Pencil },
  { label: 'Emails',          value: 'email',          icon: Mail },
  { label: 'Phone Calls',     value: 'call',           icon: Phone },
  { label: 'Meetings',        value: 'meeting',        icon: Users },
  { label: 'SMSs',            value: 'sms',            icon: MessageSquare },
  { label: 'Calendar Events', value: 'calendar_event', icon: CalendarDays },
] as const;
const ALL_TIMELINE_TYPE_VALUES = new Set<string>(TIMELINE_TYPE_FILTERS.map((f) => f.value));

interface RelatedSectionProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  iconColor?: string;
  children?: React.ReactNode;
}

function RelatedSection({ icon, label, count, iconColor, children }: RelatedSectionProps) {
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
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function LenderExpandedView() {
  const { lenderId } = useParams<{ lenderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setSearchComponent } = useAdminTopBar();
  const [searchTerm, setSearchTerm] = useState('');
  const { teamMember } = useTeamMember();
  const teamMemberId = teamMember?.id ?? null;
  const { data: teamMembers = [] } = useAssignableUsers();
  const { makeOutboundCall } = useCall();
  const { openCompose, dialogProps: composeDialogProps } = useLeadEmailCompose({
    leadId: lenderId,
    tableName: 'lender_programs',
  });

  const handleCallPhone = useCallback(
    (phone: string) => {
      void makeOutboundCall(phone, lenderId, undefined);
    },
    [makeOutboundCall, lenderId],
  );

  useEffect(() => {
    setSearchComponent(
      <AdminTopBarSearch value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
    );
    return () => setSearchComponent(null);
  }, [searchTerm, setSearchComponent]);

  // ── Activity / note form state ──
  const [activityTab, setActivityTab] = useState<'log' | 'note'>('log');
  const [activityType, setActivityType] = useState('todo');
  const [activityNote, setActivityNote] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityDropdownOpen, setActivityDropdownOpen] = useState(false);

  // ── Timeline expand / comment state ──
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [savingComment, setSavingComment] = useState<string | null>(null);
  const [selectedTimelineMembers, setSelectedTimelineMembers] = useState<Set<string>>(new Set());
  const [selectedTimelineTypes, setSelectedTimelineTypes] = useState<Set<string>>(
    () => new Set(TIMELINE_TYPE_FILTERS.map((f) => f.value))
  );

  // ── Delete confirmation ──
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Lender query ──
  const { data: lender, isLoading } = useQuery({
    queryKey: ['lender-program-expanded', lenderId],
    queryFn: async () => {
      if (!lenderId) throw new Error('No lender ID');
      const { data, error } = await supabase
        .from('lender_programs')
        .select('*')
        .eq('id', lenderId)
        .single();
      if (error) throw error;
      return data as LenderProgram;
    },
    enabled: !!lenderId,
  });

  const handleFieldSaved = useCallback((_field: string, _newValue: string) => {
    queryClient.invalidateQueries({ queryKey: ['lender-program-expanded', lenderId] });
    queryClient.invalidateQueries({ queryKey: ['lender-programs'] });
  }, [lenderId, queryClient]);

  // ── Follow state ──
  const followQueryKey = ['entity-follow', ENTITY_TYPE, lenderId, teamMemberId] as const;
  const { data: isFollowing = false } = useQuery({
    queryKey: followQueryKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('entity_followers')
        .select('id')
        .eq('entity_id', lenderId!)
        .eq('entity_type', ENTITY_TYPE)
        .eq('user_id', teamMemberId!)
        .maybeSingle();
      return !!data;
    },
    enabled: !!lenderId && !!teamMemberId,
  });
  const toggleFollowMutation = useMutation({
    mutationFn: async () => {
      if (!teamMemberId || !lenderId) throw new Error('Missing user or lender');
      if (isFollowing) {
        const { error } = await supabase
          .from('entity_followers')
          .delete()
          .eq('entity_id', lenderId)
          .eq('entity_type', ENTITY_TYPE)
          .eq('user_id', teamMemberId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('entity_followers')
          .insert({ entity_id: lenderId, entity_type: ENTITY_TYPE, user_id: teamMemberId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: followQueryKey });
      queryClient.invalidateQueries({ queryKey: ['followed-lender-programs', teamMemberId] });
      toast.success(isFollowing ? 'Unfollowed' : 'Following');
    },
    onError: () => {
      toast.error('Failed to update follow');
    },
  });

  // ── Activities query ──
  const { data: activities = [] } = useQuery({
    queryKey: ['lender-program-activities', lenderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('entity_id', lenderId!)
        .eq('entity_type', ENTITY_TYPE)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!lenderId,
  });

  const { data: activityCommentsMap = {} } = useQuery({
    queryKey: ['lender-program-activity-comments', lenderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_comments')
        .select('*')
        .eq('lead_id', lenderId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      for (const c of data ?? []) {
        (map[c.activity_id] ??= []).push(c);
      }
      return map;
    },
    enabled: !!lenderId,
  });

  // ── Gmail emails ──
  const { data: gmailConnection } = useQuery({
    queryKey: ['gmail-connection-for-lender-program'],
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
    enabled: !!lenderId,
  });

  const lenderEmailAddresses = useMemo(() => {
    if (!lender?.email) return [] as string[];
    return [lender.email.toLowerCase()];
  }, [lender]);

  const { data: gmailEmails = [], isLoading: gmailEmailsLoading } = useQuery({
    queryKey: ['lender-program-gmail-emails', lenderId, lenderEmailAddresses],
    queryFn: async () => {
      if (!gmailConnection || lenderEmailAddresses.length === 0) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const searchQuery = lenderEmailAddresses.map(email => `from:${email} OR to:${email}`).join(' OR ');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-mailbox?action=list&q=${encodeURIComponent(searchQuery)}&maxResults=50`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );
      if (!response.ok) return [];
      const data = await response.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    enabled: !!gmailConnection && lenderEmailAddresses.length > 0 && !!lenderId,
  });

  const allEmailThreads = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const threadMap = new Map<string, any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thread.messages.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return Array.from(threadMap.values()).sort((a, b) =>
      new Date(b.last_message_date || 0).getTime() - new Date(a.last_message_date || 0).getTime()
    );
  }, [gmailEmails]);

  // ── Merge timeline ──
  const timelineItems = useMemo(() => {
    const items: Array<
      | { type: 'activity'; data: typeof activities[number]; date: string }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      | { type: 'email_thread'; data: any; date: string }
    > = [];
    activities.forEach(act => items.push({ type: 'activity', data: act, date: act.created_at }));
    allEmailThreads.forEach(thread => items.push({ type: 'email_thread', data: thread, date: thread.last_message_date || '' }));
    return items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [activities, allEmailThreads]);

  const filteredTimelineItems = useMemo(() => {
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
    return memberFiltered.filter((item) => {
      if (item.type === 'email_thread') {
        return selectedTimelineTypes.has('email');
      }
      const t = item.data.activity_type;
      if (!ALL_TIMELINE_TYPE_VALUES.has(t)) return true;
      return selectedTimelineTypes.has(t);
    });
  }, [timelineItems, selectedTimelineMembers, selectedTimelineTypes, teamMembers]);

  // ── Stats ──
  const interactionCount = activities.length + allEmailThreads.length;
  const latestActivityDate = useMemo(() => {
    const dates = [
      ...activities.map(a => a.created_at),
      ...allEmailThreads.map(t => t.last_message_date),
    ].filter(Boolean) as string[];
    if (dates.length === 0) return null;
    return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [activities, allEmailThreads]);
  const lastContacted = formatShortDate(latestActivityDate);
  const inactiveDays = daysSince(latestActivityDate);

  // ── Save activity ──
  const handleSaveActivity = useCallback(async () => {
    if (!lenderId) return;
    const rawContent = activityTab === 'log' ? activityNote : noteContent;
    const content = rawContent.trim();
    const type = activityTab === 'log' ? activityType : 'note';
    if (!content || isHtmlEmpty(content)) {
      toast.error('Please enter some content');
      return;
    }
    setSavingActivity(true);
    const { error } = await supabase.from('activities').insert({
      entity_id: lenderId,
      entity_type: ENTITY_TYPE,
      activity_type: type,
      content,
      title: type === 'note' ? 'Note' : type.charAt(0).toUpperCase() + type.slice(1),
      created_by: teamMember?.name ?? null,
    });
    setSavingActivity(false);
    if (error) {
      toast.error('Failed to save activity');
      return;
    }
    toast.success('Activity saved');
    if (activityTab === 'log') setActivityNote('');
    else setNoteContent('');
    queryClient.invalidateQueries({ queryKey: ['lender-program-activities', lenderId] });
    queryClient.invalidateQueries({ queryKey: ['lender-program-expanded', lenderId] });
  }, [lenderId, activityTab, activityType, activityNote, noteContent, queryClient, teamMember]);

  const handleSaveComment = useCallback(async (activityId: string) => {
    const text = (commentTexts[activityId] ?? '').trim();
    if (!text || !lenderId) return;
    setSavingComment(activityId);
    const { error } = await supabase.from('activity_comments').insert({
      activity_id: activityId,
      lead_id: lenderId,
      content: text,
      created_by: teamMember?.name ?? null,
    });
    setSavingComment(null);
    if (error) {
      toast.error('Failed to save comment');
      return;
    }
    setCommentTexts((prev) => ({ ...prev, [activityId]: '' }));
    queryClient.invalidateQueries({ queryKey: ['lender-program-activity-comments', lenderId] });
  }, [lenderId, commentTexts, teamMember, queryClient]);

  // ── Delete ──
  const handleDeleteLender = useCallback(async () => {
    if (!lenderId) return;
    const { error } = await supabase.from('lender_programs').delete().eq('id', lenderId);
    if (error) {
      toast.error('Failed to delete');
      return;
    }
    toast.success('Deleted');
    queryClient.invalidateQueries({ queryKey: ['lender-programs'] });
    queryClient.invalidateQueries({ queryKey: ['lender-program-expanded', lenderId] });
    navigate(-1);
  }, [lenderId, queryClient, navigate]);

  // ── Toolbar handlers ──
  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
    }
  }, []);

  const goBack = useCallback(() => navigate(-1), [navigate]);

  // ── Related sidebar queries ──
  const { data: relatedDeals = [] } = useQuery({
    queryKey: ['lender-program-related-deals', lenderId, lender?.lender_name],
    queryFn: async () => {
      if (!lender?.lender_name) return [];
      const { data } = await supabase
        .from('lender_management')
        .select('id, name, company_name, status')
        .ilike('company_name', lender.lender_name);
      return data ?? [];
    },
    enabled: !!lenderId && !!lender?.lender_name,
  });

  const { data: relatedPeople = [] } = useQuery({
    queryKey: ['lender-program-related-people', lenderId, lender?.lender_name],
    queryFn: async () => {
      if (!lender?.lender_name) return [];
      const { data } = await supabase
        .from('people')
        .select('id, name, title, email, phone, company_name')
        .ilike('company_name', lender.lender_name);
      return data ?? [];
    },
    enabled: !!lenderId && !!lender?.lender_name,
  });

  if (isLoading || !lender) {
    return (
      <div className="flex items-center justify-center h-full">
        <Skeleton className="h-12 w-64" />
      </div>
    );
  }

  return (
    <>
      <div data-full-bleed className="lender-expanded-view system-font flex flex-col bg-background md:overflow-hidden overflow-y-auto h-[calc(100vh-3.5rem)]">
        <style>{`
          .lender-expanded-view,
          .lender-expanded-view *:not(svg):not(svg *) {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          }
          .lender-expanded-view [data-radix-scroll-area-viewport] {
            overflow-x: hidden !important;
          }
        `}</style>
        <div className="flex flex-col md:flex-row flex-1 min-h-0 md:overflow-hidden">

          {/* ── LEFT: Lender Details ── */}
          <ScrollArea className="w-full md:w-[255px] lg:w-[323px] xl:w-[408px] md:shrink-0 md:min-w-[204px] min-w-0 border-b md:border-b-0 md:border-r border-border bg-card overflow-hidden">
            <div className="px-4 md:pl-6 md:pr-4 lg:pl-8 lg:pr-5 xl:pl-11 xl:pr-6 py-6 space-y-6">

              {/* Mini toolbar */}
              <div className="flex items-center justify-between -ml-1 -mr-1">
                <Button variant="ghost" size="icon" onClick={goBack} className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Close">
                  <X className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-1.5">
                  <Button
                    onClick={() => toggleFollowMutation.mutate()}
                    disabled={!teamMemberId || toggleFollowMutation.isPending}
                    aria-label={isFollowing ? 'Unfollow lender program' : 'Follow lender program'}
                    className="h-8 rounded-full px-4 text-sm font-medium gap-1.5 bg-[#3b2778] hover:bg-[#2e1f5e] text-white"
                  >
                    {isFollowing ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                    {isFollowing ? 'Following' : 'Follow'}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleCopyLink} className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Copy link">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="More actions">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleCopyLink}>
                        <Copy className="h-3.5 w-3.5 mr-2" /> Copy link
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => toggleFollowMutation.mutate()}
                        disabled={!teamMemberId || toggleFollowMutation.isPending}
                      >
                        {isFollowing ? <UserCheck className="h-3.5 w-3.5 mr-2" /> : <UserPlus className="h-3.5 w-3.5 mr-2" />}
                        {isFollowing ? 'Unfollow' : 'Follow'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setShowDeleteConfirm(true)}
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Record
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Header */}
              <div className="flex items-start gap-4">
                <CrmAvatar name={lender.lender_name} size="xl" />
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 className="text-xl font-semibold text-foreground break-words leading-tight">{lender.lender_name}</h2>
                  {lender.contact_name && (
                    <p className="text-sm text-muted-foreground mt-0.5 break-words">{lender.contact_name}</p>
                  )}
                  <div className="mt-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground bg-muted/50">
                      <Briefcase className="h-3 w-3" />
                      Lender Program
                    </span>
                  </div>
                </div>
              </div>

              {/* Stacked fields */}
              <StackedEditableField label="Lender Name" value={lender.lender_name ?? ''} field="lender_name" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />
              <StackedEditableField label="Program Name" value={lender.program_name ?? ''} field="program_name" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />
              <StackedEditableField label="Lender Type" value={lender.lender_type ?? ''} field="lender_type" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />
              <StackedEditableField label="Program Type" value={lender.program_type ?? ''} field="program_type" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

              {/* Primary Contact */}
              <div>
                <label className="text-sm text-muted-foreground block mb-2">Primary Contact</label>
                <div className="border-b border-border pb-3">
                  <div className="flex items-start gap-3 px-1 py-1.5">
                    <CrmAvatar name={lender.contact_name ?? lender.lender_name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-base text-foreground break-words">{lender.contact_name ?? '—'}</p>
                      {lender.lender_type && <p className="text-xs text-muted-foreground break-words">{lender.lender_type}</p>}
                    </div>
                  </div>
                  {lender.phone && (
                    <button
                      type="button"
                      onClick={() => handleCallPhone(lender.phone!)}
                      className="w-full flex items-start gap-2 px-1 py-1 min-w-0 text-left rounded hover:bg-muted/60 transition-colors"
                      title={`Call ${formatPhoneNumber(lender.phone)}`}
                    >
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                      <span className="text-sm text-foreground min-w-0 flex-1 whitespace-nowrap">{formatPhoneNumber(lender.phone)}</span>
                    </button>
                  )}
                  {lender.email && (
                    <button
                      type="button"
                      onClick={() => openCompose({
                        to: lender.email!,
                        recipientName: lender.contact_name ?? lender.lender_name,
                        subject: `Re: ${lender.program_name ?? lender.lender_name}`,
                      })}
                      className="w-full flex items-start gap-2 px-1 py-1 min-w-0 text-left rounded hover:bg-muted/60 transition-colors"
                      title={`Email ${lender.email}`}
                    >
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                      <span className="text-sm text-foreground break-all min-w-0 flex-1">{lender.email}</span>
                    </button>
                  )}
                </div>
              </div>

              <StackedEditableField label="Loan Types" value={lender.loan_types ?? ''} field="loan_types" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />
              <StackedEditableField label="Loan Size" value={lender.loan_size_text ?? ''} field="loan_size_text" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />
              <StackedEditableField label="Interest Range" value={lender.interest_range ?? ''} field="interest_range" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />
              <StackedEditableField label="Term" value={lender.term ?? ''} field="term" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />
              <StackedEditableField label="States" value={lender.states ?? ''} field="states" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />
              <StackedEditableField label="Lender Specialty" value={lender.lender_specialty ?? ''} field="lender_specialty" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />
              <StackedEditableField label="Looking For" value={lender.looking_for ?? ''} field="looking_for" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />
              <StackedEditableField label="Location" value={lender.location ?? ''} field="location" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />
              <StackedEditableField label="Call Status" value={lender.call_status ?? ''} field="call_status" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />
              <StackedEditableField label="Last Contact" value={lender.last_contact ?? ''} field="last_contact" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />
              <StackedEditableField label="Next Call" value={lender.next_call ?? ''} field="next_call" leadId={lender.id} onSaved={handleFieldSaved} tableName="lender_programs" />

              <div>
                <label className="text-sm text-muted-foreground block mb-3">Description</label>
                <EditableNotesField
                  value={lender.description ?? ''}
                  field="description"
                  leadId={lender.id}
                  placeholder="Add a description"
                  onSaved={handleFieldSaved}
                  tableName="lender_programs"
                />
              </div>

              <StackedReadOnlyField label="Created" value={formatLongDate(lender.created_at)} locked />
            </div>
          </ScrollArea>

          {/* ── CENTER: Activity ── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f5f0fa] dark:bg-purple-950/20">
            <ScrollArea className="flex-1">
              <div className="px-3 md:px-4 lg:px-6 pt-5">

                {/* Stats */}
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

                {/* Activity tabs + form */}
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
                                  ] as const).map((opt) => {
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
                        <RichTextEditor value={activityNote} onChange={setActivityNote} placeholder="Add a note..." minHeight="80px" />
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
                        <RichTextEditor value={noteContent} onChange={setNoteContent} placeholder="Write a note..." minHeight="120px" />
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
                        <button type="button" className="flex items-center gap-1 text-xs font-semibold text-foreground hover:text-violet-700 transition-colors">
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
                          <div className={`w-4 h-4 rounded flex items-center justify-center ${
                            selectedTimelineTypes.size === TIMELINE_TYPE_FILTERS.length
                              ? 'bg-violet-600 text-white'
                              : 'border border-slate-300'
                          }`}>
                            {selectedTimelineTypes.size === TIMELINE_TYPE_FILTERS.length && <Check className="h-3 w-3" />}
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
                              <div className={`w-4 h-4 rounded flex items-center justify-center ${
                                isSelected ? 'bg-violet-600 text-white' : 'border border-slate-300'
                              }`}>
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
                                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
                                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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

          {/* ── RIGHT: Related ── */}
          <aside className="w-full md:w-[280px] lg:w-[320px] xl:w-[360px] md:shrink-0 border-t md:border-t-0 md:border-l border-border bg-card overflow-y-auto">
            <div className="py-3">
              <RelatedSection
                icon={<Briefcase className="h-3.5 w-3.5" />}
                label="Related Deals"
                count={relatedDeals.length}
                iconColor="text-blue-500"
              >
                {relatedDeals.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic px-2 py-1">No related deals</p>
                ) : (
                  <div className="space-y-1">
                    {relatedDeals.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => navigate(`/admin/pipeline/lender-management/expanded-view/${d.id}`)}
                        className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/60 transition-colors"
                      >
                        <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-foreground truncate flex-1">{d.name ?? d.company_name ?? 'Unnamed'}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{d.status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </RelatedSection>

              <RelatedSection
                icon={<Users className="h-3.5 w-3.5" />}
                label="Related People"
                count={relatedPeople.length}
                iconColor="text-violet-500"
              >
                {relatedPeople.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic px-2 py-1">No related contacts</p>
                ) : (
                  <div className="space-y-1">
                    {relatedPeople.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => navigate(`/admin/contacts/people/expanded-view/${p.id}`)}
                        className="w-full text-left flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/60 transition-colors"
                      >
                        <CrmAvatar name={p.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                          {p.title && <p className="text-[10px] text-muted-foreground truncate">{p.title}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </RelatedSection>

              <RelatedSection
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Related Files"
                count={0}
                iconColor="text-amber-500"
              >
                <p className="text-[11px] text-muted-foreground italic px-2 py-1">No files</p>
              </RelatedSection>

              <RelatedSection
                icon={<FileText className="h-3.5 w-3.5" />}
                label="Related Tasks"
                count={0}
                iconColor="text-emerald-500"
              >
                <p className="text-[11px] text-muted-foreground italic px-2 py-1">No tasks</p>
              </RelatedSection>
            </div>
          </aside>

        </div>
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Delete Record</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this lender program? This will permanently remove all associated data.</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => { setShowDeleteConfirm(false); handleDeleteLender(); }}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      <GmailComposeDialog {...composeDialogProps} />
    </>
  );
}
