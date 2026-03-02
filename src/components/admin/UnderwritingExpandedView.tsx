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
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  X, DollarSign, ChevronDown, ChevronRight,
  Users, Building2, CheckSquare, FileText,
  CalendarDays, FolderOpen, Layers, Plus,
  MessageSquare, Pencil, Activity, Clock, AlertCircle, TrendingUp,
  User, Mail, Phone, PhoneCall, Hash, Tag, Briefcase, Loader2,
  Globe, Linkedin, AtSign, MapPin, Trash2, Flag, Eye, Upload, Download,
} from 'lucide-react';
import { useMemo, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { differenceInDays, parseISO, format } from 'date-fns';

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
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/40 transition-colors group">
      <AtSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full capitalize shrink-0">
        {entry.email_type}
      </Badge>
      <span className="text-[13px] text-foreground font-medium truncate flex-1">{entry.email}</span>
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
    queryClient.invalidateQueries({ queryKey: ['lead-contacts', leadId] });
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

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File must be under 10MB');
      return;
    }

    setUploadingFile(true);
    const filePath = `${leadId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('lead-files')
      .upload(filePath, file, { contentType: file.type });

    if (uploadError) {
      setUploadingFile(false);
      toast.error('Failed to upload file');
      return;
    }

    const { data: urlData } = supabase.storage.from('lead-files').getPublicUrl(filePath);
    const fileUrl = urlData?.publicUrl || filePath;

    const { error: dbError } = await supabase.from('lead_files' as any).insert({
      lead_id: leadId,
      file_name: file.name,
      file_url: fileUrl,
      file_type: file.type || null,
      file_size: file.size,
    });

    setUploadingFile(false);
    if (dbError) {
      toast.error('File uploaded but failed to save record');
      return;
    }
    toast.success('File uploaded');
    queryClient.invalidateQueries({ queryKey: ['lead-files', leadId] });
  }, [leadId, queryClient]);

  // ── File delete ──
  const handleDeleteFile = useCallback(async (file: LeadFile) => {
    // Extract storage path from URL
    const urlParts = file.file_url.split('/lead-files/');
    const storagePath = urlParts.length > 1 ? decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]) : null;

    if (storagePath) {
      await supabase.storage.from('lead-files').remove([storagePath]);
    }

    const { error } = await supabase.from('lead_files' as any).delete().eq('id', file.id);
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
        .from('lead_files' as any)
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

  // ── Satellite table queries ──
  const { data: leadEmails = [] } = useQuery({
    queryKey: ['lead-emails', leadId],
    queryFn: async () => {
      const { data } = await supabase.from('lead_emails').select('*').eq('lead_id', leadId!);
      return (data || []) as LeadEmail[];
    },
    enabled: !!leadId,
  });

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
    <div data-full-bleed className="flex flex-col bg-background overflow-hidden h-[calc(100vh-3.5rem)]">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-border px-6 py-4 bg-gradient-to-r from-muted/50 to-blue-50/20 dark:to-blue-950/20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={goBack}>
            <X className="h-4 w-4" />
          </Button>
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-foreground truncate">{lead.name}</h1>
            {lead.company_name && (
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                {lead.company_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-800">
              <DollarSign className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Opportunity</span>
            </div>
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">{formatValue(dealValue)}</span>
          </div>
        </div>
      </div>

      {/* ── 3-Column Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT: Details — fully editable */}
        <ScrollArea className="w-[400px] shrink-0 border-r border-border bg-card">
          <div className="px-6 py-6 space-y-6">

            {/* Primary Contact */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Primary Contact</span>
              <div className="rounded-xl border border-border p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{lead.name}</p>
                    {lead.title && <p className="text-xs text-muted-foreground truncate">{lead.title}</p>}
                  </div>
                </div>
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
                  <EditableContactRow icon={<Mail className="h-3.5 w-3.5" />} value={lead.email ?? ''} field="email" leadId={lead.id} placeholder="Add email..." onSaved={handleFieldSaved} />
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

            {/* Value */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Value</span>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-card">
                <EditableField icon={<DollarSign className="h-3.5 w-3.5" />} label="Value" value={dealValueStr} field="deal_value" leadId={lead.id} onSaved={handleFieldSaved} highlight transform={(v) => { const n = parseFloat(v.replace(/[^0-9.]/g, '')); return isNaN(n) ? null : n; }} />
              </div>
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

        {/* CENTER: Activity */}
        <div className="flex-1 flex flex-col min-w-0 bg-muted/20">
          {/* Stats Bar */}
          <div className="shrink-0 grid grid-cols-4 gap-3 px-5 py-3.5 border-b border-border bg-card">
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
          <div className="shrink-0 flex items-center gap-0 border-b border-border px-6 bg-card">
            <button
              className={`px-4 py-3 text-xs font-semibold transition-colors relative ${
                activityTab === 'log'
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActivityTab('log')}
            >
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Log Activity
              </span>
              {activityTab === 'log' && (
                <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-blue-600" />
              )}
            </button>
            <button
              className={`px-4 py-3 text-xs font-semibold transition-colors relative ${
                activityTab === 'note'
                  ? 'text-blue-700 dark:text-blue-400'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActivityTab('note')}
            >
              <span className="inline-flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                Create Note
              </span>
              {activityTab === 'note' && (
                <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-blue-600" />
              )}
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

              {/* Earlier — Activity History */}
              <Separator className="my-6" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Earlier</h3>
              <div className="space-y-3">
                {activities.length > 0 ? (
                  activities.map((act) => {
                    const typeInfo = ACTIVITY_TYPE_ICONS[act.activity_type] ?? ACTIVITY_TYPE_ICONS.note;
                    const IconComp = typeInfo.icon;
                    return (
                      <div key={act.id} className="flex gap-3 p-3 rounded-xl bg-card border border-border hover:border-border transition-colors">
                        <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 ${typeInfo.color}`}>
                          <IconComp className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-foreground">{act.title || act.activity_type}</span>
                            <span className="text-[10px] text-muted-foreground">{formatShortDate(act.created_at)}</span>
                          </div>
                          {act.content && (
                            <div className="text-xs text-muted-foreground line-clamp-3">
                              <HtmlContent value={act.content} className="text-xs text-muted-foreground" />
                            </div>
                          )}
                        </div>
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
        <ScrollArea className="w-[260px] shrink-0 border-l border-border bg-card">
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
                      <a
                        href={f.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded hover:bg-muted"
                        title="Download"
                      >
                        <Download className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </a>
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
  );
}
