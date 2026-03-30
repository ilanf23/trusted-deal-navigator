import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RichTextEditor } from '@/components/ui/rich-text-input';
import { HtmlContent } from '@/components/ui/html-content';
import { isHtmlEmpty } from '@/lib/sanitize';
import { Separator } from '@/components/ui/separator';
import {
  X, Maximize2, CalendarDays, User, Copy, Check, Plus, Users, Trash2,
  Lock, MoreVertical, ArrowRight, Briefcase, FolderOpen, FileText, DollarSign, Circle, CircleCheck,
  Loader2, Phone, CheckSquare, ChevronDown, ChevronUp, MessageSquare, Activity, Mail,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useTeamMember } from '@/hooks/useTeamMember';
import { extractSenderName, toRenderableHtml } from '@/components/gmail/gmailHelpers';
import type { LeadProject } from './ProjectDetailDialog';

// ── Constants ──

const stageLabels: Record<string, string> = {
  open: 'Open', closed: 'Closed', on_hold: 'On Hold',
  waiting_on_approval: 'Waiting on Approval',
  closing_checklist_in_process: 'Closing Checklist in Process',
  waiting_on_closing_date: 'Waiting on Closing Date',
  closing_scheduled: 'Closing Scheduled',
  ts_received_brad_to_discuss: "TS's Received/Brad to Discuss",
};

const priorityLabels: Record<string, string> = {
  urgent_to_close: 'Urgent to Close', urgent_to_get_approval: 'Urgent to Get Approval',
  purchase: 'Purchase', refinance: 'Refinance',
};

const statusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'completed', label: 'Completed' },
];

const stageOptions = Object.entries(stageLabels).map(([value, label]) => ({ value, label }));
const priorityOptions = [{ value: 'none', label: '—' }, ...Object.entries(priorityLabels).map(([value, label]) => ({ value, label }))];

// ── Props ──

interface ProjectDetailPanelProps {
  project: LeadProject;
  teamMemberMap: Record<string, string>;
  teamMembers: { id: string; name: string }[];
  onClose: () => void;
  onExpand: () => void;
}

// ── Component ──

export default function ProjectDetailPanel({
  project,
  teamMemberMap,
  teamMembers,
  onClose,
  onExpand,
}: ProjectDetailPanelProps) {
  const queryClient = useQueryClient();
  const { teamMember } = useTeamMember();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'related'>('details');

  // Activity tab state
  const [activityTab, setActivityTab] = useState<'log' | 'note'>('log');
  const [activityType, setActivityType] = useState('todo');
  const [activityNote, setActivityNote] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityDropdownOpen, setActivityDropdownOpen] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});

  // Fetch lead info for context
  const { data: lead } = useQuery({
    queryKey: ['project-lead', project.lead_id],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('name, company_name, opportunity_name, email, last_activity_at').eq('id', project.lead_id).single();
      return data;
    },
    enabled: !!project.lead_id,
  });

  // Interaction count
  const { data: interactionCount = 0 } = useQuery({
    queryKey: ['project-panel-interactions', project.lead_id],
    queryFn: async () => {
      const { count } = await supabase
        .from('communications')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', project.lead_id);
      return count ?? 0;
    },
    enabled: !!project.lead_id,
  });

  // Lead emails for gmail search
  const { data: leadEmails = [] } = useQuery({
    queryKey: ['project-panel-lead-emails', project.lead_id],
    queryFn: async () => {
      const { data } = await supabase.from('lead_emails').select('email').eq('lead_id', project.lead_id);
      return (data || []) as { email: string }[];
    },
    enabled: !!project.lead_id,
  });

  const leadEmailAddresses = useMemo(() => {
    const allEmails: string[] = [];
    if (lead?.email) allEmails.push(lead.email.toLowerCase());
    leadEmails.forEach(e => allEmails.push(e.email.toLowerCase()));
    return [...new Set(allEmails)];
  }, [lead, leadEmails]);

  // Gmail connection
  const { data: gmailConnection } = useQuery({
    queryKey: ['gmail-connection-for-project-panel'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data } = await supabase.from('gmail_connections').select('*').eq('user_id', session.user.id).maybeSingle();
      return data;
    },
    enabled: !!project.lead_id,
  });

  // Gmail emails
  const { data: gmailEmails = [], isLoading: gmailEmailsLoading } = useQuery({
    queryKey: ['project-panel-gmail-emails', project.lead_id, leadEmailAddresses],
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
        id: msg.id, threadId: msg.threadId,
        subject: msg.subject || '(No Subject)', from: msg.from || '', to: msg.to || '',
        date: msg.date || new Date().toISOString(), snippet: msg.snippet || '', body: msg.body || '',
        isRead: !msg.isUnread,
      }));
    },
    enabled: !!gmailConnection && leadEmailAddresses.length > 0 && !!project.lead_id,
  });

  // Group gmail emails into threads
  const allEmailThreads = useMemo(() => {
    const threadMap = new Map<string, any>();
    gmailEmails.forEach((email: any) => {
      if (!threadMap.has(email.threadId)) {
        threadMap.set(email.threadId, {
          id: email.threadId, thread_id: email.threadId, subject: email.subject,
          last_message_date: email.date, snippet: email.snippet, from: email.from,
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

  // Activities
  const { data: activities = [] } = useQuery({
    queryKey: ['project-panel-activities', project.lead_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', project.lead_id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!project.lead_id,
  });

  // Tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['project-panel-tasks', project.lead_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('lead_id', project.lead_id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!project.lead_id,
  });

  // Contacts
  const { data: contacts = [] } = useQuery({
    queryKey: ['project-panel-contacts', project.lead_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_contacts')
        .select('*')
        .eq('lead_id', project.lead_id);
      return data ?? [];
    },
    enabled: !!project.lead_id,
  });

  // Files
  const { data: files = [] } = useQuery({
    queryKey: ['project-panel-files', project.lead_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_files')
        .select('id, file_name, file_type, file_size, created_at')
        .eq('lead_id', project.lead_id)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!project.lead_id,
  });

  // Pipeline info
  const { data: pipelineInfo } = useQuery({
    queryKey: ['project-panel-pipeline', project.lead_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('pipeline_leads')
        .select('pipeline_id, pipelines(name)')
        .eq('lead_id', project.lead_id)
        .limit(1)
        .single();
      return data as { pipeline_id: string; pipelines: { name: string } | null } | null;
    },
    enabled: !!project.lead_id,
  });

  // Linked people
  const [showPeoplePicker, setShowPeoplePicker] = useState(false);

  const { data: linkedPeople = [] } = useQuery({
    queryKey: ['project-people', project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_people')
        .select('id, lead_id, role')
        .eq('project_id', project.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const linkedLeadIds = useMemo(() => linkedPeople.map(p => p.lead_id), [linkedPeople]);

  const { data: linkedLeadNames = {} } = useQuery({
    queryKey: ['linked-lead-names-panel', linkedLeadIds],
    queryFn: async () => {
      if (linkedLeadIds.length === 0) return {};
      const { data } = await supabase.from('leads').select('id, name, company_name, phone, email, title, avatar_url').in('id', linkedLeadIds);
      const m: Record<string, { name: string; company_name: string | null; phone: string | null; email: string | null; title: string | null; avatar_url: string | null }> = {};
      for (const l of data ?? []) m[l.id] = l;
      return m;
    },
    enabled: linkedLeadIds.length > 0,
  });

  // All leads for the picker (exclude already-linked)
  const { data: allLeads = [] } = useQuery({
    queryKey: ['all-leads-for-picker'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('id, name, company_name').order('name').limit(200);
      return (data ?? []) as { id: string; name: string; company_name: string | null }[];
    },
    enabled: showPeoplePicker,
  });

  const availableLeads = useMemo(
    () => allLeads.filter(l => !linkedLeadIds.includes(l.id)),
    [allLeads, linkedLeadIds]
  );

  const addPerson = useCallback(async (leadId: string) => {
    const { error } = await supabase.from('project_people').insert({ project_id: project.id, lead_id: leadId });
    if (error) { toast.error('Failed to link person'); return; }
    queryClient.invalidateQueries({ queryKey: ['project-people', project.id] });
    queryClient.invalidateQueries({ queryKey: ['project-people-all'] });
    setShowPeoplePicker(false);
  }, [project.id, queryClient]);

  const removePerson = useCallback(async (linkId: string) => {
    const { error } = await supabase.from('project_people').delete().eq('id', linkId);
    if (error) { toast.error('Failed to remove'); return; }
    queryClient.invalidateQueries({ queryKey: ['project-people', project.id] });
    queryClient.invalidateQueries({ queryKey: ['project-people-all'] });
  }, [project.id, queryClient]);

  // Follow
  const teamMemberId = teamMember?.id;
  const { data: isFollowing = false } = useQuery({
    queryKey: ['project-follow', project.lead_id, teamMemberId],
    queryFn: async () => {
      const { data } = await supabase.from('lead_followers').select('id')
        .eq('lead_id', project.lead_id).eq('team_member_id', teamMemberId!).maybeSingle();
      return !!data;
    },
    enabled: !!project.lead_id && !!teamMemberId,
  });
  const toggleFollowMutation = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        await supabase.from('lead_followers').delete().eq('lead_id', project.lead_id).eq('team_member_id', teamMemberId!);
      } else {
        await supabase.from('lead_followers').insert({ lead_id: project.lead_id, team_member_id: teamMemberId! });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-follow', project.lead_id, teamMemberId] });
      toast.success(isFollowing ? 'Unfollowed' : 'Following');
    },
  });

  // ── Field save ──

  const saveField = useCallback(async (field: string, value: unknown) => {
    const { error } = await supabase
      .from('lead_projects')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', project.id);
    if (error) { toast.error('Failed to save'); return; }
    queryClient.invalidateQueries({ queryKey: ['all-projects'] });
  }, [project.id, queryClient]);

  // ── Activity save ──
  const handleSaveActivity = useCallback(async () => {
    if (!project.lead_id) return;
    const rawContent = activityTab === 'log' ? activityNote : noteContent;
    const content = rawContent.trim();
    const type = activityTab === 'log' ? activityType : 'note';
    if (!content || isHtmlEmpty(content)) { toast.error('Please enter some content'); return; }
    setSavingActivity(true);
    const { error } = await supabase.from('lead_activities').insert({
      lead_id: project.lead_id,
      activity_type: type,
      content,
      title: type === 'note' ? 'Note' : type.charAt(0).toUpperCase() + type.slice(1),
    });
    setSavingActivity(false);
    if (error) { toast.error('Failed to save activity'); return; }
    await supabase.from('leads').update({ last_activity_at: new Date().toISOString() }).eq('id', project.lead_id);
    toast.success('Activity saved');
    if (activityTab === 'log') setActivityNote(''); else setNoteContent('');
    queryClient.invalidateQueries({ queryKey: ['project-panel-activities', project.lead_id] });
  }, [project.lead_id, activityTab, activityType, activityNote, noteContent, queryClient]);

  // Merge activities + email threads into timeline
  const timelineItems = useMemo(() => {
    const items: Array<{ type: 'activity'; data: typeof activities[number]; date: string } | { type: 'email_thread'; data: any; date: string }> = [];
    activities.forEach(act => items.push({ type: 'activity', data: act, date: act.created_at }));
    allEmailThreads.forEach(thread => items.push({ type: 'email_thread', data: thread, date: thread.last_message_date || '' }));
    return items.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [activities, allEmailThreads]);

  const inactiveDays = lead?.last_activity_at ? differenceInDays(new Date(), parseISO(lead.last_activity_at)) : null;
  const lastContacted = lead?.last_activity_at ? format(parseISO(lead.last_activity_at), 'MMM d') : '—';

  const ownerName = project.owner ? teamMemberMap[project.owner] : null;
  const subtitle = lead ? [lead.company_name, lead.opportunity_name || lead.name].filter(Boolean).join(' - ') : '';

  return (
    <aside className="shrink-0 w-[420px] border-l border-border/60 bg-white dark:bg-card flex flex-col shadow-lg animate-in slide-in-from-right-5 duration-200 h-full">
      {/* ── Top bar ── */}
      <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-2">
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Close panel"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-1.5">
          <Button
            variant={isFollowing ? 'default' : 'outline'}
            size="sm"
            className={`h-8 text-sm font-medium rounded-full px-5 ${isFollowing ? 'bg-blue-600 hover:bg-red-600 text-white' : ''}`}
            onClick={() => toggleFollowMutation.mutate()}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Expand" onClick={onExpand}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/admin/pipeline/projects/expanded-view/${project.id}`);
                setCopied(true);
                toast.success('Link copied');
                setTimeout(() => setCopied(false), 2000);
              }}>
                {copied ? <Check className="h-4 w-4 mr-2 text-emerald-500" /> : <Copy className="h-4 w-4 mr-2" />}
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onClose} className="text-destructive focus:text-destructive">
                <X className="h-4 w-4 mr-2" /> Close
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Project identity ── */}
      <div className="px-5 pb-3">
        <div className="flex items-start gap-3">
          <div className="h-14 w-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
            <Briefcase className="h-6 w-6 text-gray-500 dark:text-gray-400" />
          </div>
          <div className="min-w-0 flex-1 pt-1">
            <h3 className="text-lg font-semibold text-foreground leading-tight truncate">{project.name}</h3>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="shrink-0 border-b border-border">
        <div className="flex px-5">
          {(['details', 'activity', 'related'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-semibold uppercase tracking-wider relative transition-colors ${
                activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
              {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-600" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <ScrollArea className="flex-1">
        {/* ── DETAILS TAB ── */}
        {activeTab === 'details' && (
          <div className="px-5 py-5 space-y-5">
            {/* Name */}
            <PanelFieldRow label="Name" value={project.name} onSave={(v) => saveField('name', v)} required />

            {/* Template */}
            <div>
              <label className="text-sm text-muted-foreground flex items-center gap-1 mb-1">Template <Lock className="h-3 w-3" /></label>
              <p className="text-base text-muted-foreground">No Selection</p>
            </div>

            {/* CLX File Name */}
            <PanelFieldRow label="CLX - File Name" value={project.clx_file_name ?? ''} onSave={(v) => saveField('clx_file_name', v || null)} placeholder="Add CLX File Name" />

            {/* Waiting On */}
            <PanelFieldRow label="Waiting On:" value={project.waiting_on ?? ''} onSave={(v) => saveField('waiting_on', v || null)} placeholder="Add Waiting On:" />

            {/* Owner */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Owner</label>
              <div className="flex items-center justify-between">
                {ownerName ? (
                  <div className="flex items-center justify-between flex-1">
                    <span className="text-base text-blue-700 dark:text-blue-400 font-medium">{ownerName}</span>
                    <button onClick={() => saveField('owner', null)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <Select value={project.owner || '__none__'} onValueChange={(v) => saveField('owner', v === '__none__' ? null : v)}>
                    <SelectTrigger className="h-9 w-full text-base border-0 shadow-none p-0 hover:bg-muted/40 rounded-md">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {ownerName && (
                <Select value={project.owner || '__none__'} onValueChange={(v) => saveField('owner', v === '__none__' ? null : v)}>
                  <SelectTrigger className="h-0 w-0 overflow-hidden border-0 p-0 opacity-0 absolute"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Status</label>
              <Select value={project.status ?? 'open'} onValueChange={(v) => saveField('status', v)}>
                <SelectTrigger className="h-10 w-full text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Created */}
            <div>
              <label className="text-sm text-muted-foreground flex items-center gap-1 mb-1">Created <Lock className="h-3 w-3" /></label>
              <p className="text-base text-foreground">{format(parseISO(project.created_at), 'M/d/yyyy')}</p>
            </div>

            {/* Visibility */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Visibility</label>
              <Select value={project.visibility || 'everyone'} onValueChange={(v) => saveField('visibility', v)}>
                <SelectTrigger className="h-10 w-full text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="owner_only">Owner Only</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <PanelFieldRow label="Description" value={project.description ?? ''} onSave={(v) => saveField('description', v || null)} multiline placeholder="Add description..." />

            {/* Due Date */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Due Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 text-base text-foreground hover:bg-muted/40 rounded-md px-2 py-1.5 -mx-2 transition-colors w-full text-left">
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                    {project.due_date ? format(parseISO(project.due_date), 'M/d/yyyy') : <span className="text-muted-foreground">Set due date</span>}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[200]" align="start">
                  <Calendar
                    mode="single"
                    selected={project.due_date ? parseISO(project.due_date) : undefined}
                    onSelect={(date) => saveField('due_date', date ? date.toISOString() : null)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Tags */}
            <PanelFieldRow label="Tags" value={(project.tags ?? []).join(', ')} onSave={(v) => saveField('tags', v ? v.split(',').map(t => t.trim()).filter(Boolean) : [])} placeholder="Add Tag" />

            {/* Project Stage */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Project Stage</label>
              <Select value={project.project_stage ?? 'open'} onValueChange={(v) => saveField('project_stage', v)}>
                <SelectTrigger className="h-10 w-full text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stageOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Bank Relationships */}
            <PanelFieldRow label="Bank Relationships" value={project.bank_relationships ?? ''} onSave={(v) => saveField('bank_relationships', v || null)} placeholder="Add Bank Relationships" />

            {/* Priority */}
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Priority</label>
              <Select value={project.priority ?? 'none'} onValueChange={(v) => saveField('priority', v === 'none' ? null : v)}>
                <SelectTrigger className="h-10 w-full text-base"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {priorityOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ── ACTIVITY TAB ── */}
        {activeTab === 'activity' && (
          <div className="px-5 py-4">
            {/* Stats bar */}
            <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card mb-4">
              <div className="flex flex-col items-center justify-center py-2.5 px-2">
                <span className="text-base font-bold text-foreground">{interactionCount || '—'}</span>
                <span className="text-[10px] text-muted-foreground">Interactions</span>
              </div>
              <div className="flex flex-col items-center justify-center py-2.5 px-2">
                <span className="text-base font-bold text-foreground">{lastContacted}</span>
                <span className="text-[10px] text-muted-foreground">Last Contacted</span>
              </div>
              <div className="flex flex-col items-center justify-center py-2.5 px-2">
                <span className="text-base font-bold text-foreground">{inactiveDays ?? '—'}</span>
                <span className="text-[10px] text-muted-foreground">Inactive Days</span>
              </div>
            </div>

            {/* Log Activity / Create Note tabs */}
            <div className="rounded-lg border border-border bg-card overflow-hidden mb-4">
              <div className="flex items-stretch border-b border-gray-200 dark:border-border">
                {([
                  { key: 'log' as const, label: 'Log Activity' },
                  { key: 'note' as const, label: 'Create Note' },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-colors relative ${
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

              <div className="p-4">
                {activityTab === 'log' ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <button
                        onClick={() => setActivityDropdownOpen(!activityDropdownOpen)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted/40 transition-colors text-xs font-medium text-foreground"
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
                          return <><Icon className="h-3.5 w-3.5 text-muted-foreground" />{t.label}</>;
                        })()}
                        <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5" />
                      </button>
                      {activityDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setActivityDropdownOpen(false)} />
                          <div className="absolute z-50 top-full left-0 mt-1 w-[260px] bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
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
                                    className={`flex items-center gap-3 w-full text-left px-4 py-2.5 text-xs transition-colors ${
                                      activityType === opt.value ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400' : 'text-foreground hover:bg-muted/50'
                                    }`}
                                  >
                                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="font-medium">{opt.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <RichTextEditor value={activityNote} onChange={setActivityNote} placeholder="Click here to add a note" minHeight="60px" />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={handleSaveActivity} disabled={savingActivity || isHtmlEmpty(activityNote)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 rounded-lg">
                        {savingActivity && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        Save Activity
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <RichTextEditor value={noteContent} onChange={setNoteContent} placeholder="Write a note..." minHeight="80px" />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={handleSaveActivity} disabled={savingActivity || isHtmlEmpty(noteContent)} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 rounded-lg">
                        {savingActivity && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        Save Note
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline: activities + email threads */}
            {gmailEmailsLoading && (
              <div className="flex items-center gap-2 py-2 mb-3">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Loading emails...</span>
              </div>
            )}
            <div className="space-y-2.5">
              {timelineItems.length > 0 ? (
                timelineItems.map((item) => {
                  if (item.type === 'email_thread') {
                    const thread = item.data;
                    const isThreadExpanded = !!expandedThreads[thread.id];
                    return (
                      <div key={`email-${thread.id}`} className={`rounded-xl bg-card border transition-colors ${isThreadExpanded ? 'border-emerald-200' : 'border-border hover:border-border'}`}>
                        <button type="button" className="flex gap-2.5 p-3 w-full text-left cursor-pointer" onClick={() => setExpandedThreads((prev) => ({ ...prev, [thread.id]: !prev[thread.id] }))}>
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-emerald-500">
                            <Mail className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-foreground truncate">{thread.subject || '(No Subject)'}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {(() => { try { return format(new Date(thread.last_message_date), 'MMM d'); } catch { return ''; } })()}
                              </span>
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
                          {isThreadExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />}
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
                                  <div key={msg.id} className="py-2 first:pt-0 last:pb-0">
                                    <div className="flex gap-2">
                                      <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                        isTeam ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'
                                      }`}>{senderName[0]?.toUpperCase() ?? '?'}</div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[11px] font-medium text-foreground">{senderName}</span>
                                          <span className="text-[10px] text-muted-foreground">
                                            {(() => { try { return format(new Date(msg.date), 'MMM d, h:mm a'); } catch { return ''; } })()}
                                          </span>
                                        </div>
                                        {msg.to && <p className="text-[10px] text-muted-foreground truncate">To: {msg.to}</p>}
                                        <div className="mt-1 text-xs text-muted-foreground prose prose-xs max-w-none [&_img]:max-w-full [&_table]:text-xs" dangerouslySetInnerHTML={{ __html: toRenderableHtml(msg.body ?? '') }} />
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
                  return (
                    <div key={act.id} className="rounded-xl bg-card border border-border p-3 hover:border-blue-100 dark:hover:border-blue-900 transition-colors">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="h-7 w-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                          {(act.created_by?.[0] ?? '?').toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-foreground">{act.created_by ?? 'System'}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {format(parseISO(act.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      {act.title && <p className="text-xs font-semibold text-foreground mb-0.5">{act.title}</p>}
                      {act.content && <HtmlContent value={act.content} className="text-xs text-muted-foreground" />}
                    </div>
                  );
                })
              ) : (
                <div className="border border-dashed border-border rounded-xl py-8 flex flex-col items-center gap-2">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No activity recorded yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── RELATED TAB ── */}
        {activeTab === 'related' && (
          <div className="px-5 py-5 space-y-5">
            {/* Files */}
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                <FileText className="h-4 w-4" /> Files ({files.length})
              </label>
              {files.length > 0 ? (
                <div className="space-y-1">
                  {files.slice(0, 5).map((f: { id: string; file_name: string; file_type: string | null; file_size: number | null }) => (
                    <div key={f.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/40 transition-colors">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm text-foreground truncate">{f.file_name}</span>
                    </div>
                  ))}
                  {files.length > 5 && <p className="text-xs text-muted-foreground pt-1">+{files.length - 5} more</p>}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No files attached</p>
              )}
            </div>

            {/* People */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-4 w-4" /> People ({linkedPeople.length})
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPeoplePicker(!showPeoplePicker)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {showPeoplePicker && (
                <div className="mb-2 rounded-lg border border-border overflow-hidden">
                  <Command className="bg-background">
                    <CommandInput placeholder="Search people..." className="h-8 text-sm" />
                    <CommandList className="max-h-[160px]">
                      <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">No results</CommandEmpty>
                      <CommandGroup>
                        {availableLeads.map(l => (
                          <CommandItem
                            key={l.id}
                            onSelect={() => addPerson(l.id)}
                            className="text-sm cursor-pointer"
                          >
                            <User className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                            <span>{l.name}</span>
                            {l.company_name && <span className="ml-1.5 text-xs text-muted-foreground">· {l.company_name}</span>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              )}

              {linkedPeople.length > 0 ? (
                <div className="space-y-4">
                  {linkedPeople.map(pp => {
                    const info = linkedLeadNames[pp.lead_id];
                    const name = info?.name ?? '...';
                    const initials = name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
                    const contactParts = [info?.phone, info?.email].filter(Boolean);
                    return (
                      <div key={pp.id} className="flex items-start gap-3 group px-2 py-2 -mx-2 rounded-lg hover:bg-muted/40 transition-colors">
                        {info?.avatar_url ? (
                          <img src={info.avatar_url} alt={name} className="h-12 w-12 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">{initials}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-foreground truncate">{name}</p>
                          {(info?.title || info?.company_name) && (
                            <p className="text-sm truncate">
                              {info?.title && <span className="text-blue-600 dark:text-blue-400">{info.title}</span>}
                              {info?.title && info?.company_name && <span className="text-muted-foreground"> at </span>}
                              {info?.company_name && <span className="text-blue-600 dark:text-blue-400">{info.company_name}</span>}
                            </p>
                          )}
                          {contactParts.length > 0 && (
                            <p className="text-sm text-muted-foreground truncate">
                              {contactParts.join('  |  ')}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removePerson(pp.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-all mt-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No people linked</p>
              )}
            </div>

            {/* Tasks */}
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                <Circle className="h-4 w-4" /> Tasks ({tasks.length})
              </label>
              {tasks.length > 0 ? (
                <div className="space-y-1">
                  {tasks.slice(0, 8).map((t: { id: string; title: string; status?: string | null; completed_at?: string | null }) => (
                    <div key={t.id} className="flex items-center gap-2 text-sm py-1">
                      {t.completed_at ? <CircleCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
                      <span className={`truncate ${t.completed_at ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{t.title}</span>
                    </div>
                  ))}
                  {tasks.length > 8 && <p className="text-xs text-muted-foreground pt-1">+{tasks.length - 8} more</p>}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No tasks</p>
              )}
            </div>

            {/* Companies */}
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                <Briefcase className="h-4 w-4" /> Companies ({lead?.company_name ? 1 : 0})
              </label>
              {lead?.company_name ? (
                <div className="flex items-center gap-2 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/40 transition-colors">
                  <div className="h-7 w-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-400 shrink-0">
                    {lead.company_name[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm text-foreground">{lead.company_name}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No companies</p>
              )}
            </div>

            {/* Contacts */}
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                <User className="h-4 w-4" /> Contacts ({contacts.length})
              </label>
              {contacts.length > 0 ? (
                <div className="space-y-1.5">
                  {contacts.map((c: { id: string; name?: string; title?: string; phone?: string; email?: string }) => (
                    <div key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/40 transition-colors">
                      <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 text-[10px] font-bold text-gray-600 dark:text-gray-300">
                        {c.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        {c.title && <p className="text-[10px] text-muted-foreground truncate">{c.title}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No contacts</p>
              )}
            </div>

            {/* Pipeline Records */}
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
                <DollarSign className="h-4 w-4" /> Pipeline Records ({pipelineInfo ? 1 : 0})
              </label>
              {pipelineInfo ? (
                <div className="flex items-center gap-2 rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/40 transition-colors">
                  <div className="h-7 w-7 rounded-full bg-blue-500 flex items-center justify-center shrink-0">
                    <DollarSign className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-sm text-foreground">{pipelineInfo.pipelines?.name ?? 'Pipeline'}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No pipeline records</p>
              )}
            </div>
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}

// ── Inline editable field for the panel ──

function PanelFieldRow({ label, value, onSave, multiline, placeholder, required }: {
  label: string; value: string; onSave: (v: string) => void; multiline?: boolean; placeholder?: string; required?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => {
    if (draft.trim() !== value) onSave(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <div>
        <label className="text-sm text-muted-foreground block mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {multiline ? (
          <Textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }} rows={4} className="text-base resize-none" />
        ) : (
          <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={handleSave} onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }} className="h-10 text-base" />
        )}
      </div>
    );
  }

  return (
    <div className="cursor-pointer hover:bg-muted/40 rounded-md -mx-2 px-2 py-1 transition-colors" onClick={() => { setDraft(value); setEditing(true); }}>
      <label className="text-sm text-muted-foreground block mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <p className="text-base text-foreground whitespace-pre-wrap">{value || <span className="text-muted-foreground">{placeholder || '—'}</span>}</p>
    </div>
  );
}
