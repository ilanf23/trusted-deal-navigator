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
import { sanitizeFileName } from '@/lib/utils';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ChecklistBuilder, { type ChecklistItem } from './ChecklistBuilder';
import SavedChecklistCard, { type SavedChecklist } from './SavedChecklistCard';
import {
  X, DollarSign, ChevronDown, ChevronRight, ChevronUp,
  Users, Building2, CheckSquare, FileText,
  CalendarDays, FolderOpen, Layers, Plus,
  MessageSquare, Pencil, Activity, Clock, AlertCircle, TrendingUp,
  User, Mail, Phone, PhoneCall, Hash, Tag, Briefcase, Loader2,
  Globe, Linkedin, AtSign, MapPin, Trash2, Flag, Eye, Upload, Download, Send,
} from 'lucide-react';
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';
import { differenceInDays, parseISO, format } from 'date-fns';
import { extractSenderName, toRenderableHtml } from '@/components/gmail/gmailHelpers';

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

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try { return differenceInDays(new Date(), parseISO(dateStr)); } catch { return null; }
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
};

/* ─── Activity Tab Bar (auto-collapses to dropdown when buttons overflow) ─── */
function ActivityTabBar({
  activityTab,
  setActivityTab,
  showChecklist,
}: {
  activityTab: 'log' | 'note' | 'checklist';
  setActivityTab: (tab: 'log' | 'note' | 'checklist') => void;
  showChecklist: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const buttons = buttonsRef.current;
    if (!container || !buttons) return;

    const check = () => {
      // Compare the scroll width of the buttons row against the container width
      setOverflowing(buttons.scrollWidth > container.clientWidth);
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(container);
    return () => ro.disconnect();
  }, [showChecklist]);

  const activeBtn = 'bg-blue-600 text-white shadow-sm shadow-blue-500/25';
  const inactiveBtn = 'text-muted-foreground hover:text-foreground hover:bg-muted/60';

  return (
    <div ref={containerRef} className="shrink-0 border-b border-border px-6 py-2.5 bg-card overflow-hidden">
      {overflowing ? (
        <Select value={activityTab} onValueChange={(v) => setActivityTab(v as 'log' | 'note' | 'checklist')}>
          <SelectTrigger className="h-9 w-full text-xs font-semibold rounded-lg border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="log" className="text-xs">Log Activity</SelectItem>
            <SelectItem value="note" className="text-xs">Create Note</SelectItem>
            {showChecklist && (
              <SelectItem value="checklist" className="text-xs">Checklist</SelectItem>
            )}
          </SelectContent>
        </Select>
      ) : null}
      {/* Always render buttons (hidden when overflowing) so we can measure them */}
      <div
        ref={buttonsRef}
        className={`flex items-center justify-center gap-2 whitespace-nowrap ${overflowing ? 'invisible h-0 overflow-hidden' : ''}`}
      >
        <button
          className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg transition-all ${activityTab === 'log' ? activeBtn : inactiveBtn}`}
          onClick={() => setActivityTab('log')}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Log Activity
        </button>
        <button
          className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg transition-all ${activityTab === 'note' ? activeBtn : inactiveBtn}`}
          onClick={() => setActivityTab('note')}
        >
          <Pencil className="h-3.5 w-3.5" />
          Create Note
        </button>
        {showChecklist && (
          <button
            className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg transition-all ${activityTab === 'checklist' ? activeBtn : inactiveBtn}`}
            onClick={() => setActivityTab('checklist')}
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Checklist
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Stats Card (accent card style) ─── */
function StatBox({ value, label, bg, border, valueColor }: {
  value: string | number;
  label: string;
  bg: string;
  border: string;
  valueColor: string;
}) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-lg px-3.5 py-2.5 border-2 ${bg} ${border} min-w-0 flex-1 shadow-sm overflow-hidden`}>
      <span className={`text-xl font-extrabold tabular-nums leading-tight truncate ${valueColor}`}>{value}</span>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest truncate">{label}</span>
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

  // Task inline add state
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Contact search-to-add state (Related sidebar)
  const [addingContact, setAddingContact] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  // Contact inline edit state (Related sidebar)
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState('');
  const [editContactTitle, setEditContactTitle] = useState('');

  // Activity expand / comments state
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [savingComment, setSavingComment] = useState<string | null>(null);

  const { teamMember } = useTeamMember();

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

  // ── Save task ──
  const handleSaveTask = useCallback(async () => {
    if (!leadId || !newTaskTitle.trim()) return;
    setSavingTask(true);
    const { error } = await supabase.from('evan_tasks').insert({
      lead_id: leadId,
      title: newTaskTitle.trim(),
      status: 'pending',
      priority: 'medium',
    });
    setSavingTask(false);
    if (error) {
      toast.error('Failed to create task');
      return;
    }
    toast.success('Task created');
    setNewTaskTitle('');
    setAddingTask(false);
    queryClient.invalidateQueries({ queryKey: ['lead-tasks', leadId] });
  }, [leadId, newTaskTitle, queryClient]);

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

  const { data: interactionCount = 0 } = useQuery({
    queryKey: ['lead-interactions', leadId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('evan_communications')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', leadId!);
      if (error) return 0;
      return count ?? 0;
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
    queryKey: ['lead-tasks', leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from('evan_tasks')
        .select('id, title, status, priority')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
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
          .from('people')
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
          .from('people')
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
        .from('people')
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
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=list&q=${encodeURIComponent(searchQuery)}&maxResults=50`,
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

  const dealValue = lead.deal_value ?? fakeValue(lead.id);
  const dealValueStr = lead.deal_value != null ? String(lead.deal_value) : '';
  const initial = lead.name[0]?.toUpperCase() ?? '?';
  const assignedName = lead.assigned_to ? (teamMemberMap[lead.assigned_to] ?? '—') : '—';
  const daysInStage = daysSince(lead.updated_at);
  const inactiveDays = daysSince(lead.last_activity_at);
  const lastContacted = formatShortDate(lead.last_activity_at);
  const stageCfg = canonicalStageConfig[lead.status];
  const inactiveColor = (inactiveDays ?? 0) > 30 ? 'text-red-600' : 'text-amber-600';
  const ownerOptions = teamMembers.map((m) => ({ value: m.id, label: m.name }));

  function goBack() {
    navigate(-1);
  }

  return (
    <div data-full-bleed className="flex flex-col bg-background h-[calc(100vh-3.5rem)] md:overflow-hidden overflow-y-auto">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-border px-4 py-2 flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={goBack}>
          <X className="h-4 w-4" />
        </Button>
        <DropdownMenu open={addMenuOpen} onOpenChange={setAddMenuOpen} modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 gap-1.5 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
              onMouseEnter={openAddMenu}
              onMouseLeave={closeAddMenu}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onMouseEnter={openAddMenu} onMouseLeave={closeAddMenu}>
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
              <CheckSquare className="h-4 w-4 mr-2" />
              Add a Checklist
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── 3-Column Body ── */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 md:overflow-hidden">

        {/* LEFT: Details — fully editable */}
        <div className="w-full md:w-[400px] shrink-0 md:border-r border-b md:border-b-0 border-border bg-card md:overflow-y-hidden overflow-y-visible">
        <ScrollArea className="md:h-full">
          <div className="px-6 py-6 space-y-6">

            {/* Primary Contact + Value */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Primary Contact</span>
              <div className="rounded-2xl bg-gradient-to-b from-card to-muted/20 dark:to-muted/10 border border-border/60 shadow-sm p-5">
                <div className="flex items-start gap-3.5">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-white">{initial}</span>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-base font-bold tracking-tight text-foreground truncate">{lead.name}</p>
                    {lead.company_name && (
                      <p className="text-[13px] text-muted-foreground truncate">{lead.company_name}</p>
                    )}
                    <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums">{formatValue(dealValue)}</p>
                    <div className="flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 w-fit">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Opportunity</span>
                    </div>
                  </div>
                </div>
                <Separator className="!my-4 opacity-50" />
                <div className="space-y-1">
                  {lead.phone ? (
                    <button
                      onClick={() => navigate(`/admin/calls?phone=${encodeURIComponent(lead.phone!.replace(/\D/g, ''))}&leadId=${lead.id}`)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors group cursor-pointer w-full"
                    >
                      <Phone className="h-3.5 w-3.5 text-muted-foreground group-hover:text-green-600 shrink-0" />
                      <span className="text-[13px] text-foreground font-medium truncate flex-1 text-left">{formatPhoneNumber(lead.phone)}</span>
                      <PhoneCall className="h-3.5 w-3.5 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  ) : (
                    <EditableContactRow icon={<Phone className="h-3.5 w-3.5" />} value="" field="phone" leadId={lead.id} placeholder="Add phone..." onSaved={handleFieldSaved} />
                  )}
                  {lead.email ? (
                    <button
                      onClick={() => navigate(`/admin/gmail?compose=new&to=${encodeURIComponent(lead.email!)}`)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group cursor-pointer w-full"
                    >
                      <Mail className="h-3.5 w-3.5 text-muted-foreground group-hover:text-blue-600 shrink-0" />
                      <span className="text-[13px] text-foreground font-medium truncate flex-1 text-left">{lead.email}</span>
                      <Send className="h-3.5 w-3.5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  ) : (
                    <EditableContactRow icon={<Mail className="h-3.5 w-3.5" />} value="" field="email" leadId={lead.id} placeholder="Add email..." onSaved={handleFieldSaved} />
                  )}
                </div>
              </div>
            </div>

            {/* Deal Info (editable — white box) */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Deal Info</span>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-card">
                <div className="px-3 py-2 space-y-1.5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium text-muted-foreground">Stage</span>
                  </div>
                  <Select value={lead.status} onValueChange={(v) => handleStageChange(v as LeadStatus)}>
                    <SelectTrigger className={`h-8 w-full text-[13px] rounded-lg ${stageCfg?.bg ?? 'bg-muted'} ${stageCfg?.color ?? 'text-foreground'} border-border shadow-none px-2.5 gap-1`}>
                      <SelectValue>{stageCfg?.label ?? lead.status}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="min-w-[220px]">
                      {UNDERWRITING_STATUSES.map((s) => {
                        const cfg = canonicalStageConfig[s];
                        return (
                          <SelectItem key={s} value={s} className="text-[13px]">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full shrink-0 ${cfg?.dot ?? 'bg-muted-foreground'}`} />
                              {cfg?.label ?? s}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <EditableField icon={<FolderOpen className="h-3.5 w-3.5" />} label="CLX File Name" value={lead.clx_file_name ?? ''} field="clx_file_name" leadId={lead.id} onSaved={handleFieldSaved} />
                <EditableField icon={<Clock className="h-3.5 w-3.5" />} label="Waiting On" value={lead.waiting_on ?? ''} field="waiting_on" leadId={lead.id} onSaved={handleFieldSaved} />
              </div>
            </div>

            {/* Tags */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Tags</span>
              <EditableTags tags={lead.tags ?? []} leadId={lead.id} onSaved={handleFieldSaved} />
            </div>

            {/* Description */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Description</span>
              <EditableNotesField value={lead.description ?? ''} field="description" leadId={lead.id} placeholder={"Deal referred by ____\nLoan Amount $____M\nAdditional deal/collateral details..."} onSaved={handleFieldSaved} />
            </div>

            {/* Details (editable — white box) */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Details</span>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-card">
                <EditableField icon={<Building2 className="h-3.5 w-3.5" />} label="Company" value={lead.company_name ?? ''} field="company_name" leadId={lead.id} onSaved={handleFieldSaved} />
                {ownerOptions.length > 0 ? (
                  <EditableSelectField
                    icon={<User className="h-3.5 w-3.5" />}
                    label="Owner"
                    value={lead.assigned_to ?? ''}
                    displayValue={assignedName}
                    field="assigned_to"
                    leadId={lead.id}
                    options={ownerOptions}
                    onSaved={handleFieldSaved}
                  />
                ) : (
                  <EditableField icon={<User className="h-3.5 w-3.5" />} label="Owner" value={assignedName} field="assigned_to" leadId={lead.id} onSaved={handleFieldSaved} />
                )}
                <EditableField icon={<Briefcase className="h-3.5 w-3.5" />} label="Opportunity Name" value={lead.opportunity_name ?? ''} field="opportunity_name" leadId={lead.id} onSaved={handleFieldSaved} />
                <EditableSelectField
                  icon={<Users className="h-3.5 w-3.5" />}
                  label="Contact Type"
                  value={lead.contact_type ?? ''}
                  displayValue={CONTACT_TYPE_OPTIONS.find(o => o.value === lead.contact_type)?.label ?? lead.contact_type ?? '\u2014'}
                  field="contact_type"
                  leadId={lead.id}
                  options={CONTACT_TYPE_OPTIONS}
                  onSaved={handleFieldSaved}
                />
                <EditableField icon={<User className="h-3.5 w-3.5" />} label="Known As" value={lead.known_as ?? ''} field="known_as" leadId={lead.id} onSaved={handleFieldSaved} />
              </div>
            </div>

            {/* Email */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Email</span>
              <div className="space-y-1">
                {leadEmails.map((e) => (
                  <ContactEmailRow key={e.id} entry={e} onDelete={(id) => deleteEmailMutation.mutate(id)} />
                ))}
                {showAddEmail ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50/50 border border-blue-100">
                    <AtSign className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <Select value={newEmailType} onValueChange={setNewEmailType}>
                      <SelectTrigger className="h-7 w-[80px] text-xs border-transparent bg-transparent shadow-none px-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="work" className="text-xs">Work</SelectItem>
                        <SelectItem value="personal" className="text-xs">Personal</SelectItem>
                      </SelectContent>
                    </Select>
                    <input autoFocus value={newEmail} onChange={(e) => setNewEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newEmail.trim()) addEmailMutation.mutate(newEmail.trim()); if (e.key === 'Escape') { setShowAddEmail(false); setNewEmail(''); } }} placeholder="email@example.com" className="flex-1 text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50" />
                  </div>
                ) : (
                  <button onClick={() => setShowAddEmail(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-3 py-1">+ Add Email</button>
                )}
              </div>
            </div>

            {/* Phone */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Phone</span>
              <div className="space-y-1">
                {leadPhones.map((p) => (
                  <ContactPhoneRow key={p.id} entry={p} onDelete={(id) => deletePhoneMutation.mutate(id)} onCall={(phone) => navigate(`/admin/calls?phone=${encodeURIComponent(phone.replace(/\D/g, ''))}&leadId=${lead.id}`)} />
                ))}
                {showAddPhone ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50/50 border border-blue-100">
                    <Phone className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <Select value={newPhoneType} onValueChange={setNewPhoneType}>
                      <SelectTrigger className="h-7 w-[80px] text-xs border-transparent bg-transparent shadow-none px-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="work" className="text-xs">Work</SelectItem>
                        <SelectItem value="personal" className="text-xs">Personal</SelectItem>
                        <SelectItem value="mobile" className="text-xs">Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                    <input autoFocus value={newPhone} onChange={(e) => setNewPhone(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newPhone.trim()) addPhoneMutation.mutate(newPhone.trim()); if (e.key === 'Escape') { setShowAddPhone(false); setNewPhone(''); } }} placeholder="(555) 123-4567" className="flex-1 text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50" />
                  </div>
                ) : (
                  <button onClick={() => setShowAddPhone(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-3 py-1">+ Add Phone</button>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Address</span>
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
                  <button onClick={() => setShowAddAddress(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-3 py-1">+ Add Address</button>
                )}
              </div>
            </div>

            {/* About */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">About</span>
              <EditableNotesField value={lead.about ?? ''} field="about" leadId={lead.id} placeholder="Details from initial contact..." onSaved={handleFieldSaved} />
            </div>

            {/* History */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">History</span>
              <EditableNotesField value={lead.history ?? ''} field="history" leadId={lead.id} placeholder="Old CRM carryover info..." onSaved={handleFieldSaved} />
            </div>

            {/* Bank Relationships */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Bank Relationships</span>
              <EditableNotesField value={lead.bank_relationships ?? ''} field="bank_relationships" leadId={lead.id} placeholder="Excluded lender names from CLX agreement..." onSaved={handleFieldSaved} />
            </div>

            {/* #UW */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">#UW</span>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                <EditableField icon={<Hash className="h-3.5 w-3.5" />} label="UW Number" value={lead.uw_number ?? ''} field="uw_number" leadId={lead.id} onSaved={handleFieldSaved} />
              </div>
            </div>

            {/* Client Working with Other Lenders */}
            <div onClick={() => handleBooleanToggle('client_other_lenders', lead.client_other_lenders)} className="flex items-center justify-between px-4 py-3.5 rounded-lg border border-border hover:bg-muted/40 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Client Working with Other Lenders</span>
              </div>
              <div className={`h-5 w-9 rounded-full transition-colors relative ${lead.client_other_lenders ? 'bg-blue-500' : 'bg-muted-foreground/30'}`}>
                <div className={`h-4 w-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${lead.client_other_lenders ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </div>

            {/* Weekly's */}
            <div onClick={() => handleBooleanToggle('flagged_for_weekly', lead.flagged_for_weekly)} className="flex items-center justify-between px-4 py-3.5 rounded-lg border border-border hover:bg-muted/40 transition-colors cursor-pointer">
              <div className="flex items-center gap-2">
                <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Weekly's</span>
              </div>
              <div className={`h-5 w-9 rounded-full transition-colors relative ${lead.flagged_for_weekly ? 'bg-blue-500' : 'bg-muted-foreground/30'}`}>
                <div className={`h-4 w-4 rounded-full bg-white shadow-sm absolute top-0.5 transition-transform ${lead.flagged_for_weekly ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Notes</span>
              <EditableNotes value={lead.notes ?? ''} leadId={lead.id} onSaved={handleFieldSaved} />
            </div>

            {/* Fixed (read-only info) */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Fixed</span>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-muted/50">
                <ReadOnlyField icon={<Briefcase className="h-3.5 w-3.5" />} label="Pipeline" value="Underwriting" />
                <ReadOnlyField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Created" value={formatDate(lead.created_at)} />
                <ReadOnlyField icon={<Tag className="h-3.5 w-3.5" />} label="Source" value={lead.source ?? '\u2014'} />
                <ReadOnlyField icon={<Eye className="h-3.5 w-3.5" />} label="Visibility" value="\u2014" />
              </div>
            </div>
          </div>
        </ScrollArea>
        </div>

        {/* CENTER: Activity */}
        <div className="flex-1 flex flex-col min-w-0 bg-muted/20">
          {/* Stats Bar */}
          <div className="shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-3.5 border-b border-border bg-card overflow-hidden">
            <StatBox
              value={interactionCount}
              label="Interactions"
              bg="bg-white dark:bg-slate-900/80"
              border="border-blue-500"
              valueColor="text-blue-700 dark:text-blue-400"
            />
            <StatBox
              value={lastContacted}
              label="Last Contacted"
              bg="bg-white dark:bg-slate-900/80"
              border="border-slate-400"
              valueColor="text-slate-700 dark:text-slate-300"
            />
            <StatBox
              value={inactiveDays ?? '—'}
              label="Inactive Days"
              bg="bg-white dark:bg-slate-900/80"
              border={(inactiveDays ?? 0) > 30 ? 'border-red-500' : 'border-amber-500'}
              valueColor={(inactiveDays ?? 0) > 30 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}
            />
            <StatBox
              value={daysInStage ?? '—'}
              label="Days in Stage"
              bg="bg-white dark:bg-slate-900/80"
              border="border-emerald-500"
              valueColor="text-emerald-700 dark:text-emerald-400"
            />
          </div>
          {/* Tabs — buttons when they fit, dropdown when they overflow */}
          <ActivityTabBar
            activityTab={activityTab}
            setActivityTab={setActivityTab}
            showChecklist={checklistTabVisible || savedChecklists.length > 0}
          />

          <ScrollArea className="md:flex-1">
            <div className="px-6 py-5">
              {activityTab === 'log' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Select value={activityType} onValueChange={setActivityType}>
                      <SelectTrigger className="h-8 w-[120px] text-xs rounded-lg border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo" className="text-xs">To Do</SelectItem>
                        <SelectItem value="call" className="text-xs">Call</SelectItem>
                        <SelectItem value="email" className="text-xs">Email</SelectItem>
                        <SelectItem value="meeting" className="text-xs">Meeting</SelectItem>
                      </SelectContent>
                    </Select>
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

        {/* RIGHT: Related */}
        <div className="w-full md:w-[260px] shrink-0 md:border-l border-t md:border-t-0 border-border bg-card flex flex-col">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Related</span>
          </div>
          <ScrollArea className="md:flex-1">
          <div className="py-4 px-1">
            {/* People */}
            <RelatedSection icon={<Users className="h-3.5 w-3.5" />} label="People" count={contacts.length + relatedPeople.filter(rp => !contacts.some(c => c.name.toLowerCase() === rp.name.toLowerCase())).length} onAdd={() => setAddingContact(true)}>
              <div className="space-y-2 py-1">
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
                    <div key={c.id} className="text-xs text-foreground flex items-center gap-2 group cursor-pointer" onClick={() => handleStartEditContact(c)}>
                      <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 shrink-0">
                        {c.name[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium">{c.name}</span>
                      {c.title && <span className="text-muted-foreground">· {c.title}</span>}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteContactMutation.mutate(c.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                      </button>
                    </div>
                  )
                ))}
                {contacts.length === 0 && !addingContact && relatedPeople.length === 0 && (
                  <p className="text-xs text-muted-foreground">No contacts</p>
                )}
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
                {/* Related people from people table */}
                {relatedPeople.filter(rp => !contacts.some(c => c.name.toLowerCase() === rp.name.toLowerCase())).length > 0 && (
                  <>
                    <div className="border-t border-border mt-2 pt-2">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Related</span>
                    </div>
                    {relatedPeople
                      .filter(rp => !contacts.some(c => c.name.toLowerCase() === rp.name.toLowerCase()))
                      .map((rp) => (
                        <div key={rp.id} className="text-xs text-foreground flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-400 shrink-0">
                            {rp.name[0]?.toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="font-medium truncate">{rp.name}</span>
                              {rp.title && <span className="text-muted-foreground truncate">· {rp.title}</span>}
                            </div>
                            {rp.company_name && (
                              <span className="text-[10px] text-muted-foreground/70 truncate">{rp.company_name}</span>
                            )}
                          </div>
                        </div>
                      ))}
                  </>
                )}
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

            {/* Tasks */}
            <RelatedSection
              icon={<CheckSquare className="h-3.5 w-3.5" />}
              label="Tasks"
              count={tasks.filter(t => t.status !== 'completed' && t.status !== 'done').length}
              onAdd={() => setAddingTask(true)}
            >
              <div className="space-y-2 py-1">
                {tasks.filter(t => t.status !== 'completed' && t.status !== 'done').map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-xs">
                    <CheckSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    <span className="flex-1 truncate text-foreground font-medium">{t.title}</span>
                    {t.priority && (
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 rounded-full ${
                        t.priority === 'high' ? 'border-red-200 text-red-600 bg-red-50' :
                        t.priority === 'medium' ? 'border-amber-200 text-amber-600 bg-amber-50' :
                        'border-border text-muted-foreground'
                      }`}>
                        {t.priority}
                      </Badge>
                    )}
                  </div>
                ))}
                {addingTask ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      autoFocus
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newTaskTitle.trim()) handleSaveTask();
                        if (e.key === 'Escape') { setAddingTask(false); setNewTaskTitle(''); }
                      }}
                      placeholder="Task title..."
                      disabled={savingTask}
                      className="flex-1 text-xs text-foreground bg-muted border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                    />
                    {savingTask && <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />}
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingTask(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1"
                  >
                    + Add task...
                  </button>
                )}
                {/* Show completed tasks toggle */}
                {(() => {
                  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'done');
                  if (completedTasks.length === 0) return null;
                  return (
                    <>
                      <button
                        onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 w-full"
                      >
                        {showCompletedTasks ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Show completed tasks ({completedTasks.length})
                      </button>
                      {showCompletedTasks && completedTasks.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 text-xs">
                          <CheckSquare className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="flex-1 truncate line-through text-muted-foreground">{t.title}</span>
                        </div>
                      ))}
                    </>
                  );
                })()}
                {/* View in List link */}
                {tasks.length > 0 && (
                  <button
                    onClick={() => toast.info('View in List coming soon')}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1 flex items-center gap-1"
                  >
                    <Layers className="h-3 w-3" /> View in List
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
            <RelatedSection icon={<CalendarDays className="h-3.5 w-3.5" />} label="Calendar Events" count={0}>
              <p className="text-xs text-muted-foreground py-1">No events</p>
            </RelatedSection>

            {/* Projects */}
            <RelatedSection icon={<FolderOpen className="h-3.5 w-3.5" />} label="Projects" count={0}>
              <p className="text-xs text-muted-foreground py-1">No projects</p>
            </RelatedSection>

            {/* Pipeline Records */}
            <RelatedSection icon={<Layers className="h-3.5 w-3.5" />} label="Pipeline Records" count={1}>
              <div className="text-xs py-1">
                <Badge variant="secondary" className={`text-[11px] ${stageCfg?.bg ?? ''} ${stageCfg?.color ?? ''}`}>
                  {stageCfg?.label ?? lead.status}
                </Badge>
              </div>
            </RelatedSection>
          </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
