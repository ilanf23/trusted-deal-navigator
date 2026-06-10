import { parseISO, format } from 'date-fns';
import { Phone, Mail, DollarSign, Sparkles, Loader2, Info, X, Copy, MoreHorizontal, Trash2, UserPlus, UserCheck, ChevronsUpDown, Check, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CrmAvatar } from '@/components/admin/CrmAvatar';
import { PipelineSelectField } from '@/components/admin/PipelineSelectField';
import {
  EditableNotesField,
  EditableTags,
  StackedEditableField,
  StackedSelectField,
  StackedOwnerField,
  StackedReadOnlyField,
  StackedToggleField,
  formatPhoneNumber,
} from './InlineEditableFields';
import { getLeadDisplayName } from '@/lib/utils';
import { useScoreDealWithAI, useLatestWinScoreReasoning } from '@/hooks/useScoreDealWithAI';
import { useTeamMember } from '@/hooks/useTeamMember';
import { supabase } from '@/integrations/supabase/client';
import { WonLostModal, type WonLostModalPayload } from '@/components/admin/shared/WonLostModal';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';

// ── Satellite record types (still imported by parent expanded views) ──
export interface LeadEmail {
  id: string;
  entity_id: string;
  entity_type: string;
  email: string;
  email_type: string;
  is_primary: boolean;
}

export interface LeadPhone {
  id: string;
  entity_id: string;
  entity_type: string;
  phone_number: string;
  phone_type: string;
  is_primary: boolean;
}

export interface LeadAddress {
  id: string;
  entity_id: string;
  entity_type: string;
  address_type: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  is_primary: boolean;
}

// Intersection of fields the left column reads from `potential`, `underwriting`, `lender_management`.
export interface ExpandedLeftColumnLead {
  id: string;
  name: string;
  opportunity_name?: string | null;
  title?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Identifier for the currently selected stage. Accepts the legacy `lead_status` enum value
   *  or a `pipeline_stages.id` UUID — matches one of the entries in `stages`. */
  status: string;
  /** Deal-outcome status shown in the "Status" dropdown — 'open' | 'won' | 'lost' | 'abandoned'.
   *  Independent of pipeline stage. Defaults to 'open' for new/existing rows. */
  deal_outcome: 'open' | 'won' | 'lost' | 'abandoned';
  loan_stage?: string | null;
  assigned_to: string | null;
  created_at: string;
  deal_value?: number | null;
  description?: string | null;
  clx_file_name?: string | null;
  waiting_on?: string | null;
  tags?: string[] | null;
  close_date?: string | null;
  loss_reason?: string | null;
  source?: string | null;
  priority?: 'low' | 'medium' | 'high' | null;
  win_percentage?: number | null;
  visibility?: string | null;
  about?: string | null;
  history?: string | null;
  bank_relationships?: string | null;
  uw_number?: string | null;
  client_other_lenders: boolean;
  flagged_for_weekly: boolean;
}

export type ExpandedLeftColumnTable = 'potential' | 'underwriting' | 'lender_management';

export interface ExpandedLeftColumnProps {
  lead: ExpandedLeftColumnLead;
  tableName: ExpandedLeftColumnTable;
  currentPipeline: ExpandedLeftColumnTable;

  stages: string[];
  /** Accepts either `{ label }` (from InlineEditableFields) or `{ title }` (from local pipeline configs). */
  stageConfig: Record<string, { label?: string; title?: string }>;
  ownerOptions: { value: string; label: string }[];
  assignedName: string;
  dealValue: number | null;

  goBack: () => void;
  onStageChange: (s: string) => void;
  onDealOutcomeChange: (outcome: 'open' | 'won' | 'lost' | 'abandoned') => void | Promise<void>;
  onPriorityChange: (priority: 'low' | 'medium' | 'high' | null) => void | Promise<void>;
  onFieldSaved: (field: string, value: string) => void;
  onBooleanToggle: (field: 'client_other_lenders' | 'flagged_for_weekly', current: boolean) => void;
  onOwnerChange: (newOwnerId: string) => Promise<void> | void;
  /** Optional: opens the parent view's delete-confirm dialog. When omitted, no delete menu item is rendered. */
  onDelete?: () => void;
  /** Optional: open the shared compose dialog seeded with the lead's primary email. */
  onComposeEmail?: (args: { to: string; recipientName: string }) => void;
  /** Optional: click-to-call handler that dials the lead's phone via Twilio. */
  onCallPhone?: (phone: string) => void;
}

// ── Fixed deal-outcome options for the Status dropdown ──
// Shown for every pipeline that uses ExpandedLeftColumn. Note: only 'won' and
// 'lost' are currently backed by the `lead_status` enum — 'open' and 'abandoned'
// will need either an enum extension or a dedicated column to persist.
const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'won', label: 'Won' },
  { value: 'abandoned', label: 'Abandoned' },
  { value: 'lost', label: 'Lost' },
  { value: 'open', label: 'Open' },
];

// ── Fixed priority options for the Priority dropdown ──
// Backed by the `deal_priority` enum on the three deal pipeline tables.
// 'none' is a UI sentinel only — it maps to NULL in the database.
const PRIORITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

// ── Internal formatters (left column only) ──
function formatValue(v: number): string {
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'MMM d, yyyy'); } catch { return '—'; }
}

// ── Main component ──
export function ExpandedLeftColumn({
  lead,
  tableName,
  currentPipeline,
  ownerOptions,
  assignedName,
  dealValue,
  goBack,
  onDealOutcomeChange,
  onPriorityChange,
  onFieldSaved,
  onBooleanToggle,
  onOwnerChange,
  onDelete,
  onComposeEmail,
  onCallPhone,
}: ExpandedLeftColumnProps) {

  // AI win-percentage scoring (Potential pipeline only — the button is hidden
  // for other tables since the edge function only writes to `potential`).
  const scoreWithAI = useScoreDealWithAI(lead.id);
  const { data: latestReasoning } = useLatestWinScoreReasoning(
    tableName === 'potential' ? lead.id : undefined,
  );

  // ── Follow state (entity_followers) ──
  // The same entity table/id pattern used by the expanded-view parents, but
  // inlined here so the toolbar is self-contained and doesn't need extra props.
  const queryClient = useQueryClient();
  const { teamMember } = useTeamMember();
  const teamMemberId = teamMember?.id ?? null;
  const followQueryKey = ['entity-follow', tableName, lead.id, teamMemberId] as const;
  const { data: isFollowing = false } = useQuery({
    queryKey: followQueryKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('entity_followers')
        .select('id')
        .eq('entity_id', lead.id)
        .eq('entity_type', 'deal')
        .eq('user_id', teamMemberId!)
        .maybeSingle();
      return !!data;
    },
    enabled: !!lead.id && !!teamMemberId,
  });
  const toggleFollowMutation = useMutation({
    mutationFn: async () => {
      if (!teamMemberId) throw new Error('No team member');
      if (isFollowing) {
        const { error } = await supabase
          .from('entity_followers')
          .delete()
          .eq('entity_id', lead.id)
          .eq('entity_type', 'deal')
          .eq('user_id', teamMemberId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('entity_followers')
          .insert({ entity_id: lead.id, entity_type: 'deal', user_id: teamMemberId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: followQueryKey });
      // Also invalidate the list-view "Following" filter query so the filter
      // count and filtered results update immediately after follow/unfollow.
      queryClient.invalidateQueries({ queryKey: ['followed-deals', tableName, teamMemberId] });
      toast.success(isFollowing ? 'Unfollowed' : 'Following');
    },
    onError: () => {
      toast.error('Failed to update follow');
    },
  });

  // ── Won/Lost capture modal ──
  // Opened when the Status dropdown transitions to 'won' or 'lost'. On submit,
  // writes the structured payload (reason, notes, final value, close date) to
  // the current deal table and then calls `onDealOutcomeChange` so the parent
  // view can invalidate its queries and register an undo entry.
  const [wonLostOpen, setWonLostOpen] = useState(false);
  const [wonLostMode, setWonLostMode] = useState<'won' | 'lost'>('won');

  const handleStatusSelect = (next: string) => {
    const nextOutcome = next as 'open' | 'won' | 'lost' | 'abandoned';
    if (nextOutcome === 'won' || nextOutcome === 'lost') {
      setWonLostMode(nextOutcome);
      setWonLostOpen(true);
      return;
    }
    // For 'open' and 'abandoned' we fire directly — no structured capture needed.
    void onDealOutcomeChange(nextOutcome);
  };

  const handleWonLostSubmit = async (payload: WonLostModalPayload) => {
    // Build the structured update. The platform-migration migration added
    // `deal_outcome`, `won_reason`, `won_at`, `lost_at`, and repurposes the
    // existing `loss_reason` column for parity with Copper's free-form field.
    //
    // The three former pipeline tables are now the single `deals` table, so
    // the update targets `deals` directly (by id) regardless of pipeline.
    const nowIso = new Date().toISOString();
    const baseUpdates = {
      deal_outcome: payload.outcome,
      close_date: payload.closeDate,
      ...(payload.outcome === 'won'
        ? { won: true, won_reason: payload.reason, won_at: nowIso }
        : { won: false, loss_reason: payload.reason, lost_at: nowIso }),
      ...(payload.finalDealValue != null ? { deal_value: payload.finalDealValue } : {}),
    } as const;

    // Append a note line if the user added free-form context.
    if (payload.notes) {
      const noteTitle = payload.outcome === 'won' ? 'Win notes' : 'Loss notes';
      await supabase.from('activities').insert({
        entity_id: lead.id,
        entity_type: 'deal',
        activity_type: 'note',
        title: noteTitle,
        content: `${payload.reason} — ${payload.notes}`,
        created_by: teamMember?.name ?? 'System',
      });
    }

    const { error: updateError } = await supabase.from('deals').update(baseUpdates).eq('id', lead.id);
    if (updateError) {
      toast.error('Failed to save outcome');
      return;
    }
    await onDealOutcomeChange(payload.outcome);
    toast.success(`Marked as ${payload.outcome === 'won' ? 'Won' : 'Lost'}`);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  // ── Primary contact switching ──
  // The deal table stores the *current* primary contact's data denormalized into
  // `name` / `title` / `email` / `phone`. Changing the primary contact means
  // selecting any person from the `people` table and copying their identity
  // fields onto the deal. The previous primary is simply replaced. The deal's
  // `company_name` is intentionally left untouched.
  type PersonResult = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    title: string | null;
    company_name: string | null;
  };

  const [switchContactOpen, setSwitchContactOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [debouncedContactSearch, setDebouncedContactSearch] = useState('');

  // Debounce the search input so we don't query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedContactSearch(contactSearch.trim()), 200);
    return () => clearTimeout(t);
  }, [contactSearch]);

  const { data: peopleResults = [], isFetching: peopleLoading } = useQuery<PersonResult[]>({
    queryKey: ['people-contact-search', debouncedContactSearch],
    queryFn: async () => {
      const q = debouncedContactSearch;
      const { data } = await supabase
        .from('people')
        .select('id, name, email, phone, title, company_name')
        .or(`name.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%`)
        .order('name', { ascending: true })
        .limit(10);
      return (data ?? []) as PersonResult[];
    },
    enabled: switchContactOpen && debouncedContactSearch.length > 0,
  });

  const setPrimaryContact = useMutation({
    mutationFn: async (person: PersonResult) => {
      const { error } = await supabase.from('deals').update({
        name: person.name,
        title: person.title,
        email: person.email,
        phone: person.phone,
      }).eq('id', lead.id);
      if (error) throw error;
    },
    onSuccess: (_data, person) => {
      // Trigger the parent expanded-view's lead refetch + "Updated" toast.
      onFieldSaved('name', person.name);
      setSwitchContactOpen(false);
      setContactSearch('');
      toast.success('Primary contact updated');
    },
    onError: () => {
      toast.error('Failed to update primary contact');
    },
  });

  return (
    <>
    <div className="w-full md:w-[255px] lg:w-[323px] xl:w-[408px] md:shrink-0 md:min-w-[204px] min-w-0 border-b md:border-b-0 md:border-r border-border bg-card overflow-y-auto overflow-x-hidden">
      <div className="px-4 md:pl-6 md:pr-4 lg:pl-8 lg:pr-5 xl:pl-11 xl:pr-6 py-6 space-y-6">

        {/* ── Mini Toolbar ── */}
        <div className="flex items-center justify-between -ml-1 -mr-1">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={goBack}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              onClick={() => toggleFollowMutation.mutate()}
              disabled={!teamMemberId || toggleFollowMutation.isPending}
              aria-label={isFollowing ? 'Unfollow opportunity' : 'Follow opportunity'}
              className="h-8 rounded-full px-4 text-sm font-medium gap-1.5 bg-[#3b2778] hover:bg-[#2e1f5e] text-white"
            >
              {isFollowing ? (
                <UserCheck className="h-3.5 w-3.5" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyLink}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              aria-label="Copy link"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Copy className="h-3.5 w-3.5 mr-2" />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => toggleFollowMutation.mutate()}
                  disabled={!teamMemberId || toggleFollowMutation.isPending}
                >
                  {isFollowing ? (
                    <UserCheck className="h-3.5 w-3.5 mr-2" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5 mr-2" />
                  )}
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </DropdownMenuItem>
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete Record
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Contact Card Header ── */}
        <div className="flex items-start gap-4">
          <CrmAvatar name={lead.name} size="xl" />
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-xl font-semibold text-foreground break-words leading-tight">{getLeadDisplayName(lead)}</h2>
            <p className="text-sm text-muted-foreground mt-0.5 break-words">
              {dealValue != null ? formatValue(dealValue) : null}
            </p>
            <div className="mt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground bg-muted/50">
                <DollarSign className="h-3 w-3" />
                Opportunity
              </span>
            </div>
          </div>
        </div>

        {/* Name */}
        <StackedEditableField
          label="Name"
          value={lead.opportunity_name ?? ''}
          field="opportunity_name"
          leadId={lead.id}
          onSaved={onFieldSaved}
          tableName="deals"
        />

        {/* Pipeline */}
        <PipelineSelectField dealId={lead.id} currentPipeline={currentPipeline} />

        {/* Stage */}
        <StackedEditableField
          label="Stage"
          value={lead.loan_stage ?? ''}
          field="loan_stage"
          leadId={lead.id}
          onSaved={onFieldSaved}
          tableName="deals"
        />

        {/* CLX - File Name */}
        <StackedEditableField label="CLX - File Name" value={lead.clx_file_name ?? ''} field="clx_file_name" leadId={lead.id} onSaved={onFieldSaved} tableName="deals" />

        {/* Waiting On: */}
        <StackedEditableField label="Waiting On:" value={lead.waiting_on ?? ''} field="waiting_on" leadId={lead.id} onSaved={onFieldSaved} tableName="deals" />

        {/* Tags */}
        <div>
          <label className="text-sm text-muted-foreground block mb-3">Tags</label>
          <EditableTags tags={lead.tags ?? []} leadId={lead.id} onSaved={onFieldSaved} tableName="deals" />
        </div>

        {/* Value */}
        <StackedEditableField
          label="Value"
          value={lead.deal_value != null ? formatValue(lead.deal_value) : ''}
          field="deal_value"
          leadId={lead.id}
          onSaved={onFieldSaved}
          transform={(v) => v ? Number(v.replace(/[^0-9.]/g, '')) : null}
          tableName="deals"
        />

        {/* Description */}
        <StackedEditableField label="Description" value={lead.description ?? ''} field="description" leadId={lead.id} onSaved={onFieldSaved} tableName="deals" />

        {/* Primary Contact */}
        <div>
          <label className="text-sm text-muted-foreground block mb-2">Primary Contact</label>
          <div className="border-b border-border pb-3">
            <div className="flex items-start gap-3 px-1 py-1.5 group">
              <CrmAvatar name={lead.name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-base text-foreground break-words">{lead.name}</p>
                {lead.title && <p className="text-xs text-muted-foreground break-words">{lead.title}</p>}
              </div>
              <Popover
                open={switchContactOpen}
                onOpenChange={(open) => {
                  setSwitchContactOpen(open);
                  if (!open) setContactSearch('');
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 transition-opacity"
                    aria-label="Change primary contact"
                    title="Change primary contact"
                    disabled={setPrimaryContact.isPending}
                  >
                    {setPrimaryContact.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-72 p-1">
                  <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Change primary contact
                  </div>
                  <div className="relative px-1 pb-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      autoFocus
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      placeholder="Search people…"
                      className="h-8 pl-8 text-sm"
                    />
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {debouncedContactSearch.length === 0 ? (
                      <p className="px-2 py-3 text-[11px] text-muted-foreground text-center">
                        Type to search people
                      </p>
                    ) : peopleLoading ? (
                      <div className="flex items-center justify-center py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : peopleResults.length === 0 ? (
                      <p className="px-2 py-3 text-[11px] text-muted-foreground text-center">
                        No people found — add them on the People page first.
                      </p>
                    ) : (
                      peopleResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPrimaryContact.mutate(p)}
                          disabled={setPrimaryContact.isPending}
                          className="w-full flex items-start gap-2 px-2 py-2 rounded-md text-left hover:bg-muted/60 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        >
                          <CrmAvatar name={p.name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-foreground break-words leading-tight">{p.name}</p>
                            {(p.title || p.company_name) && (
                              <p className="text-xs text-muted-foreground break-words leading-tight mt-0.5">
                                {[p.title, p.company_name].filter(Boolean).join(' · ')}
                              </p>
                            )}
                            {p.email && (
                              <p className="text-[11px] text-muted-foreground break-all leading-tight mt-0.5">{p.email}</p>
                            )}
                          </div>
                          <Check className="h-3.5 w-3.5 text-transparent shrink-0 mt-1" />
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {lead.phone && (
              <button
                type="button"
                onClick={() => onCallPhone?.(lead.phone!)}
                disabled={!onCallPhone}
                className="w-full flex items-start gap-2 px-1 py-1 min-w-0 text-left rounded hover:bg-muted/60 disabled:hover:bg-transparent disabled:cursor-default transition-colors"
                title={onCallPhone ? `Call ${formatPhoneNumber(lead.phone)}` : formatPhoneNumber(lead.phone)}
              >
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                <span className="text-sm text-foreground min-w-0 flex-1 whitespace-nowrap">{formatPhoneNumber(lead.phone)}</span>
              </button>
            )}
            {lead.email && (
              <button
                type="button"
                onClick={() => onComposeEmail?.({ to: lead.email!, recipientName: lead.name })}
                disabled={!onComposeEmail}
                className="w-full flex items-start gap-2 px-1 py-1 min-w-0 text-left rounded hover:bg-muted/60 disabled:hover:bg-transparent disabled:cursor-default transition-colors"
                title={onComposeEmail ? `Email ${lead.email}` : lead.email}
              >
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                <span className="text-sm text-foreground break-all min-w-0 flex-1">{lead.email}</span>
              </button>
            )}
          </div>
        </div>

        {/* Status — fixed deal-outcome options (Won / Abandoned / Lost / Open).
            Won/Lost open the capture modal so we get structured reason data;
            Open/Abandoned fire the outcome change handler directly. */}
        <StackedSelectField
          label="Status"
          value={lead.deal_outcome}
          options={STATUS_OPTIONS}
          onChange={handleStatusSelect}
        />

        {/* Close Date */}
        <StackedEditableField label="Close Date" value={lead.close_date ? formatDate(lead.close_date) : ''} field="close_date" leadId={lead.id} onSaved={onFieldSaved} tableName="deals" />

        {/* Owner */}
        {ownerOptions.length > 0 ? (
          <StackedOwnerField
            label="Owner"
            value={lead.assigned_to ?? ''}
            displayValue={assignedName}
            options={ownerOptions}
            onChange={(v) => { void onOwnerChange(v); }}
          />
        ) : (
          <StackedReadOnlyField label="Owner" value={assignedName} />
        )}

        {/* Source */}
        <StackedEditableField label="Source" value={lead.source ?? ''} field="source" leadId={lead.id} onSaved={onFieldSaved} tableName="deals" emptyText="No Source" />

        {/* Created */}
        <StackedReadOnlyField label="Created" value={formatDate(lead.created_at)} locked />

        {/* Priority — fixed options (None / Low / Medium / High), backed by deal_priority enum */}
        <StackedSelectField
          label="Priority"
          value={lead.priority ?? 'none'}
          options={PRIORITY_OPTIONS}
          onChange={(v) => onPriorityChange(v === 'none' ? null : (v as 'low' | 'medium' | 'high'))}
        />

        {/* Win Percentage — read-only display + AI scoring button (Potential only) */}
        <div>
          <StackedReadOnlyField
            label="Win Percentage"
            value={scoreWithAI.isPending ? '…' : String(lead.win_percentage ?? 0)}
            secondaryValue={scoreWithAI.isPending ? undefined : `${lead.win_percentage ?? 0}%`}
          />
          {tableName === 'potential' && (
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={scoreWithAI.isPending}
                onClick={() => scoreWithAI.mutate()}
                className="h-8 gap-1.5 text-xs"
              >
                {scoreWithAI.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {scoreWithAI.isPending ? 'Scoring…' : 'Score with AI'}
              </Button>
              {latestReasoning?.ai_reasoning && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center h-6 w-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                      aria-label="Show AI reasoning"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="bottom" align="start" className="w-80 text-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>AI reasoning</span>
                      <span>{format(parseISO(latestReasoning.created_at), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                    <p className="text-foreground leading-relaxed">{latestReasoning.ai_reasoning}</p>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
        </div>

        {/* Loss Reason */}
        <StackedEditableField label="Loss Reason" value={lead.loss_reason ?? ''} field="loss_reason" leadId={lead.id} onSaved={onFieldSaved} tableName="deals" emptyText="No Loss Reason" />

        {/* Visibility */}
        <StackedEditableField label="Visibility" value={lead.visibility && lead.visibility !== 'everyone' ? lead.visibility : ''} field="visibility" leadId={lead.id} onSaved={onFieldSaved} tableName="deals" emptyText="Everyone" />

        {/* Bank Relationships */}
        <div>
          <label className="text-sm text-muted-foreground block mb-3">Bank Relationships</label>
          <EditableNotesField value={lead.bank_relationships ?? ''} field="bank_relationships" leadId={lead.id} placeholder="Add Bank Relationships" onSaved={onFieldSaved} tableName="deals" />
        </div>

        {/* Client Working with Other Lenders */}
        <StackedToggleField
          label="Client Working with Other Lenders"
          value={lead.client_other_lenders}
          onToggle={() => onBooleanToggle('client_other_lenders', lead.client_other_lenders)}
        />

        {/* Weekly's */}
        <StackedToggleField
          label="Weekly's"
          value={lead.flagged_for_weekly}
          onToggle={() => onBooleanToggle('flagged_for_weekly', lead.flagged_for_weekly)}
        />

      </div>
    </div>
    <WonLostModal
      open={wonLostOpen}
      onOpenChange={setWonLostOpen}
      outcome={wonLostMode}
      currentDealValue={dealValue}
      onSubmit={handleWonLostSubmit}
    />
    </>
  );
}
