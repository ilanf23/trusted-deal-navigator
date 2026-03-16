import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useVolumeLogSync } from '@/hooks/useVolumeLogSync';
import {
  Check,
  ChevronRight,
  Loader2,
  RefreshCw,
  Sheet,
  Link2,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Lead field options for column mapping ── */
const LEAD_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: '__skip__', label: 'Skip' },
  { value: 'name', label: 'Borrower Name' },
  { value: 'company_name', label: 'Company Name' },
  { value: 'deal_value', label: 'Deal Value' },
  { value: 'loan_category', label: 'Loan Category' },
  { value: 'loan_stage', label: 'Loan Stage' },
  { value: 'volume_log_status', label: 'Volume Log Status' },
  { value: 'won', label: 'Won' },
  { value: 'lender_name', label: 'Lender Name' },
  { value: 'lender_type', label: 'Lender Type' },
  { value: 'fee_percent', label: 'Fee Percent' },
  { value: 'potential_revenue', label: 'Potential Revenue' },
  { value: 'net_revenue', label: 'Net Revenue' },
  { value: 'target_closing_date', label: 'Target Closing Date' },
  { value: 'wu_date', label: 'WU Date' },
  { value: 'source', label: 'Source' },
  { value: 'clx_agreement', label: 'CLX Agreement' },
  { value: 'referral_source', label: 'Referral Source' },
  { value: 'rs_fee_percent', label: 'RS Fee Percent' },
  { value: 'rs_revenue', label: 'RS Revenue' },
  { value: 'invoice_amount', label: 'Invoice Amount' },
  { value: 'actual_net_revenue', label: 'Actual Net Revenue' },
  { value: 'loss_reason', label: 'Loss Reason' },
  { value: 'assigned_to', label: 'Assigned To' },
  { value: 'description', label: 'Description' },
  { value: 'notes', label: 'Notes' },
];

/* ── Auto-detection map: lowercase header text → lead field key ── */
const AUTO_DETECT_MAP: Record<string, string> = {
  'borrower name': 'name',
  'borrower': 'name',
  'name': 'name',
  'company name': 'company_name',
  'company': 'company_name',
  'loan amount': 'deal_value',
  'deal value': 'deal_value',
  'amount': 'deal_value',
  'loan category': 'loan_category',
  'category': 'loan_category',
  'loan stage': 'loan_stage',
  'stage': 'loan_stage',
  'status': 'volume_log_status',
  'volume log status': 'volume_log_status',
  'won': 'won',
  'lender name': 'lender_name',
  'lender': 'lender_name',
  'lender type': 'lender_type',
  'fee percent': 'fee_percent',
  'fee %': 'fee_percent',
  'fee': 'fee_percent',
  'potential revenue': 'potential_revenue',
  'net revenue': 'net_revenue',
  'target closing date': 'target_closing_date',
  'closing date': 'target_closing_date',
  'target close': 'target_closing_date',
  'wu date': 'wu_date',
  'source': 'source',
  'clx agreement': 'clx_agreement',
  'agreement': 'clx_agreement',
  'referral source': 'referral_source',
  'referral': 'referral_source',
  'rs fee percent': 'rs_fee_percent',
  'rs fee %': 'rs_fee_percent',
  'rs revenue': 'rs_revenue',
  'invoice amount': 'invoice_amount',
  'invoice': 'invoice_amount',
  'actual net revenue': 'actual_net_revenue',
  'loss reason': 'loss_reason',
  'assigned to': 'assigned_to',
  'assigned': 'assigned_to',
  'description': 'description',
  'notes': 'notes',
};

function autoDetectField(headerText: string): string {
  const normalized = headerText.trim().toLowerCase();
  return AUTO_DETECT_MAP[normalized] ?? '__skip__';
}

/* ── Props ── */
interface VolumeLogSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMemberName?: string;
  onSyncComplete?: () => void;
}

/* ── Step Indicator ── */
function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: 'Connect' },
    { num: 2, label: 'Select Sheet' },
    { num: 3, label: 'Map Columns' },
  ];

  return (
    <div className="flex items-center justify-center gap-1 py-3">
      {steps.map((step, i) => (
        <div key={step.num} className="flex items-center gap-1">
          <div
            className={cn(
              'flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold transition-colors',
              currentStep === step.num
                ? 'bg-blue-600 text-white'
                : currentStep > step.num
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                  : 'bg-muted text-muted-foreground'
            )}
          >
            {currentStep > step.num ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              step.num
            )}
          </div>
          <span
            className={cn(
              'text-xs font-medium hidden sm:inline',
              currentStep === step.num
                ? 'text-blue-600 dark:text-blue-400'
                : currentStep > step.num
                  ? 'text-foreground'
                  : 'text-muted-foreground'
            )}
          >
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-1" />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Main Dialog ── */
export default function VolumeLogSyncDialog({
  open,
  onOpenChange,
  teamMemberName,
  onSyncComplete,
}: VolumeLogSyncDialogProps) {
  const googleSheets = useGoogleSheets(teamMemberName);
  const sync = useVolumeLogSync(teamMemberName);

  const [step, setStep] = useState(1);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<string>('');
  const [selectedSheetName, setSelectedSheetName] = useState<string>('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [headerRow, setHeaderRow] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced?: number; created?: number; updated?: number } | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep(googleSheets.isConnected ? 2 : 1);
      setSelectedSpreadsheetId('');
      setSelectedSheetName('');
      setColumnMapping({});
      setHeaderRow([]);
      setPreviewRows([]);
      setSyncResult(null);
    }
  }, [open, googleSheets.isConnected]);

  // Load spreadsheets when entering step 2
  useEffect(() => {
    if (step === 2 && googleSheets.isConnected && googleSheets.spreadsheets.length === 0) {
      setLoadingSpreadsheets(true);
      googleSheets.listSpreadsheets().finally(() => setLoadingSpreadsheets(false));
    }
  }, [step, googleSheets.isConnected]);

  // Load sheet tabs when spreadsheet is selected
  useEffect(() => {
    if (selectedSpreadsheetId) {
      setLoadingSheets(true);
      setSelectedSheetName('');
      setHeaderRow([]);
      setPreviewRows([]);
      googleSheets.getSheets(selectedSpreadsheetId).finally(() => setLoadingSheets(false));
    }
  }, [selectedSpreadsheetId]);

  // Load preview data when sheet tab is selected
  useEffect(() => {
    if (selectedSpreadsheetId && selectedSheetName) {
      setLoadingData(true);
      googleSheets.getData(selectedSpreadsheetId, selectedSheetName).then((rows) => {
        if (rows && rows.length > 0) {
          setHeaderRow(rows[0]);
          setPreviewRows(rows.slice(1, 4));
          // Auto-detect column mapping
          const detected: Record<string, string> = {};
          rows[0].forEach((header: string, idx: number) => {
            detected[String(idx)] = autoDetectField(header);
          });
          setColumnMapping(detected);
        }
      }).finally(() => setLoadingData(false));
    }
  }, [selectedSpreadsheetId, selectedSheetName]);

  const selectedSpreadsheetName = useMemo(() => {
    return googleSheets.spreadsheets.find((s) => s.id === selectedSpreadsheetId)?.name ?? '';
  }, [googleSheets.spreadsheets, selectedSpreadsheetId]);

  const mappedCount = useMemo(() => {
    return Object.values(columnMapping).filter((v) => v !== '__skip__').length;
  }, [columnMapping]);

  const handleSaveAndSync = async () => {
    setSaving(true);
    try {
      // Build a clean mapping: column index → lead field (skip "__skip__")
      const cleanMapping: Record<string, string> = {};
      Object.entries(columnMapping).forEach(([idx, field]) => {
        if (field !== '__skip__') {
          cleanMapping[idx] = field;
        }
      });

      const saved = await sync.saveConfig(
        selectedSpreadsheetId,
        selectedSheetName,
        cleanMapping,
        headerRow
      );

      if (saved) {
        const result = await sync.pull();
        if (result.success) {
          setSyncResult({
            synced: result.synced,
            created: result.created,
            updated: result.updated,
          });
          onSyncComplete?.();
          // Close after a brief delay so user can see result
          setTimeout(() => {
            onOpenChange(false);
          }, 2000);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const updateMapping = (colIdx: string, field: string) => {
    setColumnMapping((prev) => ({ ...prev, [colIdx]: field }));
  };

  /* ── Step 1: Connect Google Account ── */
  const renderStep1 = () => (
    <div className="flex flex-col items-center gap-5 py-6 px-4">
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
        <Sheet className="h-7 w-7 text-white" />
      </div>

      {googleSheets.loading ? (
        <div className="space-y-3 w-full max-w-xs">
          <Skeleton className="h-4 w-3/4 mx-auto" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : googleSheets.isConnected ? (
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center justify-center h-5 w-5 rounded-full bg-green-100 dark:bg-green-900/50">
              <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm font-medium text-foreground">Connected</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Signed in as{' '}
            <span className="font-medium text-foreground">{googleSheets.connectedEmail}</span>
          </p>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">Connect your Google account</p>
            <p className="text-xs text-muted-foreground mt-1">
              Grant read access to your Google Sheets to sync the Loan Volume Log.
            </p>
          </div>
          <Button
            onClick={googleSheets.connect}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Link2 className="h-4 w-4" />
            Connect Google Sheets
          </Button>
        </div>
      )}

      <div className="w-full flex justify-end pt-2">
        <Button
          onClick={() => setStep(2)}
          disabled={!googleSheets.isConnected}
          className="gap-1.5"
          size="sm"
        >
          Next
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  /* ── Step 2: Select Spreadsheet & Sheet Tab ── */
  const renderStep2 = () => (
    <div className="space-y-5 py-4 px-4">
      {/* Spreadsheet selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground">Spreadsheet</label>
        {loadingSpreadsheets ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Select
            value={selectedSpreadsheetId}
            onValueChange={setSelectedSpreadsheetId}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Choose a spreadsheet..." />
            </SelectTrigger>
            <SelectContent>
              {googleSheets.spreadsheets.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Sheet tab selector */}
      {selectedSpreadsheetId && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground">Sheet Tab</label>
          {loadingSheets ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Select
              value={selectedSheetName}
              onValueChange={setSelectedSheetName}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Choose a sheet tab..." />
              </SelectTrigger>
              <SelectContent>
                {googleSheets.sheets.map((s) => (
                  <SelectItem key={s.id} value={s.title} className="text-xs">
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* Preview */}
      {selectedSheetName && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Preview</label>
          {loadingData ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : headerRow.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-muted/60">
                    {headerRow.map((col, i) => (
                      <th
                        key={i}
                        className="px-2 py-1.5 text-left font-semibold text-foreground whitespace-nowrap border-b"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} className="border-b last:border-0">
                      {headerRow.map((_, ci) => (
                        <td
                          key={ci}
                          className="px-2 py-1 text-muted-foreground whitespace-nowrap max-w-[150px] truncate"
                        >
                          {row[ci] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No data found in this sheet.</p>
          )}
        </div>
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
          Back
        </Button>
        <Button
          onClick={() => setStep(3)}
          disabled={!selectedSpreadsheetId || !selectedSheetName || headerRow.length === 0}
          className="gap-1.5"
          size="sm"
        >
          Next
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  /* ── Step 3: Column Mapping ── */
  const renderStep3 = () => (
    <div className="space-y-4 py-4 px-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-foreground">Map Columns to Lead Fields</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {selectedSpreadsheetName} &rarr; {selectedSheetName}
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {mappedCount} mapped
        </Badge>
      </div>

      {/* Scrollable mapping area */}
      <div className="max-h-[340px] overflow-y-auto rounded-md border divide-y">
        {headerRow.map((header, idx) => {
          const mappedField = columnMapping[String(idx)] ?? '__skip__';
          const isMapped = mappedField !== '__skip__';

          return (
            <div
              key={idx}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 transition-colors',
                isMapped ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{header}</p>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <div className="w-[180px] shrink-0">
                <Select
                  value={mappedField}
                  onValueChange={(val) => updateMapping(String(idx), val)}
                >
                  <SelectTrigger
                    className={cn(
                      'h-8 text-xs',
                      isMapped ? 'border-blue-300 dark:border-blue-700' : ''
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_FIELD_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sync result feedback */}
      {syncResult && (
        <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <p className="text-xs font-medium text-green-700 dark:text-green-300">
              Sync complete &mdash; {syncResult.synced ?? 0} deals synced
              {syncResult.created ? ` (${syncResult.created} new)` : ''}
              {syncResult.updated ? ` (${syncResult.updated} updated)` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
          Back
        </Button>
        <Button
          onClick={handleSaveAndSync}
          disabled={mappedCount === 0 || saving || sync.syncing}
          className="gap-1.5 bg-blue-600 hover:bg-blue-700"
          size="sm"
        >
          {saving || sync.syncing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Save & Run Initial Sync
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-0 flex flex-col max-h-[85vh] gap-0 rounded-xl shadow-2xl border-border/60">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-2 bg-gradient-to-r from-muted/50 to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md">
              <Sheet className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold">
                Loan Volume Log Sync
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Connect and sync your Google Sheets volume log
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Step indicator */}
        <StepIndicator currentStep={step} />

        {/* Step content */}
        <div className="flex-1 overflow-y-auto">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
