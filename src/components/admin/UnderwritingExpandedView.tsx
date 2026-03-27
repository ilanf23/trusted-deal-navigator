import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
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
  X, DollarSign, ChevronDown, ChevronRight, ChevronUp,
  Users, Building2, CheckSquare, FileText,
  CalendarDays, FolderOpen, Layers, Plus,
  MessageSquare, Pencil, Activity, Clock, AlertCircle, TrendingUp,
  User, Mail, Phone, PhoneCall, Hash, Tag, Briefcase, Loader2,
  Globe, Linkedin, AtSign, MapPin, Trash2, Flag, Eye, Upload, Download, Send, Bookmark, Maximize2,
  MoreHorizontal, Copy, Check,
} from 'lucide-react';
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';
import { parseISO, format, differenceInDays } from 'date-fns';
import { extractSenderName, toRenderableHtml } from '@/components/gmail/gmailHelpers';
import PeopleDetailPanel from '@/components/admin/PeopleDetailPanel';
import { PeopleTaskDetailDialog, type LeadTask } from './PeopleTaskDetailDialog';
import { type LeadProject } from './ProjectDetailDialog';

import {
  UNDERWRITING_STATUSES,
  stageConfig as canonicalStageConfig,
  EditableField,
  EditableSelectField,
  EditableContactRow,
  EditableTags,
  EditableNotes,
  EditableNotesField,
  ReadOnlyField,
  formatPhoneNumber,
} from './InlineEditableFields';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

interface LeadEmail {
  id: string;
  lead_id: string;
  email: string;
  email_type: string;
  is_primary: boolean;
}

interface LeadPhone {
  id: string;
  lead_id: string;
  phone_number: string;
  phone_type: string;
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

interface LeadFile {
  id: string;
  lead_id: string;
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

function formatValue(v: number): string {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'M/d/yyyy'); } catch { return '—'; }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'MMM d, yyyy'); } catch { return '—'; }
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

/* ─── Contact Email Row ─── */
function ContactEmailRow({ entry, onDelete }: { entry: LeadEmail; onDelete: (id: string) => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/40 transition-colors group">
      <AtSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full capitalize shrink-0">
        {entry.email_type}
      </Badge>
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/admin/gmail?compose=new&to=${encodeURIComponent(entry.email)}`); }}
        className="text-[13px] text-foreground font-medium truncate flex-1 text-left hover:underline hover:text-blue-600 transition-colors"
      >
        {entry.email}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/admin/gmail?compose=new&to=${encodeURIComponent(entry.email)}`); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        title="Compose in Gmail"
      >
        <Send className="h-3 w-3 text-blue-500 hover:text-blue-600" />
      </button>
      <button onClick={() => onDelete(entry.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
      </button>
    </div>
  );
}

/* ─── Contact Phone Row ─── */
function ContactPhoneRow({ entry, onDelete, onCall }: { entry: LeadPhone; onDelete: (id: string) => void; onCall?: (phone: string) => void }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/40 transition-colors group">
      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full capitalize shrink-0">
        {entry.phone_type}
      </Badge>
      <span className="text-[13px] text-foreground font-medium truncate flex-1">{formatPhoneNumber(entry.phone_number)}</span>
      {onCall && (
        <button onClick={() => onCall(entry.phone_number)} title="Call this number" className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <PhoneCall className="h-3 w-3 text-green-600 hover:text-green-700" />
        </button>
      )}
      <button onClick={() => onDelete(entry.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
      </button>
    </div>
  );
}

/* ─── Address Block ─── */
function AddressBlock({ entry, onDelete }: { entry: LeadAddress; onDelete: (id: string) => void }) {
  const parts = [entry.address_line_1, entry.address_line_2].filter(Boolean);
  const cityLine = [entry.city, entry.state, entry.zip_code].filter(Boolean).join(', ');
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors group">
      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {parts.map((p, i) => (
          <p key={i} className="text-[13px] text-foreground font-medium truncate">{p}</p>
        ))}
        {cityLine && <p className="text-[12px] text-muted-foreground truncate">{cityLine}</p>}
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full capitalize mt-1">
          {entry.address_type}
        </Badge>
      </div>
      <button onClick={() => onDelete(entry.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
      </button>
    </div>
  );
}

function getAvatarGradient(name: string) {
  const gradients = [
    'from-blue-500 to-blue-600',
    'from-blue-500 to-indigo-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-cyan-500 to-blue-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

const CONTACT_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string; pill: string }> = {
  Client: { label: 'Client', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500', pill: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' },
  Prospect: { label: 'Prospect', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800', dot: 'bg-blue-500', pill: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  'Referral Partner': { label: 'Referral Partner', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800', dot: 'bg-amber-500', pill: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  Lender: { label: 'Lender', color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800', dot: 'bg-indigo-500', pill: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' },
  Attorney: { label: 'Attorney', color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800', dot: 'bg-rose-500', pill: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' },
  CPA: { label: 'CPA', color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800', dot: 'bg-teal-500', pill: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300' },
  Vendor: { label: 'Vendor', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800', dot: 'bg-orange-500', pill: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' },
  Other: { label: 'Other', color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700', dot: 'bg-slate-400', pill: 'bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300' },
};

export default function UnderwritingExpandedView() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  // Task state
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<LeadTask | null>(null);
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Contact search-to-add state (Related sidebar)
  const [addingContact, setAddingContact] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<any>(null);

  // Contact inline edit state (Related sidebar)
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState('');
  const [editContactTitle, setEditContactTitle] = useState('');

  // Calendar event dialog state
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState<Date | undefined>(undefined);
  const [eventTime, setEventTime] = useState('09:00');
  const [eventEndTime, setEventEndTime] = useState('10:00');
  const [eventType, setEventType] = useState('meeting');
  const [eventDescription, setEventDescription] = useState('');
  const [eventSaving, setEventSaving] = useState(false);
  const [eventDatePickerOpen, setEventDatePickerOpen] = useState(false);

  // Activity expand / comments state
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [savingComment, setSavingComment] = useState<string | null>(null);

  const { teamMember } = useTeamMember();

  // ── Follow state ──
  const [followHovered, setFollowHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const teamMemberId = teamMember?.id;
  const { data: isFollowing = false } = useQuery({
    queryKey: ['lead-follow', leadId, teamMemberId],
    queryFn: async () => {
      const { data } = await supabase.from('lead_followers').select('id')
        .eq('lead_id', leadId!).eq('team_member_id', teamMemberId!).maybeSingle();
      return !!data;
    },
    enabled: !!leadId && !!teamMemberId,
  });
  const toggleFollowMutation = useMutation({
    mutationFn: async () => {
      if (isFollowing) {
        await supabase.from('lead_followers').delete().eq('lead_id', leadId!).eq('team_member_id', teamMemberId!);
      } else {
        await supabase.from('lead_followers').insert({ lead_id: leadId!, team_member_id: teamMemberId! });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-follow', leadId, teamMemberId] });
      toast.success(isFollowing ? 'Unfollowed' : 'Following');
    },
  });
  const handleDeleteLead = useCallback(async () => {
    if (!leadId) return;
    await supabase.from('pipeline_leads').delete().eq('lead_id', leadId);
    await supabase.from('lead_files').delete().eq('lead_id', leadId);
    await supabase.from('lead_activities').delete().eq('lead_id', leadId);
    await supabase.from('tasks').delete().eq('lead_id', leadId);
    const { error } = await supabase.from('leads').delete().eq('id', leadId);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Deleted');
    queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
    navigate(-1);
  }, [leadId, queryClient, navigate]);

  // Company inline add state (Related sidebar)
  const [addingCompany, setAddingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  // Milestone inline add state (Related sidebar)
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [savingMilestone, setSavingMilestone] = useState(false);

  // Waiting On inline add state (Related sidebar)
  const [addingWaitingOn, setAddingWaitingOn] = useState(false);
  const [newWaitingOwner, setNewWaitingOwner] = useState('');
  const [newWaitingDesc, setNewWaitingDesc] = useState('');
  const [savingWaitingOn, setSavingWaitingOn] = useState(false);

  // Satellite table inline add state
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newEmailType, setNewEmailType] = useState('work');
  const [showAddPhone, setShowAddPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newPhoneType, setNewPhoneType] = useState('work');
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddressLine1, setNewAddressLine1] = useState('');
  const [newAddressCity, setNewAddressCity] = useState('');
  const [newAddressState, setNewAddressState] = useState('');
  const [newAddressZip, setNewAddressZip] = useState('');
  const [newAddressType, setNewAddressType] = useState('business');

  // ── Team members (must be before handlers that reference it) ──
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, name').eq('is_active', true);
      return (data || []) as { id: string; name: string }[];
    },
  });

  const teamMemberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of teamMembers) map[m.id] = m.name;
    return map;
  }, [teamMembers]);

  // ── Stage change handler ──
  const handleStageChange = useCallback(async (newStatus: LeadStatus) => {
    if (!leadId) return;
    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', leadId);
    if (error) {
      toast.error('Failed to update stage');
      return;
    }
    toast.success('Stage updated');
    queryClient.invalidateQueries({ queryKey: ['lead-expanded', leadId] });
    queryClient.invalidateQueries({ queryKey: ['underwriting-leads'] });
  }, [leadId, queryClient]);

  // ── Field saved handler ──
  const handleFieldSaved = useCallback((_field: string, _newValue: string) => {
    queryClient.invalidateQueries({ queryKey: ['lead-expanded', leadId] });
    queryClient.invalidateQueries({ queryKey: ['underwriting-leads'] });
    queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
    toast.success('Updated');
  }, [leadId, queryClient]);

  const handleBooleanToggle = useCallback(async (field: string, currentVal: boolean) => {
    if (!leadId) return;
    const { error } = await supabase.from('leads').update({ [field]: !currentVal }).eq('id', leadId);
    if (error) { toast.error('Failed to save'); return; }
    queryClient.invalidateQueries({ queryKey: ['lead-expanded', leadId] });
    queryClient.invalidateQueries({ queryKey: ['underwriting-leads'] });
    toast.success('Updated');
  }, [leadId, queryClient]);

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
    const { error } = await supabase.from('lead_activities').insert({
      lead_id: leadId,
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
    await supabase.from('leads').update({ last_activity_at: new Date().toISOString() }).eq('id', leadId);
    toast.success('Activity saved');
    if (activityTab === 'log') setActivityNote('');
    else setNoteContent('');
    queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
    queryClient.invalidateQueries({ queryKey: ['lead-expanded', leadId] });
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

    // 1. Insert lead_activities row
    const { data: actData, error: actErr } = await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
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

    // 2. Insert lead_checklists row
    const { data: clData, error: clErr } = await supabase
      .from('lead_checklists')
      .insert({
        lead_id: leadId,
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
    await supabase.from('lead_checklist_items').insert(itemRows);

    // 4. Stamp last_activity_at
    await supabase.from('leads').update({ last_activity_at: new Date().toISOString() }).eq('id', leadId);

    setSavingChecklist(false);
    toast.success('Checklist saved');
    // Reset builder
    setChecklistTitle('Checklist');
    setChecklistItems([]);
    setNewItemText('');
    setChecklistTabVisible(false);
    setActivityTab('checklist');
    queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
    queryClient.invalidateQueries({ queryKey: ['lead-saved-checklists', leadId] });
    queryClient.invalidateQueries({ queryKey: ['lead-expanded', leadId] });
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
    queryClient.invalidateQueries({ queryKey: ['activity-comments', leadId] });
  }, [leadId, commentTexts, teamMember, queryClient]);

  // ── Toggle task completion ──
  const toggleTaskCompletion = useCallback(async (task: LeadTask) => {
    const isCompleting = !task.completed_at;
    await supabase.from('tasks').update({
      completed_at: isCompleting ? new Date().toISOString() : null,
      is_completed: isCompleting,
      status: isCompleting ? 'done' : 'todo',
      updated_at: new Date().toISOString(),
    }).eq('id', task.id);
    queryClient.invalidateQueries({ queryKey: ['person-tasks', leadId] });
  }, [leadId, queryClient]);

  // ── Save calendar event ──
  const handleSaveEvent = useCallback(async () => {
    if (!leadId || !eventTitle.trim() || !eventDate) return;
    setEventSaving(true);
    const dateStr = format(eventDate, 'yyyy-MM-dd');
    const startTime = `${dateStr}T${eventTime}:00`;
    const endTime = `${dateStr}T${eventEndTime}:00`;
    const { error } = await supabase.from('appointments').insert({
      lead_id: leadId,
      title: eventTitle.trim(),
      description: eventDescription.trim() || null,
      start_time: startTime,
      end_time: endTime,
      appointment_type: eventType,
    });
    setEventSaving(false);
    if (error) {
      toast.error('Failed to create event');
      return;
    }
    toast.success('Event created');
    setEventDialogOpen(false);
    setEventTitle('');
    setEventDate(undefined);
    setEventTime('09:00');
    setEventEndTime('10:00');
    setEventType('meeting');
    setEventDescription('');
    queryClient.invalidateQueries({ queryKey: ['lead-appointments', leadId] });
  }, [leadId, eventTitle, eventDate, eventTime, eventEndTime, eventType, eventDescription, queryClient]);

  // ── Delete calendar event ──
  const handleDeleteEvent = useCallback(async (eventId: string) => {
    const { error } = await supabase.from('appointments').delete().eq('id', eventId);
    if (error) {
      toast.error('Failed to delete event');
      return;
    }
    toast.success('Event deleted');
    queryClient.invalidateQueries({ queryKey: ['lead-appointments', leadId] });
  }, [leadId, queryClient]);

  const handleInlineCreateProject = useCallback(async () => {
    if (!newProjectName.trim() || !leadId) return;
    setSavingProject(true);
    try {
      const { error } = await supabase.from('lead_projects').insert({
        lead_id: leadId,
        name: newProjectName.trim(),
        status: 'open',
        project_stage: 'open',
        visibility: 'everyone',
        created_by: teamMember?.name || null,
      });
      if (error) throw error;
      toast.success('Project created');
      queryClient.invalidateQueries({ queryKey: ['lead-projects', leadId] });
      setNewProjectName('');
      setShowAddProject(false);
    } catch {
      toast.error('Failed to create project');
    } finally {
      setSavingProject(false);
    }
  }, [newProjectName, leadId, teamMember, queryClient]);

  // ── Link existing person as contact (Related sidebar) ──
  const handleLinkPerson = useCallback(async (person: { id: string; name: string; title: string | null; email?: string | null }) => {
    if (!leadId) return;
    setSavingContact(true);
    const { error } = await supabase.from('lead_contacts').insert({
      lead_id: leadId,
      name: person.name,
      title: person.title || null,
      email: person.email || null,
    });
    setSavingContact(false);
    if (error) {
      toast.error('Failed to add contact');
      return;
    }
    toast.success('Contact added');
    setContactSearchQuery('');
    setAddingContact(false);
    queryClient.invalidateQueries({ queryKey: ['lead-contacts', leadId] });
  }, [leadId, queryClient]);

  // ── Update contact (Related sidebar) ──
  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, name, title }: { contactId: string; name: string; title: string }) => {
      const { error } = await supabase.from('lead_contacts').update({ name, title: title || null }).eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-contacts', leadId] });
      toast.success('Contact updated');
    },
    onError: () => toast.error('Failed to update contact'),
  });

  // ── Delete contact (Related sidebar) ──
  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase.from('lead_contacts').delete().eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-contacts', leadId] });
      toast.success('Contact removed');
    },
    onError: () => toast.error('Failed to remove contact'),
  });

  const handleStartEditContact = useCallback((contact: { id: string; name: string; title: string | null }) => {
    setEditingContactId(contact.id);
    setEditContactName(contact.name);
    setEditContactTitle(contact.title || '');
  }, []);

  const handleOpenPersonPanel = useCallback(async (personName: string) => {
    const { data } = await supabase
      .from('leads')
      .select('*')
      .ilike('name', personName)
      .limit(1)
      .maybeSingle();
    if (data) {
      setSelectedPerson(data);
    } else {
      toast.info('No matching person record found');
    }
  }, []);

  const handleSaveEditContact = useCallback(() => {
    if (!editingContactId || !editContactName.trim()) return;
    updateContactMutation.mutate({ contactId: editingContactId, name: editContactName.trim(), title: editContactTitle.trim() });
    setEditingContactId(null);
    setEditContactName('');
    setEditContactTitle('');
  }, [editingContactId, editContactName, editContactTitle, updateContactMutation]);

  const handleCancelEditContact = useCallback(() => {
    setEditingContactId(null);
    setEditContactName('');
    setEditContactTitle('');
  }, []);

  // ── Save company (Related sidebar) ──
  const handleSaveCompany = useCallback(async () => {
    if (!leadId || !newCompanyName.trim()) return;
    setSavingCompany(true);
    const { error } = await supabase
      .from('leads')
      .update({ company_name: newCompanyName.trim() })
      .eq('id', leadId);
    setSavingCompany(false);
    if (error) {
      toast.error('Failed to update company');
      return;
    }
    toast.success('Company updated');
    setNewCompanyName('');
    setAddingCompany(false);
    queryClient.invalidateQueries({ queryKey: ['lead-expanded', leadId] });
    queryClient.invalidateQueries({ queryKey: ['underwriting-leads'] });
  }, [leadId, newCompanyName, queryClient]);

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
    queryClient.invalidateQueries({ queryKey: ['lead-milestones', leadId] });
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
    queryClient.invalidateQueries({ queryKey: ['lead-milestones', leadId] });
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
    queryClient.invalidateQueries({ queryKey: ['lead-waiting-on', leadId] });
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
    queryClient.invalidateQueries({ queryKey: ['lead-waiting-on', leadId] });
  }, [leadId, queryClient]);

  // ── File upload ──
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !leadId) return;
    // Reset the input so the same file can be re-selected
    e.target.value = '';

    console.log('[FileUpload] Underwriting: starting upload', { name: file.name, size: file.size, type: file.type });

    // Auth check
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error('[FileUpload] Underwriting: no active session', sessionError);
      toast.error('You must be logged in to upload files. Please refresh and sign in again.');
      return;
    }

    setUploadingFile(true);
    const filePath = `${leadId}/${Date.now()}_${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from('lead-files')
      .upload(filePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) {
      console.error('[FileUpload] Underwriting: storage upload error', uploadError);
      setUploadingFile(false);
      const reason = uploadError.message?.includes('security')
        ? 'Permission denied — check your login session'
        : uploadError.message || 'Storage error';
      toast.error(`Upload failed for ${file.name}: ${reason}`);
      return;
    }

    const { error: dbError } = await supabase.from('lead_files').insert({
      lead_id: leadId,
      file_name: file.name,
      file_url: filePath,
      file_type: file.type || null,
      file_size: file.size,
    });

    setUploadingFile(false);
    if (dbError) {
      console.error('[FileUpload] Underwriting: DB insert error', dbError);
      const reason = dbError.message?.includes('row-level security')
        ? 'Permission denied — admin role required'
        : dbError.message || 'Database error';
      toast.error(`Failed to save ${file.name}: ${reason}`);
      // Clean up orphaned storage file
      await supabase.storage.from('lead-files').remove([filePath]);
      return;
    }
    console.log('[FileUpload] Underwriting: upload success', { filePath });
    toast.success('File uploaded');
    queryClient.invalidateQueries({ queryKey: ['lead-files', leadId] });
  }, [leadId, queryClient]);

  // ── File delete ──
  const handleDeleteFile = useCallback(async (file: LeadFile) => {
    // file_url stores the storage path directly
    await supabase.storage.from('lead-files').remove([file.file_url]);

    const { error } = await supabase.from('lead_files').delete().eq('id', file.id);
    if (error) {
      toast.error('Failed to delete file');
      return;
    }
    toast.success('File deleted');
    queryClient.invalidateQueries({ queryKey: ['lead-files', leadId] });
  }, [leadId, queryClient]);

  // ── Queries ──
  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead-expanded', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId!)
        .single();
      if (error) throw error;
      return data as Lead;
    },
    enabled: !!leadId,
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['lead-contacts', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('lead_contacts').select('*').eq('lead_id', leadId!);
      return data ?? [];
    },
    enabled: !!leadId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['person-tasks', leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      return (data ?? []) as LeadTask[];
    },
    enabled: !!leadId,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['lead-projects', leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_projects')
        .select('*')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      return (data ?? []) as LeadProject[];
    },
    enabled: !!leadId,
  });

  const { data: leadAppointments = [] } = useQuery({
    queryKey: ['lead-appointments', leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('id, title, description, start_time, end_time, appointment_type')
        .eq('lead_id', leadId!)
        .order('start_time', { ascending: true });
      return data ?? [];
    },
    enabled: !!leadId,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['lead-milestones', leadId],
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
    queryKey: ['lead-waiting-on', leadId],
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

  const { data: leadFiles = [] } = useQuery({
    queryKey: ['lead-files', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_files')
        .select('id, file_name, file_url, file_type, file_size, uploaded_by, created_at')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LeadFile[];
    },
    enabled: !!leadId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['lead-activities', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId!)
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
    queryKey: ['activity-comments', leadId],
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
    queryKey: ['lead-saved-checklists', leadId],
    queryFn: async () => {
      const { data: checklists, error: clErr } = await supabase
        .from('lead_checklists')
        .select('*')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      if (clErr || !checklists || checklists.length === 0) return [];
      const ids = checklists.map((c) => c.id);
      const { data: items } = await supabase
        .from('lead_checklist_items')
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
    queryKey: ['lead-emails', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('lead_emails').select('*').eq('lead_id', leadId!);
      return (data || []) as LeadEmail[];
    },
    enabled: !!leadId,
  });

  const COMMON_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com', 'protonmail.com'];

  // Related people from `people` table — matched by company name or business email domain
  const { data: relatedPeople = [] } = useQuery({
    queryKey: ['lead-related-people', lead?.company_name, lead?.email, leadEmails],
    queryFn: async () => {
      if (!lead) return [];
      const results: { id: string; name: string; title: string | null; email: string | null; phone: string | null; company_name: string | null }[] = [];

      // Match by company name
      if (lead.company_name) {
        const { data } = await supabase
          .from('leads')
          .select('id, name, title, email, phone, company_name')
          .eq('company_name', lead.company_name)
          .order('name')
          .limit(20);
        if (data) results.push(...data);
      }

      // Collect all business email domains from lead email + lead_emails
      const allEmails = [lead.email, ...leadEmails.map(e => e.email)].filter(Boolean) as string[];
      const domains = new Set<string>();
      for (const email of allEmails) {
        const domain = email.split('@')[1]?.toLowerCase();
        if (domain && !COMMON_DOMAINS.includes(domain)) domains.add(domain);
      }

      // Match by email domain
      for (const domain of domains) {
        const { data } = await supabase
          .from('leads')
          .select('id, name, title, email, phone, company_name')
          .ilike('email', `%@${domain}`)
          .limit(20);
        if (data) results.push(...data);
      }

      // Deduplicate by id
      const seen = new Set<string>();
      return results.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
    },
    enabled: !!lead,
  });

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

  // People search for adding contacts
  const { data: peopleSearchResults = [] } = useQuery({
    queryKey: ['people-search', contactSearchQuery],
    queryFn: async () => {
      const q = contactSearchQuery.trim();
      if (!q) return [];
      const { data } = await supabase
        .from('leads')
        .select('id, name, title, email, company_name')
        .ilike('name', `%${q}%`)
        .order('name', { ascending: true })
        .limit(20);
      return (data || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    },
    enabled: addingContact && contactSearchQuery.trim().length > 0,
  });

  const leadEmailAddresses = useMemo(() => {
    if (!lead) return [];
    const allEmails: string[] = [];
    if (lead.email) allEmails.push(lead.email.toLowerCase());
    leadEmails.forEach(e => allEmails.push(e.email.toLowerCase()));
    return [...new Set(allEmails)];
  }, [lead, leadEmails]);

  const { data: gmailEmails = [], isLoading: gmailEmailsLoading } = useQuery({
    queryKey: ['lead-gmail-emails', leadId, leadEmailAddresses],
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
    queryKey: ['lead-phones', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('lead_phones').select('*').eq('lead_id', leadId!);
      return (data || []) as LeadPhone[];
    },
    enabled: !!leadId,
  });

  const { data: leadAddresses = [] } = useQuery({
    queryKey: ['lead-addresses', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('lead_addresses').select('*').eq('lead_id', leadId!);
      return (data || []) as LeadAddress[];
    },
    enabled: !!leadId,
  });

  // ── Satellite table mutations ──
  const addEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      if (!leadId) return;
      const { error } = await supabase.from('lead_emails').insert({ lead_id: leadId, email, email_type: newEmailType });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-emails', leadId] });
      setNewEmail('');
      setShowAddEmail(false);
      toast.success('Email added');
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase.from('lead_emails').delete().eq('id', emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-emails', leadId] });
      toast.success('Email removed');
    },
  });

  const addPhoneMutation = useMutation({
    mutationFn: async (phone: string) => {
      if (!leadId) return;
      const { error } = await supabase.from('lead_phones').insert({ lead_id: leadId, phone_number: phone, phone_type: newPhoneType });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-phones', leadId] });
      setNewPhone('');
      setShowAddPhone(false);
      toast.success('Phone added');
    },
  });

  const deletePhoneMutation = useMutation({
    mutationFn: async (phoneId: string) => {
      const { error } = await supabase.from('lead_phones').delete().eq('id', phoneId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-phones', leadId] });
      toast.success('Phone removed');
    },
  });

  const addAddressMutation = useMutation({
    mutationFn: async () => {
      if (!leadId || !newAddressLine1.trim()) return;
      const { error } = await supabase.from('lead_addresses').insert({
        lead_id: leadId,
        address_line_1: newAddressLine1.trim(),
        city: newAddressCity.trim() || null,
        state: newAddressState.trim() || null,
        zip_code: newAddressZip.trim() || null,
        address_type: newAddressType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-addresses', leadId] });
      setNewAddressLine1('');
      setNewAddressCity('');
      setNewAddressState('');
      setNewAddressZip('');
      setNewAddressType('business');
      setShowAddAddress(false);
      toast.success('Address added');
    },
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await supabase.from('lead_addresses').delete().eq('id', addressId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-addresses', leadId] });
      toast.success('Address removed');
    },
  });

  if (isLoading || !lead) {
    return (
      <div className="flex items-center justify-center h-full">
        <Skeleton className="h-12 w-64" />
      </div>
    );
  }

  const pendingTasks = tasks.filter((t: LeadTask) => !t.completed_at);
  const completedTasks = tasks.filter((t: LeadTask) => !!t.completed_at);

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
    <div data-full-bleed className="flex flex-col bg-background h-[calc(100vh-3.5rem)] md:overflow-hidden overflow-y-auto">
      {/* ── 3-Column Body ── */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 md:overflow-hidden">

        {/* LEFT: Details — fully editable */}
        <div className="w-full md:w-[320px] xl:w-[400px] shrink-0 min-w-0 md:border-r border-b md:border-b-0 border-border bg-card overflow-hidden">
        <div className="md:h-full overflow-y-auto overflow-x-hidden">
          <div className="pl-10 pr-6 py-6 space-y-6 min-w-0">

            {/* ── Action Buttons Row ── */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={goBack}>
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                className={`h-8 text-sm font-medium gap-1.5 rounded-full px-5 transition-all ${
                  isFollowing
                    ? followHovered
                      ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
                      : 'bg-white dark:bg-card text-foreground border border-border'
                    : 'bg-[#2e1065] hover:bg-[#3b1382] text-white'
                }`}
                onClick={() => toggleFollowMutation.mutate()}
                onMouseEnter={() => setFollowHovered(true)}
                onMouseLeave={() => setFollowHovered(false)}
                disabled={toggleFollowMutation.isPending}
              >
                {isFollowing ? (
                  followHovered ? (<><X className="h-3.5 w-3.5" />Unfollow</>) : (<><Check className="h-3.5 w-3.5" />Following</>)
                ) : ('Follow')}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied'); }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link copied'); }}>
                    Copy link
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setAddMenuOpen(false);
                      setChecklistTabVisible(true);
                      setActivityTab('checklist');
                      setChecklistTitle('Checklist');
                      setChecklistItems([]);
                      setNewItemText('');
                    }}
                  >
                    Add a Checklist
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowDeleteConfirm(true)} className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* ── Contact Card Header ── */}
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                <DollarSign className="h-6 w-6 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="min-w-0 pt-0.5">
                <h2 className="text-xl font-semibold text-foreground truncate leading-tight">{getLeadDisplayName(lead)}</h2>
                <p className="text-sm text-muted-foreground mt-1 truncate">
                  {[lead.company_name, formatValue(dealValue)].filter(Boolean).join(' / ')}
                </p>
                <div className="mt-2.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800">
                    <DollarSign className="h-3 w-3" />
                    Opportunity
                  </span>
                </div>
              </div>
            </div>

            {/* Opportunity Name */}
            <EditableField label="Opportunity Name" value={lead.opportunity_name || lead.name || ''} field="opportunity_name" leadId={lead.id} placeholder="e.g. Client - Refi 6-unit Apt. Bldg" onSaved={handleFieldSaved} />

            {/* Pipeline */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Pipeline</label>
              <div className="border-b border-border pb-1">
                <p className="text-base text-foreground py-1.5 px-1">Underwriting</p>
              </div>
            </div>

            {/* Stage */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Stage</label>
              <div className="border-b border-border pb-1">
                <Select value={lead.status} onValueChange={(v) => handleStageChange(v as LeadStatus)}>
                  <SelectTrigger className="h-10 w-full text-base text-foreground border-0 bg-transparent shadow-none px-1 rounded-none">
                    <SelectValue>{stageCfg?.label ?? lead.status}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="min-w-[220px]">
                    {UNDERWRITING_STATUSES.map((s) => {
                      const cfg = canonicalStageConfig[s];
                      return (
                        <SelectItem key={s} value={s} className="text-sm">
                          {cfg?.label ?? s}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* CLX File Name */}
            <EditableField icon={<FolderOpen className="h-3.5 w-3.5" />} label="CLX File Name" value={lead.clx_file_name ?? ''} field="clx_file_name" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Waiting On */}
            <EditableField icon={<Clock className="h-3.5 w-3.5" />} label="Waiting On" value={lead.waiting_on ?? ''} field="waiting_on" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Tags */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Tags</label>
              <EditableTags tags={lead.tags ?? []} leadId={lead.id} onSaved={handleFieldSaved} />
            </div>

            {/* Value */}
            <EditableField icon={<DollarSign className="h-3.5 w-3.5" />} label="Value" value={lead.deal_value != null ? formatValue(lead.deal_value) : ''} field="deal_value" leadId={lead.id} onSaved={handleFieldSaved} transform={(v) => v ? Number(v.replace(/[^0-9.$,]/g, '')) : null} />

            {/* Description */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Description</label>
              <EditableNotesField value={lead.description ?? ''} field="description" leadId={lead.id} placeholder="Add Description" onSaved={handleFieldSaved} />
            </div>

            {/* Primary Contact */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Primary Contact</label>
              <div className="border-b border-border pb-3">
                <div className="flex items-center gap-3 px-1 py-1.5">
                  <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${getAvatarGradient(lead.name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                    {lead.name[0]?.toUpperCase() ?? '?'}{lead.name.split(' ')[1]?.[0]?.toUpperCase() ?? ''}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base text-foreground truncate">{lead.name}</p>
                    {lead.title && <p className="text-xs text-muted-foreground truncate">{lead.title}</p>}
                  </div>
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-2 px-1 py-1 min-w-0">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate">{formatPhoneNumber(lead.phone)}</span>
                  </div>
                )}
                {lead.email && (
                  <div className="flex items-center gap-2 px-1 py-1 min-w-0">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate">{lead.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Created */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Created</label>
              <div className="border-b border-border pb-1">
                <p className="text-base text-foreground py-1.5 px-1">{formatDate(lead.created_at)}</p>
              </div>
            </div>

            {/* Close Date */}
            <EditableField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Close Date" value={(lead as any).close_date ? formatDate((lead as any).close_date) : ''} field="close_date" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Loss Reason */}
            <EditableField icon={<X className="h-3.5 w-3.5" />} label="Loss Reason" value={(lead as any).loss_reason ?? ''} field="loss_reason" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Company */}
            <EditableField icon={<Building2 className="h-3.5 w-3.5" />} label="Company" value={lead.company_name ?? ''} field="company_name" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Owner */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Owner</label>
              <div className="border-b border-border pb-1">
                {ownerOptions.length > 0 ? (
                  <Select value={lead.assigned_to ?? ''} onValueChange={async (v) => {
                    const { error } = await supabase.from('leads').update({ assigned_to: v || null }).eq('id', lead.id);
                    if (!error) handleFieldSaved('assigned_to', v);
                  }}>
                    <SelectTrigger className="h-10 w-full text-base text-foreground border-0 bg-transparent shadow-none px-1 rounded-none">
                      <SelectValue>{assignedName}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ownerOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-sm">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-base text-foreground py-1.5 px-1">{assignedName}</p>
                )}
              </div>
            </div>

            {/* Source */}
            <EditableField icon={<Tag className="h-3.5 w-3.5" />} label="Source" value={lead.source ?? ''} field="source" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Priority */}
            <EditableField icon={<Flag className="h-3.5 w-3.5" />} label="Priority" value={(lead as any).priority ?? ''} field="priority" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Win Percentage */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Win Percentage</label>
              <div className="border-b border-border pb-1">
                <p className="text-base text-foreground py-1.5 px-1 tabular-nums">
                  {(lead as any).win_percentage != null ? (
                    <>{(lead as any).win_percentage}<br /><span className="text-sm text-muted-foreground">{(lead as any).win_percentage}%</span></>
                  ) : (
                    <span className="text-muted-foreground italic">{'\u2014'}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Visibility */}
            <EditableField icon={<Eye className="h-3.5 w-3.5" />} label="Visibility" value={(lead as any).visibility ?? 'everyone'} field="visibility" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Email */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Email</label>
              <div className="space-y-1">
                {leadEmails.map((e) => (
                  <ContactEmailRow key={e.id} entry={e} onDelete={(id) => deleteEmailMutation.mutate(id)} />
                ))}
                {showAddEmail ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50/50 border border-blue-100">
                    <AtSign className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <Select value={newEmailType} onValueChange={setNewEmailType}>
                      <SelectTrigger className="h-7 w-[80px] text-xs border-transparent bg-transparent shadow-none px-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="work" className="text-xs">Work</SelectItem>
                        <SelectItem value="personal" className="text-xs">Personal</SelectItem>
                      </SelectContent>
                    </Select>
                    <input autoFocus value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newEmail.trim()) addEmailMutation.mutate(newEmail.trim()); if (e.key === 'Escape') { setShowAddEmail(false); setNewEmail(''); } }} placeholder="email@example.com" className="flex-1 text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50" />
                  </div>
                ) : (
                  <button onClick={() => setShowAddEmail(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-1 py-1">+ Add Email</button>
                )}
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Phone</label>
              <div className="space-y-1">
                {leadPhones.map((p) => (
                  <ContactPhoneRow key={p.id} entry={p} onDelete={(id) => deletePhoneMutation.mutate(id)} onCall={(phone) => navigate(`/admin/calls?phone=${encodeURIComponent(phone.replace(/\D/g, ''))}&leadId=${lead.id}`)} />
                ))}
                {showAddPhone ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50/50 border border-blue-100">
                    <Phone className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <Select value={newPhoneType} onValueChange={setNewPhoneType}>
                      <SelectTrigger className="h-7 w-[80px] text-xs border-transparent bg-transparent shadow-none px-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="work" className="text-xs">Work</SelectItem>
                        <SelectItem value="personal" className="text-xs">Personal</SelectItem>
                        <SelectItem value="mobile" className="text-xs">Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                    <input autoFocus value={newPhone} onChange={(e) => setNewPhone(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newPhone.trim()) addPhoneMutation.mutate(newPhone.trim()); if (e.key === 'Escape') { setShowAddPhone(false); setNewPhone(''); } }} placeholder="(555) 123-4567" className="flex-1 text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50" />
                  </div>
                ) : (
                  <button onClick={() => setShowAddPhone(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-1 py-1">+ Add Phone</button>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Address</label>
              <div className="space-y-1">
                {leadAddresses.map((a) => (
                  <AddressBlock key={a.id} entry={a} onDelete={(id) => deleteAddressMutation.mutate(id)} />
                ))}
                {showAddAddress ? (
                  <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-2.5 space-y-2">
                    <input autoFocus value={newAddressLine1} onChange={(e) => setNewAddressLine1(e.target.value)} placeholder="Address line 1" className="w-full text-[13px] text-foreground bg-white border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300" />
                    <div className="flex gap-1.5">
                      <input value={newAddressCity} onChange={(e) => setNewAddressCity(e.target.value)} placeholder="City" className="flex-1 text-[13px] bg-white border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300" />
                      <input value={newAddressState} onChange={(e) => setNewAddressState(e.target.value)} placeholder="State" className="w-16 text-[13px] bg-white border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300" />
                      <input value={newAddressZip} onChange={(e) => setNewAddressZip(e.target.value)} placeholder="Zip" className="w-20 text-[13px] bg-white border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div className="flex items-center justify-between">
                      <Select value={newAddressType} onValueChange={setNewAddressType}>
                        <SelectTrigger className="h-8 w-[110px] text-xs border-border"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="business" className="text-xs">Business</SelectItem>
                          <SelectItem value="home" className="text-xs">Home</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex gap-1.5">
                        <button onClick={() => { setShowAddAddress(false); setNewAddressLine1(''); setNewAddressCity(''); setNewAddressState(''); setNewAddressZip(''); }} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Cancel</button>
                        <button onClick={() => addAddressMutation.mutate()} disabled={!newAddressLine1.trim()} className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md disabled:opacity-50">Save</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddAddress(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-1 py-1">+ Add Address</button>
                )}
              </div>
            </div>

            {/* About */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">About</label>
              <EditableNotesField value={lead.about ?? ''} field="about" leadId={lead.id} placeholder="Add About" onSaved={handleFieldSaved} />
            </div>

            {/* History */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">History</label>
              <EditableNotesField value={lead.history ?? ''} field="history" leadId={lead.id} placeholder="Add History" onSaved={handleFieldSaved} />
            </div>

            {/* Bank Relationships */}
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Bank Relationships</label>
              <EditableNotesField value={lead.bank_relationships ?? ''} field="bank_relationships" leadId={lead.id} placeholder="Add Bank Relationships" onSaved={handleFieldSaved} />
            </div>

            {/* #UW */}
            <EditableField icon={<Hash className="h-3.5 w-3.5" />} label="#UW" value={lead.uw_number ?? ''} field="uw_number" leadId={lead.id} onSaved={handleFieldSaved} />

            {/* Client Working with Other Lenders */}
            <div onClick={() => handleBooleanToggle('client_other_lenders', lead.client_other_lenders)} className="flex items-center justify-between py-3 border-b border-border hover:bg-muted/40 transition-colors cursor-pointer">
              <label className="text-sm text-muted-foreground">Client Working with Other Lenders</label>
              <div className={`h-5 w-9 rounded-full transition-colors relative ${lead.client_other_lenders ? 'bg-blue-500' : 'bg-muted-foreground/30'}`}>
                <div className={`h-4 w-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${lead.client_other_lenders ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </div>

            {/* Weekly's */}
            <div onClick={() => handleBooleanToggle('flagged_for_weekly', lead.flagged_for_weekly)} className="flex items-center justify-between py-3 border-b border-border hover:bg-muted/40 transition-colors cursor-pointer">
              <label className="text-sm text-muted-foreground">Weekly's</label>
              <div className={`h-5 w-9 rounded-full transition-colors relative ${lead.flagged_for_weekly ? 'bg-blue-500' : 'bg-muted-foreground/30'}`}>
                <div className={`h-4 w-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${lead.flagged_for_weekly ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </div>

          </div>
        </div>
        </div>

        {/* CENTER: Activity */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/20">
          {/* Stats Row */}
          <div className="shrink-0 px-5 py-4">
            <div className="grid grid-cols-4 divide-x divide-border rounded-xl border border-border bg-card">
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
              <div className="flex flex-col items-center justify-center py-3 px-2">
                <span className="text-lg font-bold text-foreground">{leadStats.daysInStage}</span>
                <span className="text-[11px] text-muted-foreground">Days in Stage</span>
              </div>
            </div>
          </div>
          {/* Activity Tabs — underline style */}
          <div className="shrink-0 flex items-stretch bg-card border-b border-border">
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
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-600 rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          <ScrollArea className="md:flex-1">
            <div className="px-6 py-5">
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

              {/* Earlier — Activity History + Email Threads */}
              <Separator className="my-6" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Earlier</h3>
              {gmailEmailsLoading && (
                <div className="flex items-center gap-2 py-2 mb-3">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Loading emails...</span>
                </div>
              )}
              <div className="space-y-3">
                {timelineItems.length > 0 ? (
                  timelineItems.map((item) => {
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
        <div className="w-full md:w-[280px] xl:w-[320px] shrink-0 min-w-0 md:border-l border-t md:border-t-0 border-border bg-card overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Related</span>
          </div>
          <ScrollArea className="md:flex-1">
          <div className="py-4 px-3 pr-4 overflow-hidden">
            {/* People */}
            <RelatedSection icon={<Users className="h-3.5 w-3.5" />} label="People" count={contacts.length + relatedPeople.filter(rp => !contacts.some(c => c.name.toLowerCase() === rp.name.toLowerCase())).length} onAdd={() => setAddingContact(true)}>
              <div className="space-y-3 py-1">
                {/* Linked contacts */}
                {contacts.map((c) => (
                  editingContactId === c.id ? (
                    <div key={c.id} className="space-y-1.5">
                      <input
                        autoFocus
                        value={editContactName}
                        onChange={(e) => setEditContactName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editContactName.trim()) handleSaveEditContact();
                          if (e.key === 'Escape') handleCancelEditContact();
                        }}
                        placeholder="Name (required)"
                        className="w-full text-xs text-foreground bg-muted border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                      />
                      <input
                        value={editContactTitle}
                        onChange={(e) => setEditContactTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && editContactName.trim()) handleSaveEditContact();
                          if (e.key === 'Escape') handleCancelEditContact();
                        }}
                        placeholder="Title (optional)"
                        className="w-full text-xs text-foreground bg-muted border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                      />
                    </div>
                  ) : (
                    <div key={c.id} className="flex items-start gap-2.5 group cursor-pointer" onClick={() => handleOpenPersonPanel(c.name)}>
                      <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300 shrink-0 mt-0.5">
                        {c.name.split(' ').map((n: string) => n[0]?.toUpperCase()).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground truncate hover:text-blue-600 dark:hover:text-blue-400 hover:underline">{c.name}</span>
                          {c.is_primary && (
                            <span className="flex items-center gap-0.5 text-[10px] text-foreground font-medium shrink-0">
                              <Bookmark className="h-3 w-3 fill-current" /> Primary
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteContactMutation.mutate(c.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto"
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                          </button>
                        </div>
                        {(c.title || lead.company_name) && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {c.title && <span className="text-blue-600 dark:text-blue-400">{c.title}</span>}
                            {c.title && lead.company_name && ' at '}
                            {lead.company_name && <span className="text-blue-600 dark:text-blue-400">{lead.company_name}</span>}
                          </p>
                        )}
                        {(c.phone || c.email) && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {c.phone && <span>{c.phone}</span>}
                            {c.phone && c.email && <span className="mx-1">|</span>}
                            {c.email && <span>{c.email}</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                ))}

                {/* Related people from people table */}
                {relatedPeople.filter(rp => !contacts.some(c => c.name.toLowerCase() === rp.name.toLowerCase())).length > 0 && (
                  <>
                    {contacts.length > 0 && <div className="border-t border-border" />}
                    {relatedPeople
                      .filter(rp => !contacts.some(c => c.name.toLowerCase() === rp.name.toLowerCase()))
                      .map((rp) => (
                        <div key={rp.id} className="flex items-start gap-2.5 cursor-pointer" onClick={() => setSelectedPerson(rp)}>
                          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300 shrink-0 mt-0.5">
                            {rp.name.split(' ').map((n: string) => n[0]?.toUpperCase()).join('').slice(0, 2)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-foreground truncate block hover:text-blue-600 dark:hover:text-blue-400 hover:underline">{rp.name}</span>
                            {(rp.title || rp.company_name) && (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {rp.title && <span className="text-blue-600 dark:text-blue-400">{rp.title}</span>}
                                {rp.title && rp.company_name && ' at '}
                                {rp.company_name && <span className="text-blue-600 dark:text-blue-400">{rp.company_name}</span>}
                              </p>
                            )}
                            {(rp.phone || rp.email) && (
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {rp.phone && <span>{rp.phone}</span>}
                                {rp.phone && rp.email && <span className="mx-1">|</span>}
                                {rp.email && <span>{rp.email}</span>}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </>
                )}

                {contacts.length === 0 && !addingContact && relatedPeople.filter(rp => !contacts.some(c => c.name.toLowerCase() === rp.name.toLowerCase())).length === 0 && (
                  <p className="text-xs text-muted-foreground">No contacts</p>
                )}

                {/* Add person */}
                {addingContact ? (
                  <div className="relative mt-1">
                    <input
                      autoFocus
                      value={contactSearchQuery}
                      onChange={(e) => setContactSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') { setAddingContact(false); setContactSearchQuery(''); }
                      }}
                      placeholder="Search people..."
                      disabled={savingContact}
                      className="w-full text-xs text-foreground bg-muted border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                    />
                    {savingContact && <Loader2 className="h-3 w-3 animate-spin text-blue-500 mt-1" />}
                    {contactSearchQuery.trim().length > 0 && peopleSearchResults.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {peopleSearchResults
                          .filter(p => !contacts.some(c => c.name.toLowerCase() === p.name.toLowerCase()))
                          .map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleLinkPerson(p)}
                            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-muted/60 transition-colors"
                          >
                            <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 shrink-0">
                              {p.name[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-medium text-foreground">{p.name}</span>
                              {p.title && <span className="text-xs text-muted-foreground ml-1">· {p.title}</span>}
                              {p.company_name && <p className="text-[10px] text-muted-foreground truncate">{p.company_name}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {contactSearchQuery.trim().length > 0 && peopleSearchResults.filter(p => !contacts.some(c => c.name.toLowerCase() === p.name.toLowerCase())).length === 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg px-2 py-2">
                        <p className="text-xs text-muted-foreground">No matching people found</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingContact(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1"
                  >
                    + Add person...
                  </button>
                )}

              </div>
            </RelatedSection>

            {/* Tasks */}
            <RelatedSection
              icon={<CheckSquare className="h-3.5 w-3.5" />}
              label="Tasks"
              count={pendingTasks.length}
              iconColor="text-emerald-500"
              onAdd={() => { setEditingTask(null); setNewTaskTitle(''); setTaskDialogOpen(true); }}
            >
              <div className="space-y-1 py-1">
                {pendingTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded-md px-1 py-1 -mx-1 transition-colors group"
                    onClick={() => { setEditingTask(t); setTaskDialogOpen(true); }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleTaskCompletion(t); }}
                      className="shrink-0"
                    >
                      <div className="h-3.5 w-3.5 rounded-sm border border-muted-foreground/40 group-hover:border-emerald-400 transition-colors" />
                    </button>
                    <span className="flex-1 truncate text-foreground font-medium">{t.title}</span>
                    {t.due_date && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(parseISO(t.due_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => { setEditingTask(null); setNewTaskTitle(''); setTaskDialogOpen(true); }}
                  className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1"
                >
                  + Add task...
                </button>
                {completedTasks.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 w-full"
                    >
                      {showCompletedTasks ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      Show completed tasks ({completedTasks.length})
                    </button>
                    {showCompletedTasks && completedTasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded-md px-1 py-1 -mx-1 transition-colors"
                        onClick={() => { setEditingTask(t); setTaskDialogOpen(true); }}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleTaskCompletion(t); }}
                          className="shrink-0"
                        >
                          <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />
                        </button>
                        <span className="flex-1 truncate line-through text-muted-foreground">{t.title}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </RelatedSection>

            {/* Pipeline Records */}
            <RelatedSection icon={<Layers className="h-3.5 w-3.5" />} label="Pipeline Records" count={1}>
              <div className="text-xs py-1">
                <Badge variant="secondary" className={`text-[11px] ${stageCfg?.bg ?? ''} ${stageCfg?.color ?? ''}`}>
                  {stageCfg?.label ?? lead.status}
                </Badge>
              </div>
            </RelatedSection>

            {/* Companies */}
            <RelatedSection icon={<Building2 className="h-3.5 w-3.5" />} label="Companies" count={lead.company_name ? 1 : 0} onAdd={() => setAddingCompany(true)}>
              <div className="space-y-2 py-1">
                {lead.company_name && (
                  <div className="text-xs text-foreground flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-400 shrink-0">
                      {lead.company_name[0]?.toUpperCase()}
                    </div>
                    {lead.company_name}
                  </div>
                )}
                {!lead.company_name && !addingCompany && (
                  <p className="text-xs text-muted-foreground">No companies</p>
                )}
                {addingCompany ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      autoFocus
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newCompanyName.trim()) handleSaveCompany();
                        if (e.key === 'Escape') { setAddingCompany(false); setNewCompanyName(''); }
                      }}
                      placeholder="Company name..."
                      disabled={savingCompany}
                      className="flex-1 text-xs text-foreground bg-muted border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                    />
                    {savingCompany && <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />}
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingCompany(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1"
                  >
                    + {lead.company_name ? 'Change' : 'Add'} company...
                  </button>
                )}
              </div>
            </RelatedSection>

            {/* Files */}
            <RelatedSection
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Files"
              count={leadFiles.length}
              onAdd={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="space-y-1.5 py-1">
                {leadFiles.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 text-xs p-1.5 rounded-lg hover:bg-muted/40 transition-colors group">
                    <span className="text-sm shrink-0">{getFileIcon(f.file_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{f.file_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatFileSize(f.file_size)} · {formatShortDate(f.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const { data, error } = await supabase.storage
                            .from('lead-files')
                            .createSignedUrl(f.file_url, 60);
                          if (error || !data?.signedUrl) {
                            toast.error('Failed to generate download link');
                            return;
                          }
                          const a = document.createElement('a');
                          a.href = data.signedUrl;
                          a.download = f.file_name;
                          a.target = '_blank';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        className="p-1 rounded hover:bg-muted"
                        title="Download"
                      >
                        <Download className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                      <button
                        onClick={() => handleDeleteFile(f)}
                        className="p-1 rounded hover:bg-muted"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
                {uploadingFile && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                    <Loader2 className="h-3 w-3 animate-spin text-orange-500" />
                    Uploading...
                  </div>
                )}
                {leadFiles.length === 0 && !uploadingFile && (
                  <p className="text-xs text-muted-foreground">No files</p>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1"
                >
                  + Upload file...
                </button>
              </div>
            </RelatedSection>

            {/* Calendar Events */}
            <RelatedSection icon={<CalendarDays className="h-3.5 w-3.5" />} label="Calendar Events" count={leadAppointments.length} onAdd={() => setEventDialogOpen(true)}>
              <div className="space-y-1.5 py-1">
                {leadAppointments.map((evt: any) => {
                  const startDate = evt.start_time ? parseISO(evt.start_time) : null;
                  const isPast = startDate ? startDate < new Date() : false;
                  return (
                    <div key={evt.id} className={`group flex items-start gap-2 text-xs rounded-lg px-1.5 py-1.5 -mx-1 hover:bg-muted/60 transition-colors ${isPast ? 'opacity-60' : ''}`}>
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        evt.appointment_type === 'call' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' :
                        evt.appointment_type === 'video' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600' :
                        'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'
                      }`}>
                        {evt.appointment_type === 'call' ? <Phone className="h-3 w-3" /> :
                         evt.appointment_type === 'video' ? <Eye className="h-3 w-3" /> :
                         <CalendarDays className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{evt.title}</p>
                        {startDate && (
                          <p className="text-[10px] text-muted-foreground">
                            {format(startDate, 'MMM d, yyyy')} · {format(startDate, 'h:mm a')}
                            {evt.end_time && ` – ${format(parseISO(evt.end_time), 'h:mm a')}`}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteEvent(evt.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all mt-0.5"
                        title="Delete event"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                {leadAppointments.length === 0 && (
                  <p className="text-xs text-muted-foreground">No events</p>
                )}
                <button
                  onClick={() => setEventDialogOpen(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1"
                >
                  + Add event...
                </button>
              </div>
            </RelatedSection>

            {/* Projects */}
            <RelatedSection icon={<FolderOpen className="h-3.5 w-3.5" />} label="Projects" count={projects.length} iconColor="text-amber-500" onAdd={() => setShowAddProject(true)}>
              <div className="space-y-1 py-1">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded-md px-1.5 py-1.5 -mx-1 transition-colors group"
                    onClick={() => navigate(`/admin/pipeline/projects/expanded-view/${p.id}`)}
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="flex-1 truncate text-foreground font-medium">{p.name}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-full capitalize shrink-0">
                      {(p.status || 'open').replace(/_/g, ' ')}
                    </Badge>
                  </div>
                ))}
                {projects.length === 0 && !showAddProject && (
                  <p className="text-xs text-muted-foreground py-1">No projects</p>
                )}
                {showAddProject ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newProjectName.trim()) handleInlineCreateProject();
                        if (e.key === 'Escape') { setShowAddProject(false); setNewProjectName(''); }
                      }}
                      placeholder="Add Project"
                      className="flex-1 text-xs bg-transparent border-b-2 border-blue-500 outline-none py-1 placeholder:text-muted-foreground/50"
                      autoFocus
                      disabled={savingProject}
                    />
                    <button onClick={() => { setShowAddProject(false); setNewProjectName(''); }}>
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddProject(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1"
                  >
                    + Add project...
                  </button>
                )}
              </div>
            </RelatedSection>
          </div>
          </ScrollArea>
        </div>
        )}
      </div>

      {/* Task Detail Dialog */}
      {leadId && (
        <PeopleTaskDetailDialog
          task={editingTask}
          open={taskDialogOpen}
          onClose={() => { setTaskDialogOpen(false); setEditingTask(null); }}
          leadId={leadId}
          leadName={lead?.opportunity_name || lead?.name || ''}
          teamMembers={teamMembers}
          currentUserName={teamMember?.name ?? null}
          initialTitle={editingTask ? undefined : newTaskTitle}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['person-tasks', leadId] })}
        />
      )}


      {/* Calendar Event Dialog */}
      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>New Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
              <input
                autoFocus
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Event title..."
                className="w-full text-sm text-foreground bg-muted border border-border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="call">Phone Call</SelectItem>
                  <SelectItem value="video">Video Call</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
              <Popover open={eventDatePickerOpen} onOpenChange={setEventDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left text-sm font-normal">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {eventDate ? format(eventDate, 'MMM d, yyyy') : 'Pick a date...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={eventDate}
                    onSelect={(date) => { setEventDate(date); setEventDatePickerOpen(false); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Time</label>
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full text-sm text-foreground bg-muted border border-border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">End Time</label>
                <input
                  type="time"
                  value={eventEndTime}
                  onChange={(e) => setEventEndTime(e.target.value)}
                  className="w-full text-sm text-foreground bg-muted border border-border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <textarea
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                placeholder="Add details..."
                rows={2}
                className="w-full text-sm text-foreground bg-muted border border-border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEventDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveEvent} disabled={eventSaving || !eventTitle.trim() || !eventDate}>
              {eventSaving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    </>
  );
}
