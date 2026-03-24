import { useState, useRef, useMemo, useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import FloatingInbox, { PrefilledEmail } from '@/components/admin/FloatingInbox';
import AIEmailAssistantSheet from '@/components/admin/AIEmailAssistantSheet';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import * as XLSX from 'xlsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sparkles,
  TrendingDown,
  Mail,
  Phone,
  Plus,
  FileSpreadsheet,
  MapPin,
  Building2,
  Calendar,
  Copy,
  Eye,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Users,
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  leads: {
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
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Lead detail dialog state
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<RateWatchEntry['leads'] | null>(null);
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
          leads (
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
        .from('leads')
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
    onError: (error: any) => {
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
    const contacted = rateWatchEntries.filter(e => e.last_contacted_at).length;
    const totalLoanValue = rateWatchEntries.reduce((sum, e) => sum + (e.loan_amount || 0), 0);
    return { total: rateWatchEntries.length, ready, close, contacted, totalLoanValue };
  }, [rateWatchEntries]);

  // Filter + search + sort
  const displayEntries = useMemo(() => {
    let entries = rateWatchEntries;

    // Tab filter
    if (activeTab !== 'all') {
      entries = entries.filter(e => getStatus(e) === activeTab);
    }

    // Search
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      entries = entries.filter(e =>
        e.leads.name.toLowerCase().includes(s) ||
        e.leads.email?.toLowerCase().includes(s) ||
        e.leads.company_name?.toLowerCase().includes(s) ||
        e.loan_type?.toLowerCase().includes(s) ||
        e.collateral_type?.toLowerCase().includes(s) ||
        e.re_location?.toLowerCase().includes(s)
      );
    }

    // Sort
    entries = [...entries].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'name': cmp = a.leads.name.localeCompare(b.leads.name); break;
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
            const { data } = await supabase.from('leads').select('id').eq('email', email).single();
            existingLead = data;
          }
          if (!existingLead) {
            const { data } = await supabase.from('leads').select('id').ilike('name', name).single();
            existingLead = data;
          }

          if (existingLead) {
            leadId = existingLead.id;
          } else {
            const { data: newLead, error: leadError } = await supabase
              .from('leads')
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
        name: entry.leads.name,
        email: entry.leads.email,
        phone: entry.leads.phone,
        company_name: entry.leads.company_name,
        loan_type: entry.loan_type,
        loan_amount: entry.loan_amount,
        current_rate: entry.current_rate,
        target_rate: entry.target_rate,
      });
      setAiAssistantOpen(true);
      updateLastContacted.mutate(entry.id);
    } else {
      const emailData: PrefilledEmail = {
        to: entry.leads.email || '',
        subject: `Rate Alert: Your ${entry.loan_type || 'Loan'} Refinancing Opportunity`,
        body: `Dear ${entry.leads.name},

Great news! Interest rates have dropped to a level that makes refinancing your loan attractive.

Current Rate: ${entry.current_rate}%
Target Rate: ${entry.target_rate}%
${entry.loan_amount ? `Loan Amount: $${entry.loan_amount.toLocaleString()}` : ''}
${entry.loan_type ? `Loan Type: ${entry.loan_type}` : ''}
${entry.leads.company_name ? `Company: ${entry.leads.company_name}` : ''}

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

  const SortableHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={`cursor-pointer select-none hover:bg-muted/50 transition-colors ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`w-3 h-3 ${sortField === field ? 'text-foreground' : 'text-muted-foreground/40'}`} />
      </div>
    </TableHead>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Actions */}
        <div className="flex justify-end">
          <div className="flex items-center gap-2 flex-wrap">
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
              className="gap-1.5"
              onClick={copyQuestionnaireLink}
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Link
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
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
                <Button size="sm" className="gap-1.5">
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
                    className="w-full"
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

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="border-none shadow-sm bg-gradient-to-br from-slate-50 to-slate-100/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-slate-200/80 flex items-center justify-center">
                  <Users className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{stats.total}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-gradient-to-br from-green-50 to-emerald-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-green-200/80 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-green-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none text-green-700">{stats.ready}</p>
                  <p className="text-xs text-green-600 mt-0.5">Ready</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-gradient-to-br from-amber-50 to-yellow-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-amber-200/80 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none text-amber-700">{stats.close}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Close</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-200/80 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-blue-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none text-blue-700">{stats.contacted}</p>
                  <p className="text-xs text-blue-600 mt-0.5">Contacted</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-gradient-to-br from-purple-50 to-violet-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-purple-200/80 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-purple-700" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none text-purple-700">
                    {formatCurrency(stats.totalLoanValue)}
                  </p>
                  <p className="text-xs text-purple-600 mt-0.5">Loan Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabFilter)} className="w-auto">
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs px-3 h-7">
                All ({stats.total})
              </TabsTrigger>
              <TabsTrigger value="ready" className="text-xs px-3 h-7">
                Ready ({stats.ready})
              </TabsTrigger>
              <TabsTrigger value="close" className="text-xs px-3 h-7">
                Close ({stats.close})
              </TabsTrigger>
              <TabsTrigger value="watching" className="text-xs px-3 h-7">
                Watching ({stats.total - stats.ready - stats.close})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Search name, company, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground ml-auto">
            {displayEntries.length} result{displayEntries.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Table */}
        <Card className="border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <TooltipProvider delayDuration={200}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-8" />
                    <TableHead className="w-10">Status</TableHead>
                    <SortableHeader field="name">Borrower</SortableHeader>
                    <TableHead>Property / Collateral</TableHead>
                    <SortableHeader field="current_rate" className="text-right">Rate</SortableHeader>
                    <SortableHeader field="target_rate" className="text-right">Target</SortableHeader>
                    <SortableHeader field="gap" className="text-right">Gap</SortableHeader>
                    <SortableHeader field="loan_amount" className="text-right">Loan Amt</SortableHeader>
                    <SortableHeader field="loan_maturity">Maturity</SortableHeader>
                    <SortableHeader field="last_contacted_at">Last Contact</SortableHeader>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Loading rate watch entries...
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : displayEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                        {searchTerm || activeTab !== 'all' ? 'No matching entries found' : 'No leads in rate watch yet'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayEntries.map(entry => {
                      const status = getStatus(entry);
                      const gap = getGap(entry);
                      const isExpanded = expandedRow === entry.id;

                      return (
                        <RateWatchRow
                          key={entry.id}
                          entry={entry}
                          status={status}
                          gap={gap}
                          isExpanded={isExpanded}
                          onToggleExpand={() => setExpandedRow(isExpanded ? null : entry.id)}
                          onViewLead={() => {
                            setSelectedLeadForDetail(entry.leads);
                            setLeadDetailOpen(true);
                          }}
                          onEmail={() => openEmailForEntry(entry, false)}
                          onAIEmail={() => openEmailForEntry(entry, true)}
                          onPhone={() => {
                            if (entry.leads.phone) {
                              window.open(`tel:${entry.leads.phone}`, '_blank');
                              updateLastContacted.mutate(entry.id);
                            }
                          }}
                          formatCurrency={formatCurrency}
                        />
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>
        </Card>

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
    </AdminLayout>
  );
};

// ─── Table Row ──────────────────────────────────────────────────────

interface RateWatchRowProps {
  entry: RateWatchEntry;
  status: string;
  gap: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
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
  isExpanded,
  onToggleExpand,
  onViewLead,
  onEmail,
  onAIEmail,
  onPhone,
  formatCurrency,
}: RateWatchRowProps) => {
  const statusConfig = {
    ready: { label: 'Ready', color: 'bg-green-500', badgeClass: 'bg-green-100 text-green-700 border-green-200' },
    close: { label: 'Close', color: 'bg-amber-500', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' },
    watching: { label: 'Watching', color: 'bg-slate-400', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' },
  }[status] || { label: 'Watching', color: 'bg-slate-400', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' };

  return (
    <>
      <TableRow
        className={`group cursor-pointer transition-colors ${
          status === 'ready' ? 'bg-green-50/40 hover:bg-green-50/70' : 'hover:bg-muted/40'
        }`}
        onClick={onToggleExpand}
      >
        {/* Expand toggle */}
        <TableCell className="w-8 pr-0">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>
        </TableCell>

        {/* Status dot */}
        <TableCell className="w-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center">
                <div className={`w-2.5 h-2.5 rounded-full ${statusConfig.color}`} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{statusConfig.label}</p>
            </TooltipContent>
          </Tooltip>
        </TableCell>

        {/* Borrower */}
        <TableCell>
          <div className="min-w-[140px]">
            <p className="font-medium text-sm leading-tight">{entry.leads.name}</p>
            {entry.leads.company_name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[160px]">{entry.leads.company_name}</span>
              </p>
            )}
          </div>
        </TableCell>

        {/* Property */}
        <TableCell>
          <div className="min-w-[120px]">
            {entry.collateral_type && (
              <p className="text-sm leading-tight truncate max-w-[180px]">{entry.collateral_type}</p>
            )}
            {entry.re_location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 shrink-0" />
                {entry.re_location}
              </p>
            )}
            {!entry.collateral_type && !entry.re_location && (
              <span className="text-xs text-muted-foreground">-</span>
            )}
          </div>
        </TableCell>

        {/* Current Rate */}
        <TableCell className="text-right tabular-nums font-medium text-sm">
          {entry.current_rate}%
        </TableCell>

        {/* Target Rate */}
        <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
          {entry.target_rate}%
        </TableCell>

        {/* Gap */}
        <TableCell className="text-right">
          {gap <= 0 ? (
            <span className="inline-flex items-center gap-0.5 text-green-600 text-sm font-medium">
              <TrendingDown className="w-3 h-3" />
              Met
            </span>
          ) : gap < 0.5 ? (
            <span className="inline-flex items-center gap-0.5 text-amber-600 text-sm tabular-nums">
              <AlertTriangle className="w-3 h-3" />
              {gap.toFixed(2)}%
            </span>
          ) : (
            <span className="text-sm text-muted-foreground tabular-nums">
              +{gap.toFixed(2)}%
            </span>
          )}
        </TableCell>

        {/* Loan Amount */}
        <TableCell className="text-right text-sm tabular-nums">
          {entry.loan_amount ? formatCurrency(entry.loan_amount) : '-'}
        </TableCell>

        {/* Maturity */}
        <TableCell className="text-sm">
          {entry.loan_maturity ? (
            <span className="flex items-center gap-1 text-xs">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              {format(new Date(entry.loan_maturity), 'MMM yyyy')}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>

        {/* Last Contact */}
        <TableCell className="text-sm">
          {entry.last_contacted_at ? (
            <span className="text-xs">{format(new Date(entry.last_contacted_at), 'MMM d, yyyy')}</span>
          ) : (
            <span className="text-xs text-muted-foreground">Never</span>
          )}
        </TableCell>

        {/* Actions */}
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onViewLead(); }}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Lead</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onAIEmail(); }}>
                  <Sparkles className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>AI Email</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEmail(); }}>
                  <Mail className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Template Email</TooltipContent>
            </Tooltip>
            {entry.leads.phone && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onPhone(); }}>
                    <Phone className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Call</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded Detail Row */}
      {isExpanded && (
        <TableRow className="bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={11} className="p-0">
            <ExpandedDetail entry={entry} formatCurrency={formatCurrency} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

// ─── Expanded Detail Panel ──────────────────────────────────────────

const ExpandedDetail = ({ entry, formatCurrency }: { entry: RateWatchEntry; formatCurrency: (n: number) => string }) => {
  return (
    <div className="px-6 py-4 border-t border-dashed">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Loan Details */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Loan Details</h4>
          <div className="space-y-1.5">
            <DetailRow label="Loan Type" value={entry.loan_type} />
            <DetailRow label="Rate Type" value={entry.rate_type} />
            {entry.rate_type === 'Variable' && entry.variable_index_spread && (
              <DetailRow label="Index & Spread" value={entry.variable_index_spread} />
            )}
            <DetailRow label="Original Term" value={entry.original_term_years ? `${entry.original_term_years} years` : null} />
            <DetailRow label="Amortization" value={entry.amortization} />
            <DetailRow label="Prepayment Penalty" value={entry.penalty} />
            <DetailRow label="Lender Type" value={entry.lender_type} />
          </div>
        </div>

        {/* Property / Collateral */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Property / Collateral</h4>
          <div className="space-y-1.5">
            <DetailRow label="Collateral" value={entry.collateral_type} />
            <DetailRow label="Collateral Value" value={entry.collateral_value ? formatCurrency(entry.collateral_value) : null} />
            <DetailRow label="Location" value={entry.re_location} />
            <DetailRow label="Occupancy / Use" value={entry.occupancy_use} />
            <DetailRow label="Owner Occupied" value={entry.owner_occupied_pct != null ? `${entry.owner_occupied_pct}%` : null} />
            <DetailRow label="Est. Cash Flow" value={entry.estimated_cf ? formatCurrency(entry.estimated_cf) : null} />
          </div>
        </div>

        {/* Status & Notes */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Status & Notes</h4>
          <div className="space-y-1.5">
            <DetailRow label="Email Confirmed" value={entry.confirm_email ? 'Yes' : 'No'} />
            <DetailRow label="Initial Review" value={entry.initial_review} />
            <DetailRow label="Enrolled" value={format(new Date(entry.enrolled_at), 'MMM d, yyyy')} />
            {entry.seeking_to_improve && (
              <div className="mt-2">
                <p className="text-xs font-medium text-muted-foreground">Seeking to Improve</p>
                <p className="text-sm mt-0.5">{entry.seeking_to_improve}</p>
              </div>
            )}
            {entry.notes && (
              <div className="mt-2">
                <p className="text-xs font-medium text-muted-foreground">Notes</p>
                <p className="text-sm mt-0.5 text-muted-foreground leading-relaxed">{entry.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="mt-4 pt-3 border-t flex items-center gap-4 text-xs text-muted-foreground">
        {entry.leads.email && (
          <span className="flex items-center gap-1">
            <Mail className="w-3 h-3" /> {entry.leads.email}
          </span>
        )}
        {entry.leads.phone && (
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" /> {entry.leads.phone}
          </span>
        )}
      </div>
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string | null | undefined }) => {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-right">{value}</span>
    </div>
  );
};

export default RateWatch;
