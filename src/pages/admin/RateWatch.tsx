import { useState, useRef, useMemo, useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import FloatingInbox, { PrefilledEmail } from '@/components/admin/FloatingInbox';
import AIEmailAssistantSheet from '@/components/admin/AIEmailAssistantSheet';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import * as XLSX from 'xlsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sparkles,
  Mail,
  Phone,
  Plus,
  FileSpreadsheet,
  Calendar,
  Copy,
  Search,
  X,
  ArrowDown,
  Eye,
  ArrowUpDown,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';

interface RateWatchEntry {
  id: string;
  lead_id: string;
  current_rate: number;
  target_rate: number;
  loan_type: string | null;
  loan_amount: number | null;
  enrolled_at: string;
  last_contacted_at: string | null;
  notes: string | null;
  is_active: boolean;
  status_override: string | null;
  confirm_email: boolean | null;
  initial_review: string | null;
  collateral_type: string | null;
  collateral_value: number | null;
  loan_maturity: string | null;
  re_location: string | null;
  rate_type: string | null;
  variable_index_spread: string | null;
  original_term_years: number | null;
  amortization: string | null;
  penalty: string | null;
  lender_type: string | null;
  estimated_cf: number | null;
  occupancy_use: string | null;
  owner_occupied_pct: number | null;
  seeking_to_improve: string | null;
  pipeline: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company_name: string | null;
    status: string;
    source: string | null;
    notes: string | null;
    assigned_to: string | null;
    created_at: string;
    updated_at: string;
    questionnaire_sent_at: string | null;
    questionnaire_completed_at: string | null;
    known_as: string | null;
    title: string | null;
    contact_type: string | null;
    tags: string[] | null;
    about: string | null;
    website: string | null;
    linkedin: string | null;
    twitter: string | null;
  };
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
}

type TabFilter = 'all' | 'ready' | 'watching' | 'close';
type SortField = 'name' | 'current_rate' | 'target_rate' | 'gap' | 'loan_amount' | 'last_contacted_at' | 'loan_maturity';
type SortDirection = 'asc' | 'desc';

const RateWatch = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Rate Watch');
    return () => { setPageTitle(null); };
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [selectedLeadForAI, setSelectedLeadForAI] = useState<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company_name: string | null;
    loan_type?: string | null;
    loan_amount?: number | null;
    current_rate?: number | null;
    target_rate?: number | null;
  } | null>(null);
  const [prefilledEmail, setPrefilledEmail] = useState<PrefilledEmail | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Detail panel state
  const [detailEntry, setDetailEntry] = useState<RateWatchEntry | null>(null);

  // Lead detail dialog state
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<RateWatchEntry['pipeline'] | null>(null);
  const [leadDetailOpen, setLeadDetailOpen] = useState(false);

  // Form state for adding new entry
  const [newEntry, setNewEntry] = useState({
    lead_id: '',
    current_rate: '',
    target_rate: '',
    loan_type: '',
    loan_amount: '',
    notes: ''
  });

  // Fetch rate watch entries
  const { data: rateWatchEntries = [], isLoading } = useQuery({
    queryKey: ['rate-watch'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_watch')
        .select(`
          *,
          pipeline (
            id, name, email, phone, company_name, status, source, notes, assigned_to,
            created_at, updated_at, questionnaire_sent_at, questionnaire_completed_at,
            known_as, title, contact_type, tags, about, website, linkedin, twitter
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RateWatchEntry[];
    }
  });

  // Fetch leads not in rate watch for adding
  const { data: availableLeads = [] } = useQuery({
    queryKey: ['leads-not-in-rate-watch'],
    queryFn: async () => {
      const { data: watchedLeads } = await supabase
        .from('rate_watch')
        .select('lead_id');

      const watchedIds = watchedLeads?.map(w => w.lead_id) || [];

      let query = supabase
        .from('potential')
        .select('id, name, email, phone, company_name');

      if (watchedIds.length > 0) {
        query = query.not('id', 'in', `(${watchedIds.join(',')})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Lead[];
    }
  });

  // Add to rate watch mutation
  const addToRateWatch = useMutation({
    mutationFn: async (entry: typeof newEntry) => {
      const { error } = await supabase
        .from('rate_watch')
        .insert({
          lead_id: entry.lead_id,
          current_rate: parseFloat(entry.current_rate),
          target_rate: parseFloat(entry.target_rate),
          loan_type: entry.loan_type || null,
          loan_amount: entry.loan_amount ? parseFloat(entry.loan_amount) : null,
          notes: entry.notes || null
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-watch'] });
      queryClient.invalidateQueries({ queryKey: ['leads-not-in-rate-watch'] });
      setAddDialogOpen(false);
      setNewEntry({ lead_id: '', current_rate: '', target_rate: '', loan_type: '', loan_amount: '', notes: '' });
      toast({ title: 'Lead added to Rate Watch' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error adding to Rate Watch', description: error.message, variant: 'destructive' });
    }
  });

  // Update last contacted mutation
  const updateLastContacted = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rate_watch')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-watch'] });
    }
  });

  // Copy questionnaire link to clipboard
  const copyQuestionnaireLink = async () => {
    const link = `${window.location.origin}/ratewatch/new`;
    await navigator.clipboard.writeText(link);
    toast({ title: 'Link copied to clipboard!', description: 'Paste it into your message to send to the lead.' });
  };

  // Status helpers
  const getStatus = (entry: RateWatchEntry) => {
    if (entry.status_override === 'ready') return 'ready';
    if (entry.status_override === 'watching') return 'watching';
    const gap = entry.current_rate - entry.target_rate;
    if (gap <= 0) return 'ready';
    if (gap < 0.5) return 'close';
    return 'watching';
  };

  const getGap = (entry: RateWatchEntry) => entry.current_rate - entry.target_rate;

  // Computed stats
  const stats = useMemo(() => {
    const ready = rateWatchEntries.filter(e => getStatus(e) === 'ready').length;
    const close = rateWatchEntries.filter(e => getStatus(e) === 'close').length;
    const watching = rateWatchEntries.length - ready - close;
    const totalLoanValue = rateWatchEntries.reduce((sum, e) => sum + (e.loan_amount || 0), 0);
    return { total: rateWatchEntries.length, ready, close, watching, totalLoanValue };
  }, [rateWatchEntries]);

  // Filter + search + sort
  const displayEntries = useMemo(() => {
    let entries = rateWatchEntries;

    if (activeTab !== 'all') {
      entries = entries.filter(e => getStatus(e) === activeTab);
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      entries = entries.filter(e =>
        e.pipeline.name.toLowerCase().includes(s) ||
        e.pipeline.email?.toLowerCase().includes(s) ||
        e.pipeline.company_name?.toLowerCase().includes(s) ||
        e.loan_type?.toLowerCase().includes(s) ||
        e.collateral_type?.toLowerCase().includes(s) ||
        e.re_location?.toLowerCase().includes(s)
      );
    }

    entries = [...entries].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.pipeline.name.localeCompare(b.pipeline.name); break;
        case 'current_rate': cmp = a.current_rate - b.current_rate; break;
        case 'target_rate': cmp = a.target_rate - b.target_rate; break;
        case 'gap': cmp = getGap(a) - getGap(b); break;
        case 'loan_amount': cmp = (a.loan_amount || 0) - (b.loan_amount || 0); break;
        case 'last_contacted_at': {
          const da = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
          const db = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
          cmp = da - db;
          break;
        }
        case 'loan_maturity': {
          const da = a.loan_maturity ? new Date(a.loan_maturity).getTime() : Infinity;
          const db = b.loan_maturity ? new Date(b.loan_maturity).getTime() : Infinity;
          cmp = da - db;
          break;
        }
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return entries;
  }, [rateWatchEntries, activeTab, searchTerm, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle Excel file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      if (jsonData.length === 0) {
        toast({ title: 'Empty file', description: 'The uploaded file contains no data', variant: 'destructive' });
        return;
      }

      const headerMap: Record<string, string> = {
        'name': 'name', 'lead name': 'name', 'borrower': 'name', 'client': 'name', 'client name': 'name',
        'email': 'email', 'email address': 'email',
        'phone': 'phone', 'phone number': 'phone',
        'company': 'company_name', 'company name': 'company_name', 'business': 'company_name',
        'current rate': 'current_rate', 'rate': 'current_rate',
        'target rate': 'target_rate', 'target': 'target_rate',
        'loan type': 'loan_type', 'type': 'loan_type',
        'loan amount': 'loan_amount', 'loan balance': 'loan_amount', 'amount': 'loan_amount',
        'notes': 'notes', 'note': 'notes', 'comments': 'notes',
        'confirm email': 'confirm_email',
        'initial review': 'initial_review',
        'date of last contact': 'last_contacted_at', 'last contact': 'last_contacted_at',
        'collateral type': 'collateral_type',
        'collateral value': 'collateral_value',
        'loan maturity': 'loan_maturity',
        're city/state': 're_location', 're city state': 're_location', 'city/state': 're_location', 'location': 're_location',
        'rate type': 'rate_type',
        'if variable: index and spread': 'variable_index_spread', 'index and spread': 'variable_index_spread', 'variable index': 'variable_index_spread',
        'original term (yrs)': 'original_term_years', 'original term': 'original_term_years', 'term (yrs)': 'original_term_years', 'term': 'original_term_years',
        'amortization': 'amortization',
        'penalty': 'penalty',
        'lender type': 'lender_type',
        'estimated cf': 'estimated_cf', 'cash flow': 'estimated_cf',
        'occupancy/use': 'occupancy_use', 'occupancy': 'occupancy_use', 'use': 'occupancy_use',
        '% oo': 'owner_occupied_pct', 'owner occupied': 'owner_occupied_pct', 'oo %': 'owner_occupied_pct',
        'seeking to improve': 'seeking_to_improve', 'seeking': 'seeking_to_improve', 'improve': 'seeking_to_improve',
      };

      const mapHeader = (header: string): string | null => {
        const normalized = header.toLowerCase().trim();
        return headerMap[normalized] || null;
      };

      const parseDate = (value: unknown): string | null => {
        if (!value) return null;
        const str = String(value).trim();
        if (!str) return null;
        const date = new Date(str);
        if (!isNaN(date.getTime())) return date.toISOString();
        return null;
      };

      const parseNumeric = (value: unknown): number | null => {
        if (!value) return null;
        const str = String(value).replace(/[$,]/g, '').trim();
        const num = parseFloat(str);
        return isNaN(num) ? null : num;
      };

      const parsePercent = (value: unknown): number | null => {
        if (!value) return null;
        const str = String(value).replace(/%/g, '').trim();
        const num = parseFloat(str);
        return isNaN(num) ? null : num;
      };

      const parseBoolean = (value: unknown): boolean => {
        if (!value) return false;
        const str = String(value).toLowerCase().trim();
        return ['y', 'yes', 'true', '1', 'x'].includes(str);
      };

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const row of jsonData) {
        try {
          const mappedRow: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            const mappedKey = mapHeader(key);
            if (mappedKey) mappedRow[mappedKey] = value;
          }

          const name = String(mappedRow.name || '').trim();
          const currentRate = parseFloat(String(mappedRow.current_rate || '0'));
          const targetRate = parseFloat(String(mappedRow.target_rate || '0'));

          if (!name || isNaN(currentRate) || isNaN(targetRate)) {
            errorCount++;
            errors.push(`Row skipped: Missing name or invalid rates`);
            continue;
          }

          let leadId: string;
          const email = mappedRow.email ? String(mappedRow.email).trim() : null;

          let existingLead = null;
          if (email) {
            const { data } = await supabase.from('potential').select('id').eq('email', email).single();
            existingLead = data;
          }
          if (!existingLead) {
            const { data } = await supabase.from('potential').select('id').ilike('name', name).single();
            existingLead = data;
          }

          if (existingLead) {
            leadId = existingLead.id;
          } else {
            const { data: newLead, error: leadError } = await supabase
              .from('potential')
              .insert({
                name,
                email,
                phone: mappedRow.phone ? String(mappedRow.phone).trim() : null,
                company_name: mappedRow.company_name ? String(mappedRow.company_name).trim() : null,
                source: 'Rate Watch Import',
              })
              .select('id')
              .single();

            if (leadError || !newLead) {
              errorCount++;
              errors.push(`Failed to create lead: ${name}`);
              continue;
            }
            leadId = newLead.id;
          }

          const rateWatchData = {
            current_rate: currentRate,
            target_rate: targetRate,
            loan_type: mappedRow.loan_type ? String(mappedRow.loan_type).trim() : null,
            loan_amount: parseNumeric(mappedRow.loan_amount),
            notes: mappedRow.notes ? String(mappedRow.notes).trim() : null,
            confirm_email: parseBoolean(mappedRow.confirm_email),
            initial_review: mappedRow.initial_review ? String(mappedRow.initial_review).trim() : null,
            last_contacted_at: parseDate(mappedRow.last_contacted_at),
            collateral_type: mappedRow.collateral_type ? String(mappedRow.collateral_type).trim() : null,
            collateral_value: parseNumeric(mappedRow.collateral_value),
            loan_maturity: parseDate(mappedRow.loan_maturity)?.split('T')[0] || null,
            re_location: mappedRow.re_location ? String(mappedRow.re_location).trim() : null,
            rate_type: mappedRow.rate_type ? String(mappedRow.rate_type).trim() : null,
            variable_index_spread: mappedRow.variable_index_spread ? String(mappedRow.variable_index_spread).trim() : null,
            original_term_years: parseNumeric(mappedRow.original_term_years),
            amortization: mappedRow.amortization ? String(mappedRow.amortization).trim() : null,
            penalty: mappedRow.penalty ? String(mappedRow.penalty).trim() : null,
            lender_type: mappedRow.lender_type ? String(mappedRow.lender_type).trim() : null,
            estimated_cf: parseNumeric(mappedRow.estimated_cf),
            occupancy_use: mappedRow.occupancy_use ? String(mappedRow.occupancy_use).trim() : null,
            owner_occupied_pct: parsePercent(mappedRow.owner_occupied_pct),
            seeking_to_improve: mappedRow.seeking_to_improve ? String(mappedRow.seeking_to_improve).trim() : null,
            is_active: true,
          };

          const { data: existingWatch } = await supabase
            .from('rate_watch')
            .select('id')
            .eq('lead_id', leadId)
            .single();

          if (existingWatch) {
            await supabase.from('rate_watch').update(rateWatchData).eq('id', existingWatch.id);
          } else {
            await supabase.from('rate_watch').insert({ lead_id: leadId, ...rateWatchData });
          }

          successCount++;
        } catch (err) {
          errorCount++;
          errors.push(`Error processing row: ${err}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['rate-watch'] });
      queryClient.invalidateQueries({ queryKey: ['leads-not-in-rate-watch'] });

      if (successCount > 0) {
        toast({ title: 'Import complete', description: `${successCount} entries imported${errorCount > 0 ? `, ${errorCount} failed` : ''}` });
      } else {
        toast({ title: 'Import failed', description: errors[0] || 'No valid entries found', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({ title: 'Error reading file', description: 'Failed to parse the Excel file', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openEmailForEntry = (entry: RateWatchEntry, useAI: boolean = false) => {
    if (useAI) {
      setSelectedLeadForAI({
        id: entry.lead_id,
        name: entry.pipeline.name,
        email: entry.pipeline.email,
        phone: entry.pipeline.phone,
        company_name: entry.pipeline.company_name,
        loan_type: entry.loan_type,
        loan_amount: entry.loan_amount,
        current_rate: entry.current_rate,
        target_rate: entry.target_rate,
      });
      setAiAssistantOpen(true);
      updateLastContacted.mutate(entry.id);
    } else {
      const emailData: PrefilledEmail = {
        to: entry.pipeline.email || '',
        subject: `Rate Alert: Your ${entry.loan_type || 'Loan'} Refinancing Opportunity`,
        body: `Dear ${entry.pipeline.name},

Great news! Interest rates have dropped to a level that makes refinancing your loan attractive.

Current Rate: ${entry.current_rate}%
Target Rate: ${entry.target_rate}%
${entry.loan_amount ? `Loan Amount: $${entry.loan_amount.toLocaleString()}` : ''}
${entry.loan_type ? `Loan Type: ${entry.loan_type}` : ''}
${entry.pipeline.company_name ? `Company: ${entry.pipeline.company_name}` : ''}

This presents an excellent opportunity to reduce your monthly payments or shorten your loan term.

Would you like to schedule a call to discuss your refinancing options?

Best regards,
Commercial Lending X`,
        leadId: entry.lead_id,
      };
      setPrefilledEmail(emailData);
      setInboxOpen(true);
      updateLastContacted.mutate(entry.id);
    }
  };

  const handleAIEmailUse = (subject: string, body: string) => {
    if (selectedLeadForAI) {
      setPrefilledEmail({
        to: selectedLeadForAI.email || '',
        subject,
        body,
        leadId: selectedLeadForAI.id,
      });
      setInboxOpen(true);
    }
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  };

  return (
    <AdminLayout>
      <TooltipProvider delayDuration={200}>
        <div className="min-h-screen bg-white">
          {/* ─── Header strip ───────────────────────────────────────── */}
          <div className="flex items-center gap-4 px-10 py-6 border-b border-[#e8e0f3]">
            <div className="flex flex-col gap-1">
              <h1 className="text-[22px] font-semibold text-[#1a1a1a] leading-tight">Rate Watch</h1>
              <p className="text-[13px] text-[#6b6280]">
                {stats.total} borrower{stats.total === 1 ? '' : 's'} · {formatCurrency(stats.totalLoanValue)} total loan value
              </p>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-[#e8e0f3] text-[#1a1a1a] hover:bg-[#faf7fd]"
                onClick={copyQuestionnaireLink}
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-[#e8e0f3] text-[#1a1a1a] hover:bg-[#faf7fd]"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Import
                  </>
                )}
              </Button>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-9 gap-1.5 bg-[#3b2778] hover:bg-[#2e1f5e] text-white">
                    <Plus className="w-3.5 h-3.5" />
                    Add Lead
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Lead to Rate Watch</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Select Lead *</Label>
                      <Select value={newEntry.lead_id} onValueChange={(v) => setNewEntry(prev => ({ ...prev, lead_id: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a lead..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableLeads.map(lead => (
                            <SelectItem key={lead.id} value={lead.id}>
                              {lead.name} {lead.company_name ? `(${lead.company_name})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Current Rate (%) *</Label>
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="e.g. 7.5"
                          value={newEntry.current_rate}
                          onChange={(e) => setNewEntry(prev => ({ ...prev, current_rate: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Target Rate (%) *</Label>
                        <Input
                          type="number"
                          step="0.001"
                          placeholder="e.g. 6.0"
                          value={newEntry.target_rate}
                          onChange={(e) => setNewEntry(prev => ({ ...prev, target_rate: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Loan Type</Label>
                      <Select value={newEntry.loan_type} onValueChange={(v) => setNewEntry(prev => ({ ...prev, loan_type: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select loan type..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Commercial Real Estate">Commercial Real Estate</SelectItem>
                          <SelectItem value="SBA">SBA</SelectItem>
                          <SelectItem value="Business Acquisition">Business Acquisition</SelectItem>
                          <SelectItem value="Working Capital">Working Capital</SelectItem>
                          <SelectItem value="Equipment">Equipment</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Loan Amount</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 500000"
                        value={newEntry.loan_amount}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, loan_amount: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        placeholder="Additional notes..."
                        value={newEntry.notes}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>

                    <Button
                      className="w-full bg-[#3b2778] hover:bg-[#2e1f5e]"
                      onClick={() => addToRateWatch.mutate(newEntry)}
                      disabled={!newEntry.lead_id || !newEntry.current_rate || !newEntry.target_rate || addToRateWatch.isPending}
                    >
                      {addToRateWatch.isPending ? 'Adding...' : 'Add to Rate Watch'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* ─── KPI strip ──────────────────────────────────────────── */}
          <div className="flex items-center gap-12 px-10 py-5 border-b border-[#e8e0f3]">
            <KpiCell number={stats.total} label="TOTAL" />
            <KpiDivider />
            <KpiCell number={stats.ready} label="READY" labelColor="#0F7A3E" dot="#0F7A3E" />
            <KpiDivider />
            <KpiCell number={stats.close} label="CLOSE" labelColor="#A45C00" />
            <KpiDivider />
            <KpiCell number={formatCurrency(stats.totalLoanValue)} label="LOAN VALUE" />
          </div>

          {/* ─── Filter bar ─────────────────────────────────────────── */}
          <div className="flex items-center gap-4 px-10 py-4 bg-white border-b border-[#e8e0f3]">
            <SegmentedTabs value={activeTab} onChange={setActiveTab} stats={stats} />
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9b91a8]" />
              <Input
                placeholder="Search name, company, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-11 pr-9 rounded-full bg-white border-[#e8e0f3] text-[13px] placeholder:text-[#9b91a8] focus-visible:ring-2 focus-visible:ring-[#3b2778]/20 focus-visible:border-[#3b2778]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 inline-flex items-center justify-center rounded-full text-[#9b91a8] hover:bg-[#f5f1fa] hover:text-[#1a1a1a] transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex-1" />
            <p className="text-[12px] text-[#6b6280] tabular-nums">
              {displayEntries.length} result{displayEntries.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* ─── Table ──────────────────────────────────────────────── */}
          <div className="px-10 pb-10">
            <div className="border border-[#e8e0f3] rounded-lg overflow-hidden bg-white">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="bg-[#eee6f6] h-10">
                    <th className="w-10 text-left font-semibold text-[11px] tracking-wider text-[#3b2778] px-4">{''}</th>
                    <SortableTH field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="text-left">BORROWER</SortableTH>
                    <th className="text-left font-semibold text-[11px] tracking-wider text-[#3b2778] px-3">PROPERTY / COLLATERAL</th>
                    <SortableTH field="current_rate" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="text-right">RATE</SortableTH>
                    <SortableTH field="target_rate" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="text-right">TARGET</SortableTH>
                    <SortableTH field="gap" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="text-right">GAP</SortableTH>
                    <SortableTH field="loan_amount" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="text-right">LOAN AMT</SortableTH>
                    <SortableTH field="loan_maturity" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="text-left">MATURITY</SortableTH>
                    <SortableTH field="last_contacted_at" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} className="text-left">LAST CONTACT</SortableTH>
                    <th className="text-right font-semibold text-[11px] tracking-wider text-[#3b2778] px-3">{''}</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-[#6b6280]">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Loading rate watch entries...
                        </div>
                      </td>
                    </tr>
                  ) : displayEntries.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-[#6b6280]">
                        {searchTerm || activeTab !== 'all' ? 'No matching entries found' : 'No leads in rate watch yet'}
                      </td>
                    </tr>
                  ) : (
                    displayEntries.map(entry => (
                      <RateWatchRow
                        key={entry.id}
                        entry={entry}
                        status={getStatus(entry)}
                        gap={getGap(entry)}
                        isSelected={detailEntry?.id === entry.id}
                        onClick={() => setDetailEntry(entry)}
                        onViewLead={() => {
                          setSelectedLeadForDetail(entry.pipeline);
                          setLeadDetailOpen(true);
                        }}
                        onEmail={() => openEmailForEntry(entry, false)}
                        onAIEmail={() => openEmailForEntry(entry, true)}
                        onPhone={() => {
                          if (entry.pipeline.phone) {
                            window.open(`tel:${entry.pipeline.phone}`, '_blank');
                            updateLastContacted.mutate(entry.id);
                          }
                        }}
                        formatCurrency={formatCurrency}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Side detail panel ──────────────────────────────────── */}
          <Sheet open={!!detailEntry} onOpenChange={(open) => !open && setDetailEntry(null)}>
            <SheetContent side="right" className="w-[480px] sm:max-w-[480px] p-0 border-l border-[#e8e0f3]">
              {detailEntry && (
                <RateWatchDetailPanel
                  entry={detailEntry}
                  status={getStatus(detailEntry)}
                  gap={getGap(detailEntry)}
                  formatCurrency={formatCurrency}
                  onClose={() => setDetailEntry(null)}
                  onEmail={() => openEmailForEntry(detailEntry, false)}
                  onAIEmail={() => openEmailForEntry(detailEntry, true)}
                  onPhone={() => {
                    if (detailEntry.pipeline.phone) {
                      window.open(`tel:${detailEntry.pipeline.phone}`, '_blank');
                      updateLastContacted.mutate(detailEntry.id);
                    }
                  }}
                />
              )}
            </SheetContent>
          </Sheet>

          {/* Floating Inbox */}
          <FloatingInbox
            isOpen={inboxOpen}
            onClose={() => setInboxOpen(false)}
            prefilledEmail={prefilledEmail}
            onPrefilledEmailHandled={() => setPrefilledEmail(null)}
          />

          {/* AI Email Assistant */}
          <AIEmailAssistantSheet
            isOpen={aiAssistantOpen}
            onClose={() => setAiAssistantOpen(false)}
            lead={selectedLeadForAI}
            onUseEmail={handleAIEmailUse}
          />

          {/* Lead Detail Dialog */}
          <LeadDetailDialog
            lead={selectedLeadForDetail}
            open={leadDetailOpen}
            onOpenChange={setLeadDetailOpen}
            onLeadUpdated={() => {
              queryClient.invalidateQueries({ queryKey: ['rate-watch'] });
            }}
          />
        </div>
      </TooltipProvider>
    </AdminLayout>
  );
};

// ─── KPI strip primitives ──────────────────────────────────────────

const KpiCell = ({ number, label, labelColor = '#6b6280', dot }: { number: number | string; label: string; labelColor?: string; dot?: string }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center gap-2">
      {dot && <span className="w-2 h-2 rounded-full" style={{ background: dot }} />}
      <span className="text-[26px] font-semibold text-[#1a1a1a] leading-none tabular-nums">{number}</span>
    </div>
    <span className="text-[11px] font-semibold tracking-[0.04em]" style={{ color: labelColor }}>{label}</span>
  </div>
);

const KpiDivider = () => <span className="w-px h-12 bg-[#e8e0f3]" />;

// ─── Segmented tabs ────────────────────────────────────────────────

const SegmentedTabs = ({ value, onChange, stats }: { value: TabFilter; onChange: (v: TabFilter) => void; stats: { total: number; ready: number; close: number; watching: number } }) => {
  const items: { key: TabFilter; label: string; count: number; dot?: string }[] = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'ready', label: 'Ready', count: stats.ready, dot: 'bg-emerald-500' },
    { key: 'close', label: 'Close', count: stats.close, dot: 'bg-amber-500' },
    { key: 'watching', label: 'Watching', count: stats.watching, dot: 'bg-slate-400' },
  ];
  return (
    <div
      role="tablist"
      aria-label="Filter rate watch entries by status"
      className="inline-flex h-10 items-center gap-1 rounded-lg border border-[#e8ddf5] bg-[#f7f3fb] p-1"
    >
      {items.map(item => {
        const active = value === item.key;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={[
              'inline-flex h-8 items-center gap-2 rounded-md px-3 text-[12.5px] font-medium transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b2778]/35 focus-visible:ring-offset-1 focus-visible:ring-offset-[#f7f3fb]',
              active
                ? 'bg-white text-[#3b2778] shadow-[0_1px_2px_rgba(59,39,120,0.12),0_0_0_1px_rgba(59,39,120,0.08)]'
                : 'text-[#6b6280] hover:text-[#3b2778] hover:bg-white/60',
            ].join(' ')}
          >
            {item.dot && (
              <span className={`h-1.5 w-1.5 rounded-full ${item.dot} ${active ? '' : 'opacity-70'}`} aria-hidden />
            )}
            <span>{item.label}</span>
            <span
              className={[
                'inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums leading-none h-[18px]',
                active ? 'bg-[#eee6f6] text-[#3b2778]' : 'bg-[#ece5f5] text-[#857798]',
              ].join(' ')}
            >
              {item.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// ─── Sortable TH ───────────────────────────────────────────────────

const SortableTH = ({ field, sortField, sortDirection, onSort, children, className = '' }: {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (f: SortField) => void;
  children: React.ReactNode;
  className?: string;
}) => {
  const isActive = sortField === field;
  return (
    <th
      onClick={() => onSort(field)}
      className={`cursor-pointer select-none font-semibold text-[11px] tracking-wider text-[#3b2778] px-3 hover:bg-[#e1d6f0] transition-colors ${className}`}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
        {children}
        <ArrowUpDown className={`w-3 h-3 ${isActive ? 'text-[#3b2778]' : 'text-[#9b91a8]'} ${isActive && sortDirection === 'desc' ? 'rotate-180' : ''}`} />
      </div>
    </th>
  );
};

// ─── Table Row ─────────────────────────────────────────────────────

interface RateWatchRowProps {
  entry: RateWatchEntry;
  status: string;
  gap: number;
  isSelected: boolean;
  onClick: () => void;
  onViewLead: () => void;
  onEmail: () => void;
  onAIEmail: () => void;
  onPhone: () => void;
  formatCurrency: (n: number) => string;
}

const RateWatchRow = ({
  entry,
  status,
  gap,
  isSelected,
  onClick,
  onViewLead,
  onEmail,
  onAIEmail,
  onPhone,
  formatCurrency,
}: RateWatchRowProps) => {
  const dotColor = status === 'ready' ? '#0F7A3E' : status === 'close' ? '#A45C00' : '#9B91A8';
  const statusLabel = status === 'ready' ? 'Ready' : status === 'close' ? 'Close' : 'Watching';

  return (
    <tr
      className={`group cursor-pointer border-t border-[#f1ecf7] transition-colors ${
        isSelected ? 'bg-[#eee6f6]' : 'hover:bg-[#faf7fd]'
      }`}
      onClick={onClick}
    >
      {/* Status dot */}
      <td className="w-10 px-4 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: dotColor }} />
          </TooltipTrigger>
          <TooltipContent side="right">{statusLabel}</TooltipContent>
        </Tooltip>
      </td>

      {/* Borrower */}
      <td className="px-3 py-2.5 max-w-[260px]">
        <p className="font-medium text-[13px] text-[#1a1a1a] leading-tight truncate">{entry.pipeline.name}</p>
        {entry.pipeline.company_name && (
          <p className="text-[12px] text-[#6b6280] leading-tight mt-0.5 truncate">{entry.pipeline.company_name}</p>
        )}
      </td>

      {/* Property / Collateral */}
      <td className="px-3 py-2.5 max-w-[220px]">
        {entry.collateral_type ? (
          <p className="text-[13px] text-[#1a1a1a] leading-tight truncate">{entry.collateral_type}</p>
        ) : null}
        {entry.re_location ? (
          <p className="text-[12px] text-[#6b6280] leading-tight mt-0.5 truncate">{entry.re_location}</p>
        ) : null}
        {!entry.collateral_type && !entry.re_location && (
          <span className="text-[12px] text-[#9b91a8]">—</span>
        )}
      </td>

      {/* Rate */}
      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-[13px] text-[#1a1a1a]">
        {entry.current_rate}%
      </td>

      {/* Target */}
      <td className="px-3 py-2.5 text-right tabular-nums text-[13px] text-[#6b6280]">
        {entry.target_rate}%
      </td>

      {/* Gap — hero column */}
      <td className="px-3 py-2.5 text-right tabular-nums text-[13px]">
        {gap <= 0 ? (
          <span className="inline-flex items-center gap-1 font-semibold text-[#0F7A3E]">
            Met <ArrowDown className="w-3 h-3" />
          </span>
        ) : gap < 0.5 ? (
          <span className="font-semibold text-[#A45C00]">+{gap.toFixed(2)}%</span>
        ) : (
          <span className="text-[#9B91A8]">+{gap.toFixed(2)}%</span>
        )}
      </td>

      {/* Loan Amount */}
      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-[13px] text-[#1a1a1a]">
        {entry.loan_amount ? formatCurrency(entry.loan_amount) : <span className="text-[#9b91a8]">—</span>}
      </td>

      {/* Maturity */}
      <td className="px-3 py-2.5 text-[12px] text-[#1a1a1a]">
        {entry.loan_maturity ? (
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-[#9b91a8]" />
            {format(new Date(entry.loan_maturity), 'MMM yyyy')}
          </span>
        ) : (
          <span className="text-[#9b91a8]">—</span>
        )}
      </td>

      {/* Last Contact */}
      <td className="px-3 py-2.5 text-[12px] text-[#1a1a1a]">
        {entry.last_contacted_at ? (
          format(new Date(entry.last_contacted_at), 'MMM d, yyyy')
        ) : (
          <span className="text-[#9b91a8]">Never</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5 text-right">
        <div className="inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <RowAction tip="View Lead" onClick={onViewLead}><Eye className="w-3.5 h-3.5" /></RowAction>
          <RowAction tip="AI Email" onClick={onAIEmail}><Sparkles className="w-3.5 h-3.5 text-[#3b2778]" /></RowAction>
          <RowAction tip="Email" onClick={onEmail}><Mail className="w-3.5 h-3.5" /></RowAction>
          {entry.pipeline.phone && (
            <RowAction tip="Call" onClick={onPhone}><Phone className="w-3.5 h-3.5" /></RowAction>
          )}
        </div>
      </td>
    </tr>
  );
};

const RowAction = ({ tip, onClick, children }: { tip: string; onClick: () => void; children: React.ReactNode }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#6b6280] hover:bg-white hover:text-[#1a1a1a] transition-colors"
      >
        {children}
      </button>
    </TooltipTrigger>
    <TooltipContent>{tip}</TooltipContent>
  </Tooltip>
);

// ─── Side Detail Panel ─────────────────────────────────────────────

interface DetailPanelProps {
  entry: RateWatchEntry;
  status: string;
  gap: number;
  formatCurrency: (n: number) => string;
  onClose: () => void;
  onEmail: () => void;
  onAIEmail: () => void;
  onPhone: () => void;
}

const RateWatchDetailPanel = ({ entry, status, gap, formatCurrency, onClose, onEmail, onAIEmail, onPhone }: DetailPanelProps) => {
  const gapDisplay = gap <= 0
    ? { label: 'Met', color: '#0F7A3E' }
    : gap < 0.5
      ? { label: `+${gap.toFixed(2)}%`, color: '#A45C00' }
      : { label: `+${gap.toFixed(2)}%`, color: '#9B91A8' };

  const summary = gap <= 0
    ? `Rate is at or below target — ready to reach out.`
    : gap < 0.5
      ? `Rate needs to drop ${gap.toFixed(2)}% to hit target — currently in the close zone.`
      : `Rate needs to drop ${gap.toFixed(2)}% to hit target — currently watching.`;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-start gap-3 px-6 py-5 border-b border-[#e8e0f3]">
        <div className="flex-1 min-w-0">
          <h2 className="text-[18px] font-semibold text-[#1a1a1a] truncate">{entry.pipeline.name}</h2>
          <p className="text-[12px] text-[#6b6280] truncate mt-0.5">
            {entry.pipeline.company_name}
            {entry.pipeline.company_name && entry.re_location ? ' · ' : ''}
            {entry.re_location}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-[#6b6280] hover:bg-[#faf7fd] hover:text-[#1a1a1a] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-[#e8e0f3]">
        <Button variant="outline" size="sm" className="flex-1 h-9 gap-1.5 border-[#e8e0f3]" onClick={onEmail}>
          <Mail className="w-3.5 h-3.5" /> Email
        </Button>
        <Button variant="outline" size="sm" className="flex-1 h-9 gap-1.5 bg-[#f5f1fa] border-[#e1d6f0] text-[#3b2778] hover:bg-[#eee6f6]" onClick={onAIEmail}>
          <Sparkles className="w-3.5 h-3.5" /> AI Email
        </Button>
        {entry.pipeline.phone && (
          <Button variant="outline" size="sm" className="flex-1 h-9 gap-1.5 border-[#e8e0f3]" onClick={onPhone}>
            <Phone className="w-3.5 h-3.5" /> Call
          </Button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Hero stat block */}
        <div className="bg-[#faf7fd] px-6 py-5">
          <div className="flex items-stretch gap-0">
            <HeroStat label="CURRENT" value={`${entry.current_rate}%`} />
            <span className="w-px bg-[#e8e0f3]" />
            <HeroStat label="TARGET" value={`${entry.target_rate}%`} className="pl-4" />
            <span className="w-px bg-[#e8e0f3]" />
            <HeroStat label="GAP" value={gapDisplay.label} valueColor={gapDisplay.color} labelColor={gap < 0.5 && gap > 0 ? '#A45C00' : gap <= 0 ? '#0F7A3E' : '#6b6280'} className="pl-4" />
          </div>
          <p className="text-[13px] text-[#6b6280] mt-4 leading-snug">{summary}</p>
        </div>

        {/* Loan section */}
        <DetailSection title="LOAN">
          <DetailRow label="Loan Type" value={entry.loan_type} />
          <DetailRow label="Rate Type" value={entry.rate_type} />
          {entry.rate_type === 'Variable' && entry.variable_index_spread && (
            <DetailRow label="Index & Spread" value={entry.variable_index_spread} />
          )}
          <DetailRow label="Original Term" value={entry.original_term_years ? `${entry.original_term_years} years` : null} />
          <DetailRow label="Amortization" value={entry.amortization} />
          <DetailRow label="Prepayment Penalty" value={entry.penalty} />
          <DetailRow label="Lender Type" value={entry.lender_type} />
        </DetailSection>

        {/* Collateral section */}
        <DetailSection title="COLLATERAL">
          <DetailRow label="Type" value={entry.collateral_type} />
          <DetailRow label="Estimated Value" value={entry.collateral_value ? formatCurrency(entry.collateral_value) : null} />
          <DetailRow label="Location" value={entry.re_location} />
          <DetailRow label="Occupancy / Use" value={entry.occupancy_use} />
          <DetailRow label="Owner-Occupied" value={entry.owner_occupied_pct != null ? `${entry.owner_occupied_pct}%` : null} />
          <DetailRow label="Est. Cash Flow" value={entry.estimated_cf ? formatCurrency(entry.estimated_cf) : null} />
        </DetailSection>

        {/* Status section */}
        <DetailSection title="STATUS & ACTIVITY" lastSection>
          <DetailRow label="Email Confirmed" value={entry.confirm_email ? 'Yes' : 'No'} valueColor={entry.confirm_email ? '#0F7A3E' : undefined} />
          <DetailRow label="Initial Review" value={entry.initial_review} />
          <DetailRow label="Enrolled" value={format(new Date(entry.enrolled_at), 'MMM d, yyyy')} />
          <DetailRow label="Last Contact" value={entry.last_contacted_at ? format(new Date(entry.last_contacted_at), 'MMM d, yyyy') : 'Never'} />
          {entry.seeking_to_improve && (
            <div className="bg-[#faf7fd] rounded-md px-3.5 py-3 mt-2">
              <p className="text-[11px] font-semibold tracking-wider text-[#6b6280]">SEEKING TO IMPROVE</p>
              <p className="text-[13px] text-[#1a1a1a] mt-1.5 leading-snug">{entry.seeking_to_improve}</p>
            </div>
          )}
          {entry.notes && (
            <div className="bg-[#faf7fd] rounded-md px-3.5 py-3 mt-2">
              <p className="text-[11px] font-semibold tracking-wider text-[#6b6280]">NOTES</p>
              <p className="text-[13px] text-[#1a1a1a] mt-1.5 leading-snug">{entry.notes}</p>
            </div>
          )}
        </DetailSection>
      </div>
    </div>
  );
};

const HeroStat = ({ label, value, valueColor = '#1a1a1a', labelColor = '#6b6280', className = '' }: { label: string; value: string; valueColor?: string; labelColor?: string; className?: string }) => (
  <div className={`flex-1 flex flex-col gap-1.5 ${className}`}>
    <span className="text-[11px] font-semibold tracking-[0.04em]" style={{ color: labelColor }}>{label}</span>
    <span className="text-[24px] font-semibold tabular-nums leading-none" style={{ color: valueColor }}>{value}</span>
  </div>
);

const DetailSection = ({ title, children, lastSection = false }: { title: string; children: React.ReactNode; lastSection?: boolean }) => (
  <div className={`px-6 py-5 ${lastSection ? '' : 'border-b border-[#e8e0f3]'}`}>
    <h3 className="text-[11px] font-semibold tracking-[0.04em] text-[#3b2778] mb-3">{title}</h3>
    <div className="space-y-2.5">{children}</div>
  </div>
);

const DetailRow = ({ label, value, valueColor }: { label: string; value: string | null | undefined; valueColor?: string }) => {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] text-[#6b6280] shrink-0">{label}</span>
      <span className="text-[13px] font-medium text-right" style={{ color: valueColor || '#1a1a1a' }}>{value}</span>
    </div>
  );
};

export default RateWatch;
