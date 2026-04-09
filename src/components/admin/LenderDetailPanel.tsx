import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Maximize2, Building2, Mail, Phone, User, MapPin,
  Pencil, Loader2, Copy, FileText, Clock, Briefcase,
  PhoneCall, DollarSign, Globe, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Lender type ──
export interface LenderProgram {
  id: string;
  lender_name: string;
  call_status: string | null;
  lender_type: string | null;
  loan_size_text: string | null;
  loan_types: string | null;
  states: string | null;
  location: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  looking_for: string | null;
  last_contact: string | null;
  next_call: string | null;
  program_name: string;
  program_type: string;
  description: string | null;
  interest_range: string | null;
  lender_specialty: string | null;
  term: string | null;
  created_at: string;
  updated_at: string;
}

interface LenderDetailPanelProps {
  lender: LenderProgram;
  onClose: () => void;
  onExpand?: () => void;
  onLenderUpdate?: (updated: LenderProgram) => void;
}

// ── Inline save hook ──
function useInlineSave(
  lenderId: string,
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
    const NOT_NULL_FIELDS = ['program_name', 'program_type', 'lender_name'];
    const valueToSave = NOT_NULL_FIELDS.includes(field) ? (trimmed || currentValue) : (trimmed || null);
    if (NOT_NULL_FIELDS.includes(field) && !trimmed) {
      toast.error(`${field.replace('_', ' ')} cannot be empty`);
      setEditing(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('lender_programs')
      .update({ [field]: valueToSave })
      .eq('id', lenderId);
    setSaving(false);
    if (error) {
      toast.error('Failed to save');
      return;
    }
    onSaved(field, trimmed);
    setEditing(false);
  }, [draft, currentValue, field, lenderId, onSaved]);

  const cancel = useCallback(() => {
    setDraft(currentValue);
    setEditing(false);
  }, [currentValue]);

  return { editing, setEditing, draft, setDraft, saving, save, cancel };
}

// ── Editable field row ──
function EditableField({
  icon, label, value, field, lenderId, onSaved, multiline,
}: {
  icon: React.ReactNode; label: string; value: string; field: string;
  lenderId: string;
  onSaved: (field: string, newValue: string) => void;
  multiline?: boolean;
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(lenderId, field, value, onSaved);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => (multiline ? textareaRef : inputRef).current?.focus(), 0);
  }, [editing, multiline]);

  if (editing) {
    return (
      <div className="flex items-start gap-2 px-3 py-2">
        <div className="flex items-center gap-2 text-blue-400 shrink-0 mt-1">
          {icon}
          <span className="text-xs font-medium text-blue-500">{label}</span>
        </div>
        <div className="flex-1 flex items-center gap-1.5 justify-end">
          {multiline ? (
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Escape') cancel(); }}
              onBlur={save}
              rows={3}
              disabled={saving}
              className="w-full text-right text-[13px] font-medium text-foreground bg-transparent border-0 border-b border-b-primary/30 rounded-none px-0 py-0 outline-none focus:border-b-primary focus:ring-0 transition-colors resize-none"
            />
          ) : (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
              onBlur={save}
              disabled={saving}
              className="w-full text-right text-[13px] font-medium text-foreground bg-transparent border-0 border-b border-b-primary/30 rounded-none px-0 py-0 outline-none focus:border-b-primary focus:ring-0 transition-colors"
            />
          )}
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
        <span className="text-[13px] text-right truncate font-medium text-foreground max-w-[200px]">
          {value || '\u2014'}
        </span>
        <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </div>
  );
}

// ── Section header ──
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-4 pt-4 pb-1.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#3b2778]">{title}</h3>
    </div>
  );
}

// ── Main component ──
export default function LenderDetailPanel({
  lender,
  onClose,
  onExpand,
  onLenderUpdate,
}: LenderDetailPanelProps) {
  const handleFieldSaved = useCallback((field: string, newValue: string) => {
    if (onLenderUpdate) {
      onLenderUpdate({ ...lender, [field]: newValue || null });
    }
    toast.success('Updated');
  }, [lender, onLenderUpdate]);

  return (
    <aside className="shrink-0 w-[380px] border-l border-border/60 border-b-2 border-b-gray-300 dark:border-b-border bg-white dark:bg-card flex flex-col shadow-lg animate-in slide-in-from-right-5 duration-200">
      {/* ── Header ── */}
      <div className="shrink-0">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            {onExpand && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Expand" onClick={onExpand}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Copy name" onClick={() => { navigator.clipboard.writeText(lender.lender_name); toast.success('Copied'); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Name + type badge */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-11 w-11 rounded-full bg-[#eee6f6] flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-[#3b2778]" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-foreground truncate leading-tight">{lender.lender_name}</h2>
              {lender.program_name && (
                <p className="text-sm text-muted-foreground mt-0.5 truncate">{lender.program_name}</p>
              )}
              {lender.lender_type && (
                <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full border border-border bg-white dark:bg-card">
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">{lender.lender_type}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 px-6 pb-4">
          {lender.email && (
            <a href={`mailto:${lender.email}`} className="flex-1">
              <Button size="sm" className="w-full h-8 rounded-full bg-[#3b2778] hover:bg-[#2d1d5e] text-white text-xs font-semibold gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Send Email
              </Button>
            </a>
          )}
          {lender.phone && (
            <a href={`tel:${lender.phone}`} className="flex-1">
              <Button size="sm" variant="outline" className="w-full h-8 rounded-full text-xs font-semibold gap-1.5">
                <PhoneCall className="h-3.5 w-3.5" />
                Call
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        {/* Contact Info */}
        <SectionHeader title="Contact Info" />
        <div className="divide-y divide-border/40">
          <EditableField icon={<User className="h-3.5 w-3.5" />} label="Contact" value={lender.contact_name ?? ''} field="contact_name" lenderId={lender.id} onSaved={handleFieldSaved} />
          <EditableField icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={lender.email ?? ''} field="email" lenderId={lender.id} onSaved={handleFieldSaved} />
          <EditableField icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={lender.phone ?? ''} field="phone" lenderId={lender.id} onSaved={handleFieldSaved} />
          <EditableField icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={lender.location ?? ''} field="location" lenderId={lender.id} onSaved={handleFieldSaved} />
        </div>

        {/* Program Details */}
        <SectionHeader title="Program Details" />
        <div className="divide-y divide-border/40">
          <EditableField icon={<Briefcase className="h-3.5 w-3.5" />} label="Lender Type" value={lender.lender_type ?? ''} field="lender_type" lenderId={lender.id} onSaved={handleFieldSaved} />
          <EditableField icon={<FileText className="h-3.5 w-3.5" />} label="Loan Types" value={lender.loan_types ?? ''} field="loan_types" lenderId={lender.id} onSaved={handleFieldSaved} />
          <EditableField icon={<DollarSign className="h-3.5 w-3.5" />} label="Loan Size" value={lender.loan_size_text ?? ''} field="loan_size_text" lenderId={lender.id} onSaved={handleFieldSaved} />
          <EditableField icon={<Globe className="h-3.5 w-3.5" />} label="States" value={lender.states ?? ''} field="states" lenderId={lender.id} onSaved={handleFieldSaved} />
          <EditableField icon={<Search className="h-3.5 w-3.5" />} label="Looking For" value={lender.looking_for ?? ''} field="looking_for" lenderId={lender.id} onSaved={handleFieldSaved} multiline />
          <EditableField icon={<FileText className="h-3.5 w-3.5" />} label="Program Name" value={lender.program_name ?? ''} field="program_name" lenderId={lender.id} onSaved={handleFieldSaved} />
          <EditableField icon={<Briefcase className="h-3.5 w-3.5" />} label="Program Type" value={lender.program_type ?? ''} field="program_type" lenderId={lender.id} onSaved={handleFieldSaved} />
        </div>

        {/* Activity */}
        <SectionHeader title="Activity" />
        <div className="divide-y divide-border/40">
          <EditableField icon={<PhoneCall className="h-3.5 w-3.5" />} label="Call Status" value={lender.call_status ?? ''} field="call_status" lenderId={lender.id} onSaved={handleFieldSaved} />
          <EditableField icon={<Clock className="h-3.5 w-3.5" />} label="Last Contact" value={lender.last_contact ?? ''} field="last_contact" lenderId={lender.id} onSaved={handleFieldSaved} />
          <EditableField icon={<Clock className="h-3.5 w-3.5" />} label="Next Call" value={lender.next_call ?? ''} field="next_call" lenderId={lender.id} onSaved={handleFieldSaved} />
        </div>

        {/* Bottom spacer */}
        <div className="h-4" />
      </div>

      {/* ── Footer ── */}
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
