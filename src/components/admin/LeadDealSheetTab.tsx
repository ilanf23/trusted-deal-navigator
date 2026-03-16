import { useMemo } from 'react';
import {
  DollarSign, Building2, FileText, Calendar, Percent,
  TrendingUp, AlertTriangle, CheckCircle, Clock, Target,
  Briefcase, Shield, User,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { differenceInDays, parseISO, format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';
import {
  EditableField,
  EditableSelectField,
  EditableNotesField,
  ReadOnlyField,
} from '@/components/admin/InlineEditableFields';
import type { VolumeLogSignal } from '@/hooks/useLoanVolumeLog';

type Lead = Database['public']['Tables']['leads']['Row'];

interface LeadDealSheetTabProps {
  lead: Lead;
  onFieldSaved: (field: string, newValue: string) => void;
}

// ── Option sets ──

const VOLUME_LOG_STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Dead', label: 'Dead' },
];

const CATEGORY_OPTIONS = [
  { value: 'Bus. Acquisition', label: 'Bus. Acquisition' },
  { value: 'Construction', label: 'Construction' },
  { value: 'CLOC', label: 'CLOC' },
  { value: 'Commercial RE', label: 'Commercial RE' },
  { value: 'SBA 7A', label: 'SBA 7A' },
  { value: 'SBA 504', label: 'SBA 504' },
  { value: 'Equipment', label: 'Equipment' },
  { value: 'Bridge', label: 'Bridge' },
  { value: 'Conventional', label: 'Conventional' },
  { value: 'Other', label: 'Other' },
];

const STAGE_OPTIONS = [
  { value: 'Lead', label: 'Lead' },
  { value: 'Initial Review', label: 'Initial Review' },
  { value: 'Terms Issued', label: 'Terms Issued' },
  { value: 'In Process', label: 'In Process' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Dead/Lost', label: 'Dead/Lost' },
];

const YES_NO_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

const LENDER_TYPE_OPTIONS = [
  { value: 'Traditional Bank', label: 'Traditional Bank' },
  { value: 'SBA 7A', label: 'SBA 7A' },
  { value: 'SBA 504', label: 'SBA 504' },
  { value: 'Non-Bank', label: 'Non-Bank' },
  { value: 'Private', label: 'Private' },
  { value: 'CDFI', label: 'CDFI' },
  { value: 'Credit Union', label: 'Credit Union' },
  { value: 'Other', label: 'Other' },
];

// ── Helpers ──

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '';
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function parseCurrencyToNumber(val: string): unknown {
  const cleaned = val.replace(/[$,\s]/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? null : num;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'M/d/yyyy');
  } catch {
    return dateStr;
  }
}

function boolToSelectValue(val: boolean | null | undefined): string {
  if (val === true) return 'true';
  if (val === false) return 'false';
  return '';
}

function boolDisplayValue(val: boolean | null | undefined): string {
  if (val === true) return 'Yes';
  if (val === false) return 'No';
  return '—';
}

function computeSignals(lead: Lead): VolumeLogSignal[] {
  const signals: VolumeLogSignal[] = [];
  const now = new Date();
  const isActive = lead.volume_log_status === 'Active' || !lead.volume_log_status;

  if (isActive && !lead.lender_name) {
    const stage = lead.loan_stage;
    if (stage && stage !== 'Initial Review' && stage !== 'Lead') {
      signals.push({
        type: 'missing_lender',
        severity: 'warning',
        title: 'Missing Lender',
        description: 'Active deal has no lender assigned',
      });
    }
  }

  if (isActive && !lead.clx_agreement) {
    signals.push({
      type: 'no_clx_agreement',
      severity: 'warning',
      title: 'No CLX Agreement',
      description: 'CLX agreement not signed',
    });
  }

  if (lead.won && (!lead.actual_net_revenue || lead.actual_net_revenue === 0) && lead.potential_revenue && lead.potential_revenue > 0) {
    signals.push({
      type: 'revenue_at_risk',
      severity: 'critical',
      title: 'Revenue at Risk',
      description: 'Won deal with no actual net revenue recorded',
    });
  }

  if (isActive && lead.target_closing_date) {
    const target = parseISO(lead.target_closing_date);
    if (target < now && !lead.won) {
      signals.push({
        type: 'overdue_closing',
        severity: 'critical',
        title: 'Overdue Closing',
        description: 'Target closing date passed',
      });
    }
  }

  return signals;
}

const SEVERITY_STYLES: Record<string, { badge: string; icon: string }> = {
  critical: {
    badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    icon: 'text-red-500',
  },
  warning: {
    badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    icon: 'text-amber-500',
  },
  info: {
    badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    icon: 'text-blue-500',
  },
};

// ── Section header ──

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-3 pt-4 pb-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        {title}
      </span>
    </div>
  );
}

// ── Component ──

export function LeadDealSheetTab({ lead, onFieldSaved }: LeadDealSheetTabProps) {
  const signals = useMemo(() => computeSignals(lead), [lead]);

  const daysToWu = useMemo(() => {
    if (lead.wu_date && lead.created_at) {
      return differenceInDays(parseISO(lead.wu_date), parseISO(lead.created_at));
    }
    return null;
  }, [lead.wu_date, lead.created_at]);

  const daysToClose = useMemo(() => {
    if (lead.target_closing_date && lead.created_at) {
      return differenceInDays(parseISO(lead.target_closing_date), parseISO(lead.created_at));
    }
    return null;
  }, [lead.target_closing_date, lead.created_at]);

  const isInactiveOrDead = lead.volume_log_status === 'Inactive' || lead.volume_log_status === 'Dead';

  return (
    <ScrollArea className="h-[calc(100vh-220px)] pr-2">
      <div className="space-y-1 pb-6">

        {/* ── Section 1: Deal Overview ── */}
        <SectionHeader title="Deal Overview" />
        <div className="space-y-0.5">
          <EditableSelectField
            icon={<Target className="h-3.5 w-3.5" />}
            label="Volume Log Status"
            value={lead.volume_log_status || ''}
            displayValue={lead.volume_log_status || '—'}
            field="volume_log_status"
            leadId={lead.id}
            options={VOLUME_LOG_STATUS_OPTIONS}
            onSaved={onFieldSaved}
          />
          <EditableSelectField
            icon={<Briefcase className="h-3.5 w-3.5" />}
            label="Category"
            value={lead.loan_category || ''}
            displayValue={lead.loan_category || '—'}
            field="loan_category"
            leadId={lead.id}
            options={CATEGORY_OPTIONS}
            onSaved={onFieldSaved}
          />
          <EditableSelectField
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Stage"
            value={lead.loan_stage || ''}
            displayValue={lead.loan_stage || '—'}
            field="loan_stage"
            leadId={lead.id}
            options={STAGE_OPTIONS}
            onSaved={onFieldSaved}
          />
          <EditableSelectField
            icon={<CheckCircle className="h-3.5 w-3.5" />}
            label="WON"
            value={boolToSelectValue(lead.won)}
            displayValue={boolDisplayValue(lead.won)}
            field="won"
            leadId={lead.id}
            options={YES_NO_OPTIONS}
            onSaved={(field, val) => onFieldSaved(field, val)}
          />
          <EditableSelectField
            icon={<Shield className="h-3.5 w-3.5" />}
            label="CLX Agreement"
            value={boolToSelectValue(lead.clx_agreement)}
            displayValue={boolDisplayValue(lead.clx_agreement)}
            field="clx_agreement"
            leadId={lead.id}
            options={YES_NO_OPTIONS}
            onSaved={(field, val) => onFieldSaved(field, val)}
          />
          <EditableField
            icon={<FileText className="h-3.5 w-3.5" />}
            label="Source"
            value={lead.source || ''}
            field="source"
            leadId={lead.id}
            onSaved={onFieldSaved}
          />
          <ReadOnlyField
            icon={<User className="h-3.5 w-3.5" />}
            label="Assigned To"
            value={lead.assigned_to || '—'}
          />
        </div>

        {/* ── Section 2: Loan Details ── */}
        <SectionHeader title="Loan Details" />
        <div className="space-y-0.5">
          <EditableField
            icon={<DollarSign className="h-3.5 w-3.5" />}
            label="Loan Amount"
            value={formatCurrency(lead.deal_value)}
            field="deal_value"
            leadId={lead.id}
            highlight
            onSaved={onFieldSaved}
            transform={parseCurrencyToNumber}
          />
          <EditableField
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Lender Name"
            value={lead.lender_name || ''}
            field="lender_name"
            leadId={lead.id}
            onSaved={onFieldSaved}
          />
          <EditableSelectField
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Lender Type"
            value={lead.lender_type || ''}
            displayValue={lead.lender_type || '—'}
            field="lender_type"
            leadId={lead.id}
            options={LENDER_TYPE_OPTIONS}
            onSaved={onFieldSaved}
          />
          <EditableField
            icon={<FileText className="h-3.5 w-3.5" />}
            label="Description"
            value={lead.description || ''}
            field="description"
            leadId={lead.id}
            onSaved={onFieldSaved}
          />
          <EditableField
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Target Closing Date"
            value={formatDate(lead.target_closing_date)}
            field="target_closing_date"
            leadId={lead.id}
            onSaved={onFieldSaved}
          />
          <EditableField
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="WU Date"
            value={formatDate(lead.wu_date)}
            field="wu_date"
            leadId={lead.id}
            onSaved={onFieldSaved}
          />
          <ReadOnlyField
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Days to WU"
            value={daysToWu != null ? String(daysToWu) : '—'}
          />
          <ReadOnlyField
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Days to Close"
            value={daysToClose != null ? String(daysToClose) : '—'}
          />
        </div>

        {/* ── Section 3: Financials ── */}
        <SectionHeader title="Financials" />
        <div className="space-y-0.5">
          <EditableField
            icon={<Percent className="h-3.5 w-3.5" />}
            label="Fee %"
            value={lead.fee_percent != null ? String(lead.fee_percent) : ''}
            field="fee_percent"
            leadId={lead.id}
            onSaved={onFieldSaved}
            transform={(val) => { const n = Number(val); return isNaN(n) ? null : n; }}
          />
          <EditableField
            icon={<DollarSign className="h-3.5 w-3.5" />}
            label="Potential Revenue"
            value={formatCurrency(lead.potential_revenue)}
            field="potential_revenue"
            leadId={lead.id}
            highlight
            onSaved={onFieldSaved}
            transform={parseCurrencyToNumber}
          />
          <EditableField
            icon={<User className="h-3.5 w-3.5" />}
            label="Referral Source"
            value={lead.referral_source || ''}
            field="referral_source"
            leadId={lead.id}
            onSaved={onFieldSaved}
          />
          <EditableField
            icon={<Percent className="h-3.5 w-3.5" />}
            label="R.S. Fee %"
            value={lead.rs_fee_percent != null ? String(lead.rs_fee_percent) : ''}
            field="rs_fee_percent"
            leadId={lead.id}
            onSaved={onFieldSaved}
            transform={(val) => { const n = Number(val); return isNaN(n) ? null : n; }}
          />
          <EditableField
            icon={<DollarSign className="h-3.5 w-3.5" />}
            label="R.S. Revenue"
            value={formatCurrency(lead.rs_revenue)}
            field="rs_revenue"
            leadId={lead.id}
            onSaved={onFieldSaved}
            transform={parseCurrencyToNumber}
          />
          <EditableField
            icon={<DollarSign className="h-3.5 w-3.5" />}
            label="Net Revenue"
            value={formatCurrency(lead.net_revenue)}
            field="net_revenue"
            leadId={lead.id}
            onSaved={onFieldSaved}
            transform={parseCurrencyToNumber}
          />
          <EditableField
            icon={<DollarSign className="h-3.5 w-3.5" />}
            label="Invoice Amount"
            value={formatCurrency(lead.invoice_amount)}
            field="invoice_amount"
            leadId={lead.id}
            onSaved={onFieldSaved}
            transform={parseCurrencyToNumber}
          />
          <EditableField
            icon={<DollarSign className="h-3.5 w-3.5" />}
            label="Actual Net Revenue"
            value={formatCurrency(lead.actual_net_revenue)}
            field="actual_net_revenue"
            leadId={lead.id}
            highlight
            onSaved={onFieldSaved}
            transform={parseCurrencyToNumber}
          />
        </div>

        {/* ── Section 4: Loss / Notes ── */}
        <SectionHeader title="Loss / Notes" />
        <div className="space-y-2 px-1">
          {isInactiveOrDead && (
            <EditableField
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              label="Loss Reason"
              value={lead.loss_reason || ''}
              field="loss_reason"
              leadId={lead.id}
              onSaved={onFieldSaved}
            />
          )}
          <div className="px-2">
            <EditableNotesField
              value={lead.notes || ''}
              field="notes"
              leadId={lead.id}
              placeholder="Click to add deal notes..."
              onSaved={onFieldSaved}
            />
          </div>
        </div>

        {/* ── Section 5: Signals ── */}
        <SectionHeader title="Signals" />
        <div className="space-y-2 px-3">
          {signals.length === 0 ? (
            <p className="text-[13px] text-muted-foreground italic py-2">No active signals</p>
          ) : (
            signals.map((signal) => {
              const styles = SEVERITY_STYLES[signal.severity] || SEVERITY_STYLES.info;
              return (
                <div
                  key={signal.type}
                  className="flex items-start gap-2.5 rounded-lg border border-border p-2.5"
                >
                  <div className={`mt-0.5 shrink-0 ${styles.icon}`}>
                    {signal.severity === 'critical' ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : signal.severity === 'warning' ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <Clock className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-foreground">{signal.title}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 font-medium capitalize ${styles.badge}`}
                      >
                        {signal.severity}
                      </Badge>
                    </div>
                    <p className="text-[12px] text-muted-foreground mt-0.5">{signal.description}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
