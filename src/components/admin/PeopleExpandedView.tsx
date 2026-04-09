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
import { sanitizeFileName } from '@/lib/utils';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressAutocompleteInput, type ParsedAddress } from '@/components/ui/address-autocomplete';
import {
  ArrowLeft, ChevronDown, ChevronRight, ChevronUp,
  Users, Building2, CheckSquare, FileText,
  CalendarDays, Layers, Plus,
  MessageSquare, Pencil, Activity, Clock, AlertCircle,
  User, Mail, Phone, PhoneCall, Tag, Briefcase, Loader2,
  Linkedin, Check, Upload, Download, Trash2, FolderOpen, AtSign, MapPin, Send, X, Copy, Globe, Eye,
} from 'lucide-react';
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import { useUndo } from '@/contexts/UndoContext';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { CrmAvatar } from '@/components/admin/CrmAvatar';
import AdminTopBarSearch from '@/components/admin/AdminTopBarSearch';
import { AvatarUpload } from '@/components/admin/AvatarUpload';
import { useGmailConnection } from '@/hooks/useGmailConnection';
// usePipelines import removed — people are no longer connected to pipelines
import { PeopleTaskDetailDialog, type LeadTask } from './PeopleTaskDetailDialog';
import { type LeadProject } from './ProjectDetailDialog';
import { differenceInDays, parseISO, format } from 'date-fns';
import { formatPhoneNumber } from './InlineEditableFields';

interface PersonFile {
  id: string;
  entity_id: string;
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
  if (!fileType) return '\u{1F4C4}';
  if (fileType.startsWith('image/')) return '\u{1F5BC}\uFE0F';
  if (fileType === 'application/pdf') return '\u{1F4D5}';
  if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('csv')) return '\u{1F4CA}';
  if (fileType.includes('word') || fileType.includes('document')) return '\u{1F4DD}';
  if (fileType.includes('zip') || fileType.includes('compressed')) return '\u{1F4E6}';
  return '\u{1F4C4}';
}

// ── Person type ──
interface Person {
  id: string;
  name: string;
  title: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  contact_type: string | null;
  tags: string[] | null;
  assigned_to: string | null;
  notes: string | null;
  linkedin: string | null;
  source: string | null;
  last_activity_at: string | null;
  known_as: string | null;
  clx_file_name: string | null;
  bank_relationships: string | null;
  website: string | null;
  work_website: string | null;
  twitter: string | null;
  visibility: string | null;
  last_contacted: string | null;
  history: string | null;
  description: string | null;
  about: string | null;
  deal_value: number | null;
  loan_amount: number | null;
  status: string | null;
  next_action: string | null;
  opportunity_name: string | null;
  waiting_on: string | null;
  uw_number: string | null;
  cohort_year: number | null;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

interface PersonEmail {
  id: string;
  entity_id: string;
  email: string;
  email_type: string;
  is_primary: boolean;
}

interface PersonPhone {
  id: string;
  entity_id: string;
  phone_number: string;
  phone_type: string;
  is_primary: boolean;
}

interface PersonAddress {
  id: string;
  entity_id: string;
  address_type: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  is_primary: boolean;
}

// ── Contact type config ──
const DEFAULT_CONTACT_TYPES = [
  'Potential Customer', 'Current Customer', 'Referral Source',
  'Bank Relationship', 'Attorney', 'Other',
];

const COLOR_OPTIONS = [
  { name: 'blue', dot: 'bg-blue-500', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800', pill: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  { name: 'emerald', dot: 'bg-emerald-500', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800', pill: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' },
  { name: 'violet', dot: 'bg-violet-500', color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800', pill: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' },
  { name: 'amber', dot: 'bg-amber-500', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800', pill: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  { name: 'rose', dot: 'bg-rose-500', color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800', pill: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300' },
  { name: 'cyan', dot: 'bg-cyan-500', color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800', pill: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300' },
  { name: 'orange', dot: 'bg-orange-500', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800', pill: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' },
  { name: 'pink', dot: 'bg-pink-500', color: 'text-pink-700 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-950/50 border-pink-200 dark:border-pink-800', pill: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300' },
  { name: 'slate', dot: 'bg-slate-500', color: 'text-slate-700 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800', pill: 'bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300' },
];

interface CustomContactType { label: string; colorName: string; }

const CUSTOM_TYPES_KEY = 'clx-custom-contact-types';

function loadCustomContactTypes(): CustomContactType[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TYPES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomContactTypes(types: CustomContactType[]) {
  localStorage.setItem(CUSTOM_TYPES_KEY, JSON.stringify(types));
}

function buildContactTypeConfig(customTypes: CustomContactType[]) {
  const config = { ...contactTypeConfig };
  for (const ct of customTypes) {
    const colorOpt = COLOR_OPTIONS.find(c => c.name === ct.colorName) ?? COLOR_OPTIONS[0];
    config[ct.label] = {
      label: ct.label,
      color: colorOpt.color,
      bg: colorOpt.bg,
      dot: colorOpt.dot,
      pill: colorOpt.pill,
    };
  }
  return config;
}

function getAllContactTypes(customTypes: CustomContactType[]): string[] {
  return [...DEFAULT_CONTACT_TYPES, ...customTypes.map(ct => ct.label)];
}

const SOURCE_OPTIONS = [
  'Cold Call', 'Cold Outreach', 'Conference', 'Direct Mail',
  'Email Campaign', 'Existing Client', 'Gmail', 'LinkedIn',
  'Partner', 'Partner Referral', 'Partner Referral - Adam',
  'Partner Referral - Brad', 'Rate Watch Import', 'Referral',
  'Referral - Attorney', 'Referral - Broker', 'Referral - CPA',
  'Referral - Wealth Advisor', 'Website', 'Website Inquiry',
];

const contactTypeConfig: Record<string, { label: string; color: string; bg: string; dot: string; pill: string }> = {
  'Potential Customer': {
    label: 'Potential Customer',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
    pill: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
  },
  'Current Customer': {
    label: 'Current Customer',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
  },
  'Referral Source': {
    label: 'Referral Source',
    color: 'text-violet-700 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800',
    dot: 'bg-violet-500',
    pill: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300',
  },
  'Bank Relationship': {
    label: 'Bank Relationship',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
    pill: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  },
  Attorney: {
    label: 'Attorney',
    color: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-500',
    pill: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300',
  },
  Other: {
    label: 'Other',
    color: 'text-slate-700 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800',
    dot: 'bg-slate-500',
    pill: 'bg-slate-100 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300',
  },
  // Legacy types (for existing data display)
  Client: { label: 'Client', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-500', pill: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300' },
  Prospect: { label: 'Prospect', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800', dot: 'bg-blue-500', pill: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' },
  'Referral Partner': { label: 'Referral Partner', color: 'text-violet-700 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800', dot: 'bg-violet-500', pill: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' },
  Lender: { label: 'Lender', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800', dot: 'bg-amber-500', pill: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' },
  CPA: { label: 'CPA', color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800', dot: 'bg-cyan-500', pill: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300' },
  Vendor: { label: 'Vendor', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800', dot: 'bg-orange-500', pill: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300' },
};

// ── Helpers ──

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try { return differenceInDays(new Date(), parseISO(dateStr)); } catch { return null; }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  try { return format(parseISO(dateStr), 'MMM d, yyyy'); } catch { return '\u2014'; }
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  try { return format(parseISO(dateStr), 'M/d/yyyy'); } catch { return '\u2014'; }
}

// getPipelineLeadRoute removed — people are no longer connected to pipelines

const ACTIVITY_TYPE_ICONS: Record<string, { icon: typeof Activity; color: string }> = {
  call: { icon: Phone, color: 'text-blue-500' },
  email: { icon: Mail, color: 'text-emerald-500' },
  meeting: { icon: Users, color: 'text-blue-500' },
  note: { icon: Pencil, color: 'text-amber-500' },
  todo: { icon: CheckSquare, color: 'text-muted-foreground' },
  type_change: { icon: Layers, color: 'text-violet-500' },
};

// ── Available extra fields for "Add new field" ──
const EXTRA_FIELD_OPTIONS: { field: string; label: string }[] = [
  { field: 'about', label: 'About' },
  { field: 'opportunity_name', label: 'Opportunity Name' },
  { field: 'deal_value', label: 'Deal Value' },
  { field: 'next_action', label: 'Next Action' },
  { field: 'waiting_on', label: 'Waiting On' },
  { field: 'uw_number', label: 'UW Number' },
  { field: 'cohort_year', label: 'Cohort Year' },
];

// ── Inline-save helper (for people table) ──
function useInlineSave(
  personId: string,
  field: string,
  currentValue: string,
  onSaved: (field: string, newValue: string) => void,
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);
  const [saving, setSaving] = useState(false);
  const { registerUndo } = useUndo();

  useEffect(() => {
    if (editing) setDraft(currentValue);
  }, [editing, currentValue]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === currentValue) {
      setEditing(false);
      return;
    }
    const previousValue = currentValue;
    setSaving(true);
    const { error } = await supabase
      .from('people')
      .update({ [field]: trimmed || null })
      .eq('id', personId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    registerUndo({
      label: `Updated ${field}`,
      execute: async () => {
        const { error: e } = await supabase.from('people').update({ [field]: previousValue || null }).eq('id', personId);
        if (e) throw e;
        onSaved(field, previousValue);
      },
    });
    onSaved(field, trimmed);
    setEditing(false);
  }, [draft, currentValue, field, personId, onSaved, registerUndo]);

  const cancel = useCallback(() => {
    setDraft(currentValue);
    setEditing(false);
  }, [currentValue]);

  return { editing, setEditing, draft, setDraft, saving, save, cancel };
}

// ── Editable field row ──
function EditableField({
  icon, label, value, field, personId, onSaved, placeholder, required, copyable, noLabel, allowClear, linkHref,
}: {
  icon?: React.ReactNode; label: string; value: string; field: string;
  personId: string;
  onSaved: (field: string, newValue: string) => void;
  placeholder?: string;
  required?: boolean;
  copyable?: boolean;
  noLabel?: boolean;
  allowClear?: boolean;
  linkHref?: string;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(personId, field, value, onSaved);
  const { registerUndo } = useUndo();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
  }, [editing]);

  if (editing) {
    return (
      <div>
        {!noLabel && label && (
          <span className="text-xs font-medium text-muted-foreground block mb-1">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            onBlur={save}
            disabled={saving}
            placeholder={placeholder}
            className="w-full text-sm font-medium text-foreground bg-transparent border-0 border-b border-b-primary/30 rounded-none px-0 py-0 outline-none focus:border-b-primary focus:ring-0 transition-colors"
          />
          {saving && <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />}
        </div>
      </div>
    );
  }

  const displayValue = field === 'phone' && value ? formatPhoneNumber(value) : value;

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const previousValue = value;
    const { error } = await supabase.from('people').update({ [field]: null }).eq('id', personId);
    if (error) { toast.error('Failed to clear'); return; }
    registerUndo({
      label: `Cleared ${field.replace('_', ' ')}`,
      execute: async () => {
        const { error: e } = await supabase.from('people').update({ [field]: previousValue || null }).eq('id', personId);
        if (e) throw e;
        onSaved(field, previousValue);
      },
    });
    onSaved(field, '');
  };

  return (
    <div onClick={() => setEditing(true)} className="cursor-pointer group">
      {!noLabel && label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
          <div className="flex items-center gap-1">
            {linkHref && value && (
              <a
                href={linkHref}
                target={linkHref.startsWith('mailto:') ? undefined : '_blank'}
                rel={linkHref.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Globe className="h-3.5 w-3.5" />
              </a>
            )}
            {copyable && value && (
              <button
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(value); toast.success('Copied'); }}
                className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
            {allowClear && value && (
              <button
                onClick={handleClear}
                className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}
      <span className={`text-sm font-medium block ${value ? 'text-foreground' : 'text-muted-foreground/50'}`}>
        {displayValue || placeholder || '\u2014'}
      </span>
    </div>
  );
}

// ── Editable Contact Row ──
function EditableContactRow({
  icon, value, field, personId, placeholder, onSaved, allowClear = false,
}: {
  icon: React.ReactNode; value: string; field: string;
  personId: string; placeholder: string;
  onSaved: (field: string, newValue: string) => void;
  allowClear?: boolean;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(personId, field, value, onSaved);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
  }, [editing]);

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('people').update({ [field]: null }).eq('id', personId);
    if (error) { toast.error('Failed to clear'); return; }
    onSaved(field, '');
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
        <div className="text-blue-400 shrink-0">{icon}</div>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          onBlur={save}
          placeholder={placeholder}
          disabled={saving}
          className="flex-1 text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50"
        />
        {saving && <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />}
      </div>
    );
  }

  const displayValue = field === 'phone' ? formatPhoneNumber(value) : value;

  return (
    <div onClick={() => setEditing(true)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors group cursor-pointer">
      <div className="text-muted-foreground group-hover:text-foreground shrink-0">{icon}</div>
      <span className={`text-[13px] truncate flex-1 ${value ? 'text-foreground font-medium' : 'text-muted-foreground italic'}`}>
        {displayValue || placeholder}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      {allowClear && value && (
        <button onClick={handleClear} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0">
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ── Editable Tags (with autocomplete) ──
function EditableTags({
  tags, personId, onSaved,
}: {
  tags: string[]; personId: string;
  onSaved: (field: string, newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftTags, setDraftTags] = useState<string[]>(tags);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all existing tags across leads
  const { data: allExistingTags = [] } = useQuery({
    queryKey: ['all-people-tags'],
    queryFn: async () => {
      const { data } = await supabase.from('people').select('tags').not('tags', 'is', null);
      const tagSet = new Set<string>();
      (data ?? []).forEach((row: any) => {
        (row.tags ?? []).forEach((t: string) => tagSet.add(t));
      });
      return Array.from(tagSet).sort();
    },
    staleTime: 60000,
  });

  // Filtered suggestions
  const suggestions = inputValue.length >= 1
    ? allExistingTags
        .filter(t => t.toLowerCase().includes(inputValue.toLowerCase()))
        .filter(t => !draftTags.includes(t))
        .slice(0, 8)
    : [];

  const showSuggestions = editing && suggestions.length > 0;

  useEffect(() => {
    if (editing) {
      setDraftTags(tags);
      setInputValue('');
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
    }
  }, [editing, tags]);

  // Position dropdown
  useEffect(() => {
    if (!showSuggestions || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, [showSuggestions, inputValue]);

  const { registerUndo: registerUndoTags } = useUndo();

  const saveTags = async (newTags: string[]) => {
    const currentStr = [...tags].sort().join(',');
    const newStr = [...newTags].sort().join(',');
    if (newStr === currentStr) {
      setEditing(false);
      return;
    }
    const previousTags = [...tags];
    setSaving(true);
    const { error } = await supabase
      .from('people')
      .update({ tags: newTags.length > 0 ? newTags : null })
      .eq('id', personId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    registerUndoTags({
      label: 'Updated tags',
      execute: async () => {
        const { error: e } = await supabase.from('people').update({ tags: previousTags.length > 0 ? previousTags : null }).eq('id', personId);
        if (e) throw e;
        onSaved('tags', JSON.stringify(previousTags.length > 0 ? previousTags : null));
      },
    });
    onSaved('tags', JSON.stringify(newTags.length > 0 ? newTags : null));
    setEditing(false);
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || draftTags.includes(trimmed)) return;
    setDraftTags(prev => [...prev, trimmed]);
    setInputValue('');
    setActiveIndex(-1);
    inputRef.current?.focus({ preventScroll: true });
  };

  const removeTag = (tag: string) => {
    setDraftTags(prev => prev.filter(t => t !== tag));
    inputRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        addTag(suggestions[activeIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Escape') {
      saveTags(draftTags);
    } else if (e.key === 'Backspace' && !inputValue && draftTags.length > 0) {
      setDraftTags(prev => prev.slice(0, -1));
    } else if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault();
      setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    }
  };

  // Click outside to save
  useEffect(() => {
    if (!editing) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        saveTags(draftTags);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });

  if (editing) {
    return (
      <>
        <div ref={containerRef} className="rounded-lg p-2">
          <div className="flex flex-wrap gap-1.5 items-center">
            {draftTags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-medium">
                {tag}
                <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors ml-0.5">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setActiveIndex(-1); }}
              onKeyDown={handleKeyDown}
              placeholder={draftTags.length === 0 ? 'Type to add tags...' : 'Add more...'}
              disabled={saving}
              className="flex-1 min-w-[80px] text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50 py-0.5"
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px] text-muted-foreground">Enter to add. Backspace to remove.</p>
            <div className="flex items-center gap-1.5">
              {saving && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
              <button onClick={() => saveTags(draftTags)} className="text-[10px] font-semibold text-blue-600 hover:text-blue-700">
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Suggestions dropdown via portal */}
        {showSuggestions && createPortal(
          <div
            ref={dropdownRef}
            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
            className="z-[9999] bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-[240px] overflow-y-auto"
          >
            {suggestions.map((s, i) => {
              // Highlight matching text
              const idx = s.toLowerCase().indexOf(inputValue.toLowerCase());
              const before = s.slice(0, idx);
              const match = s.slice(idx, idx + inputValue.length);
              const after = s.slice(idx + inputValue.length);

              return (
                <button
                  key={s}
                  onMouseDown={(e) => { e.preventDefault(); addTag(s); }}
                  className={`flex items-center gap-2.5 w-full text-left px-3 py-2 text-[13px] transition-colors ${
                    i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
                  }`}
                >
                  <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>
                    {before}<span className="font-semibold text-blue-600 dark:text-blue-400">{match}</span>{after}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="cursor-pointer group">
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 items-center">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 font-medium">
              {tag}
            </Badge>
          ))}
          <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-muted-foreground italic">No tags</p>
          <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </div>
      )}
    </div>
  );
}

// ── Editable Rich Text Field ──
function EditableRichTextField({
  value, personId, field, onSaved, placeholder,
}: {
  value: string; personId: string; field: string;
  onSaved: (field: string, newValue: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) setDraft(value);
  }, [editing, value]);

  const { registerUndo: registerUndoRich } = useUndo();

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === value) { setEditing(false); return; }
    const previousValue = value;
    setSaving(true);
    const { error } = await supabase
      .from('people')
      .update({ [field]: trimmed || null })
      .eq('id', personId);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    registerUndoRich({
      label: `Updated ${field}`,
      execute: async () => {
        const { error: e } = await supabase.from('people').update({ [field]: previousValue || null }).eq('id', personId);
        if (e) throw e;
        onSaved(field, previousValue);
      },
    });
    onSaved(field, trimmed);
    setEditing(false);
  }, [draft, value, field, personId, onSaved, registerUndoRich]);

  if (editing) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3">
        <RichTextEditor
          value={draft}
          onChange={setDraft}
          placeholder={placeholder || "Add content..."}
          minHeight="60px"
          disabled={saving}
        />
        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-blue-100">
          {saving && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
          <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1">
            <Check className="h-3 w-3" />Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="rounded-lg border border-border p-3 cursor-pointer hover:border-border hover:bg-muted/50 transition-all group">
      {value ? (
        <HtmlContent value={value} />
      ) : (
        <p className="text-[13px] text-muted-foreground italic">{placeholder || "Click to add content..."}</p>
      )}
      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Click to edit</span>
      </div>
    </div>
  );
}

// ── Contact Email Row ──
function ContactEmailRow({ entry, onDelete, onUpdate }: { entry: PersonEmail; onDelete: (id: string) => void; onUpdate: (id: string, data: { email?: string; email_type?: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.email);
  const [draftType, setDraftType] = useState(entry.email_type);

  useEffect(() => { setDraft(entry.email); setDraftType(entry.email_type); }, [entry.email, entry.email_type]);

  const save = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (trimmed !== entry.email || draftType !== entry.email_type) {
      onUpdate(entry.id, { email: trimmed, email_type: draftType });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg">
        <AtSign className="h-3.5 w-3.5 text-blue-400 shrink-0" />
        <Select value={draftType} onValueChange={setDraftType}>
          <SelectTrigger className="h-7 w-[80px] text-xs border-transparent bg-transparent shadow-none px-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="work" className="text-xs">Work</SelectItem>
            <SelectItem value="personal" className="text-xs">Personal</SelectItem>
          </SelectContent>
        </Select>
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(entry.email); setDraftType(entry.email_type); setEditing(false); } }} className="flex-1 text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50" />
        <button onClick={save} className="h-5 w-5 rounded flex items-center justify-center text-blue-600 hover:bg-blue-100 shrink-0"><Check className="h-3 w-3" /></button>
        <button onClick={() => { setDraft(entry.email); setDraftType(entry.email_type); setEditing(false); }} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted shrink-0"><X className="h-3 w-3" /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/40 transition-colors group/row">
      <AtSign className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[11px] text-muted-foreground uppercase font-medium w-[50px] shrink-0">{entry.email_type}</span>
      <span className="text-[13px] text-foreground font-medium truncate flex-1 cursor-pointer" onClick={() => setEditing(true)}>{entry.email}</span>
      <button onClick={() => setEditing(true)} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-blue-500 hover:bg-blue-50 opacity-0 group-hover/row:opacity-100 transition-all shrink-0">
        <Pencil className="h-3 w-3" />
      </button>
      <button onClick={() => onDelete(entry.id)} className="h-5 w-5 rounded flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover/row:opacity-100 transition-all shrink-0">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Contact Phone Row ──
function ContactPhoneRow({ entry, onDelete, onCall, onUpdate }: { entry: PersonPhone; onDelete: (id: string) => void; onCall?: (phone: string) => void; onUpdate: (id: string, data: { phone_number?: string; phone_type?: string }) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.phone_number);
  const [draftType, setDraftType] = useState(entry.phone_type);

  useEffect(() => { setDraft(entry.phone_number); setDraftType(entry.phone_type); }, [entry.phone_number, entry.phone_type]);

  const save = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (trimmed !== entry.phone_number || draftType !== entry.phone_type) {
      onUpdate(entry.id, { phone_number: trimmed, phone_type: draftType });
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg">
        <Phone className="h-3.5 w-3.5 text-blue-400 shrink-0" />
        <Select value={draftType} onValueChange={setDraftType}>
          <SelectTrigger className="h-7 w-[80px] text-xs border-transparent bg-transparent shadow-none px-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="work" className="text-xs">Work</SelectItem>
            <SelectItem value="personal" className="text-xs">Personal</SelectItem>
            <SelectItem value="mobile" className="text-xs">Mobile</SelectItem>
          </SelectContent>
        </Select>
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(entry.phone_number); setDraftType(entry.phone_type); setEditing(false); } }} placeholder="(555) 123-4567" className="flex-1 text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50" />
        <button onClick={save} className="h-5 w-5 rounded flex items-center justify-center text-blue-600 hover:bg-blue-100 shrink-0"><Check className="h-3 w-3" /></button>
        <button onClick={() => { setDraft(entry.phone_number); setDraftType(entry.phone_type); setEditing(false); }} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted shrink-0"><X className="h-3 w-3" /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/40 transition-colors group/row">
      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[11px] text-muted-foreground uppercase font-medium w-[50px] shrink-0">{entry.phone_type}</span>
      <span className="text-[13px] text-foreground font-medium truncate flex-1 cursor-pointer" onClick={() => setEditing(true)}>{formatPhoneNumber(entry.phone_number)}</span>
      {onCall && (
        <button onClick={() => onCall(entry.phone_number)} className="h-5 w-5 rounded flex items-center justify-center text-green-600 hover:bg-green-50 opacity-0 group-hover/row:opacity-100 transition-all shrink-0">
          <PhoneCall className="h-3 w-3" />
        </button>
      )}
      <button onClick={() => setEditing(true)} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-blue-500 hover:bg-blue-50 opacity-0 group-hover/row:opacity-100 transition-all shrink-0">
        <Pencil className="h-3 w-3" />
      </button>
      <button onClick={() => onDelete(entry.id)} className="h-5 w-5 rounded flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover/row:opacity-100 transition-all shrink-0">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Address Block ──
function AddressBlock({ entry, onDelete, onUpdate }: { entry: PersonAddress; onDelete: (id: string) => void; onUpdate: (id: string, data: Partial<PersonAddress>) => void }) {
  const [editing, setEditing] = useState(false);
  const [line1, setLine1] = useState(entry.address_line_1 ?? '');
  const [city, setCity] = useState(entry.city ?? '');
  const [state, setState] = useState(entry.state ?? '');
  const [zip, setZip] = useState(entry.zip_code ?? '');
  const [addrType, setAddrType] = useState(entry.address_type);

  useEffect(() => {
    setLine1(entry.address_line_1 ?? ''); setCity(entry.city ?? '');
    setState(entry.state ?? ''); setZip(entry.zip_code ?? ''); setAddrType(entry.address_type);
  }, [entry]);

  const save = () => {
    if (!line1.trim()) return;
    onUpdate(entry.id, {
      address_line_1: line1.trim(), city: city.trim() || null, state: state.trim() || null,
      zip_code: zip.trim() || null, address_type: addrType,
    });
    setEditing(false);
  };

  const cancel = () => {
    setLine1(entry.address_line_1 ?? ''); setCity(entry.city ?? '');
    setState(entry.state ?? ''); setZip(entry.zip_code ?? ''); setAddrType(entry.address_type);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-lg p-2.5 space-y-2">
        <input autoFocus value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="Address line 1" className="w-full text-[13px] text-foreground bg-white border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300" />
        <div className="flex gap-1.5">
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="flex-1 text-[13px] bg-white border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300" />
          <input value={state} onChange={(e) => setState(e.target.value)} placeholder="State" className="w-16 text-[13px] bg-white border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300" />
          <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="Zip" className="w-20 text-[13px] bg-white border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div className="flex items-center justify-between">
          <Select value={addrType} onValueChange={setAddrType}>
            <SelectTrigger className="h-8 w-[110px] text-xs border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="business" className="text-xs">Business</SelectItem>
              <SelectItem value="home" className="text-xs">Home</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-1.5">
            <button onClick={cancel} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Cancel</button>
            <button onClick={save} disabled={!line1.trim()} className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md disabled:opacity-50">Save</button>
          </div>
        </div>
      </div>
    );
  }

  const parts = [entry.address_line_1, entry.city, entry.state, entry.zip_code].filter(Boolean);
  return (
    <div className="flex items-start gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/40 transition-colors group/row">
      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditing(true)}>
        <span className="text-[11px] text-muted-foreground uppercase font-medium">{entry.address_type}</span>
        <p className="text-[13px] text-foreground font-medium">{parts.join(', ') || '\u2014'}</p>
      </div>
      <button onClick={() => setEditing(true)} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-blue-500 hover:bg-blue-50 opacity-0 group-hover/row:opacity-100 transition-all shrink-0 mt-0.5">
        <Pencil className="h-3 w-3" />
      </button>
      <button onClick={() => onDelete(entry.id)} className="h-5 w-5 rounded flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover/row:opacity-100 transition-all shrink-0 mt-0.5">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Read-only row ──
function ReadOnlyField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <span className="text-[13px] font-medium text-foreground text-right truncate">{value}</span>
    </div>
  );
}

/* --- Stats Card (accent card style) --- */
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

/* --- Related Section --- */
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
        {onAdd && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 ml-auto text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ══════════════════════════════════════════════════
// ── Customize Contact Types Panel ──
// ══════════════════════════════════════════════════

function CustomizeContactTypesPanel({
  customTypes,
  onUpdate,
}: {
  customTypes: CustomContactType[];
  onUpdate: (types: CustomContactType[]) => void;
}) {
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('blue');

  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label) return;
    if (DEFAULT_CONTACT_TYPES.includes(label) || customTypes.some(ct => ct.label === label)) {
      toast.error('Type already exists');
      return;
    }
    onUpdate([...customTypes, { label, colorName: newColor }]);
    setNewLabel('');
    setNewColor('blue');
    toast.success('Contact type added');
  };

  const handleRemove = (label: string) => {
    onUpdate(customTypes.filter(ct => ct.label !== label));
    toast.success('Contact type removed');
  };

  return (
    <div className="space-y-5">
      {/* Default types (read-only) */}
      <div>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Default Types</span>
        <div className="space-y-1">
          {DEFAULT_CONTACT_TYPES.map((t) => {
            const cfg = contactTypeConfig[t];
            return (
              <div key={t} className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg?.dot ?? 'bg-muted-foreground'}`} />
                <span className="text-sm text-foreground">{cfg?.label ?? t}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom types (removable) */}
      {customTypes.length > 0 && (
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Custom Types</span>
          <div className="space-y-1">
            {customTypes.map((ct) => {
              const colorOpt = COLOR_OPTIONS.find(c => c.name === ct.colorName) ?? COLOR_OPTIONS[0];
              return (
                <div key={ct.label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/40 group">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${colorOpt.dot}`} />
                  <span className="text-sm text-foreground flex-1">{ct.label}</span>
                  <button
                    onClick={() => handleRemove(ct.label)}
                    className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add new type */}
      <div>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Add New Type</span>
        <div className="space-y-3">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Type name..."
            className="w-full text-sm text-foreground bg-card border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
          />
          <div>
            <span className="text-xs text-muted-foreground block mb-1.5">Color</span>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setNewColor(c.name)}
                  className={`h-6 w-6 rounded-full ${c.dot} transition-all ${
                    newColor === c.name ? 'ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-110'
                  }`}
                />
              ))}
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!newLabel.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 rounded-lg w-full"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Contact Type
          </Button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════
// ── Main Component ──
// ══════════════════════════════════════════════════

export default function PeopleExpandedView() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { registerUndo, isUndoingRef } = useUndo();
  const { setSearchComponent } = useAdminTopBar();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSearchComponent(
      <AdminTopBarSearch value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
    );
    return () => setSearchComponent(null);
  }, [searchTerm]);

  const [activityTab, setActivityTab] = useState<'log' | 'note' | 'email'>('log');

  // Activity form state
  const [activityType, setActivityType] = useState('todo');
  const [activityNote, setActivityNote] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [activityDropdownOpen, setActivityDropdownOpen] = useState(false);

  // Custom contact types
  const [contactTypeDropdownOpen, setContactTypeDropdownOpen] = useState(false);
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const [visibilityDropdownOpen, setVisibilityDropdownOpen] = useState(false);
  // Pipeline state removed — people are no longer connected to pipelines
  const [customContactTypes, setCustomContactTypes] = useState<CustomContactType[]>(loadCustomContactTypes);
  const [showCustomizeDialog, setShowCustomizeDialog] = useState(false);
  const allContactTypes = useMemo(() => getAllContactTypes(customContactTypes), [customContactTypes]);
  const fullContactTypeConfig = useMemo(() => buildContactTypeConfig(customContactTypes), [customContactTypes]);

  // Email compose state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [emailCc, setEmailCc] = useState('');
  const [emailBcc, setEmailBcc] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Task inline add state
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<LeadTask | null>(null);

  // Multi-value contact form state
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

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Extra fields state
  const [extraFields, setExtraFields] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('people-extra-fields');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showFieldPicker, setShowFieldPicker] = useState(false);

  const availableExtraFields = useMemo(() => {
    return EXTRA_FIELD_OPTIONS.filter(o => !extraFields.includes(o.field));
  }, [extraFields]);

  const addExtraField = useCallback((field: string) => {
    setExtraFields(prev => {
      const next = [...prev, field];
      localStorage.setItem('people-extra-fields', JSON.stringify(next));
      return next;
    });
    setShowFieldPicker(false);
  }, []);

  const removeExtraField = useCallback((field: string) => {
    setExtraFields(prev => {
      const next = prev.filter(f => f !== field);
      localStorage.setItem('people-extra-fields', JSON.stringify(next));
      return next;
    });
  }, []);

  // Calendar events state
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventTime, setNewEventTime] = useState('09:00');
  const [newEventEndTime, setNewEventEndTime] = useState('10:00');
  const [newEventType, setNewEventType] = useState('meeting');
  const [savingEvent, setSavingEvent] = useState(false);

  // Projects state
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  // Activity expand / comments state
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [savingComment, setSavingComment] = useState<string | null>(null);

  const { teamMember } = useTeamMember();
  const gmail = useGmailConnection({ userKey: 'people-expanded' });

  // ── Queries (defined before callbacks that reference query results) ──
  const { data: person, isLoading } = useQuery({
    queryKey: ['person-expanded', personId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .eq('id', personId!)
        .single();
      if (error) throw error;
      return data as Person;
    },
    enabled: !!personId,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['person-activities', personId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('entity_id', personId!)
        .eq('entity_type', 'people')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!personId,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['person-tasks', personId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('lead_id', personId!)
        .order('created_at', { ascending: false });
      return (data ?? []) as LeadTask[];
    },
    enabled: !!personId,
  });

  // Satellite table queries
  const { data: personEmails = [] } = useQuery({
    queryKey: ['person-emails', personId],
    queryFn: async () => {
      const { data } = await supabase.from('entity_emails').select('*').eq('entity_id', personId!).eq('entity_type', 'people');
      return (data || []) as PersonEmail[];
    },
    enabled: !!personId,
  });

  const { data: personPhones = [] } = useQuery({
    queryKey: ['person-phones', personId],
    queryFn: async () => {
      const { data } = await supabase.from('entity_phones').select('*').eq('entity_id', personId!).eq('entity_type', 'people');
      return (data || []) as PersonPhone[];
    },
    enabled: !!personId,
  });

  const { data: personAddresses = [] } = useQuery({
    queryKey: ['person-addresses', personId],
    queryFn: async () => {
      const { data } = await supabase.from('entity_addresses').select('*').eq('entity_id', personId!).eq('entity_type', 'people');
      return (data || []) as PersonAddress[];
    },
    enabled: !!personId,
  });

  const { data: teamMembers = [] } = useAssignableUsers();

  const teamMemberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of teamMembers) map[m.id] = m.name;
    return map;
  }, [teamMembers]);

  // ── Contact type change handler ──
  const handleContactTypeChange = useCallback(async (newType: string) => {
    if (!personId) return;
    const previousType = person?.contact_type ?? null;
    const { error } = await supabase
      .from('people')
      .update({ contact_type: newType })
      .eq('id', personId);
    if (error) {
      toast.error('Failed to update contact type');
      return;
    }
    registerUndo({
      label: `Contact type changed to ${newType}`,
      execute: async () => {
        const { error: e } = await supabase.from('people').update({ contact_type: previousType }).eq('id', personId);
        if (e) throw e;
        queryClient.invalidateQueries({ queryKey: ['person-expanded', personId] });
        queryClient.invalidateQueries({ queryKey: ['people'] });
      },
    });
    queryClient.invalidateQueries({ queryKey: ['person-expanded', personId] });
    // Log an activity for the type change
    await supabase.from('activities').insert({
      entity_id: personId,
      entity_type: 'people',
      activity_type: 'type_change',
      title: 'Contact type changed',
      content: JSON.stringify({ from: previousType, to: newType }),
    });
    queryClient.invalidateQueries({ queryKey: ['person-activities', personId] });
  }, [personId, person?.contact_type, queryClient, registerUndo]);

  // ── Field saved handler ──
  const handleFieldSaved = useCallback((_field: string, _newValue: string) => {
    queryClient.invalidateQueries({ queryKey: ['person-expanded', personId] });
    queryClient.invalidateQueries({ queryKey: ['people'] });
    if (!isUndoingRef.current) toast.success('Updated');
  }, [personId, queryClient, isUndoingRef]);

  // ── Save activity ──
  const handleSaveActivity = useCallback(async () => {
    if (!personId) return;
    const rawContent = activityTab === 'log' ? activityNote : noteContent;
    const content = rawContent.trim();
    const type = activityTab === 'log' ? activityType : 'note';
    if (!content || isHtmlEmpty(content)) {
      toast.error('Please enter some content');
      return;
    }
    setSavingActivity(true);
    const { error } = await supabase.from('activities').insert({
      entity_id: personId,
      entity_type: 'people',
      activity_type: type,
      content,
      title: type === 'note' ? 'Note' : type.charAt(0).toUpperCase() + type.slice(1),
    });
    setSavingActivity(false);
    if (error) {
      toast.error('Failed to save activity');
      return;
    }
    // Update last_activity_at
    await supabase.from('people').update({ last_activity_at: new Date().toISOString() }).eq('id', personId);
    toast.success('Activity saved');
    if (activityTab === 'log') setActivityNote('');
    else setNoteContent('');
    queryClient.invalidateQueries({ queryKey: ['person-activities', personId] });
    queryClient.invalidateQueries({ queryKey: ['person-expanded', personId] });
  }, [personId, activityTab, activityType, activityNote, noteContent, queryClient]);

  // ── Send email ──
  const handleSendEmail = useCallback(async () => {
    if (!person?.email || sendingEmail) return;
    if (isHtmlEmpty(emailBody)) {
      toast.error('Please enter a message');
      return;
    }
    setSendingEmail(true);
    try {
      await gmail.sendEmailMutation.mutateAsync({
        to: person.email,
        subject: emailSubject || '(No Subject)',
        body: emailBody,
      });
      toast.success('Email sent');
      setEmailSubject('');
      setEmailBody('');
      setEmailCc('');
      setEmailBcc('');
      // Log as activity
      if (personId) {
        await supabase.from('activities').insert({
          entity_id: personId,
          entity_type: 'people',
          activity_type: 'email',
          title: `Email: ${emailSubject || '(No Subject)'}`,
          content: emailBody,
        });
        await supabase.from('people').update({ last_activity_at: new Date().toISOString() }).eq('id', personId);
        queryClient.invalidateQueries({ queryKey: ['person-activities', personId] });
        queryClient.invalidateQueries({ queryKey: ['person-expanded', personId] });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  }, [person, personId, emailSubject, emailBody, sendingEmail, gmail.sendEmailMutation, queryClient]);

  // ── Save task inline (Enter key) ──
  const handleSaveTask = useCallback(async () => {
    if (!personId || !newTaskTitle.trim()) return;
    const { error } = await supabase.from('tasks').insert({
      lead_id: personId,
      title: newTaskTitle.trim(),
      status: 'todo',
      task_type: 'to_do',
      source: 'lead',
    });
    if (error) {
      toast.error('Failed to create task');
      return;
    }
    toast.success('Task created');
    setNewTaskTitle('');
    setAddingTask(false);
    queryClient.invalidateQueries({ queryKey: ['person-tasks', personId] });
  }, [personId, newTaskTitle, queryClient]);

  // ── Toggle task completion directly ──
  const toggleTaskCompletion = useCallback(async (task: LeadTask) => {
    const isCompleting = !task.completed_at;
    await supabase.from('tasks').update({
      completed_at: isCompleting ? new Date().toISOString() : null,
      is_completed: isCompleting,
      status: isCompleting ? 'done' : 'todo',
      updated_at: new Date().toISOString(),
    }).eq('id', task.id);
    queryClient.invalidateQueries({ queryKey: ['person-tasks', personId] });
  }, [personId, queryClient]);

  // ── Save activity comment ──
  const handleSaveComment = useCallback(async (activityId: string) => {
    const text = (commentTexts[activityId] ?? '').trim();
    if (!text || !personId) return;
    setSavingComment(activityId);
    const { error } = await supabase.from('activity_comments').insert({
      activity_id: activityId,
      lead_id: personId,
      content: text,
      created_by: teamMember?.name ?? null,
    });
    setSavingComment(null);
    if (error) {
      toast.error('Failed to save comment');
      return;
    }
    setCommentTexts((prev) => ({ ...prev, [activityId]: '' }));
    queryClient.invalidateQueries({ queryKey: ['person-activity-comments', personId] });
  }, [personId, commentTexts, teamMember, queryClient]);

  // ── File upload ──
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !personId) return;
    e.target.value = '';

    console.log('[FileUpload] Lead: starting upload', { name: file.name, size: file.size, type: file.type });

    // Auth check
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error('[FileUpload] Lead: no active session', sessionError);
      toast.error('You must be logged in to upload files. Please refresh and sign in again.');
      return;
    }

    setUploadingFile(true);
    const filePath = `${personId}/${Date.now()}_${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from('lead-files')
      .upload(filePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      });
    if (uploadError) {
      console.error('[FileUpload] Lead: storage upload error', uploadError);
      setUploadingFile(false);
      const reason = uploadError.message?.includes('security')
        ? 'Permission denied — check your login session'
        : uploadError.message || 'Storage error';
      toast.error(`Upload failed for ${file.name}: ${reason}`);
      return;
    }

    // Store relative path, NOT public URL
    const { error: dbError } = await supabase.from('entity_files').insert({
      entity_id: personId,
      entity_type: 'people',
      file_name: file.name,
      file_url: filePath,
      file_type: file.type || null,
      file_size: file.size,
    });
    setUploadingFile(false);
    if (dbError) {
      console.error('[FileUpload] Lead: DB insert error', dbError);
      const reason = dbError.message?.includes('row-level security')
        ? 'Permission denied — admin role required'
        : dbError.message || 'Database error';
      toast.error(`Failed to save ${file.name}: ${reason}`);
      // Clean up orphaned storage file
      await supabase.storage.from('lead-files').remove([filePath]);
      return;
    }
    console.log('[FileUpload] Lead: upload success', { filePath });
    toast.success('File uploaded');
    queryClient.invalidateQueries({ queryKey: ['person-files', personId] });
  }, [personId, queryClient]);

  // ── File delete ──
  const handleDeleteFile = useCallback(async (file: PersonFile) => {
    // file_url stores relative path directly
    await supabase.storage.from('lead-files').remove([file.file_url]);

    const { error } = await supabase.from('entity_files').delete().eq('id', file.id);
    if (error) {
      toast.error('Failed to delete file');
      return;
    }
    toast.success('File deleted');
    queryClient.invalidateQueries({ queryKey: ['person-files', personId] });
  }, [personId, queryClient]);

  // ── File download (signed URL) ──
  const handleDownloadFile = useCallback(async (file: PersonFile) => {
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

  // ── Person files query ──
  const { data: personFiles = [] } = useQuery({
    queryKey: ['person-files', personId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entity_files')
        .select('id, entity_id, file_name, file_url, file_type, file_size, uploaded_by, created_at')
        .eq('entity_id', personId!)
        .eq('entity_type', 'people')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PersonFile[];
    },
    enabled: !!personId,
  });

  // ── Calendar events query ──
  const { data: calendarEvents = [] } = useQuery({
    queryKey: ['person-appointments', personId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('lead_id', personId!)
        .order('start_time', { ascending: false });
      if (error) throw error;
      return data as Array<{
        id: string; title: string; description: string | null;
        start_time: string; end_time: string | null;
        appointment_type: string | null; lead_id: string | null;
        team_member_name: string | null; created_at: string;
      }>;
    },
    enabled: !!personId,
  });

  const handleSaveEvent = useCallback(async () => {
    if (!newEventTitle.trim() || !newEventDate || !personId) return;
    setSavingEvent(true);
    const startTime = `${newEventDate}T${newEventTime}:00`;
    const endTime = `${newEventDate}T${newEventEndTime}:00`;
    const { error } = await supabase.from('appointments').insert({
      title: newEventTitle.trim(),
      start_time: startTime,
      end_time: endTime,
      lead_id: personId,
      appointment_type: newEventType,
      team_member_name: teamMember?.name ?? null,
    });
    setSavingEvent(false);
    if (error) {
      toast.error('Failed to create event');
      return;
    }
    toast.success('Event created');
    setNewEventTitle('');
    setNewEventDate('');
    setNewEventTime('09:00');
    setNewEventEndTime('10:00');
    setShowAddEvent(false);
    queryClient.invalidateQueries({ queryKey: ['person-appointments', personId] });
  }, [newEventTitle, newEventDate, newEventTime, newEventEndTime, newEventType, personId, teamMember, queryClient]);

  const handleInlineCreateProject = useCallback(async () => {
    if (!newProjectName.trim() || !personId) return;
    setSavingProject(true);
    try {
      const { error } = await supabase.from('entity_projects').insert({
        entity_id: personId,
        entity_type: 'people',
        name: newProjectName.trim(),
        status: 'open',
        project_stage: 'open',
        visibility: 'everyone',
        created_by: teamMember?.name || null,
      });
      if (error) throw error;
      toast.success('Project created');
      queryClient.invalidateQueries({ queryKey: ['person-projects', personId] });
      setNewProjectName('');
      setShowAddProject(false);
    } catch {
      toast.error('Failed to create project');
    } finally {
      setSavingProject(false);
    }
  }, [newProjectName, personId, teamMember, queryClient]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    // Capture event before deleting
    const { data: eventData } = await supabase.from('appointments').select('*').eq('id', eventId).single();
    const { error } = await supabase.from('appointments').delete().eq('id', eventId);
    if (error) {
      toast.error('Failed to delete event');
      return;
    }
    if (eventData) {
      registerUndo({
        label: `Deleted event "${eventData.title}"`,
        execute: async () => {
          const { id: _id, ...rest } = eventData;
          const { error: e } = await supabase.from('appointments').insert({ ...rest, id: eventId });
          if (e) throw e;
          queryClient.invalidateQueries({ queryKey: ['person-appointments', personId] });
        },
      });
    }
    queryClient.invalidateQueries({ queryKey: ['person-appointments', personId] });
  }, [personId, queryClient, registerUndo]);

  // ── Activity comments query ──
  const { data: activityCommentsMap = {} } = useQuery({
    queryKey: ['person-activity-comments', personId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_comments')
        .select('*')
        .eq('lead_id', personId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const map: Record<string, typeof data> = {};
      for (const c of data ?? []) {
        (map[c.activity_id] ??= []).push(c);
      }
      return map;
    },
    enabled: !!personId,
  });

  // Pipeline records removed — people are no longer connected to pipelines directly
  const pipelineRecords: any[] = [];

  // Projects for this person
  const { data: personProjects = [] } = useQuery({
    queryKey: ['person-projects', personId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entity_projects')
        .select('*')
        .eq('entity_id', personId!)
        .eq('entity_type', 'people')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadProject[];
    },
    enabled: !!personId,
  });

  // Financial stats from person's lead data
  const financialStats = useMemo(() => {
    const wonStatuses = ['funded', 'closed_won', 'won'];
    const lostStatuses = ['lost', 'closed_lost', 'dead'];
    const leadStatus = (person?.status ?? '').toLowerCase();
    const isWon = wonStatuses.includes(leadStatus);
    const isResolved = isWon || lostStatuses.includes(leadStatus);
    const winRate = isResolved ? (isWon ? 100 : 0) : 0;
    const totalWon = isWon && person?.loan_amount ? person.loan_amount : 0;
    return { totalWon, winRate };
  }, [person?.status, person?.loan_amount]);

  // usePipelines and filteredPipelines removed — people are no longer connected to pipelines

  // addToPipelineMutation removed — people are no longer connected to pipelines directly

  // ── Satellite table mutations ──
  const addEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from('entity_emails').insert({ entity_id: personId!, entity_type: 'people', email, email_type: newEmailType });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-emails', personId] }); setNewEmail(''); setShowAddEmail(false); toast.success('Email added'); },
    onError: () => toast.error('Failed to add email'),
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase.from('entity_emails').delete().eq('id', emailId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-emails', personId] }); toast.success('Email removed'); },
    onError: () => toast.error('Failed to remove email'),
  });

  const addPhoneMutation = useMutation({
    mutationFn: async (phone: string) => {
      const { error } = await supabase.from('entity_phones').insert({ entity_id: personId!, entity_type: 'people', phone_number: phone, phone_type: newPhoneType });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-phones', personId] }); setNewPhone(''); setShowAddPhone(false); toast.success('Phone added'); },
    onError: () => toast.error('Failed to add phone'),
  });

  const deletePhoneMutation = useMutation({
    mutationFn: async (phoneId: string) => {
      const { error } = await supabase.from('entity_phones').delete().eq('id', phoneId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-phones', personId] }); toast.success('Phone removed'); },
    onError: () => toast.error('Failed to remove phone'),
  });

  const addAddressMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('entity_addresses').insert({
        entity_id: personId!,
        entity_type: 'people',
        address_line_1: newAddressLine1.trim(),
        city: newAddressCity.trim() || null,
        state: newAddressState.trim() || null,
        zip_code: newAddressZip.trim() || null,
        address_type: newAddressType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-addresses', personId] });
      setNewAddressLine1(''); setNewAddressCity(''); setNewAddressState(''); setNewAddressZip('');
      setNewAddressType('business'); setShowAddAddress(false);
      toast.success('Address added');
    },
    onError: () => toast.error('Failed to add address'),
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await supabase.from('entity_addresses').delete().eq('id', addressId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-addresses', personId] }); toast.success('Address removed'); },
    onError: () => toast.error('Failed to remove address'),
  });

  const updateEmailMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { email?: string; email_type?: string } }) => {
      const { error } = await supabase.from('entity_emails').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-emails', personId] }); toast.success('Email updated'); },
    onError: () => toast.error('Failed to update email'),
  });

  const updatePhoneMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { phone_number?: string; phone_type?: string } }) => {
      const { error } = await supabase.from('entity_phones').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-phones', personId] }); toast.success('Phone updated'); },
    onError: () => toast.error('Failed to update phone'),
  });

  const updateAddressMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PersonAddress> }) => {
      const { error } = await supabase.from('entity_addresses').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-addresses', personId] }); toast.success('Address updated'); },
    onError: () => toast.error('Failed to update address'),
  });

  if (isLoading || !person) {
    return (
      <div className="flex items-center justify-center h-full">
        <Skeleton className="h-12 w-64" />
      </div>
    );
  }

  const typeCfg = fullContactTypeConfig[person.contact_type ?? 'Other'] ?? contactTypeConfig[person.contact_type ?? 'Other'];
  const inactiveDays = daysSince(person.last_activity_at);
  const lastActivityDate = formatShortDate(person.last_activity_at);
  const pendingTasks = tasks.filter(t => !t.completed_at);
  const completedTasks = tasks.filter(t => !!t.completed_at);
  const totalTasks = tasks.length;
  const assignedName = person.assigned_to ? (teamMemberMap[person.assigned_to] ?? '\u2014') : '\u2014';

  function goBack() {
    navigate(-1);
  }

  return (
    <>
    <div data-full-bleed className="people-expanded-view system-font flex flex-col bg-background md:overflow-hidden overflow-y-auto h-[calc(100vh-3.5rem)]">
      <style>{`
        .people-expanded-view,
        .people-expanded-view *:not(svg):not(svg *) {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        }
      `}</style>
      {/* ── 3-Column Body ── */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 md:overflow-hidden">

        {/* LEFT: Details */}
        <ScrollArea className="w-full md:w-[255px] lg:w-[323px] xl:w-[408px] md:shrink-0 md:min-w-[204px] min-w-0 border-b md:border-b-0 md:border-r border-border bg-card overflow-hidden">
          <div className="px-4 md:pl-6 md:pr-4 lg:pl-8 lg:pr-5 xl:pl-11 xl:pr-6 py-6 space-y-6">

            {/* ── Back Arrow ── */}
            <button onClick={goBack} className="flex items-center text-muted-foreground hover:text-foreground transition-colors -ml-2 py-1">
              <svg width="32" height="16" viewBox="0 0 32 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="30" y1="8" x2="2" y2="8" />
                <polyline points="8,2 2,8 8,14" />
              </svg>
            </button>

            {/* ── Contact Card Header ── */}
            <div className="flex items-start gap-4">
              <AvatarUpload
                userId={person.id}
                currentAvatarUrl={person.image_url}
                fallbackInitials={person.name.split(' ').map(n => n[0]?.toUpperCase()).join('').slice(0, 2)}
                size="lg"
                tableName="people"
                tableIdColumn="id"
                tableImageColumn="image_url"
                queryKeysToInvalidate={[['person-expanded', person.id]]}
              />
              <div className="min-w-0 pt-0.5">
                <h2 className="text-xl font-semibold text-foreground truncate leading-tight">{person.name}</h2>
                {(person.title || person.company_name) && (
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">
                    {[person.title, person.company_name].filter(Boolean).join(' at ')}
                  </p>
                )}
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground bg-muted/50">
                    <User className="h-3 w-3" />
                    Person
                  </span>
                </div>
              </div>
            </div>

            {/* ── Copper-style Fields ── */}
            <div className="space-y-5">
              {/* Name */}
              <EditableField label="Name" value={person.name} field="name" personId={person.id} onSaved={handleFieldSaved} required copyable />

              {/* Company */}
              <EditableField label="Company" value={person.company_name ?? ''} field="company_name" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Company" />

              {/* Known As (Nick Name) */}
              <EditableField label="Known As (Nick Name)" value={person.known_as ?? ''} field="known_as" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Known As (Nick Name)" />

              {/* CLX - File Name */}
              <EditableField label="CLX - File Name" value={person.clx_file_name ?? ''} field="clx_file_name" personId={person.id} onSaved={handleFieldSaved} placeholder="Add CLX - File Name" />

              {/* Title */}
              <EditableField label="Title" value={person.title ?? ''} field="title" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Title" />

              {/* Contact Type */}
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">Contact Type</span>
                <div className="relative">
                  <button
                    onClick={() => setContactTypeDropdownOpen(!contactTypeDropdownOpen)}
                    className="flex items-center gap-2 w-full text-sm font-medium text-foreground bg-transparent border-b border-border py-1.5 transition-colors hover:border-foreground/30"
                  >
                    {(() => {
                      const CONTACT_TYPE_ICONS: Record<string, typeof User> = {
                        'Potential Customer': User,
                        'Current Customer': CheckSquare,
                        'Referral Source': Users,
                        'Bank Relationship': Building2,
                        'Attorney': Briefcase,
                        'Other': Tag,
                      };
                      const ct = person.contact_type ?? 'Other';
                      const Icon = CONTACT_TYPE_ICONS[ct] ?? Tag;
                      return <><Icon className="h-4 w-4 text-muted-foreground" />{typeCfg?.label ?? ct}</>;
                    })()}
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                  </button>

                  {contactTypeDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setContactTypeDropdownOpen(false)} />
                      <div className="absolute z-50 top-full left-0 mt-1.5 w-[280px] bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
                        <div className="py-1">
                          {([
                            { value: 'Potential Customer', label: 'Potential Customer', icon: User },
                            { value: 'Current Customer', label: 'Current Customer', icon: CheckSquare },
                            { value: 'Referral Source', label: 'Referral Source', icon: Users },
                            { value: 'Bank Relationship', label: 'Bank Relationship', icon: Building2 },
                            { value: 'Attorney', label: 'Attorney', icon: Briefcase },
                            { value: 'Other', label: 'Other', icon: Tag },
                          ] as const).map((opt) => {
                            const Icon = opt.icon;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => { handleContactTypeChange(opt.value); setContactTypeDropdownOpen(false); }}
                                className={`flex items-center gap-3.5 w-full text-left px-4 py-3 text-sm transition-colors ${
                                  person.contact_type === opt.value ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400' : 'text-foreground hover:bg-muted/50'
                                }`}
                              >
                                <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                                <span className="font-medium">{opt.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="border-t border-border">
                          <button
                            onClick={() => { setContactTypeDropdownOpen(false); setShowCustomizeDialog(true); }}
                            className="flex items-center gap-3.5 w-full text-left px-4 py-3 text-sm text-blue-600 dark:text-blue-400 hover:bg-muted/50 transition-colors"
                          >
                            <Plus className="h-5 w-5 shrink-0" />
                            <span className="font-medium">Customize Contact Types</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Source */}
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">Source</span>
                <div className="relative">
                  <button
                    onClick={() => setSourceDropdownOpen(!sourceDropdownOpen)}
                    className="flex items-center gap-2 w-full text-sm font-medium text-foreground bg-transparent border-b border-border py-1.5 transition-colors hover:border-foreground/30"
                  >
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    {person.source ?? 'Select source'}
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                  </button>

                  {sourceDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setSourceDropdownOpen(false)} />
                      <div className="absolute z-50 top-full left-0 mt-1.5 w-[280px] max-h-[320px] overflow-y-auto bg-popover border border-border rounded-xl shadow-lg">
                        <div className="py-1">
                          {SOURCE_OPTIONS.map((s) => (
                            <button
                              key={s}
                              onClick={async () => {
                                const { error } = await supabase.from('people').update({ source: s }).eq('id', person.id);
                                if (error) { toast.error('Failed to update source'); return; }
                                handleFieldSaved('source', s);
                                setSourceDropdownOpen(false);
                              }}
                              className={`flex items-center gap-3.5 w-full text-left px-4 py-3 text-sm transition-colors ${
                                person.source === s ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400' : 'text-foreground hover:bg-muted/50'
                              }`}
                            >
                              <span className="font-medium">{s}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Owner */}
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">Owner</span>
                {assignedName ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{assignedName}</span>
                    <button
                      onClick={async () => {
                        await supabase.from('people').update({ assigned_to: null }).eq('id', person.id);
                        handleFieldSaved('assigned_to', '');
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <EditableField label="" value="" field="assigned_to" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Owner" noLabel />
                )}
              </div>

              {/* Work Email */}
              <EditableField label="Work Email" value={person.email ?? ''} field="email" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Email" copyable allowClear linkHref={person.email ? `mailto:${person.email}` : undefined} />

              {/* Phone */}
              <EditableField label="Phone" value={person.phone ?? ''} field="phone" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Phone" allowClear />

              {/* LinkedIn */}
              <EditableField label="LinkedIn" value={person.linkedin ?? ''} field="linkedin" personId={person.id} onSaved={handleFieldSaved} placeholder="Add LinkedIn" allowClear linkHref={person.linkedin ? (person.linkedin.startsWith('http') ? person.linkedin : `https://${person.linkedin}`) : undefined} />

              {/* Twitter */}
              <EditableField label="Twitter" value={person.twitter ?? ''} field="twitter" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Twitter" />

              {/* Work Website */}
              <EditableField label="Work Website" value={person.website ?? ''} field="website" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Work Website" />

              {/* Work Website 2 */}
              <EditableField label="Work Website 2" value={person.work_website ?? ''} field="work_website" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Work Website" />

              {/* Visibility */}
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">Visibility</span>
                <div className="relative">
                  <button
                    onClick={() => setVisibilityDropdownOpen(!visibilityDropdownOpen)}
                    className="flex items-center gap-2 w-full text-sm font-medium text-foreground bg-transparent border-b border-border py-1.5 transition-colors hover:border-foreground/30"
                  >
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    {person.visibility ?? 'Select visibility'}
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                  </button>

                  {visibilityDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setVisibilityDropdownOpen(false)} />
                      <div className="absolute z-50 top-full left-0 mt-1.5 w-[280px] bg-popover border border-border rounded-xl shadow-lg">
                        <div className="py-1">
                          {(['Everyone', 'Teams', 'Individuals', 'Only Me', 'Record Owner Only'] as const).map((opt) => (
                            <button
                              key={opt}
                              onClick={async () => {
                                const { error } = await supabase.from('people').update({ visibility: opt }).eq('id', person.id);
                                if (error) { toast.error('Failed to update visibility'); return; }
                                handleFieldSaved('visibility', opt);
                                setVisibilityDropdownOpen(false);
                              }}
                              className={`flex items-center gap-3.5 w-full text-left px-4 py-3 text-sm transition-colors ${
                                person.visibility === opt ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400' : 'text-foreground hover:bg-muted/50'
                              }`}
                            >
                              <span className="font-medium">{opt}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Last Contacted */}
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">Last Contacted</span>
                <input
                  type="date"
                  value={person.last_contacted ? person.last_contacted.slice(0, 10) : ''}
                  onChange={async (e) => {
                    const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                    const { error } = await supabase.from('people').update({ last_contacted: val }).eq('id', person.id);
                    if (error) { toast.error('Failed to update'); return; }
                    handleFieldSaved('last_contacted', val ?? '');
                  }}
                  className="w-full text-sm font-medium text-foreground bg-transparent border-0 border-b border-border px-0 py-1.5 outline-none focus:ring-0"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Email</span>
              <div className="space-y-1">
                {personEmails.map((e) => (
                  <ContactEmailRow key={e.id} entry={e} onDelete={(id) => deleteEmailMutation.mutate(id)} onUpdate={(id, data) => updateEmailMutation.mutate({ id, data })} />
                ))}
                {showAddEmail ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg">
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
                  <button onClick={() => setShowAddEmail(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-3 py-1">+ Add Email</button>
                )}
              </div>
            </div>

            {/* Phone */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Phone</span>
              <div className="space-y-1">
                {personPhones.map((p) => (
                  <ContactPhoneRow key={p.id} entry={p} onDelete={(id) => deletePhoneMutation.mutate(id)} onCall={(phone) => navigate(`/admin/calls?phone=${encodeURIComponent(phone.replace(/\D/g, ''))}`)} onUpdate={(id, data) => updatePhoneMutation.mutate({ id, data })} />
                ))}
                {showAddPhone ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg">
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
                  <button onClick={() => setShowAddPhone(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-3 py-1">+ Add Phone</button>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Address</span>
              <div className="space-y-1">
                {personAddresses.map((a) => (
                  <AddressBlock key={a.id} entry={a} onDelete={(id) => deleteAddressMutation.mutate(id)} onUpdate={(id, data) => updateAddressMutation.mutate({ id, data })} />
                ))}
                {showAddAddress ? (
                  <div className="rounded-lg p-2.5 space-y-2">
                    <AddressAutocompleteInput
                      value={newAddressLine1}
                      onChange={setNewAddressLine1}
                      onSelect={(parsed: ParsedAddress) => {
                        setNewAddressLine1(parsed.address_line_1);
                        setNewAddressCity(parsed.city);
                        setNewAddressState(parsed.state);
                        setNewAddressZip(parsed.zip_code);
                      }}
                      placeholder="Start typing an address..."
                      autoFocus
                      className="w-full text-[13px] text-foreground bg-white border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300"
                    />
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

            {/* Tags */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Tags</span>
              <EditableTags tags={person.tags ?? []} personId={person.id} onSaved={handleFieldSaved} />
            </div>

            {/* About (formerly Notes) */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">About</span>
              <EditableRichTextField value={person.notes ?? ''} personId={person.id} field="notes" onSaved={handleFieldSaved} placeholder="Background info about this contact..." />
            </div>

            {/* Description */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Description</span>
              <EditableRichTextField value={person.description ?? ''} personId={person.id} field="description" onSaved={handleFieldSaved} placeholder="Add a description..." />
            </div>

            {/* History */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">History</span>
              <EditableRichTextField value={person.history ?? ''} personId={person.id} field="history" onSaved={handleFieldSaved} placeholder="Add history notes..." />
            </div>

            {/* Bank Relationships */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4 block">Bank Relationships</span>
              <EditableRichTextField value={person.bank_relationships ?? ''} personId={person.id} field="bank_relationships" onSaved={handleFieldSaved} placeholder="Excluded lender names from CLX agreement..." />
            </div>

            {/* ── Extra fields added by user ── */}
            {extraFields.map((fieldKey) => {
              const opt = EXTRA_FIELD_OPTIONS.find(o => o.field === fieldKey);
              if (!opt) return null;
              const val = String(person[fieldKey] ?? '');
              return (
                <div key={fieldKey} className="group/extra">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{opt.label}</span>
                    <button
                      onClick={() => removeExtraField(fieldKey)}
                      className="opacity-0 group-hover/extra:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                      title="Remove field"
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                    </button>
                  </div>
                  <EditableField label="" value={val} field={fieldKey} personId={person.id} onSaved={handleFieldSaved} placeholder={`Add ${opt.label}`} noLabel />
                </div>
              );
            })}

            {/* + Add new field */}
            <div className="relative border-t border-border mt-2">
              <button
                onClick={() => setShowFieldPicker(!showFieldPicker)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors py-2 w-full justify-center"
              >
                <Plus className="h-3.5 w-3.5" />
                Add new field
              </button>
              {showFieldPicker && availableExtraFields.length > 0 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFieldPicker(false)} />
                  <div className="absolute z-50 bottom-full left-0 mb-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                    {availableExtraFields.map((opt) => (
                      <button
                        key={opt.field}
                        onClick={() => addExtraField(opt.field)}
                        className="w-full text-left px-3 py-2 text-[13px] text-foreground hover:bg-muted/50 transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {showFieldPicker && availableExtraFields.length === 0 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFieldPicker(false)} />
                  <div className="absolute z-50 bottom-full left-0 mb-1 w-full bg-popover border border-border rounded-lg shadow-lg p-3">
                    <p className="text-[13px] text-muted-foreground text-center">All available fields have been added</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* CENTER: Activity */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f5f0fa] dark:bg-purple-950/20">
          <ScrollArea className="flex-1">
            <div className="px-3 md:px-4 lg:px-6 pt-5">
              {/* Stats — floating card */}
              <div className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card mb-5">
                <div className="flex flex-col items-center justify-center py-3 px-2">
                  <span className="text-lg font-bold text-foreground">{activities.length}</span>
                  <span className="text-[11px] text-muted-foreground">Interactions</span>
                </div>
                <div className="flex flex-col items-center justify-center py-3 px-2">
                  <span className="text-lg font-bold text-foreground">{person.last_contacted ? format(parseISO(person.last_contacted), 'M/d/yyyy') : '—'}</span>
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
                    { key: 'email' as const, label: 'Send Email' },
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
              {activityTab === 'log' && (
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
              )}

              {activityTab === 'note' && (
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

              {activityTab === 'email' && (
                !gmail.gmailConnection ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-3">
                    <Mail className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Connect your Gmail to send emails</p>
                    <Button size="sm" onClick={gmail.connectGmail} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4 rounded-lg">
                      Connect Gmail
                    </Button>
                  </div>
                ) : (
                  <div>
                    {/* Show CC / BCC */}
                    <div className="flex justify-end mb-3">
                      <button
                        onClick={() => setShowCcBcc(!showCcBcc)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showCcBcc ? 'Hide' : 'Show'} <span className="underline">CC</span> / <span className="underline">BCC</span>
                      </button>
                    </div>

                    {/* Compose card */}
                    <div className="rounded-xl border border-border overflow-hidden bg-card">
                      {/* To row */}
                      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
                        <span className="text-sm text-muted-foreground shrink-0">To</span>
                        <div className="inline-flex items-center gap-1.5 bg-muted/60 rounded-full px-3 py-1">
                          <span className="h-5 w-5 rounded-full bg-amber-400 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {person.name[0]?.toUpperCase()}
                          </span>
                          <span className="text-sm font-medium text-foreground">{person.name}</span>
                        </div>
                      </div>

                      {/* CC row */}
                      {showCcBcc && (
                        <>
                          <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border">
                            <span className="text-sm text-muted-foreground shrink-0 w-7">CC</span>
                            <input
                              value={emailCc}
                              onChange={(e) => setEmailCc(e.target.value)}
                              placeholder="email@example.com"
                              className="flex-1 text-sm text-foreground bg-transparent outline-none placeholder:text-muted-foreground/40"
                            />
                          </div>
                          <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border">
                            <span className="text-sm text-muted-foreground shrink-0 w-7">BCC</span>
                            <input
                              value={emailBcc}
                              onChange={(e) => setEmailBcc(e.target.value)}
                              placeholder="email@example.com"
                              className="flex-1 text-sm text-foreground bg-transparent outline-none placeholder:text-muted-foreground/40"
                            />
                          </div>
                        </>
                      )}

                      {/* Subject row */}
                      <div className="flex items-center px-4 py-2.5 border-b border-border">
                        <input
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          placeholder="Subject"
                          className="flex-1 text-sm text-foreground bg-transparent outline-none placeholder:text-muted-foreground/40"
                        />
                      </div>

                      {/* Message body */}
                      <div className="px-1 py-1">
                        <RichTextEditor
                          value={emailBody}
                          onChange={setEmailBody}
                          placeholder="Message"
                          minHeight="200px"
                        />
                      </div>
                    </div>

                    {/* Send button */}
                    <div className="flex justify-end mt-4">
                      <Button
                        size="sm"
                        onClick={handleSendEmail}
                        disabled={sendingEmail || isHtmlEmpty(emailBody) || !person.email}
                        className="bg-violet-400 hover:bg-violet-500 text-white text-xs px-5 py-2 rounded-lg"
                      >
                        {sendingEmail && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
                        Send
                      </Button>
                    </div>
                  </div>
                )
              )}
                </div>
              </div>

              {/* Activity timeline */}
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Earlier</h3>
              <div className="space-y-3 pb-5">
                {activities.length > 0 ? (
                  activities.map((act: any) => {
                    const typeInfo = ACTIVITY_TYPE_ICONS[act.activity_type] ?? ACTIVITY_TYPE_ICONS.note;
                    const IconComp = typeInfo.icon;

                    // Handle type_change activities specially (no expand/comments)
                    if (act.activity_type === 'type_change' && act.content) {
                      let fromType: string | null = null;
                      let toType: string | null = null;
                      try {
                        const parsed = JSON.parse(act.content);
                        fromType = parsed.from;
                        toType = parsed.to;
                      } catch { /* ignore */ }

                      return (
                        <div key={act.id} className="flex gap-3 p-4 rounded-lg bg-card border border-border hover:border-blue-100 dark:hover:border-blue-900 transition-colors">
                          <div className={`h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 ${typeInfo.color}`}>
                            <IconComp className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-foreground">{act.title || 'Contact type changed'}</span>
                              <span className="text-[10px] text-muted-foreground">{formatShortDate(act.created_at)}</span>
                            </div>
                            {fromType && toType && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${contactTypeConfig[fromType]?.pill ?? 'bg-muted text-muted-foreground'}`}>
                                  {contactTypeConfig[fromType]?.label ?? fromType}
                                </span>
                                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${contactTypeConfig[toType]?.pill ?? 'bg-muted text-muted-foreground'}`}>
                                  {contactTypeConfig[toType]?.label ?? toType}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    const isExpanded = !!expandedActivities[act.id];
                    const comments = activityCommentsMap[act.id] ?? [];
                    const commentCount = comments.length;

                    return (
                      <div
                        key={act.id}
                        className={`rounded-lg bg-card border transition-colors ${isExpanded ? 'border-blue-200' : 'border-border hover:border-blue-100 dark:hover:border-blue-900'}`}
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
        <ScrollArea className="w-full md:w-[280px] lg:w-[310px] xl:w-[374px] md:shrink-0 md:min-w-[220px] min-w-0 border-t md:border-t-0 md:border-l border-border bg-card overflow-hidden">
          <div>
            {/* Financial Summary */}
            <div className="px-4 md:px-5 xl:px-6 py-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Won</p>
                  <p className="text-xl font-bold text-foreground mt-1">${financialStats.totalWon.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                  <p className="text-xl font-bold text-foreground mt-1">{financialStats.winRate}%</p>
                </div>
              </div>
              {person?.loan_amount && person.loan_amount > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-600 mb-1">
                    ${person.loan_amount >= 1000 ? `${(person.loan_amount / 1000).toFixed(1)}K` : person.loan_amount.toLocaleString()}
                  </p>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${financialStats.winRate}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Pipeline Records removed — people are no longer connected to pipelines */}

            {/* Tasks */}
            <Collapsible defaultOpen>
              <div className="border-t border-border">
                <CollapsibleTrigger className="flex items-center w-full px-3 md:px-3.5 xl:px-5 py-3 hover:bg-muted/30 transition-colors">
                  <span className="text-sm font-medium text-foreground">Tasks ({pendingTasks.length})</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
                  <button className="ml-2" onClick={(e) => { e.stopPropagation(); setEditingTask(null); setNewTaskTitle(''); setTaskDialogOpen(true); }}>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 md:px-3.5 xl:px-5 pb-4">
                  <div className="space-y-1">
                    {pendingTasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 rounded-md px-2 py-1.5 -mx-2 transition-colors group"
                        onClick={() => { setEditingTask(t); setTaskDialogOpen(true); }}>
                        <button onClick={(e) => { e.stopPropagation(); toggleTaskCompletion(t); }} className="shrink-0">
                          <div className="h-4 w-4 rounded-sm border border-muted-foreground/40 group-hover:border-emerald-400 transition-colors" />
                        </button>
                        <span className="flex-1 truncate text-foreground">{t.title}</span>
                        {t.due_date && <span className="text-xs text-muted-foreground shrink-0">{formatShortDate(t.due_date)}</span>}
                      </div>
                    ))}
                    {completedTasks.length > 0 && (
                      <>
                        <button onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 w-full">
                          {showCompletedTasks ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          Show completed ({completedTasks.length})
                        </button>
                        {showCompletedTasks && completedTasks.map((t) => (
                          <div key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 rounded-md px-2 py-1.5 -mx-2 transition-colors"
                            onClick={() => { setEditingTask(t); setTaskDialogOpen(true); }}>
                            <button onClick={(e) => { e.stopPropagation(); toggleTaskCompletion(t); }} className="shrink-0">
                              <CheckSquare className="h-4 w-4 text-emerald-500" />
                            </button>
                            <span className="flex-1 truncate line-through text-muted-foreground">{t.title}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Calendar Events */}
            <Collapsible defaultOpen>
              <div className="border-t border-border">
                <CollapsibleTrigger className="flex items-center w-full px-3 md:px-3.5 xl:px-5 py-3 hover:bg-muted/30 transition-colors">
                  <span className="text-sm font-medium text-foreground">Calendar Events ({calendarEvents.length})</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
                  <button className="ml-2" onClick={(e) => { e.stopPropagation(); setShowAddEvent(true); }}>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 md:px-3.5 xl:px-5 pb-4">
                  <div className="space-y-1.5">
                    {calendarEvents.map((ev) => (
                      <div key={ev.id} className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-muted/30 transition-colors group -mx-2">
                        <CalendarDays className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{ev.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatShortDate(ev.start_time)}
                            {ev.appointment_type && ` · ${ev.appointment_type}`}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                        </button>
                      </div>
                    ))}
                    {calendarEvents.length === 0 && !showAddEvent && (
                      <p className="text-sm text-muted-foreground">No events</p>
                    )}
                    {showAddEvent && (
                      <div className="space-y-2 pt-1 border-t border-border mt-1">
                        <input
                          value={newEventTitle}
                          onChange={(e) => setNewEventTitle(e.target.value)}
                          placeholder="Event title"
                          className="w-full text-sm bg-transparent border border-border rounded-md px-2 py-1.5 outline-none focus:border-blue-400"
                          autoFocus
                        />
                        <input
                          type="date"
                          value={newEventDate}
                          onChange={(e) => setNewEventDate(e.target.value)}
                          className="w-full text-xs bg-transparent border border-border rounded-md px-2 py-1.5 outline-none focus:border-blue-400"
                        />
                        <div className="flex gap-1.5">
                          <input type="time" value={newEventTime} onChange={(e) => setNewEventTime(e.target.value)}
                            className="flex-1 text-xs bg-transparent border border-border rounded-md px-2 py-1.5 outline-none focus:border-blue-400" />
                          <input type="time" value={newEventEndTime} onChange={(e) => setNewEventEndTime(e.target.value)}
                            className="flex-1 text-xs bg-transparent border border-border rounded-md px-2 py-1.5 outline-none focus:border-blue-400" />
                        </div>
                        <select value={newEventType} onChange={(e) => setNewEventType(e.target.value)}
                          className="w-full text-xs bg-transparent border border-border rounded-md px-2 py-1.5 outline-none focus:border-blue-400">
                          <option value="meeting">Meeting</option>
                          <option value="call">Call</option>
                          <option value="follow_up">Follow Up</option>
                          <option value="deadline">Deadline</option>
                        </select>
                        <div className="flex gap-1.5">
                          <button onClick={handleSaveEvent} disabled={savingEvent || !newEventTitle.trim() || !newEventDate}
                            className="flex-1 text-xs font-medium text-white bg-[#3b2778] hover:bg-[#4a3490] rounded-md py-1.5 disabled:opacity-50 transition-colors">
                            {savingEvent ? 'Saving...' : 'Add Event'}
                          </button>
                          <button onClick={() => { setShowAddEvent(false); setNewEventTitle(''); setNewEventDate(''); }}
                            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Projects */}
            <Collapsible defaultOpen>
              <div className="border-t border-border">
                <CollapsibleTrigger className="flex items-center w-full px-3 md:px-3.5 xl:px-5 py-3 hover:bg-muted/30 transition-colors">
                  <span className="text-sm font-medium text-foreground">Projects ({personProjects.length})</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
                  <button className="ml-auto" onClick={(e) => { e.stopPropagation(); setShowAddProject(true); }}>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 md:px-3.5 xl:px-5 pb-4">
                  {personProjects.length > 0 ? (
                    <div className="space-y-2">
                      {personProjects.map((proj) => (
                        <button
                          key={proj.id}
                          onClick={() => navigate(`/admin/pipeline/projects/expanded-view/${proj.id}`)}
                          className="flex items-center gap-3 text-sm py-2 rounded-lg hover:bg-muted/40 transition-colors w-full text-left"
                        >
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Briefcase className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground break-words">{proj.name}</p>
                            {proj.clx_file_name && (
                              <p className="text-xs text-blue-600 dark:text-blue-400 break-words">{proj.clx_file_name}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    !showAddProject && <p className="text-sm text-muted-foreground">No projects</p>
                  )}
                  {showAddProject && (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newProjectName.trim()) handleInlineCreateProject();
                          if (e.key === 'Escape') { setShowAddProject(false); setNewProjectName(''); }
                        }}
                        placeholder="Add Project"
                        className="flex-1 text-sm bg-transparent border-b-2 border-blue-500 outline-none py-1 placeholder:text-muted-foreground/50"
                        autoFocus
                        disabled={savingProject}
                      />
                      <button onClick={() => { setShowAddProject(false); setNewProjectName(''); }}>
                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </button>
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Files */}
            <Collapsible defaultOpen>
              <div className="border-t border-border">
                <CollapsibleTrigger className="flex items-center w-full px-3 md:px-3.5 xl:px-5 py-3 hover:bg-muted/30 transition-colors">
                  <span className="text-sm font-medium text-foreground">Files ({personFiles.length})</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1.5" />
                  <button className="ml-2" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 md:px-3.5 xl:px-5 pb-4">
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                  <div className="space-y-1.5">
                    {personFiles.map((f) => (
                      <div key={f.id} className="flex items-center gap-2 text-sm p-2 rounded-lg hover:bg-muted/30 transition-colors group -mx-2">
                        <span className="text-base shrink-0">{getFileIcon(f.file_type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{f.file_name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(f.file_size)} · {formatShortDate(f.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); handleDownloadFile(f); }} className="p-1 rounded hover:bg-muted" title="Download">
                            <Download className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </button>
                          <button onClick={() => handleDeleteFile(f)} className="p-1 rounded hover:bg-muted" title="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {uploadingFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading...
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Legacy sections hidden */}
            <div className="hidden">
            <RelatedSection icon={<Building2 className="h-3.5 w-3.5" />} label="Company" count={person.company_name ? 1 : 0} iconColor="text-indigo-500">
              <div className="space-y-2 py-1">
                {person.company_name ? (
                  <div className="text-xs text-foreground flex items-center gap-2">
                    <CrmAvatar name={person.company_name} size="xs" />
                    <span className="font-medium">{person.company_name}</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No company set</p>
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
                        {formatShortDate(t.due_date)}
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
                {/* Show completed tasks toggle */}
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

            {/* Files */}
            <RelatedSection
              icon={<FileText className="h-3.5 w-3.5" />}
              label="Files"
              count={personFiles.length}
              iconColor="text-orange-500"
              onAdd={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="space-y-1.5 py-1">
                {personFiles.map((f) => (
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
                {personFiles.length === 0 && !uploadingFile && (
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

            {/* Pipeline Records removed — people are no longer connected to pipelines */}

            {/* Calendar Events */}
            <RelatedSection icon={<CalendarDays className="h-3.5 w-3.5" />} label="Calendar Events" count={0} iconColor="text-amber-500">
              <p className="text-xs text-muted-foreground py-1">No events</p>
            </RelatedSection>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>

    {/* Customize Contact Types Dialog */}
    <Dialog open={showCustomizeDialog} onOpenChange={setShowCustomizeDialog}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Customize Contact Types</DialogTitle>
        </DialogHeader>
        <CustomizeContactTypesPanel
          customTypes={customContactTypes}
          onUpdate={(types) => {
            setCustomContactTypes(types);
            saveCustomContactTypes(types);
          }}
        />
      </DialogContent>
    </Dialog>

    {/* Task Detail Dialog */}
    {personId && (
      <PeopleTaskDetailDialog
        task={editingTask}
        open={taskDialogOpen}
        onClose={() => {
          setTaskDialogOpen(false);
          setEditingTask(null);
          setAddingTask(false);
          setNewTaskTitle('');
        }}
        leadId={personId}
        leadName={person?.name ?? ''}
        teamMembers={teamMembers}
        currentUserName={teamMember?.name ?? null}
        initialTitle={editingTask ? undefined : newTaskTitle}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['person-tasks', personId] });
        }}
      />
    )}

    </>
  );
}
