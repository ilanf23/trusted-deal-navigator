import { useState, useCallback } from 'react';
import {
  X, Maximize2, DollarSign, Building2, Calendar, AlertTriangle,
  CheckCircle, Clock, ExternalLink, Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EditableField, EditableSelectField } from './InlineEditableFields';
import { CrmAvatar } from '@/components/admin/CrmAvatar';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import type { VolumeLogLead, VolumeLogSignal } from '@/hooks/useLoanVolumeLog';

interface VolumeLogDetailPanelProps {
  lead: VolumeLogLead | null;
  onClose: () => void;
  onFieldSaved: (leadId: string, field: string, newValue: string) => void;
  onExpandClick: (leadId: string) => void;
}

// ── Helpers ──

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '\u2014';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return '\u2014';
  }
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '\u2014';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return '\u2014';
  return `${value}%`;
}

const SEVERITY_STYLES: Record<VolumeLogSignal['severity'], { bg: string; text: string; icon: string }> = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    icon: 'text-blue-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    icon: 'text-amber-500',
  },
  critical: {
    bg: 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    icon: 'text-red-500',
  },
};

const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'On Hold', label: 'On Hold' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Lost', label: 'Lost' },
];

const LENDER_TYPE_OPTIONS = [
  { value: 'Bank', label: 'Bank' },
  { value: 'Credit Union', label: 'Credit Union' },
  { value: 'CDFI', label: 'CDFI' },
  { value: 'Private', label: 'Private' },
  { value: 'SBA', label: 'SBA' },
  { value: 'Other', label: 'Other' },
];

const CLX_AGREEMENT_OPTIONS = [
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
  { value: 'Pending', label: 'Pending' },
];

const WON_OPTIONS = [
  { value: 'true', label: 'Won' },
  { value: 'false', label: 'Not Won' },
];

// ── Read-only row ──
function ReadOnlyField({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <span className={`text-[13px] font-medium text-right truncate ${highlight ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

// ── Signal Row ──
function SignalRow({ signal }: { signal: VolumeLogSignal }) {
  const styles = SEVERITY_STYLES[signal.severity];
  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${styles.bg}`}>
      <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${styles.icon}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${styles.text}`}>{signal.title}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 rounded-full capitalize ${styles.text} border-current/20`}>
            {signal.severity}
          </Badge>
        </div>
        <p className={`text-[11px] mt-0.5 ${styles.text} opacity-80`}>{signal.description}</p>
      </div>
    </div>
  );
}

// ── Main Component ──

export default function VolumeLogDetailPanel({
  lead,
  onClose,
  onFieldSaved,
  onExpandClick,
}: VolumeLogDetailPanelProps) {
  const queryClient = useQueryClient();
  const [markingWon, setMarkingWon] = useState(false);

  const handleFieldSaved = useCallback((field: string, newValue: string) => {
    if (!lead) return;
    queryClient.invalidateQueries({ queryKey: ['volume-log-leads'] });
    onFieldSaved(lead.id, field, newValue);
    toast.success('Updated');
  }, [lead, onFieldSaved, queryClient]);

  const handleMarkAsWon = useCallback(async () => {
    if (!lead) return;
    setMarkingWon(true);
    const { error } = await supabase
      .from('leads')
      .update({ won: true } as any)
      .eq('id', lead.id);
    setMarkingWon(false);
    if (error) {
      toast.error('Failed to mark as won');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['volume-log-leads'] });
    onFieldSaved(lead.id, 'won', 'true');
    toast.success('Deal marked as won');
  }, [lead, onFieldSaved, queryClient]);

  if (!lead) return null;

  const isWon = (lead as any).won;
  const volumeLogStatus = (lead as any).volume_log_status || 'Active';
  const loanAmount = lead.deal_value;
  const loanCategory = (lead as any).loan_category || '\u2014';
  const loanStage = (lead as any).loan_stage || '\u2014';
  const lenderName = (lead as any).lender_name || '';
  const lenderType = (lead as any).lender_type || '';
  const targetClosing = (lead as any).target_closing_date || '';
  const wuDate = (lead as any).wu_date || '';
  const clxAgreement = (lead as any).clx_agreement || '';
  const feePercent = (lead as any).fee_percent;
  const potentialRevenue = (lead as any).potential_revenue;
  const netRevenue = (lead as any).net_revenue;
  const invoiceAmount = (lead as any).invoice_amount;
  const actualNetRevenue = (lead as any).actual_net_revenue;

  const statusColor = volumeLogStatus === 'Active'
    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
    : volumeLogStatus === 'On Hold'
      ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
      : volumeLogStatus === 'Lost'
        ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
        : 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';

  return (
    <aside className="shrink-0 w-[380px] border-l border-border/60 bg-card flex flex-col h-full animate-in slide-in-from-right-5 duration-200">
      {/* ── Top accent bar ── */}
      <div className="shrink-0">
        <div className="h-1" style={{ background: 'linear-gradient(90deg, #059669, #10b981, #34d399)' }} />

        {/* ── Header ── */}
        <div className="px-5 pt-4 pb-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <CrmAvatar name={lead.name ?? ''} size="xl" />
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold text-foreground truncate leading-tight">{lead.name}</h2>
                {lead.company_name && (
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                    <Building2 className="h-3 w-3 shrink-0" />
                    {lead.company_name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Expand full view"
                onClick={() => onExpandClick(lead.id)}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* ── Quick Info Bar ── */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${statusColor}`}>
              {volumeLogStatus === 'Active' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {volumeLogStatus}
            </div>
            {loanAmount != null && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800">
                <DollarSign className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatCurrency(loanAmount)}</span>
              </div>
            )}
            {isWon && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800">
                <Trophy className="h-3 w-3 text-amber-600" />
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Won</span>
              </div>
            )}
          </div>
          {(loanCategory !== '\u2014' || loanStage !== '\u2014') && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              {loanCategory !== '\u2014' && (
                <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">{loanCategory}</span>
              )}
              {loanStage !== '\u2014' && (
                <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">{loanStage}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <ScrollArea className="flex-1">
        <div className="px-5 py-4 space-y-5">

          {/* ── Deal Details Section ── */}
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Deal Details</span>
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              <EditableField
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Lender"
                value={lenderName}
                field="lender_name"
                leadId={lead.id}
                onSaved={handleFieldSaved}
              />
              <EditableSelectField
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Lender Type"
                value={lenderType}
                displayValue={lenderType || '\u2014'}
                field="lender_type"
                leadId={lead.id}
                options={LENDER_TYPE_OPTIONS}
                onSaved={handleFieldSaved}
              />
              <EditableField
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Target Closing"
                value={targetClosing ? formatDate(targetClosing) : ''}
                field="target_closing_date"
                leadId={lead.id}
                onSaved={handleFieldSaved}
              />
              <EditableField
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="WU Date"
                value={wuDate ? formatDate(wuDate) : ''}
                field="wu_date"
                leadId={lead.id}
                onSaved={handleFieldSaved}
              />
              <EditableSelectField
                icon={<CheckCircle className="h-3.5 w-3.5" />}
                label="CLX Agreement"
                value={clxAgreement}
                displayValue={clxAgreement || '\u2014'}
                field="clx_agreement"
                leadId={lead.id}
                options={CLX_AGREEMENT_OPTIONS}
                onSaved={handleFieldSaved}
              />
              <EditableSelectField
                icon={<Trophy className="h-3.5 w-3.5" />}
                label="Won"
                value={isWon ? 'true' : 'false'}
                displayValue={isWon ? 'Won' : 'Not Won'}
                field="won"
                leadId={lead.id}
                options={WON_OPTIONS}
                onSaved={handleFieldSaved}
              />
              <EditableSelectField
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Status"
                value={volumeLogStatus}
                displayValue={volumeLogStatus}
                field="volume_log_status"
                leadId={lead.id}
                options={STATUS_OPTIONS}
                onSaved={handleFieldSaved}
              />
            </div>
          </div>

          {/* ── Financials Section ── */}
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Financials</span>
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              <EditableField
                icon={<DollarSign className="h-3.5 w-3.5" />}
                label="Fee %"
                value={feePercent != null ? `${feePercent}` : ''}
                field="fee_percent"
                leadId={lead.id}
                onSaved={handleFieldSaved}
                transform={(val) => val ? parseFloat(val) : null}
              />
              <ReadOnlyField
                icon={<DollarSign className="h-3.5 w-3.5" />}
                label="Potential Revenue"
                value={formatCurrency(potentialRevenue)}
                highlight={potentialRevenue > 0}
              />
              <ReadOnlyField
                icon={<DollarSign className="h-3.5 w-3.5" />}
                label="Net Revenue"
                value={formatCurrency(netRevenue)}
                highlight={netRevenue > 0}
              />
              <EditableField
                icon={<DollarSign className="h-3.5 w-3.5" />}
                label="Invoice"
                value={invoiceAmount != null ? `${invoiceAmount}` : ''}
                field="invoice_amount"
                leadId={lead.id}
                onSaved={handleFieldSaved}
                transform={(val) => val ? parseFloat(val) : null}
              />
              <EditableField
                icon={<DollarSign className="h-3.5 w-3.5" />}
                label="Actual Net Rev"
                value={actualNetRevenue != null ? `${actualNetRevenue}` : ''}
                field="actual_net_revenue"
                leadId={lead.id}
                highlight
                onSaved={handleFieldSaved}
                transform={(val) => val ? parseFloat(val) : null}
              />
            </div>
          </div>

          {/* ── Computed Metrics ── */}
          {(lead.days_to_wu != null || lead.days_to_close != null) && (
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Metrics</span>
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                {lead.days_to_wu != null && (
                  <ReadOnlyField icon={<Clock className="h-3.5 w-3.5" />} label="Days to WU" value={`${lead.days_to_wu}d`} />
                )}
                {lead.days_to_close != null && (
                  <ReadOnlyField icon={<Clock className="h-3.5 w-3.5" />} label="Days to Close" value={`${lead.days_to_close}d`} />
                )}
                {lead.assignedName && (
                  <ReadOnlyField icon={<Building2 className="h-3.5 w-3.5" />} label="Assigned To" value={lead.assignedName} />
                )}
              </div>
            </div>
          )}

          {/* ── Signals Section ── */}
          {lead.signals.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Signals</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center rounded-full bg-muted text-muted-foreground">
                  {lead.signals.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {lead.signals.map((signal, idx) => (
                  <SignalRow key={`${signal.type}-${idx}`} signal={signal} />
                ))}
              </div>
            </div>
          )}

          {/* ── Actions Section ── */}
          <div>
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Quick Actions</span>
            <div className="space-y-2">
              {!isWon && (
                <button
                  onClick={handleMarkAsWon}
                  disabled={markingWon}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50"
                >
                  <Trophy className="h-3.5 w-3.5" />
                  {markingWon ? 'Saving...' : 'Mark as Won'}
                </button>
              )}
              <button
                onClick={() => onExpandClick(lead.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View in Sheets
              </button>
            </div>
          </div>

        </div>
      </ScrollArea>

      {/* ── Footer ── */}
      <div className="shrink-0 px-5 py-3 border-t border-border">
        <button
          onClick={() => onExpandClick(lead.id)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          Open full record
          <Maximize2 className="h-3 w-3" />
        </button>
      </div>
    </aside>
  );
}
