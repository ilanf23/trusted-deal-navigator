import { useEffect, useState } from 'react';
import { Info, Loader2 } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCrmMutations, type CrmTable, PIPELINE_LABELS } from '@/hooks/usePipelineMutations';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

type StageOption = { id: string; name: string };
type StageConfigMap = Record<string, { title?: string }>;

export interface AddOpportunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: CrmTable;
  stages: StageOption[];
  stageConfig: StageConfigMap;
  ownerOptions: { value: string; label: string }[];
  initialStageId?: string;
  onCreated?: (lead: { id: string; name: string }) => void;
}

type NewOpportunityForm = {
  // Deal
  opportunity_name: string;
  stage_id: string;
  clx_file_name: string;
  waiting_on: string;
  tags: string;
  deal_value: string;
  description: string;

  // Status & ownership
  status: string;
  close_date: string;
  company_name: string;
  assigned_to: string;
  source: string;
  priority: string;
  win_percentage: string;
  visibility: string;

  // Contact / extras
  phone: string;
  address: string; // no DB column on pipeline tables; captured but not persisted for v1
  about: string;
  history: string;
  bank_relationships: string;
  rlm: string; // no DB column on pipeline tables; captured but not persisted for v1

  // Flags
  client_other_lenders: boolean;
  weeklys: string; // maps to flagged_for_weekly (Yes/No)
};

const BLANK: NewOpportunityForm = {
  opportunity_name: '',
  stage_id: '',
  clx_file_name: '',
  waiting_on: '',
  tags: '',
  deal_value: '',
  description: '',
  status: '',
  close_date: '',
  company_name: '',
  assigned_to: '',
  source: '',
  priority: 'None',
  win_percentage: '',
  visibility: 'Everyone',
  phone: '',
  address: '',
  about: '',
  history: '',
  bank_relationships: '',
  rlm: '',
  client_other_lenders: false,
  weeklys: '',
};

const PRIORITY_OPTIONS = ['None', 'Low', 'Medium', 'High'];
const VISIBILITY_OPTIONS = ['Everyone', 'Just Me'];
const WEEKLYS_OPTIONS = ['No', 'Yes'];

// ── Small helper components ─────────────────────────────────────────────────

function FieldRow({
  label,
  htmlFor,
  required,
  children,
  labelRight,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
  labelRight?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label
          htmlFor={htmlFor}
          className="text-xs font-medium text-muted-foreground"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
          {labelRight}
        </Label>
      </div>
      {children}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function AddOpportunityDialog({
  open,
  onOpenChange,
  tableName,
  stages,
  stageConfig,
  ownerOptions,
  initialStageId,
  onCreated,
}: AddOpportunityDialogProps) {
  const { addLeadToPipeline } = useCrmMutations(tableName);
  const [form, setForm] = useState<NewOpportunityForm>(BLANK);

  // Reset form every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const defaultStage = initialStageId || stages[0]?.id || '';
    setForm({
      ...BLANK,
      stage_id: defaultStage,
      status: defaultStage,
      assigned_to: ownerOptions[0]?.value || '',
    });
  }, [open, initialStageId, stages, ownerOptions]);

  const canSubmit = form.opportunity_name.trim().length > 0 && !!form.stage_id;

  const update = <K extends keyof NewOpportunityForm>(key: K, value: NewOpportunityForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Name is required');
      return;
    }
    try {
      const name = form.opportunity_name.trim();
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const created = await addLeadToPipeline.mutateAsync({
        leadData: {
          // DB `name` is NOT NULL — derive from the opportunity name at top.
          name,
          opportunity_name: name,
          loan_stage: stageConfig[form.stage_id]?.title ?? null,
          clx_file_name: form.clx_file_name.trim() || null,
          waiting_on: form.waiting_on.trim() || null,
          tags: tags.length ? tags : null,
          deal_value: form.deal_value
            ? Number(form.deal_value.replace(/[^0-9.]/g, '')) || null
            : null,
          description: form.description.trim() || null,
          phone: form.phone.trim() || null,
          close_date: form.close_date || null,
          assigned_to: form.assigned_to || null,
          source: form.source.trim() || null,
          priority: form.priority === 'None' ? null : form.priority,
          win_percentage: form.win_percentage ? Number(form.win_percentage) || null : null,
          visibility: form.visibility === 'Everyone' ? null : form.visibility,
          bank_relationships: form.bank_relationships.trim() || null,
          client_other_lenders: form.client_other_lenders,
          flagged_for_weekly: form.weeklys === 'Yes',
        },
        stageId: form.stage_id,
      });

      // Address & RLM are captured in the form to match the mockup but are not
      // persisted — there are no matching columns on the pipeline tables yet.

      const createdLead = created as { id: string; name: string } | null;
      toast.success(`"${createdLead?.name ?? name}" added to ${stageConfig[form.stage_id]?.title ?? 'pipeline'}`);
      onOpenChange(false);
      if (createdLead) onCreated?.(createdLead);
    } catch {
      // toast is surfaced inside addLeadToPipeline.onError
    }
  };

  const isSubmitting = addLeadToPipeline.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold text-foreground">
            Add a New Opportunity
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          {/* Name */}
          <FieldRow label="Name" htmlFor="opp-name" required>
            <Input
              id="opp-name"
              autoFocus
              placeholder="Add Name"
              value={form.opportunity_name}
              onChange={(e) => update('opportunity_name', e.target.value)}
            />
          </FieldRow>

          {/* Pipeline + Stage (2 cols) */}
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Pipeline" htmlFor="opp-pipeline">
              <Select value={tableName} onValueChange={() => { /* locked */ }}>
                <SelectTrigger id="opp-pipeline" disabled>
                  <SelectValue>{PIPELINE_LABELS[tableName]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PIPELINE_LABELS) as CrmTable[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {PIPELINE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>

            <FieldRow label="Stage" htmlFor="opp-stage">
              <Select
                value={form.stage_id}
                onValueChange={(v) => update('stage_id', v)}
              >
                <SelectTrigger id="opp-stage">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {stageConfig[s.id]?.title ?? s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          </div>

          {/* CLX - File Name */}
          <FieldRow label="CLX - File Name" htmlFor="opp-clx">
            <Input
              id="opp-clx"
              placeholder="Add CLX - File Name"
              value={form.clx_file_name}
              onChange={(e) => update('clx_file_name', e.target.value)}
            />
          </FieldRow>

          {/* Waiting On */}
          <FieldRow label="Waiting On:" htmlFor="opp-waiting">
            <Input
              id="opp-waiting"
              placeholder="Add Waiting On:"
              value={form.waiting_on}
              onChange={(e) => update('waiting_on', e.target.value)}
            />
          </FieldRow>

          {/* Tags */}
          <FieldRow label="Tags" htmlFor="opp-tags">
            <Input
              id="opp-tags"
              placeholder="Add Tag"
              value={form.tags}
              onChange={(e) => update('tags', e.target.value)}
            />
          </FieldRow>

          {/* Value */}
          <FieldRow label="Value" htmlFor="opp-value">
            <Input
              id="opp-value"
              inputMode="decimal"
              placeholder="Add Value"
              value={form.deal_value}
              onChange={(e) => update('deal_value', e.target.value)}
            />
          </FieldRow>

          {/* Description */}
          <FieldRow label="Description" htmlFor="opp-description">
            <Input
              id="opp-description"
              placeholder="Add Description"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
            />
          </FieldRow>

          {/* Primary Contact (relate action) */}
          <FieldRow label="Primary Contact" required>
            <button
              type="button"
              onClick={() => toast.info('Contact relation available after creation')}
              className="text-sm text-[#3b2778] hover:underline font-medium bg-transparent border-0 p-0 text-left"
            >
              Relate a Contact
            </button>
          </FieldRow>

          {/* Status */}
          <FieldRow label="Status" htmlFor="opp-status">
            <Select
              value={form.status}
              onValueChange={(v) => update('status', v)}
            >
              <SelectTrigger id="opp-status">
                <SelectValue placeholder="Open" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {stageConfig[s.id]?.title ?? s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Close Date with info tooltip */}
          <FieldRow
            label="Close Date"
            htmlFor="opp-close"
            labelRight={
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-1 inline-flex text-muted-foreground hover:text-foreground cursor-help">
                      <Info className="h-3 w-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Expected close date for this opportunity
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            }
          >
            <Input
              id="opp-close"
              type="date"
              value={form.close_date}
              onChange={(e) => update('close_date', e.target.value)}
            />
          </FieldRow>

          {/* Company */}
          <FieldRow label="Company" htmlFor="opp-company">
            <Input
              id="opp-company"
              placeholder="Add Company"
              value={form.company_name}
              onChange={(e) => update('company_name', e.target.value)}
            />
          </FieldRow>

          {/* Owner + Source (2 cols) */}
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Owner" htmlFor="opp-owner">
              {ownerOptions.length > 0 ? (
                <Select
                  value={form.assigned_to}
                  onValueChange={(v) => update('assigned_to', v)}
                >
                  <SelectTrigger id="opp-owner">
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {ownerOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input id="opp-owner" disabled value="No team" />
              )}
            </FieldRow>

            <FieldRow label="Source" htmlFor="opp-source">
              <Input
                id="opp-source"
                placeholder="No Source"
                value={form.source}
                onChange={(e) => update('source', e.target.value)}
              />
            </FieldRow>
          </div>

          {/* Priority */}
          <FieldRow label="Priority" htmlFor="opp-priority">
            <Select
              value={form.priority}
              onValueChange={(v) => update('priority', v)}
            >
              <SelectTrigger id="opp-priority">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Win Percentage */}
          <FieldRow label="Win Percentage" htmlFor="opp-win">
            <Input
              id="opp-win"
              type="number"
              min={0}
              max={100}
              placeholder="Add Win Percentage"
              value={form.win_percentage}
              onChange={(e) => update('win_percentage', e.target.value)}
            />
          </FieldRow>

          {/* Visibility */}
          <FieldRow label="Visibility" htmlFor="opp-visibility">
            <Select
              value={form.visibility}
              onValueChange={(v) => update('visibility', v)}
            >
              <SelectTrigger id="opp-visibility">
                <SelectValue placeholder="Everyone" />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {/* Phone */}
          <FieldRow label="Phone" htmlFor="opp-phone">
            <Input
              id="opp-phone"
              type="tel"
              placeholder="Add Phone"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </FieldRow>

          {/* Address */}
          <FieldRow label="Address" htmlFor="opp-address">
            <Input
              id="opp-address"
              placeholder="Add Address"
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
            />
          </FieldRow>

          {/* About */}
          <FieldRow label="About" htmlFor="opp-about">
            <Input
              id="opp-about"
              placeholder="Add About"
              value={form.about}
              onChange={(e) => update('about', e.target.value)}
            />
          </FieldRow>

          {/* History */}
          <FieldRow label="History" htmlFor="opp-history">
            <Input
              id="opp-history"
              placeholder="Add History"
              value={form.history}
              onChange={(e) => update('history', e.target.value)}
            />
          </FieldRow>

          {/* Bank Relationships */}
          <FieldRow label="Bank Relationships" htmlFor="opp-bank">
            <Input
              id="opp-bank"
              placeholder="Add Bank Relationships"
              value={form.bank_relationships}
              onChange={(e) => update('bank_relationships', e.target.value)}
            />
          </FieldRow>

          {/* RLM */}
          <FieldRow label="RLM" htmlFor="opp-rlm">
            <Input
              id="opp-rlm"
              placeholder="Add RLM"
              value={form.rlm}
              onChange={(e) => update('rlm', e.target.value)}
            />
          </FieldRow>

          {/* Client Working with Other Lenders + Weekly's (2 cols) */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="opp-other-lenders"
                checked={form.client_other_lenders}
                onCheckedChange={(v) => update('client_other_lenders', v === true)}
              />
              <Label
                htmlFor="opp-other-lenders"
                className="text-xs font-medium text-foreground cursor-pointer leading-tight"
              >
                Client Working with Other Lenders
              </Label>
            </div>

            <FieldRow label="Weekly's" htmlFor="opp-weeklys">
              <Select
                value={form.weeklys}
                onValueChange={(v) => update('weeklys', v)}
              >
                <SelectTrigger id="opp-weeklys">
                  <SelectValue placeholder="Select Weekly's" />
                </SelectTrigger>
                <SelectContent>
                  {WEEKLYS_OPTIONS.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border px-6 py-3 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="h-9 px-4 text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className={cn(
              'h-9 px-5 font-semibold text-white',
              'bg-[#3b2778] hover:bg-[#4a3490] focus-visible:ring-[#3b2778]',
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
