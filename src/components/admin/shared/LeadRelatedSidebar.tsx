import { useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useCrmMutations } from '@/hooks/usePipelineMutations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Users, CheckSquare, Layers, Building2, FileText,
  CalendarDays, FolderOpen, ChevronDown, ChevronRight,
  Plus, Maximize2, Bookmark, Trash2, Download, Eye, Phone,
  Loader2, X,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { PeopleTaskDetailDialog, type LeadTask } from '@/components/admin/PeopleTaskDetailDialog';
import { type LeadProject } from '@/components/admin/ProjectDetailDialog';
import { LeadCallHistorySection } from '@/components/admin/shared/LeadCallHistorySection';

// ─── Types ───────────────────────────────────────────────────────────────

export type LeadEntityType = 'potential' | 'underwriting' | 'lender_management';

export interface LeadRelatedSidebarLead {
  id: string;
  name?: string | null;
  opportunity_name?: string | null;
  company_name: string | null;
  email?: string | null;
  phone?: string | null;
  status: string;
}

export interface LeadRelatedSidebarStageCfg {
  label?: string;
  title?: string;
  bg?: string;
  color?: string;
}

interface LeadEmailLite {
  id: string;
  email: string;
}

interface LeadFile {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

interface LeadContact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean | null;
}

interface RelatedPersonLite {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
}

interface PeopleSearchResult {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  source: 'people' | 'leads';
}

interface CompanySearchResult {
  id: string;
  company_name: string;
  website: string | null;
  source: 'companies' | 'derived';
}

export interface LeadRelatedSidebarProps {
  entityType: LeadEntityType;
  leadId: string;
  lead: LeadRelatedSidebarLead;
  /** Entity emails from parent query — used to compute related-people via shared domains. */
  leadEmails?: LeadEmailLite[];
  stageCfg?: LeadRelatedSidebarStageCfg | null;
  teamMembers: Array<{ id: string; name: string }>;
  currentUserName?: string | null;
  /** Parent's lead row query key — invalidated after company link/unlink. */
  leadQueryKey?: readonly unknown[];
  /** Parent's lead list query key — invalidated after company link/unlink. */
  leadsListQueryKey?: readonly unknown[];
  /** Called when a contact row is clicked — parent decides how to open person panel. */
  onPersonSelect?: (person: RelatedPersonLite & Record<string, unknown>) => void;
  /** Optional custom navigator for project clicks. Defaults to `/admin/pipeline/projects/expanded-view/:id`. */
  onProjectClick?: (projectId: string) => void;
  className?: string;
}

const COMMON_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'aol.com', 'icloud.com', 'mail.com', 'protonmail.com',
];

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

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'M/d/yyyy'); } catch { return '—'; }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// ─── Polymorphic Supabase helpers ───────────────────────────────────────
// Supabase's .from() type inference breaks with dynamic string unions,
// so each entity type is dispatched through a switch for type safety.

async function updateLeadCompany(
  entityType: LeadEntityType,
  leadId: string,
  companyName: string | null,
): Promise<{ error: unknown }> {
  switch (entityType) {
    case 'potential':
      return supabase.from('potential').update({ company_name: companyName }).eq('id', leadId);
    case 'underwriting':
      return supabase.from('underwriting').update({ company_name: companyName }).eq('id', leadId);
    case 'lender_management':
      return supabase.from('lender_management').update({ company_name: companyName }).eq('id', leadId);
  }
}

async function searchLeadsByName(
  entityType: LeadEntityType,
  query: string,
): Promise<Array<{ id: string; name: string | null; title: string | null; email: string | null; company_name: string | null }>> {
  let res;
  switch (entityType) {
    case 'potential':
      res = await supabase.from('potential').select('id, name, title, email, company_name')
        .ilike('name', `%${query}%`).order('name', { ascending: true }).limit(20);
      break;
    case 'underwriting':
      res = await supabase.from('underwriting').select('id, name, title, email, company_name')
        .ilike('name', `%${query}%`).order('name', { ascending: true }).limit(20);
      break;
    case 'lender_management':
      res = await supabase.from('lender_management').select('id, name, title, email, company_name')
        .ilike('name', `%${query}%`).order('name', { ascending: true }).limit(20);
      break;
  }
  return (res.data ?? []) as Array<{ id: string; name: string | null; title: string | null; email: string | null; company_name: string | null }>;
}

async function searchLeadsByCompany(
  entityType: LeadEntityType,
  query: string,
): Promise<Array<{ id: string; company_name: string | null }>> {
  let res;
  switch (entityType) {
    case 'potential':
      res = await supabase.from('potential').select('id, company_name')
        .ilike('company_name', `%${query}%`).not('company_name', 'is', null).limit(20);
      break;
    case 'underwriting':
      res = await supabase.from('underwriting').select('id, company_name')
        .ilike('company_name', `%${query}%`).not('company_name', 'is', null).limit(20);
      break;
    case 'lender_management':
      res = await supabase.from('lender_management').select('id, company_name')
        .ilike('company_name', `%${query}%`).not('company_name', 'is', null).limit(20);
      break;
  }
  return (res.data ?? []) as Array<{ id: string; company_name: string | null }>;
}

async function searchRelatedPeopleByCompany(
  entityType: LeadEntityType,
  companyName: string,
): Promise<RelatedPersonLite[]> {
  let res;
  switch (entityType) {
    case 'potential':
      res = await supabase.from('potential').select('id, name, title, email, phone, company_name')
        .eq('company_name', companyName).order('name').limit(20);
      break;
    case 'underwriting':
      res = await supabase.from('underwriting').select('id, name, title, email, phone, company_name')
        .eq('company_name', companyName).order('name').limit(20);
      break;
    case 'lender_management':
      res = await supabase.from('lender_management').select('id, name, title, email, phone, company_name')
        .eq('company_name', companyName).order('name').limit(20);
      break;
  }
  return ((res.data ?? []) as RelatedPersonLite[]).filter((p) => p && p.name);
}

async function searchRelatedPeopleByDomain(
  entityType: LeadEntityType,
  domain: string,
): Promise<RelatedPersonLite[]> {
  let res;
  switch (entityType) {
    case 'potential':
      res = await supabase.from('potential').select('id, name, title, email, phone, company_name')
        .ilike('email', `%@${domain}`).limit(20);
      break;
    case 'underwriting':
      res = await supabase.from('underwriting').select('id, name, title, email, phone, company_name')
        .ilike('email', `%@${domain}`).limit(20);
      break;
    case 'lender_management':
      res = await supabase.from('lender_management').select('id, name, title, email, phone, company_name')
        .ilike('email', `%@${domain}`).limit(20);
      break;
  }
  return ((res.data ?? []) as RelatedPersonLite[]).filter((p) => p && p.name);
}

async function lookupPersonByName(
  entityType: LeadEntityType,
  name: string,
): Promise<RelatedPersonLite | null> {
  let res;
  switch (entityType) {
    case 'potential':
      res = await supabase.from('potential').select('*').ilike('name', name).limit(1).maybeSingle();
      break;
    case 'underwriting':
      res = await supabase.from('underwriting').select('*').ilike('name', name).limit(1).maybeSingle();
      break;
    case 'lender_management':
      res = await supabase.from('lender_management').select('*').ilike('name', name).limit(1).maybeSingle();
      break;
  }
  return (res.data ?? null) as RelatedPersonLite | null;
}

async function fetchSourceStageId(
  entityType: LeadEntityType,
  leadId: string,
): Promise<string | null> {
  let res;
  switch (entityType) {
    case 'potential':
      res = await supabase.from('potential').select('stage_id').eq('id', leadId).single();
      break;
    case 'underwriting':
      res = await supabase.from('underwriting').select('stage_id').eq('id', leadId).single();
      break;
    case 'lender_management':
      res = await supabase.from('lender_management').select('stage_id').eq('id', leadId).single();
      break;
  }
  return ((res.data as { stage_id: string | null } | null)?.stage_id) ?? null;
}

// ─── RelatedSection primitive ────────────────────────────────────────────

function RelatedSection({
  icon, label, count, iconColor, onAdd, onExpand, children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  iconColor?: string;
  onAdd?: () => void;
  onExpand?: () => void;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div
          role="button"
          className="flex items-center gap-1.5 w-full py-2.5 hover:bg-muted/50 px-4 rounded-lg transition-colors cursor-pointer min-w-0"
          onClick={() => setOpen(!open)}
        >
          <span className={`shrink-0 ${iconColor ?? ''}`}>{icon}</span>
          <span className="text-xs font-semibold text-foreground truncate min-w-0" title={label}>{label}</span>
          <span className="text-xs font-normal text-muted-foreground shrink-0">({count})</span>
          {open ? <ChevronDown className="h-3 w-3 text-muted-foreground ml-0.5 shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground ml-0.5 shrink-0" />}
          <div className="flex items-center gap-0.5 ml-auto shrink-0">
            {onExpand && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); onExpand(); }}
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
      <CollapsibleContent className="px-4 pb-2 min-w-0 max-w-full overflow-hidden">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────

export default function LeadRelatedSidebar({
  entityType,
  leadId,
  lead,
  leadEmails = [],
  stageCfg,
  teamMembers,
  currentUserName,
  leadQueryKey,
  leadsListQueryKey,
  onPersonSelect,
  onProjectClick,
  className,
}: LeadRelatedSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { teamMember } = useTeamMember();
  const crmMutations = useCrmMutations(entityType);

  // ─── State ─────────────────────────────────────────────────────────────

  // Contact add state
  const [addingContact, setAddingContact] = useState(false);
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  // Contact edit state
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState('');
  const [editContactTitle, setEditContactTitle] = useState('');

  // Per-row reveal-more state: click a truncated row to expand its details
  // inline. Keys are contact ids (for linked contacts) or `rp:<id>` for
  // unlinked related people so the two collections don't collide.
  const [expandedPeopleRows, setExpandedPeopleRows] = useState<Record<string, boolean>>({});

  // Company add state
  const [addingCompany, setAddingCompany] = useState(false);
  const [companySearchQuery, setCompanySearchQuery] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);

  // Task state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<LeadTask | null>(null);
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  // Project add state
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [savingProject, setSavingProject] = useState(false);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Duplicate-opportunity dialog state
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [dupStages, setDupStages] = useState<Array<{ id: string; name: string }>>([]);
  const [dupStageId, setDupStageId] = useState('');
  const [dupOppName, setDupOppName] = useState('');
  const [dupValue, setDupValue] = useState('');
  const [dupDescription, setDupDescription] = useState('');
  const [dupCloseDate, setDupCloseDate] = useState<Date | undefined>(undefined);
  const [dupCloseDatePickerOpen, setDupCloseDatePickerOpen] = useState(false);
  const [dupLoadingStages, setDupLoadingStages] = useState(false);

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

  // ─── Canonical polymorphic query keys ──────────────────────────────────
  const contactsKey = ['lead-related', entityType, leadId, 'contacts'] as const;
  const tasksKey = ['person-tasks', leadId] as const; // kept for compat with existing task consumers
  const projectsKey = ['lead-related', entityType, leadId, 'projects'] as const;
  const appointmentsKey = ['lead-related', entityType, leadId, 'appointments'] as const;
  const filesKey = ['lead-related', entityType, leadId, 'files'] as const;

  // ─── Queries ───────────────────────────────────────────────────────────

  const { data: contacts = [] } = useQuery<LeadContact[]>({
    queryKey: contactsKey,
    queryFn: async () => {
      const { data } = await supabase.from('entity_contacts').select('*')
        .eq('entity_id', leadId).eq('entity_type', entityType);
      return (data ?? []) as LeadContact[];
    },
    enabled: !!leadId,
  });

  const { data: tasks = [] } = useQuery<LeadTask[]>({
    queryKey: tasksKey,
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*')
        .eq('lead_id', leadId).order('created_at', { ascending: false });
      return (data ?? []) as LeadTask[];
    },
    enabled: !!leadId,
  });

  const { data: projects = [] } = useQuery<LeadProject[]>({
    queryKey: projectsKey,
    queryFn: async () => {
      const { data } = await supabase.from('entity_projects').select('*')
        .eq('entity_id', leadId).eq('entity_type', entityType).order('created_at', { ascending: false });
      return (data ?? []) as LeadProject[];
    },
    enabled: !!leadId,
  });

  const { data: leadAppointments = [] } = useQuery({
    queryKey: appointmentsKey,
    queryFn: async () => {
      const { data } = await supabase.from('appointments')
        .select('id, title, description, start_time, end_time, appointment_type')
        .eq('lead_id', leadId).order('start_time', { ascending: true });
      return data ?? [];
    },
    enabled: !!leadId,
  });

  const { data: leadFiles = [] } = useQuery<LeadFile[]>({
    queryKey: filesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entity_files')
        .select('id, file_name, file_url, file_type, file_size, uploaded_by, created_at')
        .eq('entity_id', leadId).eq('entity_type', entityType)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LeadFile[];
    },
    enabled: !!leadId,
  });

  // Related people from same entity table — matched by company_name or business email domain
  const { data: relatedPeople = [] } = useQuery<RelatedPersonLite[]>({
    queryKey: ['lead-related', entityType, 'related-people', lead.company_name, lead.email, leadEmails.map(e => e.id).join(',')],
    queryFn: async () => {
      const results: RelatedPersonLite[] = [];
      if (lead.company_name) {
        results.push(...await searchRelatedPeopleByCompany(entityType, lead.company_name));
      }
      const allEmails = [lead.email, ...leadEmails.map(e => e.email)].filter(Boolean) as string[];
      const domains = new Set<string>();
      for (const email of allEmails) {
        const domain = email.split('@')[1]?.toLowerCase();
        if (domain && !COMMON_DOMAINS.includes(domain)) domains.add(domain);
      }
      for (const domain of domains) {
        results.push(...await searchRelatedPeopleByDomain(entityType, domain));
      }
      const seen = new Set<string>();
      return results.filter((p) => {
        if (!p?.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
    },
    enabled: !!lead,
  });

  // People search — queries master `people` + entity table in parallel
  const { data: peopleSearchResults = [] } = useQuery<PeopleSearchResult[]>({
    queryKey: ['lead-related', entityType, 'people-search', contactSearchQuery],
    queryFn: async () => {
      const q = contactSearchQuery.trim();
      if (!q) return [];
      const [peopleRes, leadsRes] = await Promise.all([
        supabase.from('people')
          .select('id, name, title, email, phone, company_name')
          .ilike('name', `%${q}%`)
          .order('name', { ascending: true })
          .limit(20),
        searchLeadsByName(entityType, q),
      ]);
      const merged = new Map<string, PeopleSearchResult>();
      (peopleRes.data || []).forEach((p) => {
        const key = (p.name || '').toLowerCase();
        if (key) {
          merged.set(key, {
            id: p.id,
            name: p.name,
            title: p.title,
            email: p.email,
            phone: p.phone,
            company_name: p.company_name,
            source: 'people',
          });
        }
      });
      leadsRes.forEach((p) => {
        const key = (p.name || '').toLowerCase();
        if (!key) return;
        if (!merged.has(key)) {
          merged.set(key, {
            id: p.id,
            name: p.name as string,
            title: p.title,
            email: p.email,
            phone: null,
            company_name: p.company_name,
            source: 'leads',
          });
        }
      });
      return Array.from(merged.values()).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );
    },
    enabled: addingContact && contactSearchQuery.trim().length > 0,
  });

  // Company search — queries `companies` + entity table + `people` in parallel
  const { data: companiesSearchResults = [] } = useQuery<CompanySearchResult[]>({
    queryKey: ['lead-related', entityType, 'companies-search', companySearchQuery],
    queryFn: async () => {
      const q = companySearchQuery.trim();
      if (!q) return [];
      const [companiesRes, leadsRes, peopleRes] = await Promise.all([
        supabase.from('companies')
          .select('id, company_name, website')
          .ilike('company_name', `%${q}%`)
          .order('company_name', { ascending: true })
          .limit(20),
        searchLeadsByCompany(entityType, q),
        supabase.from('people')
          .select('id, company_name')
          .ilike('company_name', `%${q}%`)
          .not('company_name', 'is', null)
          .limit(20),
      ]);
      const merged = new Map<string, CompanySearchResult>();
      (companiesRes.data || []).forEach((c) => {
        const key = (c.company_name || '').toLowerCase();
        if (key) {
          merged.set(key, {
            id: c.id,
            company_name: c.company_name,
            website: c.website,
            source: 'companies',
          });
        }
      });
      leadsRes.forEach((row) => {
        const name = (row.company_name || '').trim();
        const key = name.toLowerCase();
        if (!name || !key) return;
        if (!merged.has(key)) {
          merged.set(key, {
            id: `lead:${row.id}`,
            company_name: name,
            website: null,
            source: 'derived',
          });
        }
      });
      (peopleRes.data || []).forEach((row) => {
        const name = (row.company_name || '').trim();
        const key = name.toLowerCase();
        if (!name || !key) return;
        if (!merged.has(key)) {
          merged.set(key, {
            id: `ppl:${row.id}`,
            company_name: name,
            website: null,
            source: 'derived',
          });
        }
      });
      return Array.from(merged.values()).sort((a, b) =>
        a.company_name.localeCompare(b.company_name, undefined, { sensitivity: 'base' }),
      );
    },
    enabled: addingCompany && companySearchQuery.trim().length > 0,
  });

  // ─── Mutations & Handlers ──────────────────────────────────────────────

  const invalidateParentLead = useCallback(() => {
    if (leadQueryKey) queryClient.invalidateQueries({ queryKey: leadQueryKey });
    if (leadsListQueryKey) queryClient.invalidateQueries({ queryKey: leadsListQueryKey });
  }, [queryClient, leadQueryKey, leadsListQueryKey]);

  const handleLinkPerson = useCallback(async (person: {
    id: string; name: string; title: string | null; email?: string | null;
  }) => {
    if (!leadId) return;
    setSavingContact(true);
    const { error } = await supabase.from('entity_contacts').insert({
      entity_id: leadId,
      entity_type: entityType,
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
    queryClient.invalidateQueries({ queryKey: contactsKey });
  }, [leadId, entityType, queryClient, contactsKey]);

  const updateContactMutation = useMutation({
    mutationFn: async ({ contactId, name, title }: { contactId: string; name: string; title: string }) => {
      const { error } = await supabase.from('entity_contacts').update({ name, title: title || null }).eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactsKey });
      toast.success('Contact updated');
    },
    onError: () => toast.error('Failed to update contact'),
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase.from('entity_contacts').delete().eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactsKey });
      toast.success('Contact removed');
    },
    onError: () => toast.error('Failed to remove contact'),
  });

  const handleSaveEditContact = useCallback(() => {
    if (!editingContactId || !editContactName.trim()) return;
    updateContactMutation.mutate({
      contactId: editingContactId,
      name: editContactName.trim(),
      title: editContactTitle.trim(),
    });
    setEditingContactId(null);
    setEditContactName('');
    setEditContactTitle('');
  }, [editingContactId, editContactName, editContactTitle, updateContactMutation]);

  const handleCancelEditContact = useCallback(() => {
    setEditingContactId(null);
    setEditContactName('');
    setEditContactTitle('');
  }, []);

  const handleOpenPersonPanel = useCallback(async (personName: string) => {
    if (!onPersonSelect) return;
    const person = await lookupPersonByName(entityType, personName);
    if (person) {
      onPersonSelect(person as unknown as RelatedPersonLite & Record<string, unknown>);
    } else {
      toast.info('No matching person record found');
    }
  }, [entityType, onPersonSelect]);

  const handleLinkCompany = useCallback(async (companyName: string) => {
    if (!leadId || !companyName.trim()) return;
    setSavingCompany(true);
    const { error } = await updateLeadCompany(entityType, leadId, companyName.trim());
    setSavingCompany(false);
    if (error) {
      toast.error('Failed to update company');
      return;
    }
    toast.success('Company linked');
    setCompanySearchQuery('');
    setAddingCompany(false);
    invalidateParentLead();
  }, [leadId, entityType, invalidateParentLead]);

  const handleRemoveCompany = useCallback(async () => {
    if (!leadId) return;
    setSavingCompany(true);
    const { error } = await updateLeadCompany(entityType, leadId, null);
    setSavingCompany(false);
    if (error) {
      toast.error('Failed to remove company');
      return;
    }
    toast.success('Company removed');
    invalidateParentLead();
  }, [leadId, entityType, invalidateParentLead]);

  const toggleTaskCompletion = useCallback(async (task: LeadTask) => {
    const isCompleting = !task.completed_at;
    await supabase.from('tasks').update({
      completed_at: isCompleting ? new Date().toISOString() : null,
      is_completed: isCompleting,
      status: isCompleting ? 'done' : 'todo',
      updated_at: new Date().toISOString(),
    }).eq('id', task.id);
    queryClient.invalidateQueries({ queryKey: tasksKey });
  }, [queryClient, tasksKey]);

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
    queryClient.invalidateQueries({ queryKey: appointmentsKey });
  }, [leadId, eventTitle, eventDate, eventTime, eventEndTime, eventType, eventDescription, queryClient, appointmentsKey]);

  const handleDeleteEvent = useCallback(async (eventId: string) => {
    const { error } = await supabase.from('appointments').delete().eq('id', eventId);
    if (error) {
      toast.error('Failed to delete event');
      return;
    }
    toast.success('Event deleted');
    queryClient.invalidateQueries({ queryKey: appointmentsKey });
  }, [queryClient, appointmentsKey]);

  // Open the duplicate-opportunity dialog. Resolves the source row's pipeline
  // by following stage_id → pipeline_stages.pipeline_id, then loads sibling
  // stages so the user can pick which stage the new opportunity lands in.
  const openDuplicateDialog = useCallback(async () => {
    if (!leadId) return;
    setDupLoadingStages(true);
    try {
      const sourceStageId = await fetchSourceStageId(entityType, leadId);
      if (!sourceStageId) {
        toast.error('This opportunity has no stage assigned');
        return;
      }
      const { data: stageRow, error: stageErr } = await supabase
        .from('pipeline_stages')
        .select('pipeline_id')
        .eq('id', sourceStageId)
        .single();
      if (stageErr || !stageRow?.pipeline_id) {
        toast.error('Could not find pipeline for this opportunity');
        return;
      }
      const { data: siblings, error: siblingsErr } = await supabase
        .from('pipeline_stages')
        .select('id, name')
        .eq('pipeline_id', stageRow.pipeline_id)
        .order('position', { ascending: true });
      if (siblingsErr) {
        toast.error('Failed to load pipeline stages');
        return;
      }
      const list = (siblings ?? []).map((s) => ({ id: s.id, name: s.name }));
      setDupStages(list);
      setDupStageId(list[0]?.id ?? '');
      setDupOppName('');
      setDupValue('');
      setDupDescription('');
      setDupCloseDate(undefined);
      setDuplicateOpen(true);
    } catch (err) {
      console.error('Failed to open duplicate dialog:', err);
      toast.error('Failed to open duplicate dialog');
    } finally {
      setDupLoadingStages(false);
    }
  }, [entityType, leadId]);

  const handleDuplicateSubmit = useCallback(async () => {
    if (!leadId || !dupStageId) return;
    const parsedValue = dupValue.trim() ? Number(dupValue) : null;
    if (parsedValue !== null && Number.isNaN(parsedValue)) {
      toast.error('Deal value must be a number');
      return;
    }
    try {
      const result = await crmMutations.duplicateDealForSamePerson.mutateAsync({
        sourceId: leadId,
        dealOverrides: {
          opportunity_name: dupOppName.trim() || null,
          deal_value: parsedValue,
          description: dupDescription.trim() || null,
          close_date: dupCloseDate ? format(dupCloseDate, 'yyyy-MM-dd') : null,
          stage_id: dupStageId,
        },
        newOwnerId: teamMember?.id ?? null,
      });
      setDuplicateOpen(false);
      // Replace the trailing path segment with the new opportunity's id so the
      // user lands on the fresh expanded view immediately. Works for any of
      // the three pipeline expanded-view routes since they all end in /:id.
      const newId = (result?.newDeal as { id?: string } | null | undefined)?.id;
      if (newId) {
        const newPath = location.pathname.replace(/[^/]+$/, newId);
        navigate(newPath);
      }
    } catch {
      // Toast already shown by the mutation's onError handler.
    }
  }, [
    leadId,
    dupStageId,
    dupValue,
    dupOppName,
    dupDescription,
    dupCloseDate,
    crmMutations.duplicateDealForSamePerson,
    teamMember?.id,
    location.pathname,
    navigate,
  ]);

  const handleInlineCreateProject = useCallback(async () => {
    if (!newProjectName.trim() || !leadId) return;
    setSavingProject(true);
    try {
      const { error } = await supabase.from('entity_projects').insert({
        entity_id: leadId,
        entity_type: entityType,
        name: newProjectName.trim(),
        status: 'open',
        project_stage: 'open',
        visibility: 'everyone',
        created_by: currentUserName || null,
      });
      if (error) throw error;
      toast.success('Project created');
      queryClient.invalidateQueries({ queryKey: projectsKey });
      setNewProjectName('');
      setShowAddProject(false);
    } catch {
      toast.error('Failed to create project');
    } finally {
      setSavingProject(false);
    }
  }, [newProjectName, leadId, entityType, currentUserName, queryClient, projectsKey]);

  /**
   * Delete a project from `entity_projects`. Each row in that table represents
   * a project scoped to a single entity (the insert in handleInlineCreateProject
   * creates one row per project), so removing the row deletes the project
   * itself — not just a link. Uses a native confirm dialog because the sidebar
   * has no undo and projects can carry their own tasks/files.
   */
  const handleDeleteProject = useCallback(async (projectId: string, projectName: string) => {
    if (!window.confirm(`Delete project "${projectName}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('entity_projects').delete().eq('id', projectId);
    if (error) {
      toast.error('Failed to delete project');
      return;
    }
    toast.success('Project deleted');
    queryClient.invalidateQueries({ queryKey: projectsKey });
  }, [queryClient, projectsKey]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !leadId) return;
    e.target.value = '';

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
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
      setUploadingFile(false);
      const reason = uploadError.message?.includes('security')
        ? 'Permission denied — check your login session'
        : uploadError.message || 'Storage error';
      toast.error(`Upload failed for ${file.name}: ${reason}`);
      return;
    }

    const { error: dbError } = await supabase.from('entity_files').insert({
      entity_id: leadId,
      entity_type: entityType,
      file_name: file.name,
      file_url: filePath,
      file_type: file.type || null,
      file_size: file.size,
    });

    setUploadingFile(false);
    if (dbError) {
      const reason = dbError.message?.includes('row-level security')
        ? 'Permission denied — admin role required'
        : dbError.message || 'Database error';
      toast.error(`Failed to save ${file.name}: ${reason}`);
      await supabase.storage.from('lead-files').remove([filePath]);
      return;
    }
    toast.success('File uploaded');
    queryClient.invalidateQueries({ queryKey: filesKey });
  }, [leadId, entityType, queryClient, filesKey]);

  const handleDeleteFile = useCallback(async (file: LeadFile) => {
    await supabase.storage.from('lead-files').remove([file.file_url]);
    const { error } = await supabase.from('entity_files').delete().eq('id', file.id);
    if (error) {
      toast.error('Failed to delete file');
      return;
    }
    toast.success('File deleted');
    queryClient.invalidateQueries({ queryKey: filesKey });
  }, [queryClient, filesKey]);

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

  // ─── Derived data ──────────────────────────────────────────────────────
  const pendingTasks = tasks.filter((t: LeadTask) => !t.completed_at);
  const completedTasks = tasks.filter((t: LeadTask) => !!t.completed_at);

  const unlinkedRelatedPeople = relatedPeople.filter(
    (rp) => !contacts.some((c) => c.name.toLowerCase() === rp.name.toLowerCase()),
  );

  const peopleCount = contacts.length + unlinkedRelatedPeople.length;

  const projectsNav = onProjectClick ?? ((id: string) => navigate(`/admin/pipeline/projects/expanded-view/${id}`));

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <div
        className={
          className ??
          'w-full md:w-[280px] xl:w-[320px] md:shrink-0 md:min-w-[220px] min-w-0 md:border-l border-t md:border-t-0 border-border bg-card overflow-hidden flex flex-col'
        }
      >
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Related</span>
        </div>
        {/* Vertical-only scroll container: no horizontal scrollbar, content is
            constrained to sidebar width via min-w-0 + overflow-x-hidden. */}
        <div className="md:flex-1 overflow-y-auto overflow-x-hidden min-w-0">
          <div className="py-4 px-3 pr-4 min-w-0 max-w-full">

            {/* People */}
            <RelatedSection
              icon={<Users className="h-3.5 w-3.5" />}
              label="People"
              count={peopleCount}
              onAdd={() => setAddingContact(true)}
            >
              <div className="space-y-3 py-1">
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
                  ) : (() => {
                    const rowKey = c.id;
                    const isRowExpanded = !!expandedPeopleRows[rowKey];
                    const titleLine = [c.title, lead.company_name].filter(Boolean).join(' at ');
                    return (
                      <div
                        key={c.id}
                        className="flex items-start gap-2.5 group cursor-pointer min-w-0"
                        onClick={() => setExpandedPeopleRows((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }))}
                        title={isRowExpanded ? 'Click to collapse' : 'Click to reveal full details'}
                      >
                        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300 shrink-0 mt-0.5">
                          {c.name.split(' ').map((n: string) => n[0]?.toUpperCase()).join('').slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1 max-w-full">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`text-xs font-semibold text-foreground min-w-0 ${isRowExpanded ? 'break-words' : 'truncate'}`}
                              title={c.name}
                            >
                              {c.name}
                            </span>
                            {c.is_primary && (
                              <span className="flex items-center gap-0.5 text-[10px] text-foreground font-medium shrink-0">
                                <Bookmark className="h-3 w-3 fill-current" /> Primary
                              </span>
                            )}
                            <div className="ml-auto flex items-center gap-0.5 shrink-0">
                              {onPersonSelect && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleOpenPersonPanel(c.name); }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-blue-600"
                                  title="Open person panel"
                                >
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteContactMutation.mutate(c.id); }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                                title="Remove contact"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          {titleLine && (
                            <p
                              className={`text-[11px] text-muted-foreground ${isRowExpanded ? 'break-words' : 'truncate'}`}
                              title={titleLine}
                            >
                              {c.title && <span className="text-blue-600 dark:text-blue-400">{c.title}</span>}
                              {c.title && lead.company_name && ' at '}
                              {lead.company_name && <span className="text-blue-600 dark:text-blue-400">{lead.company_name}</span>}
                            </p>
                          )}
                          {c.phone && (
                            <p
                              className={`text-[11px] text-muted-foreground mt-0.5 ${isRowExpanded ? 'break-all' : 'truncate'}`}
                              title={c.phone}
                            >
                              {c.phone}
                            </p>
                          )}
                          {c.email && (
                            <p
                              className={`text-[11px] text-muted-foreground mt-0.5 ${isRowExpanded ? 'break-all' : 'truncate'}`}
                              title={c.email}
                            >
                              {c.email}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ))}

                {unlinkedRelatedPeople.length > 0 && (
                  <>
                    {contacts.length > 0 && <div className="border-t border-border" />}
                    {unlinkedRelatedPeople.map((rp) => {
                      const rowKey = `rp:${rp.id}`;
                      const isRowExpanded = !!expandedPeopleRows[rowKey];
                      const titleLine = [rp.title, rp.company_name].filter(Boolean).join(' at ');
                      return (
                        <div
                          key={rp.id}
                          className="flex items-start gap-2.5 group cursor-pointer min-w-0"
                          onClick={() => setExpandedPeopleRows((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }))}
                          title={isRowExpanded ? 'Click to collapse' : 'Click to reveal full details'}
                        >
                          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300 shrink-0 mt-0.5">
                            {rp.name.split(' ').map((n: string) => n[0]?.toUpperCase()).join('').slice(0, 2)}
                          </div>
                          <div className="min-w-0 flex-1 max-w-full">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`text-xs font-semibold text-foreground min-w-0 ${isRowExpanded ? 'break-words' : 'truncate'}`}
                                title={rp.name}
                              >
                                {rp.name}
                              </span>
                              {onPersonSelect && (
                                <div className="ml-auto flex items-center gap-0.5 shrink-0">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onPersonSelect?.(rp as unknown as RelatedPersonLite & Record<string, unknown>);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-blue-600"
                                    title="Open person panel"
                                  >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                            {titleLine && (
                              <p
                                className={`text-[11px] text-muted-foreground ${isRowExpanded ? 'break-words' : 'truncate'}`}
                                title={titleLine}
                              >
                                {rp.title && <span className="text-blue-600 dark:text-blue-400">{rp.title}</span>}
                                {rp.title && rp.company_name && ' at '}
                                {rp.company_name && <span className="text-blue-600 dark:text-blue-400">{rp.company_name}</span>}
                              </p>
                            )}
                            {rp.phone && (
                              <p
                                className={`text-[11px] text-muted-foreground mt-0.5 ${isRowExpanded ? 'break-all' : 'truncate'}`}
                                title={rp.phone}
                              >
                                {rp.phone}
                              </p>
                            )}
                            {rp.email && (
                              <p
                                className={`text-[11px] text-muted-foreground mt-0.5 ${isRowExpanded ? 'break-all' : 'truncate'}`}
                                title={rp.email}
                              >
                                {rp.email}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {peopleCount === 0 && !addingContact && (
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
                          .filter((p) => !contacts.some((c) => c.name.toLowerCase() === p.name.toLowerCase()))
                          .map((p) => (
                            <button
                              key={`${p.source}:${p.id}`}
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
                    {contactSearchQuery.trim().length > 0 && peopleSearchResults.filter((p) => !contacts.some((c) => c.name.toLowerCase() === p.name.toLowerCase())).length === 0 && (
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

            {/* Projects */}
            <RelatedSection
              icon={<FolderOpen className="h-3.5 w-3.5" />}
              label="Projects"
              count={projects.length}
              onAdd={() => setShowAddProject(true)}
            >
              <div className="space-y-1 py-1">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded-md px-1.5 py-1.5 -mx-1 transition-colors group min-w-0"
                    onClick={() => projectsNav(p.id)}
                  >
                    <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-foreground font-medium" title={p.name}>{p.name}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-full capitalize shrink-0">
                      {(p.status || 'open').replace(/_/g, ' ')}
                    </Badge>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id, p.name); }}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
                      title="Delete project"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
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

            {/* Tasks */}
            <RelatedSection
              icon={<CheckSquare className="h-3.5 w-3.5" />}
              label="Tasks"
              count={pendingTasks.length}
              iconColor="text-emerald-500"
              onAdd={() => { setEditingTask(null); setTaskDialogOpen(true); }}
            >
              <div className="space-y-1 py-1">
                {pendingTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded-md px-1 py-1 -mx-1 transition-colors group min-w-0"
                    onClick={() => { setEditingTask(t); setTaskDialogOpen(true); }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleTaskCompletion(t); }}
                      className="shrink-0"
                    >
                      <div className="h-3.5 w-3.5 rounded-sm border border-muted-foreground/40 group-hover:border-emerald-400 transition-colors" />
                    </button>
                    <span className="flex-1 min-w-0 truncate text-foreground font-medium" title={t.title}>{t.title}</span>
                    {t.due_date && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(parseISO(t.due_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => { setEditingTask(null); setTaskDialogOpen(true); }}
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
            <RelatedSection
              icon={<Layers className="h-3.5 w-3.5" />}
              label="Pipeline Records"
              count={1}
              onAdd={openDuplicateDialog}
            >
              <div className="text-xs py-1 min-w-0 max-w-full">
                <Badge
                  variant="secondary"
                  className={`text-[11px] max-w-full whitespace-normal break-words leading-tight ${stageCfg?.bg ?? ''} ${stageCfg?.color ?? ''}`}
                  title={stageCfg?.label ?? stageCfg?.title ?? lead.status}
                >
                  {stageCfg?.label ?? stageCfg?.title ?? lead.status}
                </Badge>
              </div>
            </RelatedSection>

            {/* Companies */}
            <RelatedSection
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Companies"
              count={lead.company_name ? 1 : 0}
              onAdd={() => setAddingCompany(true)}
            >
              <div className="space-y-2 py-1">
                {lead.company_name && (
                  <div className="text-xs text-foreground flex items-center gap-2 group min-w-0">
                    <div className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-400 shrink-0">
                      {lead.company_name[0]?.toUpperCase()}
                    </div>
                    <span className="flex-1 min-w-0 truncate" title={lead.company_name}>{lead.company_name}</span>
                    <button
                      onClick={handleRemoveCompany}
                      disabled={savingCompany}
                      className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 disabled:opacity-50"
                      title="Remove company"
                    >
                      {savingCompany ? (
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                      ) : (
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                      )}
                    </button>
                  </div>
                )}
                {!lead.company_name && !addingCompany && (
                  <p className="text-xs text-muted-foreground">No companies</p>
                )}
                {addingCompany ? (
                  <div className="relative mt-1">
                    <input
                      autoFocus
                      value={companySearchQuery}
                      onChange={(e) => setCompanySearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (!companySearchQuery.trim()) return;
                          const first = companiesSearchResults[0];
                          if (first) {
                            handleLinkCompany(first.company_name);
                          }
                        }
                        if (e.key === 'Escape') { setAddingCompany(false); setCompanySearchQuery(''); }
                      }}
                      placeholder="Search companies..."
                      disabled={savingCompany}
                      className="w-full text-xs text-foreground bg-muted border border-border rounded-md px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                    />
                    {savingCompany && <Loader2 className="h-3 w-3 animate-spin text-blue-500 mt-1" />}
                    {companySearchQuery.trim().length > 0 && companiesSearchResults.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {companiesSearchResults.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => handleLinkCompany(c.company_name)}
                            className="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-muted/60 transition-colors"
                          >
                            <div className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-400 shrink-0">
                              {c.company_name[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-medium text-foreground">{c.company_name}</span>
                              {c.website && <p className="text-[10px] text-muted-foreground truncate">{c.website}</p>}
                            </div>
                            <span className="text-[9px] uppercase tracking-wide text-muted-foreground shrink-0">
                              {c.source === 'companies' ? 'Company' : 'Lead'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {companySearchQuery.trim().length > 0 && companiesSearchResults.length === 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg px-2 py-2">
                        <p className="text-xs text-muted-foreground">No matching companies</p>
                      </div>
                    )}
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
                {leadFiles.map((f) => {
                  const isImage = f.file_type?.startsWith('image/') ?? false;
                  // File types the browser can render directly in a new tab.
                  const isPreviewable =
                    isImage ||
                    f.file_type === 'application/pdf' ||
                    f.file_type === 'text/plain' ||
                    f.file_type === 'text/html' ||
                    f.file_type === 'text/csv';
                  return (
                    <div
                      key={f.id}
                      className="flex items-start gap-2 text-xs p-1.5 rounded-lg hover:bg-muted/40 transition-colors group min-w-0"
                    >
                      {isImage ? (
                        // Inline thumbnail for image types — clicking opens the
                        // full image in a new tab (opt-in noreferrer for safety).
                        <a
                          href={f.file_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="h-9 w-9 shrink-0 rounded-md overflow-hidden border border-border bg-muted/40 flex items-center justify-center"
                          title={`Preview ${f.file_name}`}
                        >
                          <img
                            src={f.file_url}
                            alt={f.file_name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </a>
                      ) : (
                        <span className="text-base shrink-0 mt-0.5 leading-none">{getFileIcon(f.file_type)}</span>
                      )}
                      <div className="flex-1 min-w-0 max-w-full">
                        {isPreviewable ? (
                          <a
                            href={f.file_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="font-medium text-foreground truncate block hover:text-violet-700 hover:underline"
                            title={`Preview ${f.file_name}`}
                          >
                            {f.file_name}
                          </a>
                        ) : (
                          <p className="font-medium text-foreground truncate" title={f.file_name}>{f.file_name}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground truncate">
                          {formatFileSize(f.file_size)} · {formatShortDate(f.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {isPreviewable && (
                          <a
                            href={f.file_url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="p-1 rounded hover:bg-muted"
                            title="Preview in new tab"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Eye className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                          </a>
                        )}
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
                  );
                })}
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

            {/* Call History */}
            <LeadCallHistorySection
              leadId={leadId}
              entityType={entityType}
              teamMembers={teamMembers}
              fallbackPhone={lead.phone ?? null}
            />

            {/* Calendar Events */}
            <RelatedSection
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Calendar Events"
              count={leadAppointments.length}
              onAdd={() => setEventDialogOpen(true)}
            >
              <div className="space-y-1.5 py-1">
                {leadAppointments.map((evt) => {
                  const startDate = evt.start_time ? parseISO(evt.start_time) : null;
                  const isPast = startDate ? startDate < new Date() : false;
                  return (
                    <div
                      key={evt.id}
                      className={`group flex items-start gap-2 text-xs rounded-lg px-1.5 py-1.5 -mx-1 hover:bg-muted/60 transition-colors ${isPast ? 'opacity-60' : ''}`}
                    >
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        evt.appointment_type === 'call' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600' :
                        evt.appointment_type === 'video' ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600' :
                        'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600'
                      }`}>
                        {evt.appointment_type === 'call' ? <Phone className="h-3 w-3" /> :
                         evt.appointment_type === 'video' ? <Eye className="h-3 w-3" /> :
                         <CalendarDays className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0 max-w-full">
                        <p className="font-medium text-foreground truncate" title={evt.title}>{evt.title}</p>
                        {startDate && (
                          <p className="text-[10px] text-muted-foreground truncate">
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

          </div>
        </div>
      </div>

      {/* Task Detail Dialog */}
      {leadId && (
        <PeopleTaskDetailDialog
          task={editingTask}
          open={taskDialogOpen}
          onClose={() => { setTaskDialogOpen(false); setEditingTask(null); }}
          leadId={leadId}
          leadName={lead.opportunity_name || lead.name || ''}
          teamMembers={teamMembers}
          currentUserName={currentUserName ?? null}
          onSaved={() => queryClient.invalidateQueries({ queryKey: tasksKey })}
        />
      )}

      {/* Duplicate Opportunity Dialog */}
      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              New opportunity for {lead.name || 'this person'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Person (copied to new opportunity)
              </p>
              <div className="text-xs text-foreground">
                <span className="font-medium">{lead.name || '—'}</span>
                {lead.company_name ? <span className="text-muted-foreground"> · {lead.company_name}</span> : null}
              </div>
              {lead.email && (
                <div className="text-[11px] text-muted-foreground truncate" title={lead.email}>{lead.email}</div>
              )}
              <p className="text-[10px] text-muted-foreground italic pt-1">
                Name, company, phones, emails and addresses will be copied. Deal-specific fields below start blank.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Opportunity name</label>
              <input
                autoFocus
                value={dupOppName}
                onChange={(e) => setDupOppName(e.target.value)}
                placeholder="e.g. Second loan – 2026 acquisition"
                className="w-full text-sm text-foreground bg-muted border border-border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Stage</label>
              <Select value={dupStageId} onValueChange={setDupStageId}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder={dupLoadingStages ? 'Loading…' : 'Select a stage'} />
                </SelectTrigger>
                <SelectContent>
                  {dupStages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Deal value</label>
              <input
                value={dupValue}
                onChange={(e) => setDupValue(e.target.value)}
                placeholder="e.g. 250000"
                inputMode="decimal"
                className="w-full text-sm text-foreground bg-muted border border-border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <textarea
                value={dupDescription}
                onChange={(e) => setDupDescription(e.target.value)}
                placeholder="What's different about this deal?"
                rows={3}
                className="w-full text-sm text-foreground bg-muted border border-border rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Close date (optional)</label>
              <Popover open={dupCloseDatePickerOpen} onOpenChange={setDupCloseDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left text-sm font-normal">
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {dupCloseDate ? format(dupCloseDate, 'MMM d, yyyy') : 'Pick a date...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dupCloseDate}
                    onSelect={(date) => { setDupCloseDate(date); setDupCloseDatePickerOpen(false); }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDuplicateOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleDuplicateSubmit}
              disabled={!dupStageId || crmMutations.duplicateDealForSamePerson.isPending}
            >
              {crmMutations.duplicateDealForSamePerson.isPending && (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              )}
              Create opportunity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
