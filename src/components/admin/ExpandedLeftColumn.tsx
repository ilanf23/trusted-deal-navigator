import { parseISO, format } from 'date-fns';
import { Phone, Mail, DollarSign, Sparkles, Loader2, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  priority?: string | null;
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
  onFieldSaved: (field: string, value: string) => void;
  onBooleanToggle: (field: 'client_other_lenders' | 'flagged_for_weekly', current: boolean) => void;
  onOwnerChange: (newOwnerId: string) => Promise<void> | void;
}

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
  stages,
  stageConfig,
  ownerOptions,
  assignedName,
  dealValue,
  goBack,
  onStageChange,
  onFieldSaved,
  onBooleanToggle,
  onOwnerChange,
}: ExpandedLeftColumnProps) {
  const stageCfgLabel = (cfg?: { label?: string; title?: string }) => cfg?.label ?? cfg?.title;

  // AI win-percentage scoring (Potential pipeline only — the button is hidden
  // for other tables since the edge function only writes to `potential`).
  const scoreWithAI = useScoreDealWithAI(lead.id);
  const { data: latestReasoning } = useLatestWinScoreReasoning(
    tableName === 'potential' ? lead.id : undefined,
  );

  return (
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
          tableName={tableName}
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
          tableName={tableName}
        />

        {/* CLX - File Name */}
        <StackedEditableField label="CLX - File Name" value={lead.clx_file_name ?? ''} field="clx_file_name" leadId={lead.id} onSaved={onFieldSaved} tableName={tableName} />

        {/* Waiting On: */}
        <StackedEditableField label="Waiting On:" value={lead.waiting_on ?? ''} field="waiting_on" leadId={lead.id} onSaved={onFieldSaved} tableName={tableName} />

        {/* Tags */}
        <div>
          <label className="text-sm text-muted-foreground block mb-3">Tags</label>
          <EditableTags tags={lead.tags ?? []} leadId={lead.id} onSaved={onFieldSaved} tableName={tableName} />
        </div>

        {/* Value */}
        <StackedEditableField
          label="Value"
          value={lead.deal_value != null ? String(lead.deal_value) : ''}
          secondaryValue={lead.deal_value != null ? formatValue(lead.deal_value) : undefined}
          field="deal_value"
          leadId={lead.id}
          onSaved={onFieldSaved}
          transform={(v) => v ? Number(v.replace(/[^0-9.]/g, '')) : null}
          tableName={tableName}
        />

        {/* Description */}
        <StackedEditableField label="Description" value={lead.description ?? ''} field="description" leadId={lead.id} onSaved={onFieldSaved} tableName={tableName} />

        {/* Primary Contact */}
        <div>
          <label className="text-sm text-muted-foreground block mb-2">Primary Contact</label>
          <div className="border-b border-border pb-3">
            <div className="flex items-start gap-3 px-1 py-1.5">
              <CrmAvatar name={lead.name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-base text-foreground break-words">{lead.name}</p>
                {lead.title && <p className="text-xs text-muted-foreground break-words">{lead.title}</p>}
              </div>
            </div>
            {lead.phone && (
              <div className="flex items-start gap-2 px-1 py-1 min-w-0">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                <span className="text-sm text-foreground min-w-0 flex-1 whitespace-nowrap">{formatPhoneNumber(lead.phone)}</span>
              </div>
            )}
            {lead.email && (
              <div className="flex items-start gap-2 px-1 py-1 min-w-0">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                <span className="text-sm text-foreground break-all min-w-0 flex-1">{lead.email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status */}
        <StackedSelectField
          label="Status"
          value={lead.status}
          options={stages.map((s) => ({ value: s, label: stageCfgLabel(stageConfig[s]) ?? s }))}
          onChange={onStageChange}
        />

        {/* Close Date */}
        <StackedEditableField label="Close Date" value={lead.close_date ? formatDate(lead.close_date) : ''} field="close_date" leadId={lead.id} onSaved={onFieldSaved} tableName={tableName} />

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
        <StackedEditableField label="Source" value={lead.source ?? ''} field="source" leadId={lead.id} onSaved={onFieldSaved} tableName={tableName} emptyText="No Source" />

        {/* Created */}
        <StackedReadOnlyField label="Created" value={formatDate(lead.created_at)} locked />

        {/* Priority */}
        <StackedEditableField label="Priority" value={lead.priority ?? ''} field="priority" leadId={lead.id} onSaved={onFieldSaved} tableName={tableName} emptyText="None" />

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
        <StackedEditableField label="Loss Reason" value={lead.loss_reason ?? ''} field="loss_reason" leadId={lead.id} onSaved={onFieldSaved} tableName={tableName} emptyText="No Loss Reason" />

        {/* Visibility */}
        <StackedEditableField label="Visibility" value={lead.visibility && lead.visibility !== 'everyone' ? lead.visibility : ''} field="visibility" leadId={lead.id} onSaved={onFieldSaved} tableName={tableName} emptyText="Everyone" />

        {/* Bank Relationships */}
        <div>
          <label className="text-sm text-muted-foreground block mb-3">Bank Relationships</label>
          <EditableNotesField value={lead.bank_relationships ?? ''} field="bank_relationships" leadId={lead.id} placeholder="Add Bank Relationships" onSaved={onFieldSaved} tableName={tableName} />
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
    </ScrollArea>
  );
}
