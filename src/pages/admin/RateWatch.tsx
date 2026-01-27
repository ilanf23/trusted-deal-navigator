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
import AIEmailAssistantSheet from '@/components/admin/AIEmailAssistantSheet';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import * as XLSX from 'xlsx';
import { 
  DndContext, 
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
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
  FileSpreadsheet,
  MapPin,
  Building2,
  Calendar,
  DollarSign,
  ClipboardList,
  Copy,
  ExternalLink
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
  // New fields
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

type ColumnId = 'ready' | 'watching';

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Lead detail dialog state
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<RateWatchEntry['leads'] | null>(null);
  const [leadDetailOpen, setLeadDetailOpen] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  
  
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
            company_name,
            status,
            source,
            notes,
            assigned_to,
            created_at,
            updated_at,
            questionnaire_sent_at,
            questionnaire_completed_at,
            known_as,
            title,
            contact_type,
            tags,
            about,
            website,
            linkedin,
            twitter
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

  // Helper to get which column an entry belongs to
  const getEntryColumn = (entry: RateWatchEntry): ColumnId => {
    // status_override takes precedence over auto-calculation
    if (entry.status_override === 'ready') return 'ready';
    if (entry.status_override === 'watching') return 'watching';
    // Auto-calculate based on rates
    return entry.current_rate <= entry.target_rate ? 'ready' : 'watching';
  };

  // Separate entries by status (including override)
  const readyEntries = filteredEntries.filter(e => getEntryColumn(e) === 'ready');
  const alertEntries = filteredEntries.filter(e => getEntryColumn(e) === 'watching');

  // Get active entry for overlay
  const activeEntry = activeId ? rateWatchEntries.find(e => e.id === activeId) : null;

  // Update status override mutation
  const updateStatusOverride = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string | null }) => {
      const { error } = await supabase
        .from('rate_watch')
        .update({ status_override: status })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-watch'] });
    }
  });

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const entryId = active.id as string;
    const entry = rateWatchEntries.find(e => e.id === entryId);
    if (!entry) return;

    const overId = over.id as string;

    // Handle drop on email zone
    if (overId === 'email-zone') {
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
      setPrefilledEmail({
        to: entry.leads.email || '',
        subject: '',
        body: '',
        leadId: entry.lead_id,
      });
      setAiAssistantOpen(true);
      setInboxOpen(true);
      updateLastContacted.mutate(entry.id);
      return;
    }

    // Handle drop on columns
    if (overId === 'ready' || overId === 'watching') {
      const currentColumn = getEntryColumn(entry);
      if (currentColumn !== overId) {
        // Update the status_override in the database
        updateStatusOverride.mutate({ id: entryId, status: overId });
        toast({ title: `Moved to ${overId === 'ready' ? 'Ready to Contact' : 'Watching'}` });
      }
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
            
            {/* Copy Questionnaire Link Button */}
            <Button variant="outline" className="gap-2" onClick={copyQuestionnaireLink}>
              <Copy className="w-4 h-4" />
              Copy Questionnaire Link
            </Button>
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

        {/* DnD Context wrapping all draggable/droppable areas */}
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Email Drop Zone */}
          <EmailDropZone isActive={!!activeId} />

          {/* Rate Watch Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ready to Contact */}
            <DroppableColumn 
              id="ready" 
              title="Ready to Contact" 
              count={readyEntries.length}
              isReady={true}
            >
              {readyEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No leads have reached their target rate yet
                </p>
              ) : (
                readyEntries.map(entry => (
                  <DraggableRateWatchCard 
                    key={entry.id} 
                    entry={entry} 
                    onClick={() => {
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
                  />
                ))
              )}
            </DroppableColumn>

            {/* Watching */}
            <DroppableColumn 
              id="watching" 
              title="Watching" 
              count={alertEntries.length}
              isReady={false}
            >
              {alertEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  All leads have reached their target rate!
                </p>
              ) : (
                alertEntries.map(entry => (
                  <DraggableRateWatchCard 
                    key={entry.id} 
                    entry={entry} 
                    onClick={() => {
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
                  />
                ))
              )}
            </DroppableColumn>
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeEntry ? (
              <div className="opacity-90">
                <RateWatchCardContent entry={activeEntry} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Floating Inbox */}
        <FloatingInbox 
          isOpen={inboxOpen} 
          onClose={() => setInboxOpen(false)}
          prefilledEmail={prefilledEmail}
          onPrefilledEmailHandled={() => setPrefilledEmail(null)}
        />

        {/* AI Email Assistant - Right Side Sheet */}
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

// Email Drop Zone Component
const EmailDropZone = ({ isActive }: { isActive: boolean }) => {
  const { setNodeRef, isOver } = useDroppable({ id: 'email-zone' });
  
  return (
    <Card 
      ref={setNodeRef}
      className={`border-2 border-dashed transition-all ${
        isOver 
          ? 'border-primary bg-primary/10 scale-[1.02]' 
          : isActive
            ? 'border-primary/50 bg-primary/5'
            : 'border-muted-foreground/20'
      }`}
    >
      <CardContent className="py-8 text-center">
        <Mail className={`w-10 h-10 mx-auto mb-2 ${isOver || isActive ? 'text-primary' : 'text-muted-foreground'}`} />
        <p className={`font-medium ${isOver || isActive ? 'text-primary' : 'text-muted-foreground'}`}>
          {isOver ? 'Drop here to compose email' : isActive ? 'Drag here to send an email' : 'Drag a lead here to send an email'}
        </p>
      </CardContent>
    </Card>
  );
};

// Droppable Column Component
interface DroppableColumnProps {
  id: ColumnId;
  title: string;
  count: number;
  isReady: boolean;
  children: React.ReactNode;
}

const DroppableColumn = ({ id, title, count, isReady, children }: DroppableColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <Card className={`transition-all ${
      isReady ? 'border-green-200' : ''
    } ${isOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
      <CardHeader className={`border-b ${isReady ? 'bg-green-50 border-green-200' : 'bg-muted'}`}>
        <CardTitle className={`flex items-center gap-2 ${isReady ? 'text-green-700' : ''}`}>
          {isReady ? <CheckCircle2 className="w-5 h-5" /> : <TrendingDown className="w-5 h-5 text-muted-foreground" />}
          {title} ({count})
        </CardTitle>
      </CardHeader>
      <CardContent ref={setNodeRef} className="p-4 space-y-3 max-h-[600px] overflow-y-auto min-h-[200px]">
        {children}
      </CardContent>
    </Card>
  );
};

// Draggable Rate Watch Card
interface DraggableRateWatchCardProps {
  entry: RateWatchEntry;
  onClick: () => void;
  onEmail: () => void;
  onAIEmail: () => void;
  onPhone: () => void;
}

const DraggableRateWatchCard = ({ entry, onClick, onEmail, onAIEmail, onPhone }: DraggableRateWatchCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: entry.id });
  
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <RateWatchCardContent 
        entry={entry} 
        dragHandleProps={{ ...attributes, ...listeners }}
        onClick={onClick}
        onEmail={onEmail}
        onAIEmail={onAIEmail}
        onPhone={onPhone}
      />
    </div>
  );
};

// Rate Watch Card Content Component
interface RateWatchCardContentProps {
  entry: RateWatchEntry;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  onClick?: () => void;
  onEmail?: () => void;
  onAIEmail?: () => void;
  onPhone?: () => void;
}

const RateWatchCardContent = ({ entry, dragHandleProps, onClick, onEmail, onAIEmail, onPhone }: RateWatchCardContentProps) => {
  const rateStatus = entry.current_rate <= entry.target_rate;
  const rateDiff = (entry.current_rate - entry.target_rate).toFixed(3);
  
  const handleClick = (e: React.MouseEvent) => {
    // Only trigger onClick if not clicking on buttons or drag handle
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-drag-handle]')) {
      return;
    }
    onClick?.();
  };
  
  return (
    <div 
      className={`p-4 rounded-lg border-2 transition-all hover:shadow-md cursor-pointer ${
        rateStatus ? 'bg-green-50 border-green-200' : 'bg-card border-border'
      }`}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3">
        <div 
          data-drag-handle
          className="cursor-grab active:cursor-grabbing touch-none"
          {...dragHandleProps}
        >
          <GripVertical className="w-5 h-5 text-muted-foreground mt-1 shrink-0" />
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold truncate">{entry.leads.name}</span>
            {entry.confirm_email && (
              <Badge variant="default" className="text-xs shrink-0 bg-green-600">
                Email ✓
              </Badge>
            )}
            {entry.last_contacted_at && (
              <Badge variant="outline" className="text-xs shrink-0">
                Contacted
              </Badge>
            )}
          </div>
          
          {/* Company and location */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {entry.leads.company_name && (
              <span className="flex items-center gap-1 truncate">
                <Building2 className="w-3 h-3" />
                {entry.leads.company_name}
              </span>
            )}
            {entry.re_location && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3" />
                {entry.re_location}
              </span>
            )}
          </div>
          
          {/* Badges row */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {entry.loan_type && (
              <Badge variant="secondary" className="text-xs">{entry.loan_type}</Badge>
            )}
            {entry.collateral_type && (
              <Badge variant="outline" className="text-xs">{entry.collateral_type}</Badge>
            )}
            {entry.lender_type && (
              <Badge variant="outline" className="text-xs">{entry.lender_type}</Badge>
            )}
            {entry.rate_type && (
              <Badge variant="outline" className="text-xs">{entry.rate_type}</Badge>
            )}
          </div>
          
          {/* Financial info */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-sm">
            <div className="flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Loan:</span>
              <span className="font-medium">
                {entry.loan_amount ? `$${entry.loan_amount.toLocaleString()}` : '-'}
              </span>
            </div>
            {entry.collateral_value && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Collateral:</span>
                <span className="font-medium">${entry.collateral_value.toLocaleString()}</span>
              </div>
            )}
          </div>
          
          {/* Rates */}
          <div className="flex items-center gap-4 mt-2 text-sm">
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
          
          {/* Maturity and term */}
          {(entry.loan_maturity || entry.original_term_years) && (
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              {entry.loan_maturity && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Maturity: {format(new Date(entry.loan_maturity), 'MMM yyyy')}
                </span>
              )}
              {entry.original_term_years && (
                <span>Term: {entry.original_term_years} yrs</span>
              )}
              {entry.amortization && (
                <span>Amort: {entry.amortization}</span>
              )}
            </div>
          )}
          
          {/* Seeking to improve */}
          {entry.seeking_to_improve && (
            <p className="text-xs text-muted-foreground mt-2 italic line-clamp-1">
              Seeking: {entry.seeking_to_improve}
            </p>
          )}
          
          {entry.last_contacted_at && (
            <p className="text-xs text-muted-foreground mt-2">
              Last contacted: {format(new Date(entry.last_contacted_at), 'MMM d, yyyy')}
            </p>
          )}
        </div>
        
        {(onAIEmail || onEmail || onPhone) && (
          <div className="flex flex-col gap-1 shrink-0">
            {onAIEmail && (
              <Button size="icon" variant="ghost" onClick={onAIEmail} className="h-8 w-8" title="AI Generate Email">
                <Sparkles className="w-4 h-4" />
              </Button>
            )}
            {onEmail && (
              <Button size="icon" variant="ghost" onClick={onEmail} className="h-8 w-8" title="Template Email">
                <Mail className="w-4 h-4" />
              </Button>
            )}
            {onPhone && entry.leads.phone && (
              <Button size="icon" variant="ghost" onClick={onPhone} className="h-8 w-8" title="Call">
                <Phone className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RateWatch;
