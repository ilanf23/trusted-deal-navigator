import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  X, User, Mail, Phone, Building2, Briefcase, Tag, FileText,
  Clock, Pencil, Check, Loader2, Linkedin,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface Person {
  id: string;
  name: string;
  email: string;
  contact_type: string | null;
  company_name: string | null;
  phone?: string | null;
  title?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  linkedin?: string | null;
  source?: string | null;
  created_at?: string;
  last_activity_at?: string | null;
}

interface GmailContactSidebarProps {
  person: Person;
  onClose: () => void;
}

const CONTACT_TYPES = [
  { value: 'Prospect', label: 'Prospect' },
  { value: 'Client', label: 'Client' },
  { value: 'Referral Partner', label: 'Referral Partner' },
  { value: 'Lender', label: 'Lender' },
  { value: 'Attorney', label: 'Attorney' },
  { value: 'Broker', label: 'Broker' },
  { value: 'Vendor', label: 'Vendor' },
  { value: 'Other', label: 'Other' },
];

const CONTACT_TYPE_COLORS: Record<string, { dot: string; pill: string }> = {
  Prospect: { dot: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700 border-blue-200' },
  Client: { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'Referral Partner': { dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  Lender: { dot: 'bg-indigo-500', pill: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  Attorney: { dot: 'bg-purple-500', pill: 'bg-purple-50 text-purple-700 border-purple-200' },
  Broker: { dot: 'bg-cyan-500', pill: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  Vendor: { dot: 'bg-rose-500', pill: 'bg-rose-50 text-rose-700 border-rose-200' },
  Other: { dot: 'bg-slate-500', pill: 'bg-slate-50 text-slate-700 border-slate-200' },
};

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

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '\u2014';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return '\u2014';
  }
}

// ── Inline-save helper for people table ──
function usePersonInlineSave(
  personId: string,
  field: string,
  currentValue: string,
  onSaved: () => void,
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
      .from('people')
      .update({ [field]: trimmed || null })
      .eq('id', personId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    onSaved();
    setEditing(false);
  }, [draft, currentValue, field, personId, onSaved]);

  const cancel = useCallback(() => {
    setDraft(currentValue);
    setEditing(false);
  }, [currentValue]);

  return { editing, setEditing, draft, setDraft, saving, save, cancel };
}

// ── Editable contact row ──
function EditableContactRow({
  icon, value, field, personId, placeholder, onSaved,
}: {
  icon: React.ReactNode; value: string; field: string;
  personId: string; placeholder: string;
  onSaved: () => void;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = usePersonInlineSave(personId, field, value, onSaved);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => inputRef.current?.focus(), 0);
  }, [editing]);

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

  return (
    <div onClick={() => setEditing(true)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors group cursor-pointer">
      <div className="text-muted-foreground group-hover:text-foreground shrink-0">{icon}</div>
      <span className={`text-[13px] truncate flex-1 ${value ? 'text-foreground font-medium' : 'text-muted-foreground italic'}`}>
        {value || placeholder}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );
}

// ── Read-only field ──
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

// ── Editable Notes ──
function EditableNotes({ value, personId, onSaved }: { value: string; personId: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [editing, value]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (trimmed === value) { setEditing(false); return; }
    setSaving(true);
    const { error } = await supabase
      .from('people')
      .update({ notes: trimmed || null })
      .eq('id', personId);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    onSaved();
    setEditing(false);
  }, [draft, value, personId, onSaved]);

  if (editing) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-3">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add notes..."
          disabled={saving}
          rows={4}
          className="w-full text-[13px] text-foreground bg-transparent outline-none resize-none placeholder:text-muted-foreground/50"
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
        <p className="text-[13px] text-foreground whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-[13px] text-muted-foreground italic">Click to add notes...</p>
      )}
      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Pencil className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">Click to edit</span>
      </div>
    </div>
  );
}

// ── Editable Tags ──
function EditableTags({ tags, personId, onSaved }: { tags: string[]; personId: string; onSaved: () => void }) {
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
    if (newStr === currentStr) { setEditing(false); return; }
    setSaving(true);
    const { error } = await supabase
      .from('people')
      .update({ tags: newTags.length > 0 ? newTags : null })
      .eq('id', personId);
    setSaving(false);
    if (error) { toast.error('Failed to save'); return; }
    onSaved();
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

// ══════════════════════════════════════════════════
// ── Main Contact Sidebar ──
// ══════════════════════════════════════════════════
export function GmailContactSidebar({ person, onClose }: GmailContactSidebarProps) {
  const queryClient = useQueryClient();
  const [contactType, setContactType] = useState(person.contact_type || 'Prospect');
  const [savingType, setSavingType] = useState(false);

  const initial = person.name?.[0]?.toUpperCase() ?? '?';
  const gradient = getAvatarGradient(person.name);
  const typeColors = CONTACT_TYPE_COLORS[contactType] || CONTACT_TYPE_COLORS.Other;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['gmail-people'] });
  }, [queryClient]);

  const handleContactTypeChange = async (value: string) => {
    setContactType(value);
    setSavingType(true);
    const { error } = await supabase
      .from('people')
      .update({ contact_type: value })
      .eq('id', person.id);
    setSavingType(false);
    if (error) {
      toast.error('Failed to update contact type');
      setContactType(person.contact_type || 'Prospect');
      return;
    }
    invalidate();
  };

  return (
    <aside className="shrink-0 w-80 border-l border-border/60 bg-card flex flex-col h-full animate-in slide-in-from-right-5 duration-200">
      {/* ── Header ── */}
      <div className="shrink-0">
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)' }} />

        <div className="px-4 pt-4 pb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md`}>
                {initial}
              </div>
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold text-foreground truncate leading-tight">{person.name}</h2>
                {person.company_name && (
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3 w-3 shrink-0" />
                    {person.company_name}
                  </p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Contact type pill */}
          <div className="flex items-center gap-2.5">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${typeColors.pill}`}>
              <span className={`h-2 w-2 rounded-full ${typeColors.dot}`} />
              <span className="text-xs font-semibold">{contactType}</span>
            </div>
            {person.source && (
              <span className="text-[11px] text-muted-foreground">via {person.source}</span>
            )}
          </div>
        </div>

        <Separator />
      </div>

      {/* ── Content ── */}
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-5">

          {/* Contact Type Selector */}
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Contact Type</span>
            <Select value={contactType} onValueChange={handleContactTypeChange}>
              <SelectTrigger className="h-9 w-full text-xs border-border bg-card rounded-lg">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${typeColors.dot}`} />
                  <SelectValue>{contactType}</SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent>
                {CONTACT_TYPES.map((ct) => {
                  const colors = CONTACT_TYPE_COLORS[ct.value] || CONTACT_TYPE_COLORS.Other;
                  return (
                    <SelectItem key={ct.value} value={ct.value} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${colors.dot}`} />
                        {ct.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {savingType && <Loader2 className="h-3 w-3 animate-spin text-blue-500 mt-1" />}
          </div>

          {/* Contact Info */}
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Contact</span>
            <div className="space-y-1.5">
              <EditableContactRow icon={<User className="h-3.5 w-3.5" />} value={person.name} field="name" personId={person.id} placeholder="Name" onSaved={invalidate} />
              <EditableContactRow icon={<Mail className="h-3.5 w-3.5" />} value={person.email ?? ''} field="email" personId={person.id} placeholder="Add email..." onSaved={invalidate} />
              <EditableContactRow icon={<Phone className="h-3.5 w-3.5" />} value={person.phone ?? ''} field="phone" personId={person.id} placeholder="Add phone..." onSaved={invalidate} />
              <EditableContactRow icon={<Building2 className="h-3.5 w-3.5" />} value={person.company_name ?? ''} field="company_name" personId={person.id} placeholder="Add company..." onSaved={invalidate} />
              <EditableContactRow icon={<Briefcase className="h-3.5 w-3.5" />} value={person.title ?? ''} field="title" personId={person.id} placeholder="Add title..." onSaved={invalidate} />
              <EditableContactRow icon={<Linkedin className="h-3.5 w-3.5" />} value={person.linkedin ?? ''} field="linkedin" personId={person.id} placeholder="Add LinkedIn..." onSaved={invalidate} />
            </div>
          </div>

          {/* Details */}
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Details</span>
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              <ReadOnlyField icon={<Tag className="h-3.5 w-3.5" />} label="Source" value={person.source || '\u2014'} />
              <ReadOnlyField icon={<Clock className="h-3.5 w-3.5" />} label="Created" value={formatDate(person.created_at)} />
              <ReadOnlyField icon={<Clock className="h-3.5 w-3.5" />} label="Last Activity" value={formatDate(person.last_activity_at)} />
            </div>
          </div>

          {/* Tags */}
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Tags</span>
            <EditableTags tags={person.tags ?? []} personId={person.id} onSaved={invalidate} />
          </div>

          {/* Notes */}
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Notes</span>
            <EditableNotes value={person.notes ?? ''} personId={person.id} onSaved={invalidate} />
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
