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
import {
  X, DollarSign, ChevronDown, ChevronRight, ChevronUp,
  Users, Building2, CheckSquare, FileText,
  CalendarDays, FolderOpen, Layers, Plus,
  MessageSquare, Pencil, Activity, Clock, AlertCircle, TrendingUp,
  User, Mail, Phone, PhoneCall, Hash, Tag, Briefcase, Loader2,
  Globe, Linkedin, AtSign, MapPin, Trash2, Flag, Eye, Upload, Download, Send,
} from 'lucide-react';
import { useMemo, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';
import { differenceInDays, parseISO, format } from 'date-fns';
import { extractSenderName, toRenderableHtml } from '@/components/gmail/gmailHelpers';

import {
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
};

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

export default function LenderManagementExpandedView() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activityTab, setActivityTab] = useState<'log' | 'note'>('log');

  // Activity form state
  const [activityType, setActivityType] = useState('todo');
  const [activityNote, setActivityNote] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);

  // Task inline add state
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Contact inline add state (Related sidebar)
  const [addingContact, setAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactTitle, setNewContactTitle] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  // Company inline add state (Related sidebar)
  const [addingCompany, setAddingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  // Milestone inline add state (Related sidebar)
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');
  const [savingMilestone, setSavingMilestone] = useState(false);

  // Activity expand / comments state
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
  const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [savingComment, setSavingComment] = useState<string | null>(null);

  const { teamMember } = useTeamMember();

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
    queryClient.invalidateQueries({ queryKey: ['lm-expanded-lead', leadId] });
    queryClient.invalidateQueries({ queryKey: ['lm-leads'] });
  }, [leadId, queryClient]);

  // ── Field saved handler ──
  const handleFieldSaved = useCallback((_field: string, _newValue: string) => {
    queryClient.invalidateQueries({ queryKey: ['lm-expanded-lead', leadId] });
    queryClient.invalidateQueries({ queryKey: ['lm-leads'] });
    toast.success('Updated');
  }, [leadId, queryClient]);

  const handleBooleanToggle = useCallback(async (field: string, currentVal: boolean) => {
    if (!leadId) return;
    const { error } = await supabase.from('leads').update({ [field]: !currentVal }).eq('id', leadId);
    if (error) { toast.error('Failed to save'); return; }
    queryClient.invalidateQueries({ queryKey: ['lm-expanded-lead', leadId] });
    queryClient.invalidateQueries({ queryKey: ['lm-leads'] });
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
    queryClient.invalidateQueries({ queryKey: ['lm-lead-tasks', leadId] });
  }, [leadId, newTaskTitle, queryClient]);

  // ── Save contact (Related sidebar) ──
  const handleSaveContact = useCallback(async () => {
    if (!leadId || !newContactName.trim()) return;
    setSavingContact(true);
    const { error } = await supabase.from('lead_contacts').insert({
      lead_id: leadId,
      name: newContactName.trim(),
      title: newContactTitle.trim() || null,
    });
    setSavingContact(false);
    if (error) {
      toast.error('Failed to add contact');
      return;
    }
    toast.success('Contact added');
    setNewContactName('');
    setNewContactTitle('');
    setAddingContact(false);
    queryClient.invalidateQueries({ queryKey: ['lm-lead-contacts', leadId] });
  }, [leadId, newContactName, newContactTitle, queryClient]);

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
    queryClient.invalidateQueries({ queryKey: ['lm-expanded-lead', leadId] });
    queryClient.invalidateQueries({ queryKey: ['lm-leads'] });
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
    queryClient.invalidateQueries({ queryKey: ['lm-lead-milestones', leadId] });
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
    queryClient.invalidateQueries({ queryKey: ['lm-lead-milestones', leadId] });
  }, [leadId, queryClient]);

  // ── File upload ──
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !leadId) return;
    e.target.value = '';

    console.log('[FileUpload] Pipeline: starting upload', { name: file.name, size: file.size, type: file.type });

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error('[FileUpload] Pipeline: no active session', sessionError);
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
      console.error('[FileUpload] Pipeline: storage upload error', uploadError);
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
      console.error('[FileUpload] Pipeline: DB insert error', dbError);
      const reason = dbError.message?.includes('row-level security')
        ? 'Permission denied — admin role required'
        : dbError.message || 'Database error';
      toast.error(`Failed to save ${file.name}: ${reason}`);
      await supabase.storage.from('lead-files').remove([filePath]);
      return;
    }
    console.log('[FileUpload] Pipeline: upload success', { filePath });
    toast.success('File uploaded');
    queryClient.invalidateQueries({ queryKey: ['lm-lead-files', leadId] });
  }, [leadId, queryClient]);

  // ── File delete ──
  const handleDeleteFile = useCallback(async (file: LeadFile) => {
    await supabase.storage.from('lead-files').remove([file.file_url]);
    const { error } = await supabase.from('lead_files').delete().eq('id', file.id);
    if (error) {
      toast.error('Failed to delete file');
      return;
    }
    toast.success('File deleted');
    queryClient.invalidateQueries({ queryKey: ['lm-lead-files', leadId] });
  }, [leadId, queryClient]);

  // ── File download (signed URL) ──
  const handleDownloadFile = useCallback(async (file: LeadFile) => {
    const { data, error } = await supabase.storage
      .from('lead-files')
      .createSignedUrl(file.file_url, 60);
    if (error || !data?.signedUrl) {
      toast.error('Failed to generate download link');
      return;
    }
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = file.file_name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  // ── Queries ──
  const { data: lead, isLoading } = useQuery({
    queryKey: ['lm-expanded-lead', leadId],
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
    queryKey: ['lm-lead-interactions', leadId],
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

  const { data: lastContactType = null } = useQuery({
    queryKey: ['lm-lead-last-contact-type', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_communications')
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

  const { data: contacts = [] } = useQuery({
    queryKey: ['lm-lead-contacts', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('lead_contacts').select('*').eq('lead_id', leadId!);
      return data ?? [];
    },
    enabled: !!leadId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['lm-lead-tasks', leadId],
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
    queryKey: ['lm-lead-milestones', leadId],
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

  const { data: leadFiles = [] } = useQuery({
    queryKey: ['lm-lead-files', leadId],
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
    queryKey: ['lm-lead-activities', leadId],
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
      const { data } = await supabase.from('lead_emails').select('*').eq('lead_id', leadId!);
      return (data || []) as LeadEmail[];
    },
    enabled: !!leadId,
  });

  const { data: leadPhones = [] } = useQuery({
    queryKey: ['lm-lead-phones', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('lead_phones').select('*').eq('lead_id', leadId!);
      return (data || []) as LeadPhone[];
    },
    enabled: !!leadId,
  });

  const { data: leadAddresses = [] } = useQuery({
    queryKey: ['lm-lead-addresses', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('lead_addresses').select('*').eq('lead_id', leadId!);
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

  // ── Satellite table mutations ──
  const addEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      if (!leadId) return;
      const { error } = await supabase.from('lead_emails').insert({ lead_id: leadId, email, email_type: newEmailType });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lm-lead-emails', leadId] });
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
      queryClient.invalidateQueries({ queryKey: ['lm-lead-emails', leadId] });
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
      queryClient.invalidateQueries({ queryKey: ['lm-lead-phones', leadId] });
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
      queryClient.invalidateQueries({ queryKey: ['lm-lead-phones', leadId] });
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
      queryClient.invalidateQueries({ queryKey: ['lm-lead-addresses', leadId] });
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
      queryClient.invalidateQueries({ queryKey: ['lm-lead-addresses', leadId] });
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
  const stageCfg = pipelineStageConfig[lead.status];
  const inactiveColor = (inactiveDays ?? 0) > 30 ? 'text-red-600' : 'text-amber-600';
  const ownerOptions = teamMembers.map((m) => ({ value: m.id, label: m.name }));

  function goBack() {
    navigate('/admin/pipeline/lender-management');
  }

  return (
    <div data-full-bleed className="flex flex-col bg-background overflow-hidden h-[calc(100vh-3.5rem)]">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-border px-4 py-2 flex items-center">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={goBack}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── 3-Column Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Details — fully editable */}
        <div className="w-[320px] xl:w-[400px] shrink-0 border-r border-border bg-card overflow-hidden">
        <ScrollArea className="h-full">
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
                      <SelectValue>{stageCfg?.title ?? lead.status}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="min-w-[220px]">
                      {PIPELINE_STATUSES.map((s) => {
                        const cfg = pipelineStageConfig[s];
                        return (
                          <SelectItem key={s} value={s} className="text-[13px]">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full shrink-0 ${cfg?.dot ?? 'bg-muted-foreground'}`} />
                              {cfg?.title ?? s}
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
                <ReadOnlyField icon={<Briefcase className="h-3.5 w-3.5" />} label="Pipeline" value="Pipeline" />
                <ReadOnlyField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Created" value={formatDate(lead.created_at)} />
                <ReadOnlyField icon={<Tag className="h-3.5 w-3.5" />} label="Source" value={lead.source ?? '\u2014'} />
                <ReadOnlyField icon={<Eye className="h-3.5 w-3.5" />} label="Visibility" value="\u2014" />
              </div>
            </div>
          </div>
        </ScrollArea>
        </div>

        {/* CENTER: Activity */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-muted/20">
          {/* Stats Bar */}
          <div className="shrink-0 grid grid-cols-5 gap-3 px-5 py-3.5 border-b border-border bg-card">
            <StatBox
              value={interactionCount}
              label="Interactions"
              icon={<Activity className="h-3.5 w-3.5 text-blue-500" />}
              bg="bg-white dark:bg-slate-900/80"
              border="border-blue-500"
              valueColor="text-blue-700 dark:text-blue-400"
              iconBg="bg-blue-100 dark:bg-blue-900/40"
            />
            <StatBox
              value={lastContacted}
              label="Last Contacted"
              icon={<Clock className="h-3.5 w-3.5 text-slate-400" />}
              bg="bg-white dark:bg-slate-900/80"
              border="border-slate-400"
              valueColor="text-slate-700 dark:text-slate-300"
              iconBg="bg-slate-100 dark:bg-slate-700/40"
            />
            <StatBox
              value={lastContactType ?? '—'}
              label="Last Contact Of"
              icon={<MessageSquare className="h-3.5 w-3.5 text-purple-500" />}
              bg="bg-white dark:bg-slate-900/80"
              border="border-purple-500"
              valueColor="text-purple-700 dark:text-purple-400"
              iconBg="bg-purple-100 dark:bg-purple-900/40"
            />
            <StatBox
              value={inactiveDays ?? '—'}
              label="Inactive Days"
              icon={<AlertCircle className="h-3.5 w-3.5" />}
              bg="bg-white dark:bg-slate-900/80"
              border={(inactiveDays ?? 0) > 30 ? 'border-red-500' : 'border-amber-500'}
              valueColor={(inactiveDays ?? 0) > 30 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}
              iconBg={(inactiveDays ?? 0) > 30 ? 'bg-red-100 dark:bg-red-900/40' : 'bg-amber-100 dark:bg-amber-900/40'}
            />
            <StatBox
              value={daysInStage ?? '—'}
              label="Days in Stage"
              icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
              bg="bg-white dark:bg-slate-900/80"
              border="border-emerald-500"
              valueColor="text-emerald-700 dark:text-emerald-400"
              iconBg="bg-emerald-100 dark:bg-emerald-900/40"
            />
          </div>
          {/* Tabs */}
          <div className="shrink-0 flex items-center justify-center gap-2 border-b border-border px-6 py-2.5 bg-card">
            <button
              className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activityTab === 'log'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              onClick={() => setActivityTab('log')}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Log Activity
            </button>
            <button
              className={`inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activityTab === 'note'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
              onClick={() => setActivityTab('note')}
            >
              <Pencil className="h-3.5 w-3.5" />
              Create Note
            </button>
          </div>

          <ScrollArea className="flex-1">
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

        {/* RIGHT: Related */}
        <div className="w-[220px] xl:w-[260px] shrink-0 border-l border-border bg-card overflow-hidden">
        <ScrollArea className="h-full">
          <div className="py-4 px-1">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block px-3">Related</span>
            {/* People */}
            <RelatedSection icon={<Users className="h-3.5 w-3.5" />} label="People" count={contacts.length} onAdd={() => setAddingContact(true)}>
              <div className="space-y-2 py-1">
                {contacts.map((c) => (
                  <div key={c.id} className="text-xs text-foreground flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-400 shrink-0">
                      {c.name[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium">{c.name}</span>
                    {c.title && <span className="text-muted-foreground">· {c.title}</span>}
                  </div>
                ))}
                {contacts.length === 0 && !addingContact && (
                  <p className="text-xs text-muted-foreground">No contacts</p>
                )}
                {addingContact ? (
                  <div className="space-y-1.5 mt-1">
                    <input
                      autoFocus
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newContactName.trim()) handleSaveContact();
                        if (e.key === 'Escape') { setAddingContact(false); setNewContactName(''); setNewContactTitle(''); }
                      }}
                      placeholder="Name (required)"
                      disabled={savingContact}
                      className="w-full text-xs text-foreground bg-muted border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                    />
                    <input
                      value={newContactTitle}
                      onChange={(e) => setNewContactTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newContactName.trim()) handleSaveContact();
                        if (e.key === 'Escape') { setAddingContact(false); setNewContactName(''); setNewContactTitle(''); }
                      }}
                      placeholder="Title (optional)"
                      disabled={savingContact}
                      className="w-full text-xs text-foreground bg-muted border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                    />
                    {savingContact && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
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

            {/* Milestones */}
            <RelatedSection
              icon={<Flag className="h-3.5 w-3.5" />}
              label="Milestones"
              count={milestones.length}
              onAdd={() => setAddingMilestone(true)}
            >
              <div className="space-y-2 py-1">
                {milestones.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 text-xs cursor-pointer"
                    onClick={() => handleToggleMilestone(m.id, m.completed)}
                  >
                    <CheckSquare className={`h-3.5 w-3.5 shrink-0 ${m.completed ? 'text-emerald-500' : 'text-muted-foreground/50'}`} />
                    <span className={`flex-1 truncate font-medium ${m.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {m.milestone_name}
                    </span>
                  </div>
                ))}
                {milestones.length === 0 && !addingMilestone && (
                  <p className="text-xs text-muted-foreground">No milestones</p>
                )}
                {addingMilestone ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      autoFocus
                      value={newMilestoneName}
                      onChange={(e) => setNewMilestoneName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newMilestoneName.trim()) handleSaveMilestone(milestones.length);
                        if (e.key === 'Escape') { setAddingMilestone(false); setNewMilestoneName(''); }
                      }}
                      placeholder="Milestone name..."
                      disabled={savingMilestone}
                      className="flex-1 text-xs text-foreground bg-muted border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                    />
                    {savingMilestone && <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />}
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingMilestone(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1"
                  >
                    + Add milestone...
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
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadFile(f); }}
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
                  {stageCfg?.title ?? lead.status}
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
