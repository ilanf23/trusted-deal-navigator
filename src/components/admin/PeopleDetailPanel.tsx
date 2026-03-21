import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Maximize2, Building2, User, Mail, Phone, PhoneCall,
  Tag, FileText, Clock, ArrowRight, ChevronRight, Briefcase,
  Pencil, Check, Loader2, MessageSquare, Users, CheckSquare, ChevronDown, Layers,
  Link2, FolderOpen, AtSign, MapPin, Trash2,
} from 'lucide-react';
import { RichTextEditor } from '@/components/ui/rich-text-input';
import { HtmlContent } from '@/components/ui/html-content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressAutocompleteInput, type ParsedAddress } from '@/components/ui/address-autocomplete';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { formatPhoneNumber } from './InlineEditableFields';
import { PeopleTaskDetailDialog, type LeadTask } from './PeopleTaskDetailDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';
import { differenceInDays, parseISO, format, formatDistanceToNow } from 'date-fns';

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
        .select('id, activity_type, title, content, created_at')
        .eq('lead_id', person.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const isLoading = loadingComms || loadingActivities;

  interface TimelineItem {
    id: string;
    type: string;
    title: string;
    content: string | null;
    createdAt: string;
    source: 'communication' | 'activity';
    direction?: string;
    durationSeconds?: number | null;
  }

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    for (const c of communications) {
      const typeLabel = c.communication_type === 'sms' ? 'SMS' : c.communication_type === 'call' ? 'Call' : 'Email';
      const dirLabel = c.direction === 'inbound' ? 'Inbound' : 'Outbound';
      items.push({
        id: c.id,
        type: c.communication_type,
        title: `${dirLabel} ${typeLabel}`,
        content: c.content,
        createdAt: c.created_at,
        source: 'communication',
        direction: c.direction,
        durationSeconds: c.duration_seconds,
      });
    }

    for (const a of activities) {
      items.push({
        id: a.id,
        type: a.activity_type,
        title: a.title ?? a.activity_type,
        content: a.content,
        createdAt: a.created_at,
        source: 'activity',
      });
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
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="px-5 py-4">
      {timelineItems.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center text-center">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No activity recorded yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">Activities will appear here</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[13px] top-2 bottom-2 w-px bg-border" />
          <div className="space-y-0.5">
            {timelineItems.map((item) => {
              const iconCfg = TIMELINE_ICON_CONFIG[item.type] ?? TIMELINE_ICON_CONFIG.comment;

              let fromType: string | null = null;
              let toType: string | null = null;
              if (item.type === 'type_change' && item.content) {
                try {
                  const parsed = JSON.parse(item.content);
                  fromType = parsed.from;
                  toType = parsed.to;
                } catch { /* ignore */ }
              }

              return (
                <div key={item.id} className="flex gap-3 py-2.5 relative">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10 ${iconCfg.dotColor}`}>
                    {iconCfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold text-foreground leading-tight">{item.title}</p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                        {formatDistanceToNow(parseISO(item.createdAt), { addSuffix: true })}
                      </span>
                    </div>

                    {item.type === 'type_change' && fromType && toType && (
                      <div className="flex items-center gap-1.5 mt-1.5">
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
                      <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{item.content}</p>
                    )}

                    {item.type === 'call' && item.durationSeconds != null && item.durationSeconds > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {Math.floor(item.durationSeconds / 60)}m {item.durationSeconds % 60}s
                      </p>
                    )}
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

// ── Related Tab Content ──
function RelatedTabContent({ person, contactTypeConfig }: { person: Person; contactTypeConfig: Record<string, ContactTypeConfigEntry> }) {
  const queryClient = useQueryClient();
  const { teamMember } = useTeamMember();
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<LeadTask | null>(null);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['person-tasks', person.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_tasks')
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

  const toggleTaskCompletion = useCallback(async (task: LeadTask) => {
    const isCompleting = !task.completed_at;
    await supabase.from('lead_tasks').update({
      completed_at: isCompleting ? new Date().toISOString() : null,
      status: isCompleting ? 'completed' : 'pending',
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

  const typeCfg = contactTypeConfig[person.contact_type ?? 'Other'];

  return (
    <div className="px-5 py-4 space-y-1">
      {/* Company */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2.5 hover:bg-muted/50 px-1 rounded-lg transition-colors">
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <span className="text-indigo-500"><Building2 className="h-3.5 w-3.5" /></span> Company
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center rounded-full ml-1 bg-muted text-muted-foreground">
            {person.company_name ? 1 : 0}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-6 pb-2">
          {person.company_name ? (
            <div className="flex items-center gap-2.5 pt-1">
              <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${getAvatarGradient(person.company_name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                {person.company_name[0]?.toUpperCase() ?? '?'}
              </div>
              <p className="text-[12px] font-medium text-foreground">{person.company_name}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic py-1">No company set</p>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Tasks */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2.5 hover:bg-muted/50 px-1 rounded-lg transition-colors">
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <span className="text-emerald-500"><CheckSquare className="h-3.5 w-3.5" /></span> Tasks
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center rounded-full ml-1 bg-muted text-muted-foreground">
            {pendingTasks.length}
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-6 pb-2">
          {pendingTasks.length === 0 && completedTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-1">No tasks</p>
          ) : (
            <div className="space-y-1 pt-1">
              {pendingTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md px-1 py-0.5 -mx-1 transition-colors group"
                  onClick={() => { setEditingTask(t); setTaskDialogOpen(true); }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTaskCompletion(t); }}
                    className="shrink-0"
                  >
                    <div className="h-4 w-4 rounded border border-border group-hover:border-emerald-400 transition-colors" />
                  </button>
                  <span className="text-[12px] truncate flex-1 text-foreground">
                    {t.title}
                  </span>
                  {t.due_date && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDate(t.due_date)}
                    </span>
                  )}
                </div>
              ))}
              {completedTasks.length > 0 && (
                <>
                  <button
                    onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1 w-full"
                  >
                    {showCompletedTasks ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    Completed ({completedTasks.length})
                  </button>
                  {showCompletedTasks && completedTasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md px-1 py-0.5 -mx-1 transition-colors"
                      onClick={() => { setEditingTask(t); setTaskDialogOpen(true); }}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleTaskCompletion(t); }}
                        className="shrink-0"
                      >
                        <CheckSquare className="h-4 w-4 text-emerald-500" />
                      </button>
                      <span className="text-[12px] truncate flex-1 text-muted-foreground line-through">
                        {t.title}
                      </span>
                    </div>
                  ))}
                </>
              )}
              <button
                onClick={() => { setEditingTask(null); setTaskDialogOpen(true); }}
                className="text-[11px] text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1"
              >
                + Add task...
              </button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

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

      {/* Contact Type */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center gap-2 w-full py-2.5 hover:bg-muted/50 px-1 rounded-lg transition-colors">
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <span className="text-blue-500"><Layers className="h-3.5 w-3.5" /></span> Contact Type
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center rounded-full ml-1 bg-muted text-muted-foreground">
            1
          </Badge>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-6 pb-2">
          <div className="pt-1">
            {typeCfg ? (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${typeCfg.bg}`}>
                <span className={`h-2 w-2 rounded-full ${typeCfg.dot}`} />
                <span className={`text-[11px] font-semibold ${typeCfg.color}`}>{typeCfg.label}</span>
              </div>
            ) : (
              <Badge variant="outline" className="text-[11px]">{person.contact_type}</Badge>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
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
  const initial = person.name[0]?.toUpperCase() ?? '?';
  const gradient = getAvatarGradient(person.name);

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
    <aside className="shrink-0 w-[380px] border-l border-border/60 bg-card flex flex-col h-full animate-in slide-in-from-right-5 duration-200">
      {/* ── Header ── */}
      <div className="shrink-0">
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #6d28d9, #8b5cf6, #a78bfa)' }} />

        <div className="px-5 pt-4 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md`}>
                {initial}
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold text-foreground truncate leading-tight">{person.name}</h2>
                {person.title && (
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                    <Briefcase className="h-3 w-3 shrink-0" />
                    {person.title}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0 -mt-0.5">
              {onExpand && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Expand full view" onClick={onExpand}>
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {typeCfg && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${typeCfg.bg}`}>
                <span className={`h-2 w-2 rounded-full ${typeCfg.dot}`} />
                <span className={`text-xs font-semibold ${typeCfg.color}`}>{typeCfg.label}</span>
              </div>
            )}
            {person.company_name && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted border border-border">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">{person.company_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-5 gap-1 border-b border-border">
          {(['details', 'activity', 'related'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all relative ${
                activeTab === tab ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-blue-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      {activeTab === 'details' && (
        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-5">

            {/* Contact Type selector */}
            {onContactTypeChange && (
              <div className="rounded-lg border border-border p-3">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Contact Type</span>
                <Select value={person.contact_type ?? 'Other'} onValueChange={(v) => onContactTypeChange(person.id, v)}>
                  <SelectTrigger className="h-9 w-full text-xs border-border bg-card rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${typeCfg?.dot ?? 'bg-muted-foreground'}`} />
                      <SelectValue>{typeCfg?.label ?? person.contact_type}</SelectValue>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_TYPES.map((t) => {
                      const cfg = contactTypeConfig[t];
                      return (
                        <SelectItem key={t} value={t} className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${cfg?.dot ?? 'bg-muted-foreground'}`} />
                            {cfg?.label ?? t}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Contact info */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Contact</span>
              <div className="space-y-1.5">
                <EditableContactRow icon={<User className="h-3.5 w-3.5" />} value={person.name} field="name" personId={person.id} placeholder="Name" onSaved={handleFieldSaved} />
                <EditableContactRow icon={<Mail className="h-3.5 w-3.5" />} value={person.email ?? ''} field="email" personId={person.id} placeholder="Add email..." onSaved={handleFieldSaved} allowClear />
                <div className="flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <EditableContactRow icon={<Phone className="h-3.5 w-3.5" />} value={person.phone ?? ''} field="phone" personId={person.id} placeholder="Add phone..." onSaved={handleFieldSaved} allowClear />
                  </div>
                  {person.phone && (
                    <button
                      onClick={() => navigate(`/admin/calls?phone=${encodeURIComponent(person.phone!.replace(/\D/g, ''))}`)}
                      title="Call this number"
                      className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <EditableContactRow icon={<Link2 className="h-3.5 w-3.5" />} value={person.linkedin ?? ''} field="linkedin" personId={person.id} placeholder="Add LinkedIn..." onSaved={handleFieldSaved} allowClear />
              </div>
            </div>

            {/* Details */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Details</span>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                <EditableField icon={<Briefcase className="h-3.5 w-3.5" />} label="Title" value={person.title ?? ''} field="title" personId={person.id} onSaved={handleFieldSaved} />
                <EditableField icon={<Building2 className="h-3.5 w-3.5" />} label="Company" value={person.company_name ?? ''} field="company_name" personId={person.id} onSaved={handleFieldSaved} />
                <EditableField icon={<User className="h-3.5 w-3.5" />} label="Nickname" value={person.known_as ?? ''} field="known_as" personId={person.id} onSaved={handleFieldSaved} />
                <EditableField icon={<FolderOpen className="h-3.5 w-3.5" />} label="CLX File Name" value={person.clx_file_name ?? ''} field="clx_file_name" personId={person.id} onSaved={handleFieldSaved} />
                <EditableField icon={<Tag className="h-3.5 w-3.5" />} label="Source" value={person.source ?? ''} field="source" personId={person.id} onSaved={handleFieldSaved} />
                <ReadOnlyField icon={<Clock className="h-3.5 w-3.5" />} label="Last Contacted" value={formatDate(person.last_activity_at)} />
                <ReadOnlyField icon={<Clock className="h-3.5 w-3.5" />} label="Created" value={formatDate(person.created_at)} />
              </div>
            </div>

            {/* Tags */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Tags</span>
              <EditableTags tags={person.tags ?? []} personId={person.id} onSaved={handleFieldSaved} />
            </div>

            {/* Email */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Email</span>
              <div className="space-y-1">
                {personEmails.map((e) => (
                  <ContactEmailRow key={e.id} entry={e} onDelete={(id) => deleteEmailMutation.mutate(id)} onUpdate={(id, data) => updateEmailMutation.mutate({ id, data })} />
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
                  <button onClick={() => setShowAddEmail(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-3 py-1">+ Add Email</button>
                )}
              </div>
            </div>

            {/* Phone */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Phone</span>
              <div className="space-y-1">
                {personPhones.map((p) => (
                  <ContactPhoneRow key={p.id} entry={p} onDelete={(id) => deletePhoneMutation.mutate(id)} onCall={(phone) => navigate(`/admin/calls?phone=${encodeURIComponent(phone.replace(/\D/g, ''))}`)} onUpdate={(id, data) => updatePhoneMutation.mutate({ id, data })} />
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
                  <button onClick={() => setShowAddPhone(true)} className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 px-3 py-1">+ Add Phone</button>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Address</span>
              <div className="space-y-1">
                {personAddresses.map((a) => (
                  <AddressBlock key={a.id} entry={a} onDelete={(id) => deleteAddressMutation.mutate(id)} onUpdate={(id, data) => updateAddressMutation.mutate({ id, data })} />
                ))}
                {showAddAddress ? (
                  <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-2.5 space-y-2">
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

            {/* About */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">About</span>
              <EditableRichTextField value={person.notes ?? ''} personId={person.id} field="notes" onSaved={handleFieldSaved} placeholder="Background info about this contact..." />
            </div>

            {/* Bank Relationships */}
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Bank Relationships</span>
              <EditableRichTextField value={person.bank_relationships ?? ''} personId={person.id} field="bank_relationships" onSaved={handleFieldSaved} placeholder="Excluded lender names from CLX agreement..." />
            </div>
          </div>
        </ScrollArea>
      )}

      {activeTab === 'activity' && (
        <ScrollArea className="flex-1">
          <ActivityTabContent person={person} contactTypeConfig={contactTypeConfig} />
        </ScrollArea>
      )}

      {activeTab === 'related' && (
        <ScrollArea className="flex-1">
          <RelatedTabContent person={person} contactTypeConfig={contactTypeConfig} />
        </ScrollArea>
      )}

      {/* Footer */}
      {onExpand && (
        <div className="shrink-0 px-5 py-3 border-t border-border">
          <button onClick={onExpand} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
            Open full record
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </aside>
  );
}
