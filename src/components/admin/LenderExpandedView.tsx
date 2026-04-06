import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  ArrowLeft, Building2, Mail, Phone, User, MapPin,
  Pencil, Loader2, Copy, FileText, Clock, Briefcase,
  PhoneCall, DollarSign, Globe, Search, Tag,
} from 'lucide-react';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { LenderProgram } from './LenderDetailPanel';

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

// ── Editable field card row ──
function EditableCardField({
  icon, label, value, field, lenderId, onSaved, multiline, linkType,
}: {
  icon: React.ReactNode; label: string; value: string; field: string;
  lenderId: string;
  onSaved: (field: string, newValue: string) => void;
  multiline?: boolean;
  linkType?: 'email' | 'phone';
}) {
  const { editing, setEditing, draft, setDraft, saving, save, cancel } = useInlineSave(lenderId, field, value, onSaved);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) setTimeout(() => (multiline ? textareaRef : inputRef).current?.focus(), 0);
  }, [editing, multiline]);

  if (editing) {
    return (
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg">
        <div className="flex items-center gap-2 text-blue-500 shrink-0 mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-500 block mb-1">{label}</span>
          {multiline ? (
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); } if (e.key === 'Escape') cancel(); }}
              onBlur={save}
              rows={3}
              disabled={saving}
              className="w-full text-[13px] font-medium text-foreground bg-card border border-blue-200 dark:border-blue-800 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all resize-none"
            />
          ) : (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
              onBlur={save}
              disabled={saving}
              className="w-full text-[13px] font-medium text-foreground bg-card border border-blue-200 dark:border-blue-800 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all"
            />
          )}
          {saving && <Loader2 className="h-3 w-3 animate-spin text-blue-500 mt-1" />}
        </div>
      </div>
    );
  }

  const displayValue = value || '\u2014';
  const hasLink = linkType && value;

  return (
    <div onClick={() => setEditing(true)} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/40 rounded-lg transition-colors cursor-pointer group">
      <div className="flex items-center gap-2 text-muted-foreground shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">{label}</span>
        <div className="flex items-center gap-1.5">
          {hasLink ? (
            <a
              href={linkType === 'email' ? `mailto:${value}` : `tel:${value}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[13px] font-medium text-blue-600 hover:underline truncate"
            >
              {displayValue}
            </a>
          ) : (
            <span className="text-[13px] font-medium text-foreground truncate">{displayValue}</span>
          )}
          {hasLink && (
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(value); toast.success('Copied'); }}
              className="shrink-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
          <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto" />
        </div>
      </div>
    </div>
  );
}

// ── Section header ──
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-4 pt-5 pb-2">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#3b2778]">{title}</h3>
    </div>
  );
}

// ── Notes tab ──
function NotesTab({ lenderId, notes, onSaved }: { lenderId: string; notes: string; onSaved: (field: string, val: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(notes); }, [notes]);

  const save = useCallback(async () => {
    if (draft === notes) { setEditing(false); return; }
    setSaving(true);
    const { error } = await supabase
      .from('lender_programs')
      .update({ description: draft || null })
      .eq('id', lenderId);
    setSaving(false);
    if (error) { toast.error('Failed to save notes'); return; }
    onSaved('description', draft);
    setEditing(false);
    toast.success('Notes saved');
  }, [draft, notes, lenderId, onSaved]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Notes & Activity</h3>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-7 text-xs gap-1">
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            className="w-full text-sm text-foreground bg-card border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#3b2778]/30 resize-none"
            placeholder="Add notes about this lender..."
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setDraft(notes); setEditing(false); }} className="h-7 text-xs">Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving} className="h-7 text-xs bg-[#3b2778] hover:bg-[#2d1d5e] text-white gap-1">
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground whitespace-pre-wrap rounded-lg border border-border bg-muted/20 p-4 min-h-[120px]">
          {notes || 'No notes yet. Click Edit to add notes about this lender.'}
        </div>
      )}
    </div>
  );
}

// ── Main component ──
export default function LenderExpandedView() {
  const { lenderId } = useParams<{ lenderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'notes'>('overview');

  const { data: lender, isLoading } = useQuery({
    queryKey: ['lender-expanded', lenderId],
    queryFn: async () => {
      if (!lenderId) throw new Error('No lender ID');
      const { data, error } = await supabase
        .from('lender_programs')
        .select('*')
        .eq('id', lenderId)
        .single();
      if (error) throw error;
      return data as LenderProgram;
    },
    enabled: !!lenderId,
  });

  const handleFieldSaved = useCallback((field: string, newValue: string) => {
    queryClient.setQueryData(['lender-expanded', lenderId], (prev: LenderProgram | undefined) => {
      if (!prev) return prev;
      return { ...prev, [field]: newValue || null };
    });
    queryClient.invalidateQueries({ queryKey: ['lender-programs'] });
    toast.success('Updated');
  }, [lenderId, queryClient]);

  const handleGoBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="border-b border-border px-6 py-4 flex items-center gap-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </div>
    );
  }

  if (!lender) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="border-b border-border px-6 py-4">
          <p className="text-muted-foreground">Lender not found</p>
          <Button variant="ghost" onClick={handleGoBack} className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Lender Programs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card">
        <div className="flex items-center gap-3 px-6 py-4">
          <button onClick={handleGoBack} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted-foreground">Lender Programs</span>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground truncate">{lender.lender_name}</span>
        </div>

        {/* Identity strip */}
        <div className="px-6 pb-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-[#eee6f6] flex items-center justify-center shrink-0">
            <Building2 className="h-6 w-6 text-[#3b2778]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{lender.lender_name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {lender.program_name && <span className="text-sm text-muted-foreground truncate">{lender.program_name}</span>}
              {lender.lender_type && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-white dark:bg-card text-xs font-medium text-foreground">
                  <Briefcase className="h-3 w-3 text-muted-foreground" />
                  {lender.lender_type}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lender.email && (
              <a href={`mailto:${lender.email}`}>
                <Button size="sm" className="h-8 rounded-full bg-[#3b2778] hover:bg-[#2d1d5e] text-white text-xs font-semibold gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </Button>
              </a>
            )}
            {lender.phone && (
              <a href={`tel:${lender.phone}`}>
                <Button size="sm" variant="outline" className="h-8 rounded-full text-xs font-semibold gap-1.5">
                  <PhoneCall className="h-3.5 w-3.5" />
                  Call
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-6 border-t border-border">
          {(['overview', 'notes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[#3b2778] text-[#3b2778]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'overview' ? 'Overview' : 'Notes / Activity'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === 'overview' ? (
          <div className="max-w-3xl mx-auto py-6 px-6">
            {/* Contact Info card */}
            <div className="rounded-xl border border-border bg-card shadow-sm mb-4">
              <SectionHeader title="Contact Info" />
              <div className="divide-y divide-border/40">
                <EditableCardField icon={<User className="h-3.5 w-3.5" />} label="Contact Name" value={lender.contact_name ?? ''} field="contact_name" lenderId={lender.id} onSaved={handleFieldSaved} />
                <EditableCardField icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={lender.email ?? ''} field="email" lenderId={lender.id} onSaved={handleFieldSaved} linkType="email" />
                <EditableCardField icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={lender.phone ?? ''} field="phone" lenderId={lender.id} onSaved={handleFieldSaved} linkType="phone" />
                <EditableCardField icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={lender.location ?? ''} field="location" lenderId={lender.id} onSaved={handleFieldSaved} />
              </div>
            </div>

            {/* Program Details card */}
            <div className="rounded-xl border border-border bg-card shadow-sm mb-4">
              <SectionHeader title="Program Details" />
              <div className="divide-y divide-border/40">
                <EditableCardField icon={<Briefcase className="h-3.5 w-3.5" />} label="Lender Type" value={lender.lender_type ?? ''} field="lender_type" lenderId={lender.id} onSaved={handleFieldSaved} />
                <EditableCardField icon={<FileText className="h-3.5 w-3.5" />} label="Program Name" value={lender.program_name ?? ''} field="program_name" lenderId={lender.id} onSaved={handleFieldSaved} />
                <EditableCardField icon={<Tag className="h-3.5 w-3.5" />} label="Program Type" value={lender.program_type ?? ''} field="program_type" lenderId={lender.id} onSaved={handleFieldSaved} />
                <EditableCardField icon={<FileText className="h-3.5 w-3.5" />} label="Loan Types" value={lender.loan_types ?? ''} field="loan_types" lenderId={lender.id} onSaved={handleFieldSaved} />
                <EditableCardField icon={<DollarSign className="h-3.5 w-3.5" />} label="Loan Size" value={lender.loan_size_text ?? ''} field="loan_size_text" lenderId={lender.id} onSaved={handleFieldSaved} />
                <EditableCardField icon={<DollarSign className="h-3.5 w-3.5" />} label="Interest Range" value={lender.interest_range ?? ''} field="interest_range" lenderId={lender.id} onSaved={handleFieldSaved} />
                <EditableCardField icon={<Clock className="h-3.5 w-3.5" />} label="Term" value={lender.term ?? ''} field="term" lenderId={lender.id} onSaved={handleFieldSaved} />
                <EditableCardField icon={<Globe className="h-3.5 w-3.5" />} label="States" value={lender.states ?? ''} field="states" lenderId={lender.id} onSaved={handleFieldSaved} />
                <EditableCardField icon={<Briefcase className="h-3.5 w-3.5" />} label="Lender Specialty" value={lender.lender_specialty ?? ''} field="lender_specialty" lenderId={lender.id} onSaved={handleFieldSaved} />
                <EditableCardField icon={<Search className="h-3.5 w-3.5" />} label="Looking For" value={lender.looking_for ?? ''} field="looking_for" lenderId={lender.id} onSaved={handleFieldSaved} multiline />
              </div>
            </div>

            {/* Activity card */}
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <SectionHeader title="Activity" />
              <div className="divide-y divide-border/40">
                <EditableCardField icon={<PhoneCall className="h-3.5 w-3.5" />} label="Call Status" value={lender.call_status ?? ''} field="call_status" lenderId={lender.id} onSaved={handleFieldSaved} />
                <EditableCardField icon={<Clock className="h-3.5 w-3.5" />} label="Last Contact" value={lender.last_contact ?? ''} field="last_contact" lenderId={lender.id} onSaved={handleFieldSaved} />
                <EditableCardField icon={<Clock className="h-3.5 w-3.5" />} label="Next Call" value={lender.next_call ?? ''} field="next_call" lenderId={lender.id} onSaved={handleFieldSaved} />
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <NotesTab
              lenderId={lender.id}
              notes={lender.description ?? ''}
              onSaved={handleFieldSaved}
            />
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
