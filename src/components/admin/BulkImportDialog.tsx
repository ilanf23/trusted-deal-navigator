import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, X, Check, AlertTriangle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';

// Fields users can map to
const MAPPABLE_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company_name', label: 'Company' },
  { key: 'title', label: 'Title' },
  { key: 'contact_type', label: 'Contact Type' },
  { key: 'known_as', label: 'Known As (Nick Name)' },
  { key: 'clx_file_name', label: 'CLX File Name' },
  { key: 'source', label: 'Source' },
  { key: 'notes', label: 'Notes' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'website', label: 'Website' },
  { key: 'tags', label: 'Tags (semicolon-separated)' },
] as const;

type MappableKey = typeof MAPPABLE_FIELDS[number]['key'];

const CONTACT_TYPES = ['Client', 'Prospect', 'Referral Partner', 'Lender', 'Attorney', 'CPA', 'Vendor', 'Other'];

// Auto-detect column mapping based on header names
function autoDetectMapping(headers: string[]): Record<number, MappableKey | ''> {
  const mapping: Record<number, MappableKey | ''> = {};
  const patterns: Record<MappableKey, RegExp> = {
    name: /^(full\s?name|name|person|contact\s?name)$/i,
    email: /^(e[\-_]?mail|email\s?address|work\s?email)$/i,
    phone: /^(phone|telephone|phone\s?number|work\s?phone|mobile)$/i,
    company_name: /^(company|company\s?name|organization|org|employer)$/i,
    title: /^(title|job\s?title|position|role)$/i,
    contact_type: /^(type|contact\s?type|category)$/i,
    known_as: /^(known\s?as|nick\s?name|nickname|alias)$/i,
    clx_file_name: /^(clx|clx\s?file|file\s?name|clx\s?file\s?name)$/i,
    source: /^(source|lead\s?source|referral\s?source|origin)$/i,
    notes: /^(notes|comments|description|memo)$/i,
    linkedin: /^(linkedin|linkedin\s?url|linkedin\s?profile)$/i,
    website: /^(website|url|web|homepage)$/i,
    tags: /^(tags|labels|categories)$/i,
  };

  const usedFields = new Set<MappableKey>();

  headers.forEach((header, idx) => {
    const trimmed = header.trim();
    for (const [field, regex] of Object.entries(patterns) as [MappableKey, RegExp][]) {
      if (!usedFields.has(field) && regex.test(trimmed)) {
        mapping[idx] = field;
        usedFields.add(field);
        break;
      }
    }
    if (!(idx in mapping)) mapping[idx] = '';
  });

  return mapping;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'done';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, MappableKey | ''>>({});
  const [defaultContactType, setDefaultContactType] = useState('Prospect');
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const reset = () => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setRows([]);
    setColumnMapping({});
    setDefaultContactType('Prospect');
    setImportProgress({ done: 0, total: 0, errors: 0 });
    setImportErrors([]);
  };

  const handleClose = (val: boolean) => {
    if (!val) reset();
    onOpenChange(val);
  };

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (json.length < 2) {
          toast.error('File must have a header row and at least one data row');
          return;
        }

        const fileHeaders = json[0].map(h => String(h).trim());
        const dataRows = json.slice(1).filter(row => row.some(cell => String(cell).trim() !== ''));

        if (dataRows.length === 0) {
          toast.error('No data rows found in file');
          return;
        }

        setFileName(file.name);
        setHeaders(fileHeaders);
        setRows(dataRows.map(row => row.map(cell => String(cell).trim())));
        setColumnMapping(autoDetectMapping(fileHeaders));
        setStep('mapping');
      } catch {
        toast.error('Failed to parse file. Please check the format.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    if (e.target) e.target.value = '';
  }, [parseFile]);

  const nameColumnMapped = Object.values(columnMapping).includes('name');

  const buildRecords = () => {
    const nameIdx = Object.entries(columnMapping).find(([, v]) => v === 'name')?.[0];
    if (nameIdx === undefined) return [];

    return rows.map((row) => {
      const record: Record<string, string | string[] | null> = {};
      for (const [idxStr, field] of Object.entries(columnMapping)) {
        if (!field) continue;
        const idx = Number(idxStr);
        const value = row[idx] ?? '';
        if (field === 'tags') {
          record.tags = value ? value.split(/[;,]/).map(t => t.trim()).filter(Boolean) : null;
        } else {
          record[field] = value || null;
        }
      }
      // Apply default contact type if none mapped or empty
      if (!record.contact_type) {
        record.contact_type = defaultContactType;
      }
      // Validate contact type
      if (record.contact_type && !CONTACT_TYPES.includes(record.contact_type as string)) {
        record.contact_type = defaultContactType;
      }
      return record;
    }).filter(r => r.name && String(r.name).trim());
  };

  const previewRecords = buildRecords();

  const handleImport = async () => {
    const records = buildRecords();
    if (records.length === 0) {
      toast.error('No valid records to import');
      return;
    }

    setStep('importing');
    setImportProgress({ done: 0, total: records.length, errors: 0 });
    setImportErrors([]);

    // Get default pipeline & first stage
    const { data: pipeline } = await supabase
      .from('pipelines')
      .select('id')
      .eq('is_main', true)
      .maybeSingle();

    let firstStageId: string | null = null;
    if (pipeline) {
      const { data: stage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('pipeline_id', pipeline.id)
        .order('position', { ascending: true })
        .limit(1)
        .maybeSingle();
      firstStageId = stage?.id ?? null;
    }

    // Batch insert in chunks of 50
    const BATCH_SIZE = 50;
    let totalDone = 0;
    let totalErrors = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      const leadsToInsert = batch.map(r => ({
        name: r.name as string,
        email: (r.email as string) || null,
        phone: (r.phone as string) || null,
        company_name: (r.company_name as string) || null,
        title: (r.title as string) || null,
        contact_type: (r.contact_type as string) || defaultContactType,
        known_as: (r.known_as as string) || null,
        clx_file_name: (r.clx_file_name as string) || null,
        source: (r.source as string) || null,
        notes: (r.notes as string) || null,
        linkedin: (r.linkedin as string) || null,
        website: (r.website as string) || null,
        tags: (r.tags as string[]) || null,
        status: 'initial_review' as const,
      }));

      const { data: insertedLeads, error } = await supabase
        .from('leads')
        .insert(leadsToInsert)
        .select('id');

      if (error) {
        totalErrors += batch.length;
        errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      } else {
        totalDone += insertedLeads.length;

        // Add to default pipeline
        if (pipeline && firstStageId && insertedLeads.length > 0) {
          const pipelineLeads = insertedLeads.map(l => ({
            lead_id: l.id,
            pipeline_id: pipeline.id,
            stage_id: firstStageId!,
          }));
          await supabase.from('pipeline_leads').insert(pipelineLeads);
        }
      }

      setImportProgress({ done: totalDone, total: records.length, errors: totalErrors });
    }

    setImportErrors(errors);
    setStep('done');
    queryClient.invalidateQueries({ queryKey: ['all-pipeline-leads'] });

    if (totalErrors === 0) {
      toast.success(`Successfully imported ${totalDone} contacts`);
    } else {
      toast.warning(`Imported ${totalDone} contacts with ${totalErrors} errors`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[720px] p-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="text-xl font-bold text-foreground">
            {step === 'upload' && 'Import Contacts'}
            {step === 'mapping' && 'Map Columns'}
            {step === 'preview' && 'Preview Import'}
            {step === 'importing' && 'Importing...'}
            {step === 'done' && 'Import Complete'}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 flex-1 min-h-0 overflow-y-auto">
          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload a CSV or Excel file (.xlsx, .xls) with contact data. The first row should contain column headers.
              </p>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer hover:border-[#3b2778] hover:bg-[#f8f6fc] dark:hover:bg-[#3b2778]/10 transition-colors"
              >
                <div className="h-14 w-14 rounded-full bg-[#eee6f6] dark:bg-[#3b2778]/30 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-[#3b2778] dark:text-purple-400" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  Drag & drop your file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports .csv, .xlsx, .xls
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}

          {/* ── Step 2: Column Mapping ── */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  <FileSpreadsheet className="inline h-4 w-4 mr-1 -mt-0.5" />
                  <span className="font-medium text-foreground">{fileName}</span> — {rows.length} row{rows.length !== 1 ? 's' : ''} found
                </p>
              </div>

              <div className="text-sm text-muted-foreground">
                Map each column from your file to a contact field. Columns mapped to "Skip" will be ignored.
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-0 bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                  <span>File Column</span>
                  <span className="px-4"></span>
                  <span>Maps To</span>
                </div>
                <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
                  {headers.map((header, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_auto_1fr] items-center gap-0 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{header}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          e.g. "{rows[0]?.[idx] ?? ''}"
                        </span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mx-3" />
                      <Select
                        value={columnMapping[idx] || '__skip__'}
                        onValueChange={(v) => setColumnMapping(prev => ({ ...prev, [idx]: v === '__skip__' ? '' : v as MappableKey }))}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__skip__">
                            <span className="text-muted-foreground">Skip this column</span>
                          </SelectItem>
                          {MAPPABLE_FIELDS.map((f) => {
                            const alreadyUsed = Object.entries(columnMapping).some(
                              ([i, v]) => v === f.key && Number(i) !== idx
                            );
                            return (
                              <SelectItem key={f.key} value={f.key} disabled={alreadyUsed}>
                                {f.label}{f.required ? ' *' : ''}{alreadyUsed ? ' (already mapped)' : ''}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Default contact type */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-foreground whitespace-nowrap">Default Contact Type:</label>
                <Select value={defaultContactType} onValueChange={setDefaultContactType}>
                  <SelectTrigger className="h-8 w-48 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">Used when Contact Type column is empty or not mapped</span>
              </div>

              {!nameColumnMapped && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  You must map at least one column to <strong>Name</strong> to proceed.
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Preview ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Previewing <span className="font-semibold text-foreground">{previewRecords.length}</span> valid contacts to import.
                {rows.length - previewRecords.length > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {' '}{rows.length - previewRecords.length} row{rows.length - previewRecords.length !== 1 ? 's' : ''} will be skipped (missing name).
                  </span>
                )}
              </p>

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide">#</th>
                        {MAPPABLE_FIELDS.filter(f => Object.values(columnMapping).includes(f.key)).map(f => (
                          <th key={f.key} className="px-3 py-2 text-left font-semibold text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {previewRecords.slice(0, 100).map((record, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="px-3 py-1.5 text-muted-foreground text-xs">{i + 1}</td>
                          {MAPPABLE_FIELDS.filter(f => Object.values(columnMapping).includes(f.key)).map(f => (
                            <td key={f.key} className="px-3 py-1.5 text-foreground truncate max-w-[200px]">
                              {f.key === 'tags'
                                ? (record[f.key] as string[] | null)?.join(', ') ?? ''
                                : (record[f.key] as string) ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewRecords.length > 100 && (
                  <div className="px-3 py-2 bg-muted/30 text-xs text-muted-foreground border-t border-border">
                    Showing first 100 of {previewRecords.length} rows
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 4: Importing ── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <Loader2 className="h-10 w-10 animate-spin text-[#3b2778]" />
              <p className="text-sm font-semibold text-foreground">
                Importing contacts... {importProgress.done} / {importProgress.total}
              </p>
              <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3b2778] rounded-full transition-all duration-300"
                  style={{ width: `${importProgress.total ? (importProgress.done / importProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Step 5: Done ── */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-8">
              {importProgress.errors === 0 ? (
                <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
                  <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
              ) : (
                <div className="h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
                  <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                </div>
              )}
              <p className="text-lg font-semibold text-foreground">
                {importProgress.done} contact{importProgress.done !== 1 ? 's' : ''} imported
              </p>
              {importProgress.errors > 0 && (
                <div className="w-full space-y-2">
                  <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                    {importProgress.errors} record{importProgress.errors !== 1 ? 's' : ''} failed to import
                  </p>
                  <div className="bg-muted/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                    {importErrors.map((err, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
          <div>
            {step === 'mapping' && (
              <button
                onClick={() => { setStep('upload'); setFileName(''); setHeaders([]); setRows([]); }}
                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 uppercase tracking-wide px-4 py-2 flex items-center gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={() => setStep('mapping')}
                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 uppercase tracking-wide px-4 py-2 flex items-center gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step !== 'importing' && (
              <button
                onClick={() => handleClose(false)}
                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 uppercase tracking-wide px-4 py-2"
              >
                {step === 'done' ? 'Close' : 'Cancel'}
              </button>
            )}

            {step === 'mapping' && (
              <Button
                onClick={() => setStep('preview')}
                disabled={!nameColumnMapped}
                className="bg-[#3b2778] hover:bg-[#4a3490] text-white text-sm font-semibold uppercase tracking-wide rounded-full px-6"
              >
                Preview
              </Button>
            )}

            {step === 'preview' && (
              <Button
                onClick={handleImport}
                disabled={previewRecords.length === 0}
                className="bg-[#3b2778] hover:bg-[#4a3490] text-white text-sm font-semibold uppercase tracking-wide rounded-full px-6"
              >
                Import {previewRecords.length} Contact{previewRecords.length !== 1 ? 's' : ''}
              </Button>
            )}

            {step === 'done' && (
              <Button
                onClick={() => handleClose(false)}
                className="bg-[#3b2778] hover:bg-[#4a3490] text-white text-sm font-semibold uppercase tracking-wide rounded-full px-6"
              >
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
