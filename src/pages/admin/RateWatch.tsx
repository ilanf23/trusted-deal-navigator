import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import FloatingInbox, { PrefilledEmail } from '@/components/admin/FloatingInbox';
import AIEmailAssistant from '@/components/admin/AIEmailAssistant';
import * as XLSX from 'xlsx';
import { 
  Sparkles,
  TrendingDown, 
  TrendingUp, 
  Mail, 
  Phone, 
  Plus, 
  GripVertical,
  AlertCircle,
  CheckCircle2,
  Clock,
  Upload,
  FileSpreadsheet
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
  leads: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company_name: string | null;
  };
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
}

const RateWatch = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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
  const [draggedEntry, setDraggedEntry] = useState<RateWatchEntry | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
            id,
            name,
            email,
            phone,
            company_name
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

  // Filter entries
  const filteredEntries = rateWatchEntries.filter(entry => {
    const searchLower = searchTerm.toLowerCase();
    return (
      entry.leads.name.toLowerCase().includes(searchLower) ||
      entry.leads.email?.toLowerCase().includes(searchLower) ||
      entry.leads.company_name?.toLowerCase().includes(searchLower) ||
      entry.loan_type?.toLowerCase().includes(searchLower)
    );
  });

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

      // Map headers to our fields (fuzzy matching)
      const headerMap: Record<string, string> = {
        // Lead fields
        'name': 'name',
        'lead name': 'name',
        'borrower': 'name',
        'client': 'name',
        'client name': 'name',
        'email': 'email',
        'email address': 'email',
        'phone': 'phone',
        'phone number': 'phone',
        'company': 'company_name',
        'company name': 'company_name',
        'business': 'company_name',
        // Rate watch core fields
        'current rate': 'current_rate',
        'rate': 'current_rate',
        'target rate': 'target_rate',
        'target': 'target_rate',
        'loan type': 'loan_type',
        'type': 'loan_type',
        'loan amount': 'loan_amount',
        'loan balance': 'loan_amount',
        'amount': 'loan_amount',
        'notes': 'notes',
        'note': 'notes',
        'comments': 'notes',
        // New columns from user's spreadsheet
        'confirm email': 'confirm_email',
        'initial review': 'initial_review',
        'date of last contact': 'last_contacted_at',
        'last contact': 'last_contacted_at',
        'collateral type': 'collateral_type',
        'collateral value': 'collateral_value',
        'loan maturity': 'loan_maturity',
        're city/state': 're_location',
        're city state': 're_location',
        'city/state': 're_location',
        'location': 're_location',
        'rate type': 'rate_type',
        'if variable: index and spread': 'variable_index_spread',
        'index and spread': 'variable_index_spread',
        'variable index': 'variable_index_spread',
        'original term (yrs)': 'original_term_years',
        'original term': 'original_term_years',
        'term (yrs)': 'original_term_years',
        'term': 'original_term_years',
        'amortization': 'amortization',
        'penalty': 'penalty',
        'lender type': 'lender_type',
        'estimated cf': 'estimated_cf',
        'cash flow': 'estimated_cf',
        'occupancy/use': 'occupancy_use',
        'occupancy': 'occupancy_use',
        'use': 'occupancy_use',
        '% oo': 'owner_occupied_pct',
        'owner occupied': 'owner_occupied_pct',
        'oo %': 'owner_occupied_pct',
        'seeking to improve': 'seeking_to_improve',
        'seeking': 'seeking_to_improve',
        'improve': 'seeking_to_improve',
      };

      const mapHeader = (header: string): string | null => {
        const normalized = header.toLowerCase().trim();
        return headerMap[normalized] || null;
      };

      // Helper to parse date strings
      const parseDate = (value: unknown): string | null => {
        if (!value) return null;
        const str = String(value).trim();
        if (!str) return null;
        
        // Try to parse as date
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
        return null;
      };

      // Helper to parse numeric values (handles currency formats)
      const parseNumeric = (value: unknown): number | null => {
        if (!value) return null;
        const str = String(value).replace(/[$,]/g, '').trim();
        const num = parseFloat(str);
        return isNaN(num) ? null : num;
      };

      // Helper to parse percentage
      const parsePercent = (value: unknown): number | null => {
        if (!value) return null;
        const str = String(value).replace(/%/g, '').trim();
        const num = parseFloat(str);
        return isNaN(num) ? null : num;
      };

      // Helper to parse boolean (Y/N, Yes/No, true/false)
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
            if (mappedKey) {
              mappedRow[mappedKey] = value;
            }
          }

          const name = String(mappedRow.name || '').trim();
          const currentRate = parseFloat(String(mappedRow.current_rate || '0'));
          const targetRate = parseFloat(String(mappedRow.target_rate || '0'));

          if (!name || isNaN(currentRate) || isNaN(targetRate)) {
            errorCount++;
            errors.push(`Row skipped: Missing name or invalid rates`);
            continue;
          }

          // First, create or find the lead
          let leadId: string;
          const email = mappedRow.email ? String(mappedRow.email).trim() : null;
          
          // Check if lead exists by name or email
          let existingLead = null;
          if (email) {
            const { data } = await supabase
              .from('leads')
              .select('id')
              .eq('email', email)
              .single();
            existingLead = data;
          }
          
          if (!existingLead) {
            const { data } = await supabase
              .from('leads')
              .select('id')
              .ilike('name', name)
              .single();
            existingLead = data;
          }

          if (existingLead) {
            leadId = existingLead.id;
          } else {
            // Create new lead
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

          // Build the rate watch data object with all fields
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

          // Check if already in rate watch
          const { data: existingWatch } = await supabase
            .from('rate_watch')
            .select('id')
            .eq('lead_id', leadId)
            .single();

          if (existingWatch) {
            // Update existing
            await supabase
              .from('rate_watch')
              .update(rateWatchData)
              .eq('id', existingWatch.id);
          } else {
            // Insert new
            await supabase
              .from('rate_watch')
              .insert({
                lead_id: leadId,
                ...rateWatchData,
              });
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
        toast({ 
          title: 'Import complete', 
          description: `${successCount} entries imported${errorCount > 0 ? `, ${errorCount} failed` : ''}` 
        });
      } else {
        toast({ 
          title: 'Import failed', 
          description: errors[0] || 'No valid entries found', 
          variant: 'destructive' 
        });
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      toast({ title: 'Error reading file', description: 'Failed to parse the Excel file', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Separate entries by status
  const alertEntries = filteredEntries.filter(e => e.current_rate > e.target_rate);
  const readyEntries = filteredEntries.filter(e => e.current_rate <= e.target_rate);

  // Drag handlers
  const handleDragStart = (entry: RateWatchEntry) => {
    setDraggedEntry(entry);
  };

  const handleDragEnd = () => {
    setDraggedEntry(null);
  };

  const handleDropOnEmail = () => {
    if (draggedEntry) {
      // Open both AI Assistant and Gmail inbox side by side
      setSelectedLeadForAI({
        id: draggedEntry.lead_id,
        name: draggedEntry.leads.name,
        email: draggedEntry.leads.email,
        phone: draggedEntry.leads.phone,
        company_name: draggedEntry.leads.company_name,
        loan_type: draggedEntry.loan_type,
        loan_amount: draggedEntry.loan_amount,
        current_rate: draggedEntry.current_rate,
        target_rate: draggedEntry.target_rate,
      });
      setPrefilledEmail({
        to: draggedEntry.leads.email || '',
        subject: '',
        body: '',
        leadId: draggedEntry.lead_id,
      });
      setAiAssistantOpen(true);
      setInboxOpen(true);
      updateLastContacted.mutate(draggedEntry.id);
      setDraggedEntry(null);
    }
  };

  const openEmailForEntry = (entry: RateWatchEntry, useAI: boolean = false) => {
    if (useAI) {
      // Open AI Assistant dialog
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
      // Open with pre-written template
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

  const getRateStatus = (entry: RateWatchEntry) => {
    const diff = entry.current_rate - entry.target_rate;
    if (diff <= 0) return { status: 'ready', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-200' };
    if (diff < 0.5) return { status: 'close', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' };
    return { status: 'waiting', icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted border-border' };
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Rate Watch</h1>
            <p className="text-muted-foreground">
              Monitor interest rates and reach out when refinancing becomes attractive
            </p>
          </div>
          
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  Import Excel
                </>
              )}
            </Button>
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add to Rate Watch
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

        {/* Search */}
        <div className="max-w-md">
          <Input 
            placeholder="Search by name, email, company, or loan type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{rateWatchEntries.length}</div>
              <p className="text-sm text-muted-foreground">Total Watching</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-700">{readyEntries.length}</div>
              <p className="text-sm text-green-600">Ready to Contact</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{alertEntries.filter(e => (e.current_rate - e.target_rate) < 0.5).length}</div>
              <p className="text-sm text-muted-foreground">Close to Target</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {rateWatchEntries.filter(e => e.last_contacted_at).length}
              </div>
              <p className="text-sm text-muted-foreground">Contacted</p>
            </CardContent>
          </Card>
        </div>

        {/* Email Drop Zone */}
        <Card 
          className={`border-2 border-dashed transition-all ${
            draggedEntry 
              ? 'border-primary bg-primary/5 scale-[1.02]' 
              : 'border-muted-foreground/20'
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropOnEmail}
        >
          <CardContent className="py-8 text-center">
            <Mail className={`w-10 h-10 mx-auto mb-2 ${draggedEntry ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className={`font-medium ${draggedEntry ? 'text-primary' : 'text-muted-foreground'}`}>
              {draggedEntry ? 'Drop here to compose email' : 'Drag a lead here to send an email'}
            </p>
          </CardContent>
        </Card>

        {/* Rate Watch Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ready to Contact */}
          <Card className="border-green-200">
            <CardHeader className="bg-green-50 border-b border-green-200">
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-5 h-5" />
                Ready to Contact ({readyEntries.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {readyEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No leads have reached their target rate yet
                </p>
              ) : (
                readyEntries.map(entry => (
                  <RateWatchCard 
                    key={entry.id} 
                    entry={entry} 
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onEmail={() => openEmailForEntry(entry, false)}
                    onAIEmail={() => openEmailForEntry(entry, true)}
                    onPhone={() => {
                      if (entry.leads.phone) {
                        window.open(`tel:${entry.leads.phone}`, '_blank');
                        updateLastContacted.mutate(entry.id);
                      }
                    }}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Watching */}
          <Card>
            <CardHeader className="bg-muted border-b">
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-muted-foreground" />
                Watching ({alertEntries.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
              {alertEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  All leads have reached their target rate!
                </p>
              ) : (
                alertEntries.map(entry => (
                  <RateWatchCard 
                    key={entry.id} 
                    entry={entry} 
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onEmail={() => openEmailForEntry(entry, false)}
                    onAIEmail={() => openEmailForEntry(entry, true)}
                    onPhone={() => {
                      if (entry.leads.phone) {
                        window.open(`tel:${entry.leads.phone}`, '_blank');
                        updateLastContacted.mutate(entry.id);
                      }
                    }}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Floating Inbox */}
        <FloatingInbox 
          isOpen={inboxOpen} 
          onClose={() => setInboxOpen(false)}
          prefilledEmail={prefilledEmail}
          onPrefilledEmailHandled={() => setPrefilledEmail(null)}
        />

        {/* AI Email Assistant */}
        <AIEmailAssistant
          isOpen={aiAssistantOpen}
          onClose={() => setAiAssistantOpen(false)}
          lead={selectedLeadForAI}
          onUseEmail={handleAIEmailUse}
        />
      </div>
    </AdminLayout>
  );
};

// Rate Watch Card Component
interface RateWatchCardProps {
  entry: RateWatchEntry;
  onDragStart: (entry: RateWatchEntry) => void;
  onDragEnd: () => void;
  onEmail: () => void;
  onAIEmail: () => void;
  onPhone: () => void;
}

const RateWatchCard = ({ entry, onDragStart, onDragEnd, onEmail, onAIEmail, onPhone }: RateWatchCardProps) => {
  const rateStatus = entry.current_rate <= entry.target_rate;
  const rateDiff = (entry.current_rate - entry.target_rate).toFixed(3);
  
  return (
    <div 
      className={`p-4 rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
        rateStatus ? 'bg-green-50 border-green-200' : 'bg-card border-border'
      }`}
      draggable
      onDragStart={() => onDragStart(entry)}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-start gap-3">
        <GripVertical className="w-5 h-5 text-muted-foreground mt-1 shrink-0" />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold truncate">{entry.leads.name}</span>
            {entry.last_contacted_at && (
              <Badge variant="outline" className="text-xs shrink-0">
                Contacted
              </Badge>
            )}
          </div>
          
          {entry.leads.company_name && (
            <p className="text-sm text-muted-foreground truncate">{entry.leads.company_name}</p>
          )}
          
          <div className="flex flex-wrap gap-2 mt-2">
            {entry.loan_type && (
              <Badge variant="secondary" className="text-xs">{entry.loan_type}</Badge>
            )}
            {entry.loan_amount && (
              <Badge variant="outline" className="text-xs">
                ${entry.loan_amount.toLocaleString()}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-4 mt-3 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Current:</span>
              <span className="font-medium">{entry.current_rate}%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Target:</span>
              <span className="font-medium">{entry.target_rate}%</span>
            </div>
            {!rateStatus && (
              <div className="flex items-center gap-1 text-orange-600">
                <TrendingUp className="w-3 h-3" />
                <span className="text-xs">+{rateDiff}%</span>
              </div>
            )}
            {rateStatus && (
              <div className="flex items-center gap-1 text-green-600">
                <TrendingDown className="w-3 h-3" />
                <span className="text-xs font-medium">Target Met!</span>
              </div>
            )}
          </div>
          
          {entry.last_contacted_at && (
            <p className="text-xs text-muted-foreground mt-2">
              Last contacted: {format(new Date(entry.last_contacted_at), 'MMM d, yyyy')}
            </p>
          )}
        </div>
        
        <div className="flex flex-col gap-1 shrink-0">
          <Button size="icon" variant="ghost" onClick={onAIEmail} className="h-8 w-8" title="AI Generate Email">
            <Sparkles className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onEmail} className="h-8 w-8" title="Template Email">
            <Mail className="w-4 h-4" />
          </Button>
          {entry.leads.phone && (
            <Button size="icon" variant="ghost" onClick={onPhone} className="h-8 w-8" title="Call">
              <Phone className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RateWatch;
