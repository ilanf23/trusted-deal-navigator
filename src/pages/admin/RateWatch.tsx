import { useState } from 'react';
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
import { Sparkles } from 'lucide-react';
import { 
  TrendingDown, 
  TrendingUp, 
  Mail, 
  Phone, 
  Plus, 
  Search,
  GripVertical,
  AlertCircle,
  CheckCircle2,
  Clock
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
  const [prefilledEmail, setPrefilledEmail] = useState<PrefilledEmail | null>(null);
  const [draggedEntry, setDraggedEntry] = useState<RateWatchEntry | null>(null);
  
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
      openEmailForEntry(draggedEntry);
      setDraggedEntry(null);
    }
  };

  const openEmailForEntry = (entry: RateWatchEntry, useAI: boolean = false) => {
    if (useAI) {
      // Open inbox with lead context for AI generation
      const emailData: PrefilledEmail = {
        to: entry.leads.email || '',
        subject: '',
        body: '',
        leadId: entry.lead_id,
      };
      setPrefilledEmail(emailData);
      setInboxOpen(true);
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

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name, email, company, or loan type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
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
