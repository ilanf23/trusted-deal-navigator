import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { ExpandedLeftColumn } from '@/components/admin/ExpandedLeftColumn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RichTextEditor } from '@/components/ui/rich-text-input';
import { HtmlContent } from '@/components/ui/html-content';
import { isHtmlEmpty } from '@/lib/sanitize';
import { sanitizeFileName, getLeadDisplayName } from '@/lib/utils';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import ChecklistBuilder, { type ChecklistItem } from './ChecklistBuilder';
import SavedChecklistCard, { type SavedChecklist } from './SavedChecklistCard';
import {
  X, ChevronDown, ChevronRight, ChevronUp,
  Users, Building2, CheckSquare, FileText,
  CalendarDays, FolderOpen, Layers, Plus,
  MessageSquare, Pencil, Activity, AlertCircle, TrendingUp,
  User, Mail, Phone, PhoneCall, Briefcase, Loader2,
  Globe, Linkedin, Trash2, Eye, Upload, Download, Send, Bookmark, Maximize2,
  MoreHorizontal, Copy, Check, List,
} from 'lucide-react';
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useLeadEmailCompose } from '@/hooks/useLeadEmailCompose';
import GmailComposeDialog from '@/components/admin/GmailComposeDialog';
import { useCall } from '@/contexts/CallContext';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import { useUndo } from '@/contexts/UndoContext';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import { parseISO, format, differenceInDays } from 'date-fns';
import { extractSenderName, toRenderableHtml } from '@/components/gmail/gmailHelpers';
import PeopleDetailPanel from '@/components/admin/PeopleDetailPanel';
import { CONTACT_TYPE_CONFIG } from '@/components/admin/shared/contactTypeConfig';
import LeadRelatedSidebar from '@/components/admin/shared/LeadRelatedSidebar';

import {
  UNDERWRITING_STATUSES,
  stageConfig as canonicalStageConfig,
} from './InlineEditableFields';

type Lead = Database['public']['Tables']['underwriting']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

interface LeadEmail {
  id: string;
  entity_id: string;
  entity_type: string;
  email: string;
  email_type: string;
  is_primary: boolean;
}

interface LeadPhone {
  id: string;
  entity_id: string;
  entity_type: string;
  phone_number: string;
  phone_type: string;
  is_primary: boolean;
}

interface LeadAddress {
  id: string;
  entity_id: string;
  entity_type: string;
  address_type: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  is_primary: boolean;
}

interface LeadFile {
  id: string;
  entity_id: string;
  entity_type: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string | null): string {
  if (!fileType) return '📄';
  if (fileType.startsWith('image/')) return '🖼️';
  if (fileType === 'application/pdf') return '📕';
  if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('csv')) return '📊';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  if (fileType.includes('zip') || fileType.includes('compressed')) return '📦';
  return '📄';
}

const CONTACT_TYPE_OPTIONS = [
  { value: 'potential_customer', label: 'Potential Customer' },
  { value: 'current_customer', label: 'Current Customer' },
  { value: 'referral_source', label: 'Referral Source' },
  { value: 'bank_relationship', label: 'Bank Relationship' },
];

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
  checklist: { icon: CheckSquare, color: 'text-violet-500' },
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


/* ─── Related Section ─── */
function RelatedSection({ icon, label, count, iconColor, onAdd, onExpand, children }: {
  icon: React.ReactNode; label: string; count: number; iconColor?: string; onAdd?: () => void; onExpand?: () => void; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div role="button" className="flex items-center gap-1.5 w-full py-2.5 hover:bg-muted/50 px-4 rounded-lg transition-colors cursor-pointer" onClick={() => setOpen(!open)}>
          <span className={`shrink-0 ${iconColor}`}>{icon}</span>
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <span className="text-xs font-normal text-muted-foreground">({count})</span>
          {open ? <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5" /> : <ChevronRight className="h-3 w-3 text-muted-foreground ml-0.5" />}
          <div className="flex items-center gap-0.5 ml-auto">
            {onExpand && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onExpand();
                }}
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                if (onAdd) onAdd();
                else toast.info('Coming soon');
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function UnderwritingExpandedView() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { registerUndo, isUndoingRef } = useUndo();
  const { setSearchComponent } = useAdminTopBar();
  const [searchTerm, setSearchTerm] = useState('');

  // Email compose + click-to-call. See PipelineExpandedView for the pattern —
  // compose dialog is mounted once at the bottom of the view and triggered
  // from the primary-contact row via `openCompose`.
  const { openCompose, dialogProps: composeDialogProps } = useLeadEmailCompose({
    leadId,
    tableName: 'underwriting',
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

  const [activityTab, setActivityTab] = useState<'log' | 'note' | 'checklist'>('log');

  // Activity form state
  const [activityType, setActivityType] = useState('todo');
  const [activityNote, setActivityNote] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityDropdownOpen, setActivityDropdownOpen] = useState(false);

  // Checklist builder state
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openAddMenu = useCallback(() => { if (addMenuTimer.current) clearTimeout(addMenuTimer.current); setAddMenuOpen(true); }, []);
  const closeAddMenu = useCallback(() => { addMenuTimer.current = setTimeout(() => setAddMenuOpen(false), 150); }, []);
  const [checklistTabVisible, setChecklistTabVisible] = useState(false);
  const [checklistTitle, setChecklistTitle] = useState('Checklist');
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [showTemplateSaveDialog, setShowTemplateSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Selected person for person detail panel (kept — sidebar `onPersonSelect` sets this)
  const [selectedPerson, setSelectedPerson] = useState<any>(null);

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

  // ── Follow state ──
  const [followHovered, setFollowHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const teamMemberId = teamMember?.id;
  const { data: isFollowing = false } = useQuery({
    queryKey: ['entity-follow', leadId, teamMemberId],
    queryFn: async () => {
      const { data } = await supabase.from('entity_followers').select('id')
        .eq('entity_id', leadId!).eq('entity_type', 'underwriting').eq('team_member_id', teamMemberId!).maybeSingle();
      return !!data;
    },
    enabled: !!leadId && !!teamMemberId,
  });
  const toggleFollowMutation = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        await supabase.from('entity_followers').delete().eq('entity_id', leadId!).eq('entity_type', 'underwriting').eq('team_member_id', teamMemberId!);
      } else {
        await supabase.from('entity_followers').insert({ entity_id: leadId!, entity_type: 'underwriting', team_member_id: teamMemberId! });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-follow', leadId, teamMemberId] });
      toast.success(isFollowing ? 'Unfollowed' : 'Following');
    },
  });
  const handleDeleteLead = useCallback(async () => {
    if (!leadId) return;
    await supabase.from('entity_files').delete().eq('entity_id', leadId).eq('entity_type', 'underwriting');
    await supabase.from('activities').delete().eq('entity_id', leadId).eq('entity_type', 'underwriting');
    await supabase.from('tasks').delete().eq('lead_id', leadId);
    const { error } = await supabase.from('underwriting').delete().eq('id', leadId);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Deleted');
    queryClient.invalidateQueries({ queryKey: ['underwriting-deals'] });
    navigate(-1);
  }, [leadId, queryClient, navigate]);

  // Milestone inline add state (Related sidebar)
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [savingMilestone, setSavingMilestone] = useState(false);

  // Waiting On inline add state (Related sidebar)
  const [addingWaitingOn, setAddingWaitingOn] = useState(false);
  const [newWaitingOwner, setNewWaitingOwner] = useState('');
  const [newWaitingDesc, setNewWaitingDesc] = useState('');
  const [savingWaitingOn, setSavingWaitingOn] = useState(false);

  // ── Team members (must be before handlers that reference it) ──
  const { data: teamMembers = [] } = useAssignableUsers();

  const teamMemberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of teamMembers) map[m.id] = m.name;
    return map;
  }, [teamMembers]);

  // ── Stage change handler ──
  const handleStageChange = useCallback(async (newStatus: LeadStatus) => {
    if (!leadId) return;
    const { data: current } = await supabase.from('underwriting').select('status').eq('id', leadId).single();
    const previousStatus = current?.status as LeadStatus | null;
    const { error } = await supabase
      .from('underwriting')
      .update({ status: newStatus })
      .eq('id', leadId);
    if (error) {
      toast.error('Failed to update stage');
      return;
    }
    registerUndo({
      label: `Stage changed to ${canonicalStageConfig[newStatus]?.title ?? newStatus}`,
      execute: async () => {
        const { error: e } = await supabase.from('underwriting').update({ status: previousStatus }).eq('id', leadId);
        if (e) throw e;
        queryClient.invalidateQueries({ queryKey: ['underwriting-expanded', leadId] });
        queryClient.invalidateQueries({ queryKey: ['underwriting-deals'] });
      },
    });
    toast.success('Stage updated');
    queryClient.invalidateQueries({ queryKey: ['underwriting-expanded', leadId] });
    queryClient.invalidateQueries({ queryKey: ['underwriting-deals'] });
  }, [leadId, queryClient, registerUndo]);

  // ── Deal-outcome change handler (Status dropdown: Open / Won / Lost / Abandoned) ──
  const handleDealOutcomeChange = useCallback(async (newOutcome: 'open' | 'won' | 'lost' | 'abandoned') => {
    if (!leadId) return;
    const { data: current } = await supabase.from('underwriting').select('deal_outcome').eq('id', leadId).single();
    const previousOutcome = (current?.deal_outcome ?? 'open') as 'open' | 'won' | 'lost' | 'abandoned';
    const { error } = await supabase
      .from('underwriting')
      .update({ deal_outcome: newOutcome })
      .eq('id', leadId);
    if (error) {
      toast.error('Failed to update status');
      return;
    }
    registerUndo({
      label: `Status changed to ${newOutcome}`,
      execute: async () => {
        const { error: e } = await supabase.from('underwriting').update({ deal_outcome: previousOutcome }).eq('id', leadId);
        if (e) throw e;
        queryClient.invalidateQueries({ queryKey: ['underwriting-expanded', leadId] });
        queryClient.invalidateQueries({ queryKey: ['underwriting-deals'] });
      },
    });
    toast.success('Status updated');
    queryClient.invalidateQueries({ queryKey: ['underwriting-expanded', leadId] });
    queryClient.invalidateQueries({ queryKey: ['underwriting-deals'] });
  }, [leadId, queryClient, registerUndo]);

  // ── Priority change handler (Priority dropdown: None / Low / Medium / High) ──
  const handlePriorityChange = useCallback(async (newPriority: 'low' | 'medium' | 'high' | null) => {
    if (!leadId) return;
    const { data: current } = await supabase.from('underwriting').select('priority').eq('id', leadId).single();
    const previousPriority = (current?.priority ?? null) as 'low' | 'medium' | 'high' | null;
    const { error } = await supabase
      .from('underwriting')
      .update({ priority: newPriority })
      .eq('id', leadId);
    if (error) {
      toast.error('Failed to update priority');
      return;
    }
    registerUndo({
      label: `Priority changed to ${newPriority ?? 'None'}`,
      execute: async () => {
        const { error: e } = await supabase.from('underwriting').update({ priority: previousPriority }).eq('id', leadId);
        if (e) throw e;
        queryClient.invalidateQueries({ queryKey: ['underwriting-expanded', leadId] });
        queryClient.invalidateQueries({ queryKey: ['underwriting-deals'] });
      },
    });
    toast.success('Priority updated');
    queryClient.invalidateQueries({ queryKey: ['underwriting-expanded', leadId] });
    queryClient.invalidateQueries({ queryKey: ['underwriting-deals'] });
  }, [leadId, queryClient, registerUndo]);

  // ── Field saved handler ──
  const handleFieldSaved = useCallback((_field: string, _newValue: string) => {
    queryClient.invalidateQueries({ queryKey: ['underwriting-expanded', leadId] });
    queryClient.invalidateQueries({ queryKey: ['underwriting-deals'] });
    if (!isUndoingRef.current) toast.success('Updated');
  }, [leadId, queryClient, isUndoingRef]);

  const handleBooleanToggle = useCallback(async (field: string, currentVal: boolean) => {
    if (!leadId) return;
    const { error } = await supabase.from('underwriting').update({ [field]: !currentVal }).eq('id', leadId);
    if (error) { toast.error('Failed to save'); return; }
    registerUndo({
      label: `Toggled ${field}`,
      execute: async () => {
        const { error: e } = await supabase.from('underwriting').update({ [field]: currentVal }).eq('id', leadId);
        if (e) throw e;
        queryClient.invalidateQueries({ queryKey: ['underwriting-expanded', leadId] });
        queryClient.invalidateQueries({ queryKey: ['underwriting-deals'] });
      },
    });
    queryClient.invalidateQueries({ queryKey: ['underwriting-expanded', leadId] });
    queryClient.invalidateQueries({ queryKey: ['underwriting-deals'] });
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
      entity_type: 'underwriting',
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
    await supabase.from('underwriting').update({ last_activity_at: new Date().toISOString() }).eq('id', leadId);
    toast.success('Activity saved');
    if (activityTab === 'log') setActivityNote('');
    else setNoteContent('');
    queryClient.invalidateQueries({ queryKey: ['underwriting-activities', leadId] });
    queryClient.invalidateQueries({ queryKey: ['underwriting-expanded', leadId] });
  }, [leadId, activityTab, activityType, activityNote, noteContent, queryClient]);

  // ── Save checklist ──
  const handleSaveChecklist = useCallback(async () => {
    if (!leadId || checklistItems.length === 0) return;
    setSavingChecklist(true);

    // Build plain-text content for the activity timeline
    const lines = checklistItems.map(
      (i) => `${i.is_checked ? '[x]' : '[ ]'} ${i.text}`
    );
    const content = `<strong>${checklistTitle}</strong><br/>${lines.join('<br/>')}`;

    // 1. Insert activities row
    const { data: actData, error: actErr } = await supabase
      .from('activities')
      .insert({
        entity_id: leadId,
        entity_type: 'underwriting',
        activity_type: 'checklist',
        content,
        title: checklistTitle || 'Checklist',
      })
      .select('id')
      .single();

    if (actErr || !actData) {
      setSavingChecklist(false);
      toast.error('Failed to save checklist');
      return;
    }

    // 2. Insert underwriting_checklists row
    const { data: clData, error: clErr } = await supabase
      .from('underwriting_checklists')
      .insert({
        entity_id: leadId,
        entity_type: 'underwriting',
        title: checklistTitle || 'Checklist',
        created_by: teamMember?.name ?? null,
        activity_id: actData.id,
      })
      .select('id')
      .single();

    if (clErr || !clData) {
      setSavingChecklist(false);
      toast.error('Failed to save checklist');
      return;
    }

    // 3. Bulk insert items
    const itemRows = checklistItems.map((item, idx) => ({
      checklist_id: clData.id,
      text: item.text,
      is_checked: item.is_checked,
      position: idx,
    }));
    await supabase.from('underwriting_checklist_items').insert(itemRows);

    // 4. Stamp last_activity_at
    await supabase.from('underwriting').update({ last_activity_at: new Date().toISOString() }).eq('id', leadId);

    setSavingChecklist(false);
    toast.success('Checklist saved');
    // Reset builder
    setChecklistTitle('Checklist');
    setChecklistItems([]);
    setNewItemText('');
    setChecklistTabVisible(false);
    setActivityTab('checklist');
    queryClient.invalidateQueries({ queryKey: ['underwriting-activities', leadId] });
    queryClient.invalidateQueries({ queryKey: ['underwriting-saved-checklists', leadId] });
    queryClient.invalidateQueries({ queryKey: ['underwriting-expanded', leadId] });
  }, [leadId, checklistTitle, checklistItems, teamMember, queryClient]);

  // ── Save checklist as template ──
  const handleSaveAsTemplate = useCallback(async () => {
    setShowTemplateSaveDialog(true);
  }, []);

  const handleConfirmSaveTemplate = useCallback(async () => {
    if (!templateName.trim() || checklistItems.length === 0) return;
    setSavingTemplate(true);

    const { data: tmplData, error: tmplErr } = await supabase
      .from('checklist_templates')
      .insert({
        name: templateName.trim(),
        created_by: teamMember?.name ?? null,
      })
      .select('id')
      .single();

    if (tmplErr || !tmplData) {
      setSavingTemplate(false);
      toast.error('Failed to save template');
      return;
    }

    const itemRows = checklistItems.map((item, idx) => ({
      template_id: tmplData.id,
      text: item.text,
      position: idx,
    }));
    await supabase.from('checklist_template_items').insert(itemRows);

    setSavingTemplate(false);
    setShowTemplateSaveDialog(false);
    setTemplateName('');
    toast.success('Template saved');
    queryClient.invalidateQueries({ queryKey: ['checklist-templates'] });
  }, [templateName, checklistItems, teamMember, queryClient]);

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
    queryClient.invalidateQueries({ queryKey: ['underwriting-activity-comments', leadId] });
  }, [leadId, commentTexts, teamMember, queryClient]);

  // NOTE: Sidebar handlers (toggleTaskCompletion, handleSaveEvent, handleDeleteEvent,
  // handleInlineCreateProject, handleLinkPerson, updateContactMutation, deleteContactMutation,
  // handleStartEditContact, handleOpenPersonPanel, handleSaveEditContact, handleCancelEditContact,
  // handleLinkCompany, handleRemoveCompany) have moved to <LeadRelatedSidebar>.

  // ── Save milestone (Related sidebar) ──
  const handleSaveMilestone = useCallback(async (milestoneCount: number) => {
    if (!leadId || !newMilestoneName.trim()) return;
    setSavingMilestone(true);
    const { error } = await supabase.from('deal_milestones').insert({
      lead_id: leadId,
      milestone_name: newMilestoneName.trim(),
      position: milestoneCount,
    });
    setSavingMilestone(false);
    if (error) {
      toast.error('Failed to add milestone');
      return;
    }
    toast.success('Milestone added');
    setNewMilestoneName('');
    setAddingMilestone(false);
    queryClient.invalidateQueries({ queryKey: ['underwriting-milestones', leadId] });
  }, [leadId, newMilestoneName, queryClient]);

  // ── Toggle milestone complete ──
  const handleToggleMilestone = useCallback(async (milestoneId: string, currentlyCompleted: boolean) => {
    const { error } = await supabase
      .from('deal_milestones')
      .update({
        completed: !currentlyCompleted,
        completed_at: !currentlyCompleted ? new Date().toISOString() : null,
      })
      .eq('id', milestoneId);
    if (error) {
      toast.error('Failed to update milestone');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['underwriting-milestones', leadId] });
  }, [leadId, queryClient]);

  // ── Save waiting on (Related sidebar) ──
  const handleSaveWaitingOn = useCallback(async () => {
    if (!leadId || !newWaitingOwner.trim()) return;
    setSavingWaitingOn(true);
    const { error } = await supabase.from('deal_waiting_on').insert({
      lead_id: leadId,
      owner: newWaitingOwner.trim(),
      description: newWaitingDesc.trim() || null,
    });
    setSavingWaitingOn(false);
    if (error) {
      toast.error('Failed to add waiting on item');
      return;
    }
    toast.success('Waiting on item added');
    setNewWaitingOwner('');
    setNewWaitingDesc('');
    setAddingWaitingOn(false);
    queryClient.invalidateQueries({ queryKey: ['underwriting-waiting-on', leadId] });
  }, [leadId, newWaitingOwner, newWaitingDesc, queryClient]);

  // ── Resolve waiting on ──
  const handleResolveWaitingOn = useCallback(async (itemId: string) => {
    const { error } = await supabase
      .from('deal_waiting_on')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', itemId);
    if (error) {
      toast.error('Failed to resolve item');
      return;
    }
    toast.success('Resolved');
    queryClient.invalidateQueries({ queryKey: ['underwriting-waiting-on', leadId] });
  }, [leadId, queryClient]);

  // NOTE: File upload / delete, plus contacts / tasks / projects / files / appointments queries
  // and related-people / people-search / companies-search have all moved into <LeadRelatedSidebar>.

  // ── Queries ──
  const { data: lead, isLoading } = useQuery({
    queryKey: ['underwriting-expanded', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('underwriting')
        .select('*')
        .eq('id', leadId!)
        .single();
      if (error) throw error;
      return data as Lead;
    },
    enabled: !!leadId,
  });

  // contacts / tasks / projects / appointments / files queries moved into <LeadRelatedSidebar>.

  const { data: milestones = [] } = useQuery({
    queryKey: ['underwriting-milestones', leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('deal_milestones')
        .select('id, milestone_name, completed, completed_at, position')
        .eq('lead_id', leadId!)
        .order('position', { ascending: true });
      return data ?? [];
    },
    enabled: !!leadId,
  });

  const { data: waitingOn = [] } = useQuery({
    queryKey: ['underwriting-waiting-on', leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('deal_waiting_on')
        .select('id, owner, description, due_date, resolved_at')
        .eq('lead_id', leadId!)
        .is('resolved_at', null)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!leadId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['underwriting-activities', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('entity_id', leadId!)
        .eq('entity_type', 'underwriting')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!leadId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  // ── Activity comments query ──
  const { data: activityCommentsMap = {} } = useQuery({
    queryKey: ['underwriting-activity-comments', leadId],
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

  // ── Saved checklists query ──
  const { data: savedChecklists = [] } = useQuery<SavedChecklist[]>({
    queryKey: ['underwriting-saved-checklists', leadId],
    queryFn: async () => {
      const { data: checklists, error: clErr } = await supabase
        .from('underwriting_checklists')
        .select('*')
        .eq('entity_id', leadId!)
        .eq('entity_type', 'underwriting')
        .order('created_at', { ascending: false });
      if (clErr || !checklists || checklists.length === 0) return [];
      const ids = checklists.map((c) => c.id);
      const { data: items } = await supabase
        .from('underwriting_checklist_items')
        .select('*')
        .in('checklist_id', ids)
        .order('position');
      return checklists.map((c) => ({
        ...c,
        items: (items ?? []).filter((i) => i.checklist_id === c.id),
      }));
    },
    enabled: !!leadId,
    refetchOnMount: 'always',
  });

  const { data: leadEmails = [] } = useQuery({
    queryKey: ['underwriting-emails', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('entity_emails').select('*').eq('entity_id', leadId!).eq('entity_type', 'underwriting');
      return (data || []) as LeadEmail[];
    },
    enabled: !!leadId,
  });

  // related-people query moved into <LeadRelatedSidebar>.

  // ── Gmail email queries ──
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
    enabled: !!leadId,
  });

  // people / companies search queries moved into <LeadRelatedSidebar>.

  const leadEmailAddresses = useMemo(() => {
    if (!lead) return [];
    const allEmails: string[] = [];
    if (lead.email) allEmails.push(lead.email.toLowerCase());
    leadEmails.forEach(e => allEmails.push(e.email.toLowerCase()));
    return [...new Set(allEmails)];
  }, [lead, leadEmails]);

  const { data: gmailEmails = [], isLoading: gmailEmailsLoading } = useQuery({
    queryKey: ['underwriting-gmail-emails', leadId, leadEmailAddresses],
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
    // Sort messages within each thread oldest-first (chronological conversation order)
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

  // ── Stats for the 4-box row ──
  const leadStats = useMemo(() => {
    const now = new Date();
    const interactionCount = activities.length + allEmailThreads.reduce((sum, t) => sum + (t.messages?.length ?? 0), 0);

    // Last contacted = most recent activity or email date
    let lastContactedDate: Date | null = null;
    if (activities.length > 0) {
      lastContactedDate = new Date(activities[0].created_at);
    }
    allEmailThreads.forEach(thread => {
      if (thread.last_message_date) {
        const d = new Date(thread.last_message_date);
        if (!lastContactedDate || d > lastContactedDate) lastContactedDate = d;
      }
    });

    const inactiveDays = lastContactedDate ? differenceInDays(now, lastContactedDate) : null;
    const daysInStage = lead ? differenceInDays(now, new Date(lead.created_at)) : 0;

    return { interactionCount, lastContactedDate, inactiveDays, daysInStage };
  }, [activities, allEmailThreads, lead]);

  const { data: leadPhones = [] } = useQuery({
    queryKey: ['underwriting-phones', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('entity_phones').select('*').eq('entity_id', leadId!).eq('entity_type', 'underwriting');
      return (data || []) as LeadPhone[];
    },
    enabled: !!leadId,
  });

  const { data: leadAddresses = [] } = useQuery({
    queryKey: ['underwriting-addresses', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('entity_addresses').select('*').eq('entity_id', leadId!).eq('entity_type', 'underwriting');
      return (data || []) as LeadAddress[];
    },
    enabled: !!leadId,
  });

  // ── Satellite table mutations ──
  const addEmailMutation = useMutation({
    mutationFn: async ({ email, type }: { email: string; type: string }) => {
      if (!leadId) return;
      const { error } = await supabase.from('entity_emails').insert({ entity_id: leadId, entity_type: 'underwriting', email, email_type: type });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['underwriting-emails', leadId] });
      toast.success('Email added');
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase.from('entity_emails').delete().eq('id', emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['underwriting-emails', leadId] });
      toast.success('Email removed');
    },
  });

  const addPhoneMutation = useMutation({
    mutationFn: async ({ phone, type }: { phone: string; type: string }) => {
      if (!leadId) return;
      const { error } = await supabase.from('entity_phones').insert({ entity_id: leadId, entity_type: 'underwriting', phone_number: phone, phone_type: type });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['underwriting-phones', leadId] });
      toast.success('Phone added');
    },
  });

  const deletePhoneMutation = useMutation({
    mutationFn: async (phoneId: string) => {
      const { error } = await supabase.from('entity_phones').delete().eq('id', phoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['underwriting-phones', leadId] });
      toast.success('Phone removed');
    },
  });

  const addAddressMutation = useMutation({
    mutationFn: async ({ line1, city, state, zip, type }: { line1: string; city: string; state: string; zip: string; type: string }) => {
      if (!leadId || !line1) return;
      const { error } = await supabase.from('entity_addresses').insert({
        entity_id: leadId,
        entity_type: 'underwriting',
        address_line_1: line1,
        city: city || null,
        state: state || null,
        zip_code: zip || null,
        address_type: type,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['underwriting-addresses', leadId] });
      toast.success('Address added');
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await supabase.from('entity_addresses').delete().eq('id', addressId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['underwriting-addresses', leadId] });
      toast.success('Address removed');
    },
  });

  // ── Owner change handler (passed to shared left column) ──
  const handleOwnerChange = useCallback(async (newOwnerId: string) => {
    if (!leadId) return;
    const previousOwner = lead?.assigned_to ?? null;
    const { error } = await supabase.from('underwriting').update({ assigned_to: newOwnerId || null }).eq('id', leadId);
    if (error) { toast.error('Failed to save'); return; }
    registerUndo({
      label: 'Owner changed',
      execute: async () => {
        const { error: e } = await supabase.from('underwriting').update({ assigned_to: previousOwner || null }).eq('id', leadId);
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
  const stageCfg = canonicalStageConfig[lead.status];
  const ownerOptions = teamMembers.map((m) => ({ value: m.id, label: m.name }));

  function goBack() {
    navigate(-1);
  }

  return (
    <>
    <div data-full-bleed className="underwriting-expanded-view system-font flex flex-col bg-background h-[calc(100vh-3.5rem)] md:overflow-hidden overflow-y-auto">
      <style>{`
        .underwriting-expanded-view,
        .underwriting-expanded-view *:not(svg):not(svg *) {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        }
        .underwriting-expanded-view [data-radix-scroll-area-viewport] {
          overflow-x: hidden !important;
        }
      `}</style>
      {/* ── 3-Column Body ── */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 md:overflow-hidden">

        {/* LEFT: Details — fully editable (shared component) */}
        <ExpandedLeftColumn
          lead={lead}
          tableName="underwriting"
          currentPipeline="underwriting"
          stages={UNDERWRITING_STATUSES}
          stageConfig={canonicalStageConfig}
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
              subject: lead.uw_number
                ? `Re: ${lead.uw_number}`
                : `Following up — ${lead.company_name ?? lead.name ?? ''}`.trim(),
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
                  <span className="text-lg font-bold text-foreground">{leadStats.interactionCount}</span>
                  <span className="text-[11px] text-muted-foreground">Interactions</span>
                </div>
                <div className="flex flex-col items-center justify-center py-3 px-2">
                  <span className="text-lg font-bold text-foreground">
                    {leadStats.lastContactedDate ? format(leadStats.lastContactedDate, 'M/d/yyyy') : '—'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Last Contacted</span>
                </div>
                <div className="flex flex-col items-center justify-center py-3 px-2">
                  <span className="text-lg font-bold text-foreground">{leadStats.inactiveDays ?? '—'}</span>
                  <span className="text-[11px] text-muted-foreground">Inactive Days</span>
                </div>
              </div>

              {/* Activity tabs + form — floating card */}
              <div className="rounded-lg border border-border bg-card overflow-hidden mb-5">
                <div className="flex items-stretch border-b border-gray-200 dark:border-border">
                  {([
                    { key: 'log' as const, label: 'Log Activity' },
                    { key: 'note' as const, label: 'Create Note' },
                    ...((checklistTabVisible || savedChecklists.length > 0) ? [{ key: 'checklist' as const, label: 'Checklist' }] : []),
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
              ) : activityTab === 'checklist' ? (
                <div className="space-y-4">
                  <ChecklistBuilder
                    title={checklistTitle}
                    onTitleChange={setChecklistTitle}
                    items={checklistItems}
                    onItemsChange={setChecklistItems}
                    newItemText={newItemText}
                    onNewItemTextChange={setNewItemText}
                    onSave={handleSaveChecklist}
                    saving={savingChecklist}
                    onSaveAsTemplate={handleSaveAsTemplate}
                  />
                  {/* Inline template save dialog */}
                  {showTemplateSaveDialog && (
                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <span className="text-xs font-semibold text-foreground">Save as Template</span>
                      <input
                        autoFocus
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && templateName.trim()) handleConfirmSaveTemplate(); if (e.key === 'Escape') { setShowTemplateSaveDialog(false); setTemplateName(''); } }}
                        placeholder="Template name..."
                        className="w-full text-xs bg-transparent border border-border rounded-lg px-3 py-2 outline-none focus:border-blue-500 transition-colors placeholder:text-muted-foreground/50"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => { setShowTemplateSaveDialog(false); setTemplateName(''); }}>
                          Cancel
                        </Button>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3" onClick={handleConfirmSaveTemplate} disabled={savingTemplate || !templateName.trim()}>
                          {savingTemplate && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                          Save
                        </Button>
                      </div>
                    </div>
                  )}
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

              {/* Saved Checklists — persistent interactive cards */}
              {savedChecklists.length > 0 && (
                <>
                  <Separator className="my-6" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Checklists</h3>
                  <div className="space-y-3 mb-4">
                    {savedChecklists.map((cl) => (
                      <SavedChecklistCard
                        key={cl.id}
                        checklist={cl}
                        formatDate={formatShortDate}
                        leadId={leadId!}
                      />
                    ))}
                  </div>
                </>
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
                    // Skip checklist activities — they're rendered above as interactive cards
                    if (item.type === 'activity' && item.data?.activity_type === 'checklist') return null;
                    if (item.type === 'email_thread') {
                      const thread = item.data;
                      const isThreadExpanded = !!expandedThreads[thread.id];
                      return (
                        <div
                          key={`email-${thread.id}`}
                          className={`rounded-xl bg-card border transition-colors ${isThreadExpanded ? 'border-emerald-200' : 'border-border hover:border-border'}`}
                        >
                          {/* Clickable header */}
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

                          {/* Expanded: thread messages */}
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

                    // Activity card (unchanged)
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
                        {/* Clickable header */}
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

                        {/* Expanded: comments section */}
                        {isExpanded && (
                          <div className="px-3 pb-3">
                            <Separator className="mb-3" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Comments</span>
                            {comments.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {comments.map((c) => (
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
                            {/* Comment input */}
                            <div className="flex items-center gap-2 mt-2">
                              <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 shrink-0">
                                {(teamMember?.name ?? '?')[0]?.toUpperCase()}
                              </div>
                              <input
                                className="flex-1 text-xs bg-muted/50 border border-border rounded-md px-2 py-1 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-300"
                                placeholder="Add a comment…"
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

        {/* RIGHT: Related or Person Detail Panel */}
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
            entityType="underwriting"
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
            stageCfg={stageCfg ? { label: stageCfg.label, bg: stageCfg.bg, color: stageCfg.color } : null}
            teamMembers={teamMembers}
            currentUserName={teamMember?.name ?? null}
            leadQueryKey={['underwriting-expanded', leadId]}
            leadsListQueryKey={['underwriting-deals']}
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
