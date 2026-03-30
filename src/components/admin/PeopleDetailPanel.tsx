import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Maximize2, Building2, User, Mail, Phone, PhoneCall,
  Tag, FileText, Clock, ArrowRight, ChevronRight, Briefcase,
  Pencil, Check, Loader2, MessageSquare, Users, CheckSquare, ChevronDown, Layers,
  Link2, FolderOpen, AtSign, MapPin, Trash2, Copy, Plus, Download, Upload,
} from 'lucide-react';
import { RichTextEditor } from '@/components/ui/rich-text-input';
import { HtmlContent } from '@/components/ui/html-content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { AddressAutocompleteInput, type ParsedAddress } from '@/components/ui/address-autocomplete';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { formatPhoneNumber } from './InlineEditableFields';
import { CrmAvatar } from '@/components/admin/CrmAvatar';
import { PeopleTaskDetailDialog, type LeadTask } from './PeopleTaskDetailDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';
import { usePipelines } from '@/hooks/usePipelines';
import { sanitizeFileName } from '@/lib/utils';
import { differenceInDays, parseISO, format, formatDistanceToNow } from 'date-fns';

// ── File type ──
interface PersonFile {
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
  if (!fileType) return '\u{1F4C4}';
  if (fileType.startsWith('image/')) return '\u{1F5BC}\uFE0F';
  if (fileType === 'application/pdf') return '\u{1F4D5}';
  if (fileType.includes('spreadsheet') || fileType.includes('excel') || fileType.includes('csv')) return '\u{1F4CA}';
  if (fileType.includes('word') || fileType.includes('document')) return '\u{1F4DD}';
  if (fileType.includes('zip') || fileType.includes('compressed')) return '\u{1F4E6}';
  return '\u{1F4C4}';
}

function getPipelineLeadRoute(pipelineName: string, leadId: string): string {
  switch (pipelineName) {
    case 'Underwriting': return `/admin/pipeline/underwriting/expanded-view/${leadId}`;
    case 'Lender Management': return `/admin/pipeline/lender-management/expanded-view/${leadId}`;
    default: return `/admin/pipeline/pipeline/expanded-view/${leadId}`;
  }
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
  created_at: string;
  updated_at: string;
}

interface PersonEmail {
  id: string; lead_id: string; email: string; email_type: string; is_primary: boolean;
}
interface PersonPhone {
  id: string; lead_id: string; phone_number: string; phone_type: string; is_primary: boolean;
}
interface PersonAddress {
  id: string; lead_id: string; address_type: string; address_line_1: string | null; address_line_2: string | null; city: string | null; state: string | null; zip_code: string | null; country: string | null; is_primary: boolean;
}

interface ContactTypeConfigEntry {
  label: string;
  color: string;
  bg: string;
  dot: string;
  pill: string;
}

interface TeamMember {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface PeopleDetailPanelProps {
  person: Person;
  contactTypeConfig: Record<string, ContactTypeConfigEntry>;
  teamMemberMap: Record<string, string>;
  teamMembers?: TeamMember[];
  onClose: () => void;
  onExpand?: () => void;
  onContactTypeChange?: (personId: string, newType: string) => void;
  onPersonUpdate?: (updatedPerson: Person) => void;
}

const CONTACT_TYPES = [
  'Client', 'Prospect', 'Referral Partner', 'Lender',
  'Attorney', 'CPA', 'Vendor', 'Other',
];

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    return differenceInDays(new Date(), parseISO(dateStr));
  } catch {
    return null;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return '\u2014';
  }
}

// ── Generic inline-save helper ──
function useInlineSave(
  personId: string,
  field: string,
  currentValue: string,
  onSaved: (field: string, newValue: string) => void,
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) setDraft(currentValue);
  }, [editing, currentValue]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === currentValue) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('leads')
      .update({ [field]: trimmed || null })
      .eq('id', personId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    onSaved(field, trimmed);
    setEditing(false);
  }, [draft, currentValue, field, personId, onSaved]);

  const cancel = useCallback(() => {
    setDraft(currentValue);
    setEditing(false);
  }, [currentValue]);

  return { editing, setEditing, draft, setDraft, saving, save, cancel };
}

// ── Simple field (header + value, click to edit) ──
function SimpleField({
  label,
  value,
  field,
  personId,
  onSaved,
  placeholder,
  required,
  multiline,
}: {
  label: string;
  value: string;
  field: string;
  personId: string;
  onSaved: (updated: any) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  const { editing, setEditing, draft, setDraft, saving, save } = useInlineSave(personId, field, value, onSaved);

  if (editing) {
    return (
      <div>
        <span className="text-[12px] font-semibold text-muted-foreground">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</span>
        {multiline ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Escape') setEditing(false); }}
            onBlur={() => save()}
            rows={3}
            className="w-full mt-0.5 text-[15px] text-foreground bg-transparent border-b border-blue-400 outline-none resize-none"
          />
        ) : (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            onBlur={() => save()}
            className="w-full mt-0.5 text-[15px] text-foreground bg-transparent border-b border-blue-400 outline-none"
          />
        )}
      </div>
    );
  }

  return (
    <div className="cursor-pointer" onClick={() => setEditing(true)}>
      <span className="text-[12px] font-semibold text-muted-foreground">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</span>
      <p className={`text-[15px] mt-0.5 ${value ? 'font-medium text-foreground' : 'text-muted-foreground/50'}`}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : (value || placeholder || `Add ${label}`)}
      </p>
    </div>
  );
}

// ── Editable field row ──
function EditableField({
  icon, label, value, field, personId, onSaved,
}: {
  icon: React.ReactNode; label: string; value: string; field: string;
  personId: string;
  onSaved: (field: string, newValue: string) => void;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(personId, field, value, onSaved);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-50/50">
        <div className="flex items-center gap-2 text-blue-400 shrink-0">
          {icon}
          <span className="text-xs font-medium text-blue-500">{label}</span>
        </div>
        <div className="flex-1 flex items-center gap-1.5 justify-end">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            onBlur={save}
            disabled={saving}
            className="w-full text-right text-[13px] font-medium text-foreground bg-card border border-blue-200 dark:border-blue-800 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all"
          />
          {saving && <Loader2 className="h-3 w-3 animate-spin text-blue-500 shrink-0" />}
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => setEditing(true)} className="flex items-center justify-between px-3 py-2 hover:bg-muted/40 transition-colors cursor-pointer group">
      <div className="flex items-center gap-2 text-muted-foreground shrink-0">
        {icon}
        <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] text-right truncate font-medium text-foreground">
          {value || '\u2014'}
        </span>
        <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
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
    if (editing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editing]);

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('leads').update({ [field]: null }).eq('id', personId);
    if (error) { toast.error('Failed to clear'); return; }
    onSaved(field, '');
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-blue-50/50 border border-blue-100">
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

// ── Editable Tags ──
function EditableTags({
  tags, personId, onSaved,
}: {
  tags: string[]; personId: string;
  onSaved: (field: string, newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tags.join(', '));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(tags.join(', '));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [editing, tags]);

  const save = async () => {
    const newTags = draft.split(',').map(t => t.trim()).filter(Boolean);
    const currentStr = tags.join(',');
    const newStr = newTags.join(',');
    if (newStr === currentStr) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('leads')
      .update({ tags: newTags.length > 0 ? newTags : null })
      .eq('id', personId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    onSaved('tags', JSON.stringify(newTags.length > 0 ? newTags : null));
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-2.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          onBlur={save}
          placeholder="tag1, tag2, tag3..."
          disabled={saving}
          className="w-full text-[13px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground/50"
        />
        <p className="text-[10px] text-muted-foreground mt-1">Comma-separated. Press Enter to save.</p>
        {saving && <Loader2 className="h-3 w-3 animate-spin text-blue-500 mt-1" />}
      </div>
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
  value, personId, field, onSaved, placeholder = 'Click to add...',
}: {
  value: string; personId: string; field: string;
  onSaved: (field: string, newValue: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setDraft(value);
    }
  }, [editing, value]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === value) { setEditing(false); return; }
    setSaving(true);
    const { error } = await supabase
      .from('leads')
      .update({ [field]: trimmed || null })
      .eq('id', personId);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    onSaved(field, trimmed);
    setEditing(false);
  }, [draft, value, field, personId, onSaved]);

  if (editing) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3">
        <RichTextEditor
          value={draft}
          onChange={setDraft}
          placeholder={placeholder}
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
        <p className="text-[13px] text-muted-foreground italic">{placeholder}</p>
      )}
      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Click to edit</span>
      </div>
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
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50/50 border border-blue-100">
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
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50/50 border border-blue-100">
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
      <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-2.5 space-y-2">
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

// ── Timeline icon config ──
const TIMELINE_ICON_CONFIG: Record<string, { icon: React.ReactNode; dotColor: string }> = {
  type_change: { icon: <ArrowRight className="h-3 w-3" />, dotColor: 'bg-blue-500 text-white' },
  call: { icon: <Phone className="h-3 w-3" />, dotColor: 'bg-blue-500 text-white' },
  sms: { icon: <MessageSquare className="h-3 w-3" />, dotColor: 'bg-emerald-500 text-white' },
  email: { icon: <Mail className="h-3 w-3" />, dotColor: 'bg-amber-500 text-white' },
  comment: { icon: <MessageSquare className="h-3 w-3" />, dotColor: 'bg-slate-500 text-white' },
};

// ── Activity Tab Content ──
function ActivityTabContent({ person, contactTypeConfig }: { person: Person; contactTypeConfig: Record<string, ContactTypeConfigEntry> }) {
  const queryClient = useQueryClient();
  const { teamMember } = useTeamMember();
  const [activityTab, setActivityTab] = useState<'log' | 'note'>('log');
  const [activityType, setActivityType] = useState('to_do');
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const { data: communications = [], isLoading: loadingComms } = useQuery({
    queryKey: ['people-activity-timeline', 'communications', person.id, person.phone],
    queryFn: async () => {
      if (!person.phone) return [];
      const digits = person.phone.replace(/\D/g, '');
      if (!digits) return [];
      const { data, error } = await supabase
        .from('communications')
        .select('id, communication_type, direction, content, duration_seconds, created_at')
        .eq('phone_number', digits)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ['people-activity-timeline', 'activities', person.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_activities')
        .select('id, activity_type, title, content, created_at, created_by')
        .eq('lead_id', person.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const isLoading = loadingComms || loadingActivities;

  // ── Stats ──
  const stats = useMemo(() => {
    const total = communications.length + activities.length;
    let lastDate: Date | null = null;
    const allDates = [
      ...communications.map(c => new Date(c.created_at)),
      ...activities.map(a => new Date(a.created_at)),
    ];
    if (allDates.length > 0) lastDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    const inactive = lastDate ? differenceInDays(new Date(), lastDate) : null;
    return { total, lastDate, inactive };
  }, [communications, activities]);

  // ── Log activity mutation ──
  const handleLogActivity = async () => {
    if (!noteContent.trim()) return;
    setSavingNote(true);
    const { error } = await supabase.from('lead_activities').insert({
      lead_id: person.id,
      activity_type: activityTab === 'log' ? activityType : 'note',
      title: activityTab === 'log' ? activityType.replace(/_/g, ' ') : 'Note',
      content: noteContent.trim(),
      created_by: teamMember?.name ?? 'Unknown',
    });
    setSavingNote(false);
    if (error) { toast.error('Failed to save'); return; }
    setNoteContent('');
    queryClient.invalidateQueries({ queryKey: ['people-activity-timeline', 'activities', person.id] });
    toast.success(activityTab === 'log' ? 'Activity logged' : 'Note saved');
  };

  interface TimelineItem {
    id: string;
    type: string;
    title: string;
    content: string | null;
    createdAt: string;
    createdBy?: string | null;
    source: 'communication' | 'activity';
    direction?: string;
    durationSeconds?: number | null;
  }

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    for (const c of communications) {
      const typeLabel = c.communication_type === 'sms' ? 'SMS' : c.communication_type === 'call' ? 'Call' : 'Email';
      const dirLabel = c.direction === 'inbound' ? 'Inbound' : 'Outbound';
      items.push({ id: c.id, type: c.communication_type, title: `${dirLabel} ${typeLabel}`, content: c.content, createdAt: c.created_at, source: 'communication', direction: c.direction, durationSeconds: c.duration_seconds });
    }
    for (const a of activities) {
      items.push({ id: a.id, type: a.activity_type, title: a.title ?? a.activity_type, content: a.content, createdAt: a.created_at, createdBy: (a as any).created_by, source: 'activity' });
    }
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return items;
  }, [communications, activities]);

  if (isLoading) {
    return (
      <div className="px-5 py-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-4">

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-3 rounded-lg border border-border divide-x divide-border overflow-hidden bg-white dark:bg-card">
        <div className="py-3 text-center">
          <p className="text-lg font-bold text-foreground">{stats.total}</p>
          <p className="text-[11px] text-muted-foreground">Interactions</p>
        </div>
        <div className="py-3 text-center">
          <p className="text-lg font-bold text-foreground">{stats.lastDate ? format(stats.lastDate, 'M/d/yyyy') : '—'}</p>
          <p className="text-[11px] text-muted-foreground">Last Contacted</p>
        </div>
        <div className="py-3 text-center">
          <p className="text-lg font-bold text-foreground">{stats.inactive ?? '—'}</p>
          <p className="text-[11px] text-muted-foreground">Inactive Days</p>
        </div>
      </div>

      {/* ── Log Activity / Create Note ── */}
      <div className="rounded-lg border border-border overflow-hidden bg-white dark:bg-card">
        <div className="flex border-b border-border">
          {(['log', 'note'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActivityTab(tab)}
              className={`flex-1 py-2.5 text-[13px] font-semibold transition-colors relative text-center ${
                activityTab === tab ? 'text-[#3b2778]' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'log' ? 'Log Activity' : 'Create Note'}
              {activityTab === tab && <span className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #6d28d9, #8b5cf6, #a78bfa)' }} />}
            </button>
          ))}
        </div>
        <div className="p-4 space-y-3">
          {activityTab === 'log' && (
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="to_do">To Do</SelectItem>
                <SelectItem value="phone_call">Phone Call</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="follow_up">Follow Up</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Click here to add a note"
            rows={3}
            className="resize-none text-sm"
          />
          {noteContent.trim() && (
            <div className="flex justify-end">
              <Button size="sm" onClick={handleLogActivity} disabled={savingNote} className="bg-[#3b2778] hover:bg-[#2d1d5e] text-white">
                {savingNote && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                {activityTab === 'note' ? 'Save Note' : 'Log Activity'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Earlier label ── */}
      {timelineItems.length > 0 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-[13px] font-medium text-muted-foreground">Earlier</span>
          <span className="text-[12px] text-muted-foreground">Filters ({timelineItems.length})</span>
        </div>
      )}

      {/* ── Activity Feed ── */}
      {timelineItems.length === 0 ? (
        <div className="py-8 flex flex-col items-center justify-center text-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No activity recorded yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {timelineItems.map((item) => {
            const iconCfg = TIMELINE_ICON_CONFIG[item.type] ?? TIMELINE_ICON_CONFIG.comment;
            const initial = item.createdBy?.[0]?.toUpperCase() ?? '?';

            let fromType: string | null = null;
            let toType: string | null = null;
            if (item.type === 'type_change' && item.content) {
              try { const p = JSON.parse(item.content); fromType = p.from; toType = p.to; } catch { /* */ }
            }

            return (
              <div key={item.id} className="rounded-lg border border-border bg-white dark:bg-card p-4 hover:border-[#c8bdd6] transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold ${iconCfg.dotColor}`}>
                    {item.source === 'activity' ? initial : iconCfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate">{item.title}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                    {format(parseISO(item.createdAt), 'MMM d, yyyy')}
                  </span>
                </div>

                {item.type === 'type_change' && fromType && toType && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${contactTypeConfig[fromType]?.pill ?? 'bg-muted text-muted-foreground'}`}>
                      {contactTypeConfig[fromType]?.label ?? fromType}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${contactTypeConfig[toType]?.pill ?? 'bg-muted text-muted-foreground'}`}>
                      {contactTypeConfig[toType]?.label ?? toType}
                    </span>
                  </div>
                )}

                {item.type !== 'type_change' && item.content && (
                  <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">{item.content}</p>
                )}

                {item.type === 'call' && item.durationSeconds != null && item.durationSeconds > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">{Math.floor(item.durationSeconds / 60)}m {item.durationSeconds % 60}s</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Reusable collapsible section for Related tab ──
function RelatedSection({ label, count, defaultOpen, onAdd, children }: {
  label: string;
  count: number;
  defaultOpen?: boolean;
  onAdd?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <div className="border-t border-border">
        <div className="flex items-center justify-between px-6 py-3">
          <CollapsibleTrigger className="flex items-center gap-1 hover:text-foreground transition-colors">
            <span className="text-[14px] font-semibold text-foreground">{label} ({count})</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </CollapsibleTrigger>
          <button
            onClick={onAdd}
            className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            title={`Add ${label}`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <CollapsibleContent className="px-6 pb-3">
          {children}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ── Related Tab Content ──
function RelatedTabContent({ person, contactTypeConfig }: { person: Person; contactTypeConfig: Record<string, ContactTypeConfigEntry> }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { teamMember } = useTeamMember();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<LeadTask | null>(null);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // ── Pipeline state ──
  const [pipelineSearchText, setPipelineSearchText] = useState('');
  const [pipelineSearchFocused, setPipelineSearchFocused] = useState(false);

  // ── File state ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['person-tasks', person.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('lead_id', person.id)
        .order('created_at', { ascending: false });
      return (data || []) as LeadTask[];
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, name').eq('is_active', true);
      return (data || []) as { id: string; name: string }[];
    },
  });

  // ── Pipeline records query ──
  const { data: pipelineRecords = [] } = useQuery({
    queryKey: ['person-pipeline-records', person.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pipeline_leads')
        .select('id, pipeline_id, stage_id, added_at, updated_at, pipeline:pipelines(id, name), stage:pipeline_stages(id, name, color)')
        .eq('lead_id', person.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Array<{
        id: string;
        pipeline_id: string;
        stage_id: string;
        added_at: string;
        updated_at: string;
        pipeline: { id: string; name: string };
        stage: { id: string; name: string; color: string | null };
      }>;
    },
  });

  const { data: allPipelines = [] } = usePipelines();

  const filteredPipelines = useMemo(() => {
    if (!pipelineSearchText.trim()) return allPipelines;
    const q = pipelineSearchText.toLowerCase();
    return allPipelines.filter((p: any) => p.name?.toLowerCase().includes(q));
  }, [allPipelines, pipelineSearchText]);

  const addToPipelineMutation = useMutation({
    mutationFn: async (pipelineId: string) => {
      const { data: stages, error: stagesError } = await (supabase as any)
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', pipelineId)
        .order('position')
        .limit(1);
      if (stagesError) throw stagesError;
      if (!stages || stages.length === 0) throw new Error('Pipeline has no stages');

      const { error: insertError } = await (supabase as any)
        .from('pipeline_leads')
        .insert({ pipeline_id: pipelineId, lead_id: person.id, stage_id: stages[0].id });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-pipeline-records', person.id] });
      queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      toast.success('Added to pipeline');
      setPipelineSearchText('');
      setPipelineSearchFocused(false);
    },
    onError: () => toast.error('Failed to add to pipeline'),
  });

  // ── Person files query ──
  const { data: personFiles = [] } = useQuery({
    queryKey: ['person-files', person.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_files')
        .select('id, lead_id, file_name, file_url, file_type, file_size, uploaded_by, created_at')
        .eq('lead_id', person.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PersonFile[];
    },
  });

  // ── Related people (same company) ──
  const { data: relatedPeople = [] } = useQuery({
    queryKey: ['related-people', person.id, person.company_name],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name')
        .eq('company_name', person.company_name!)
        .neq('id', person.id)
        .order('name')
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
    enabled: !!person.company_name,
  });

  // ── Remove from pipeline ──
  const removeFromPipelineMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await (supabase as any).from('pipeline_leads').delete().eq('id', recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-pipeline-records', person.id] });
      queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      toast.success('Removed from pipeline');
    },
    onError: () => toast.error('Failed to remove from pipeline'),
  });

  // ── Core file upload logic ──
  const uploadFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large (max 10MB)');
      return;
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      toast.error('You must be logged in to upload files.');
      return;
    }

    setUploadingFile(true);
    const filePath = `${person.id}/${Date.now()}_${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from('lead-files')
      .upload(filePath, file, { contentType: file.type || 'application/octet-stream', upsert: true });
    if (uploadError) {
      setUploadingFile(false);
      toast.error(`Upload failed: ${uploadError.message || 'Storage error'}`);
      return;
    }

    const { error: dbError } = await supabase.from('lead_files').insert({
      lead_id: person.id,
      file_name: file.name,
      file_url: filePath,
      file_type: file.type || null,
      file_size: file.size,
    });
    setUploadingFile(false);
    if (dbError) {
      toast.error(`Failed to save file: ${dbError.message || 'Database error'}`);
      await supabase.storage.from('lead-files').remove([filePath]);
      return;
    }
    toast.success('File uploaded');
    queryClient.invalidateQueries({ queryKey: ['person-files', person.id] });
  }, [person.id, queryClient]);

  // ── File upload from input ──
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    uploadFile(file);
  }, [uploadFile]);

  // ── Drag-and-drop handlers ──
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  // ── File delete ──
  const handleDeleteFile = useCallback(async (file: PersonFile) => {
    await supabase.storage.from('lead-files').remove([file.file_url]);
    const { error } = await supabase.from('lead_files').delete().eq('id', file.id);
    if (error) {
      toast.error('Failed to delete file');
      return;
    }
    toast.success('File deleted');
    queryClient.invalidateQueries({ queryKey: ['person-files', person.id] });
  }, [person.id, queryClient]);

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

  const toggleTaskCompletion = useCallback(async (task: LeadTask) => {
    const isCompleting = !task.completed_at;
    await supabase.from('tasks').update({
      completed_at: isCompleting ? new Date().toISOString() : null,
      is_completed: isCompleting,
      status: isCompleting ? 'done' : 'todo',
      updated_at: new Date().toISOString(),
    }).eq('id', task.id);
    queryClient.invalidateQueries({ queryKey: ['person-tasks', person.id] });
  }, [person.id, queryClient]);

  const pendingTasks = tasks.filter(t => !t.completed_at);
  const completedTasks = tasks.filter(t => !!t.completed_at);

  if (loadingTasks) {
    return (
      <div className="px-5 py-4 space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="py-4">

      {/* ── Stats: Total Won + Win Rate ── */}
      <div className="px-6 pb-5">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <span className="text-[12px] font-medium text-muted-foreground">Total Won</span>
            <p className="text-xl font-bold text-foreground mt-0.5">$0</p>
          </div>
          <div>
            <span className="text-[12px] font-medium text-muted-foreground">Win Rate</span>
            <p className="text-xl font-bold text-foreground mt-0.5">0%</p>
          </div>
        </div>
      </div>

      {/* ── Pipeline Records ── */}
      <RelatedSection label="Pipeline Records" count={pipelineRecords.length} defaultOpen>
        <div className="space-y-1.5">
          {pipelineRecords.map((rec: any) => (
            <button
              key={rec.id}
              onClick={() => navigate(getPipelineLeadRoute(rec.pipeline.name, person.id))}
              className="flex items-center gap-2.5 text-[13px] p-2 rounded-lg hover:bg-muted/40 transition-colors w-full text-left group"
            >
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: rec.stage?.color || '#6b7280' }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{rec.pipeline.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {rec.stage?.name} · {formatDate(rec.added_at)}
                </p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); removeFromPipelineMutation.mutate(rec.id); }}
                  className="p-1 rounded hover:bg-muted"
                  title="Remove from pipeline"
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                </button>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </button>
          ))}

          <div className="relative mt-1">
            <input
              value={pipelineSearchText}
              onChange={(e) => setPipelineSearchText(e.target.value)}
              onFocus={() => setPipelineSearchFocused(true)}
              placeholder="Add Pipeline Record"
              className="w-full text-[13px] text-foreground bg-transparent border-0 border-b border-muted-foreground/20 focus:border-[#3b2778] px-0 py-1.5 outline-none placeholder:text-muted-foreground/50 transition-colors"
            />
            {pipelineSearchFocused && filteredPipelines.length > 0 && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => { setPipelineSearchFocused(false); setPipelineSearchText(''); }} />
                <div className="absolute z-50 top-full left-0 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                  {filteredPipelines.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => addToPipelineMutation.mutate(p.id)}
                      className="w-full text-left px-3 py-2 text-[13px] text-foreground hover:bg-muted/50 transition-colors"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </RelatedSection>

      {/* ── People ── */}
      <RelatedSection label="People" count={1 + relatedPeople.length}>
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 py-1.5">
            <CrmAvatar name={person.name} />
            <span className="text-[13px] font-medium text-foreground">{person.name}</span>
          </div>
          {relatedPeople.map((rp) => (
            <button
              key={rp.id}
              onClick={() => navigate(`/admin/contacts/people/expanded-view/${rp.id}`)}
              className="flex items-center gap-2.5 py-1.5 w-full text-left hover:bg-muted/50 rounded-md px-1 -mx-1 transition-colors group"
            >
              <CrmAvatar name={rp.name} />
              <span className="text-[13px] font-medium text-foreground truncate flex-1">{rp.name}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          ))}
        </div>
      </RelatedSection>

      {/* ── Tasks ── */}
      <RelatedSection label="Tasks" count={pendingTasks.length} onAdd={() => { setEditingTask(null); setTaskDialogOpen(true); }}>
        {pendingTasks.length === 0 && completedTasks.length === 0 ? (
          <p className="text-[13px] text-muted-foreground/50 py-1">No tasks</p>
        ) : (
          <div className="space-y-1">
            {pendingTasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md px-1 py-1 -mx-1 transition-colors group"
                onClick={() => { setEditingTask(t); setTaskDialogOpen(true); }}
              >
                <button onClick={(e) => { e.stopPropagation(); toggleTaskCompletion(t); }} className="shrink-0">
                  <div className="h-4 w-4 rounded border border-border group-hover:border-emerald-400 transition-colors" />
                </button>
                <span className="text-[13px] truncate flex-1 text-foreground">{t.title}</span>
                {t.due_date && <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">{formatDate(t.due_date)}</span>}
              </div>
            ))}
            {completedTasks.length > 0 && (
              <>
                <button onClick={() => setShowCompletedTasks(!showCompletedTasks)} className="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors py-1 w-full">
                  {showCompletedTasks ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  Completed ({completedTasks.length})
                </button>
                {showCompletedTasks && completedTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md px-1 py-0.5 -mx-1 transition-colors" onClick={() => { setEditingTask(t); setTaskDialogOpen(true); }}>
                    <button onClick={(e) => { e.stopPropagation(); toggleTaskCompletion(t); }} className="shrink-0"><CheckSquare className="h-4 w-4 text-emerald-500" /></button>
                    <span className="text-[13px] truncate flex-1 text-muted-foreground line-through">{t.title}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </RelatedSection>

      {/* ── Files ── */}
      <RelatedSection label="Files" count={personFiles.length} onAdd={() => fileInputRef.current?.click()}>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
        />
        <div
          className={`space-y-1.5 rounded-lg transition-colors ${isDragging ? 'bg-[#eee6f6] dark:bg-purple-950/30 border-2 border-dashed border-[#3b2778] p-2' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging ? (
            <div className="flex flex-col items-center justify-center py-4 gap-1.5">
              <Upload className="h-5 w-5 text-[#3b2778]" />
              <span className="text-[13px] font-medium text-[#3b2778]">Drop file here</span>
            </div>
          ) : (
            <>
              {personFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-2 text-[13px] p-1.5 rounded-lg hover:bg-muted/40 transition-colors group">
                  <span className="text-sm shrink-0">{getFileIcon(f.file_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{f.file_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatFileSize(f.file_size)} · {formatDate(f.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownloadFile(f); }}
                      className="p-1 rounded hover:bg-muted"
                      title="Download"
                    >
                      <Download className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                    <button
                      onClick={() => handleDeleteFile(f)}
                      className="p-1 rounded hover:bg-muted"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
              {uploadingFile && (
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground py-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3b2778]" />
                  Uploading...
                </div>
              )}
              {personFiles.length === 0 && !uploadingFile && (
                <p className="text-[13px] text-muted-foreground/50 py-1">No files</p>
              )}
            </>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-[13px] text-[#3b2778] dark:text-purple-400 font-medium hover:text-[#2a1d5c] dark:hover:text-purple-300 transition-colors py-1"
          >
            + Upload file...
          </button>
        </div>
      </RelatedSection>

      {/* ── Calendar Events ── */}
      <RelatedSection label="Calendar Events" count={0}>
        <p className="text-[13px] text-muted-foreground/50 py-1">No events</p>
      </RelatedSection>

      {/* ── Projects ── */}
      <RelatedSection label="Projects" count={0}>
        <p className="text-[13px] text-muted-foreground/50 py-1">No projects</p>
      </RelatedSection>

      <PeopleTaskDetailDialog
        task={editingTask}
        open={taskDialogOpen}
        onClose={() => { setTaskDialogOpen(false); setEditingTask(null); }}
        leadId={person.id}
        leadName={person.name}
        teamMembers={teamMembers}
        currentUserName={teamMember?.name ?? null}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['person-tasks', person.id] });
        }}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════
// ── Main Panel ──
// ══════════════════════════════════════════════════
export default function PeopleDetailPanel({
  person,
  contactTypeConfig,
  teamMemberMap,
  teamMembers = [],
  onClose,
  onExpand,
  onContactTypeChange,
  onPersonUpdate,
}: PeopleDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'activity' | 'related'>('details');
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const typeCfg = contactTypeConfig[person.contact_type ?? 'Other'];

  // ── Satellite queries ──
  const { data: personEmails = [] } = useQuery({
    queryKey: ['person-emails', person.id],
    queryFn: async () => {
      const { data } = await supabase.from('lead_emails').select('*').eq('lead_id', person.id);
      return (data || []) as PersonEmail[];
    },
  });

  const { data: personPhones = [] } = useQuery({
    queryKey: ['person-phones', person.id],
    queryFn: async () => {
      const { data } = await supabase.from('lead_phones').select('*').eq('lead_id', person.id);
      return (data || []) as PersonPhone[];
    },
  });

  const { data: personAddresses = [] } = useQuery({
    queryKey: ['person-addresses', person.id],
    queryFn: async () => {
      const { data } = await supabase.from('lead_addresses').select('*').eq('lead_id', person.id);
      return (data || []) as PersonAddress[];
    },
  });

  // ── Satellite mutations ──
  const addEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from('lead_emails').insert({ lead_id: person.id, email, email_type: newEmailType });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-emails', person.id] }); setNewEmail(''); setShowAddEmail(false); toast.success('Email added'); },
    onError: () => toast.error('Failed to add email'),
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase.from('lead_emails').delete().eq('id', emailId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-emails', person.id] }); toast.success('Email removed'); },
    onError: () => toast.error('Failed to remove email'),
  });

  const addPhoneMutation = useMutation({
    mutationFn: async (phone: string) => {
      const { error } = await supabase.from('lead_phones').insert({ lead_id: person.id, phone_number: phone, phone_type: newPhoneType });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-phones', person.id] }); setNewPhone(''); setShowAddPhone(false); toast.success('Phone added'); },
    onError: () => toast.error('Failed to add phone'),
  });

  const deletePhoneMutation = useMutation({
    mutationFn: async (phoneId: string) => {
      const { error } = await supabase.from('lead_phones').delete().eq('id', phoneId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-phones', person.id] }); toast.success('Phone removed'); },
    onError: () => toast.error('Failed to remove phone'),
  });

  const addAddressMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('lead_addresses').insert({
        lead_id: person.id,
        address_line_1: newAddressLine1.trim(),
        city: newAddressCity.trim() || null,
        state: newAddressState.trim() || null,
        zip_code: newAddressZip.trim() || null,
        address_type: newAddressType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person-addresses', person.id] });
      setNewAddressLine1(''); setNewAddressCity(''); setNewAddressState(''); setNewAddressZip('');
      setNewAddressType('business'); setShowAddAddress(false);
      toast.success('Address added');
    },
    onError: () => toast.error('Failed to add address'),
  });

  const deleteAddressMutation = useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await supabase.from('lead_addresses').delete().eq('id', addressId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-addresses', person.id] }); toast.success('Address removed'); },
    onError: () => toast.error('Failed to remove address'),
  });

  const updateEmailMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { email?: string; email_type?: string } }) => {
      const { error } = await supabase.from('lead_emails').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-emails', person.id] }); toast.success('Email updated'); },
    onError: () => toast.error('Failed to update email'),
  });

  const updatePhoneMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { phone_number?: string; phone_type?: string } }) => {
      const { error } = await supabase.from('lead_phones').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-phones', person.id] }); toast.success('Phone updated'); },
    onError: () => toast.error('Failed to update phone'),
  });

  const updateAddressMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PersonAddress> }) => {
      const { error } = await supabase.from('lead_addresses').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['person-addresses', person.id] }); toast.success('Address updated'); },
    onError: () => toast.error('Failed to update address'),
  });

  const handleFieldSaved = useCallback((field: string, newValue: string) => {
    queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });
    if (onPersonUpdate) {
      if (field === 'tags') {
        try {
          onPersonUpdate({ ...person, tags: JSON.parse(newValue) });
        } catch {
          onPersonUpdate({ ...person });
        }
      } else {
        onPersonUpdate({ ...person, [field]: newValue || null });
      }
    }
    toast.success('Updated');
  }, [person, onPersonUpdate, queryClient]);

  return (
    <aside className="shrink-0 w-[380px] border-l border-border/60 border-b-2 border-b-gray-300 dark:border-b-border bg-white dark:bg-card flex flex-col shadow-lg animate-in slide-in-from-right-5 duration-200">
      {/* ── Header ── */}
      <div className="shrink-0">
        {/* Top bar: X close + Follow/actions */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            <Button size="sm" className="h-8 rounded-full bg-[#3b2778] hover:bg-[#2d1d5e] text-white text-xs font-semibold px-4">
              Follow
            </Button>
            {onExpand && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Expand" onClick={onExpand}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Copy" onClick={() => { navigator.clipboard.writeText(person.name); toast.success('Copied'); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Avatar + Name + Subtitle + Company badge */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <CrmAvatar name={person.name} imageUrl={person.image_url} size="xl" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-foreground truncate leading-tight">{person.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">1 Contact</p>
              {person.company_name && (
                <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full border border-border bg-white dark:bg-card">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">{person.company_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {(['details', 'activity', 'related'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-[13px] font-semibold uppercase tracking-wider transition-all relative text-center ${
                activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #6d28d9, #8b5cf6, #a78bfa)' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'details' && (
        <div>
          <div className="px-6 py-5 space-y-6">

            {/* Name */}
            <SimpleField label="Name" value={person.name} field="name" personId={person.id} onSaved={handleFieldSaved} required />

            {/* CLX File Name */}
            <SimpleField label="CLX - File Name" value={person.clx_file_name ?? ''} field="clx_file_name" personId={person.id} onSaved={handleFieldSaved} placeholder="Add CLX - File Name" />

            {/* Work Phone */}
            <SimpleField label="Work Phone" value={person.phone ?? ''} field="phone" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Phone" />

            {/* Primary Contact — name + title/email */}
            <div>
              <span className="text-[12px] font-semibold text-muted-foreground">Primary Contact</span>
              <p className="text-[15px] text-blue-700 dark:text-blue-400 mt-0.5">{person.name}</p>
              {(person.title || person.email) && (
                <div className="flex items-center gap-2 mt-1">
                  <div className={`h-7 w-7 rounded-full bg-gray-200 dark:bg-muted flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0`}>
                    {person.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    {person.title && <p className="text-[13px] text-muted-foreground truncate">{person.title}</p>}
                    {person.email && (
                      <div className="flex items-center gap-1">
                        <a href={`mailto:${person.email}`} className="text-[13px] text-blue-700 dark:text-blue-400 truncate hover:underline">{person.email}</a>
                        <button onClick={() => { navigator.clipboard.writeText(person.email!); }} className="shrink-0 text-muted-foreground hover:text-foreground" title="Copy email">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Direct Phone */}
            <SimpleField label="Direct Phone" value="" field="phone" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Direct Phone" />

            {/* Fax Phone */}
            <SimpleField label="Fax Phone" value="" field="phone" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Fax Phone" />

            {/* Owner */}
            <div>
              <span className="text-[12px] font-semibold text-muted-foreground">Owner</span>
              <div className="flex items-center justify-between mt-0.5">
                <p className="text-[15px] text-blue-700 dark:text-blue-400">
                  {person.assigned_to ? (teamMemberMap[person.assigned_to] ?? 'Unknown') : <span className="text-muted-foreground/50">Unassigned</span>}
                </p>
                {person.assigned_to && (
                  <button onClick={() => handleFieldSaved({ ...person, assigned_to: null })} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Work Website */}
            <SimpleField label="Work Website" value={person.linkedin ?? ''} field="linkedin" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Website" />

            {/* Contact Type */}
            {onContactTypeChange && (
              <div>
                <span className="text-[12px] font-semibold text-muted-foreground">Contact Type</span>
                <Select value={person.contact_type ?? 'Other'} onValueChange={(v) => onContactTypeChange(person.id, v)}>
                  <SelectTrigger className="h-9 w-full mt-0.5 text-[15px] font-medium border-0 bg-transparent shadow-none p-0 focus:ring-0">
                    <SelectValue>{typeCfg?.label ?? person.contact_type}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_TYPES.map((t) => {
                      const cfg = contactTypeConfig[t];
                      return <SelectItem key={t} value={t}>{cfg?.label ?? t}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Email Domain */}
            <div>
              <span className="text-[12px] font-semibold text-muted-foreground">Email Domain</span>
              <p className="text-[15px] font-medium text-foreground mt-0.5">{person.email ? person.email.split('@')[1] : <span className="text-muted-foreground/50">—</span>}</p>
            </div>

            {/* LinkedIn */}
            <SimpleField label="LinkedIn" value={person.linkedin ?? ''} field="linkedin" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Social" />

            {/* Source */}
            <SimpleField label="Source" value={person.source ?? ''} field="source" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Source" />

            {/* Company */}
            <SimpleField label="Company" value={person.company_name ?? ''} field="company_name" personId={person.id} onSaved={handleFieldSaved} placeholder="Add Company" />

            {/* Tags */}
            <div>
              <span className="text-[12px] font-semibold text-muted-foreground">Tags</span>
              <EditableTags tags={person.tags ?? []} personId={person.id} onSaved={handleFieldSaved} />
            </div>

            {/* Notes */}
            <SimpleField label="Notes" value={person.notes ?? ''} field="notes" personId={person.id} onSaved={handleFieldSaved} placeholder="Add notes..." multiline />

          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="overflow-y-auto max-h-[400px] bg-[#eeedf3] dark:bg-violet-950/20">
          <ActivityTabContent person={person} contactTypeConfig={contactTypeConfig} />
        </div>
      )}

      {activeTab === 'related' && (
        <div className="overflow-y-auto max-h-[400px]">
          <RelatedTabContent person={person} contactTypeConfig={contactTypeConfig} />
        </div>
      )}

      {/* Footer */}
      {onExpand && (
        <div className="shrink-0 px-5 py-3 border-t border-border">
          <button onClick={onExpand} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#3b2778] dark:text-purple-300 bg-[#e0d4f0] dark:bg-purple-950/50 hover:bg-[#d8cce8] dark:hover:bg-purple-900/50 transition-colors">
            Open full record
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </aside>
  );
}
