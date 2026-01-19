import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Phone, Mail, Building2, Calendar, Edit, Trash2, Lock, User, Loader2, ChevronRight, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

const statusConfig: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  discovery: { label: 'Discovery', color: 'text-blue-600', bg: 'bg-blue-50' },
  pre_qualification: { label: 'Pre-Qual', color: 'text-cyan-600', bg: 'bg-cyan-50' },
  document_collection: { label: 'Documents', color: 'text-amber-600', bg: 'bg-amber-50' },
  underwriting: { label: 'Underwriting', color: 'text-orange-600', bg: 'bg-orange-50' },
  approval: { label: 'Approved', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  funded: { label: 'Funded', color: 'text-violet-600', bg: 'bg-violet-50' },
};

const EvansLeads = () => {
  const queryClient = useQueryClient();
  const { teamMember, isOwner } = useTeamMember();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [previewLead, setPreviewLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    source: '',
    status: 'discovery' as LeadStatus,
    notes: '',
  });

  // Get Evan's team member ID
  const { data: evanTeamMember } = useQuery({
    queryKey: ['evan-team-member'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id')
        .ilike('name', 'evan')
        .single();
      if (error) throw error;
      return data;
    },
  });

  const evanId = evanTeamMember?.id;

  // Check if current user can edit (is Evan or is owner/super admin)
  const canEdit = isOwner || teamMember?.name?.toLowerCase() === 'evan';

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['evans-leads', evanId],
    queryFn: async () => {
      if (!evanId) return [];
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('assigned_to', evanId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
    enabled: !!evanId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!evanId) throw new Error('Evan team member not found');
      const { error } = await supabase.from('leads').insert([{ ...data, assigned_to: evanId }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead created successfully');
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: () => toast.error('Failed to create lead'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      if (!canEdit) throw new Error('Not authorized to edit this lead');
      const { error } = await supabase.from('leads').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead updated successfully');
      setEditingLead(null);
      resetForm();
    },
    onError: () => toast.error('Failed to update lead'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!canEdit) throw new Error('Not authorized to delete this lead');
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead deleted successfully');
      setPreviewLead(null);
    },
    onError: () => toast.error('Failed to delete lead'),
  });

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const updateData: Partial<Lead> = { status: newStatus };
      if (newStatus === 'approval') {
        updateData.qualified_at = new Date().toISOString();
      }
      const { error } = await supabase.from('leads').update(updateData).eq('id', leadId);
      if (error) throw error;
      toast.success('Lead status updated');
      queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    } catch (error) {
      toast.error('Failed to update lead');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      company_name: '',
      source: '',
      status: 'discovery',
      notes: '',
    });
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone || '',
      company_name: lead.company_name || '',
      source: lead.source || '',
      status: lead.status,
      notes: lead.notes || '',
    });
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<LeadStatus, number>);

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Header Section */}
      <div className="flex items-start justify-between mb-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {leads.length} total leads · {filteredLeads.length} showing
          </p>
          {!canEdit && (
            <Badge variant="outline" className="mt-2 gap-1">
              <Lock className="h-3 w-3" />
              View Only
            </Badge>
          )}
        </div>
        
        <Dialog open={isAddDialogOpen || !!editingLead} onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingLead(null);
            resetForm();
          }
        }}>
          {canEdit && (
            <DialogTrigger asChild>
              <Button onClick={() => setIsAddDialogOpen(true)} className="h-10 px-4 rounded-xl bg-foreground text-background hover:bg-foreground/90 shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]">
                <Plus className="w-4 h-4 mr-2" strokeWidth={2} />
                <span className="font-medium">New Lead</span>
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="sm:max-w-md rounded-2xl border-border/50 shadow-2xl">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-lg font-semibold">{editingLead ? 'Edit Lead' : 'Create New Lead'}</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {editingLead ? 'Update lead information' : 'Add a new lead to your pipeline'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="name" className="text-[13px] font-medium">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  className="mt-1.5 h-10 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="email" className="text-[13px] font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@company.com"
                    className="mt-1.5 h-10 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-[13px] font-medium">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    className="mt-1.5 h-10 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="company" className="text-[13px] font-medium">Company</Label>
                  <Input
                    id="company"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Acme Corp"
                    className="mt-1.5 h-10 rounded-xl"
                  />
                </div>
                <div>
                  <Label htmlFor="source" className="text-[13px] font-medium">Source</Label>
                  <Input
                    id="source"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    placeholder="Website, Referral..."
                    className="mt-1.5 h-10 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="status" className="text-[13px] font-medium">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as LeadStatus })}
                  >
                    <SelectTrigger className="mt-1.5 h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {Object.entries(statusConfig).map(([key, { label }]) => (
                        <SelectItem key={key} value={key} className="rounded-lg">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="notes" className="text-[13px] font-medium">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    className="mt-1.5 rounded-xl resize-none"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button variant="ghost" onClick={() => {
                setIsAddDialogOpen(false);
                setEditingLead(null);
                resetForm();
              }} className="rounded-xl">
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} className="rounded-xl bg-foreground text-background hover:bg-foreground/90">
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editingLead ? 'Update' : 'Create'} Lead
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-4 mb-5 animate-fade-in animation-delay-100">
        {/* Status Pills */}
        <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-all duration-200 ${
              statusFilter === 'all'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({leads.length})
          </button>
          {(Object.keys(statusConfig) as LeadStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-all duration-200 ${
                statusFilter === status
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {statusConfig[status].label} ({statusCounts[status] || 0})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
          <Input
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9 rounded-xl bg-white border-border/50 focus:border-foreground/20 transition-colors"
          />
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex gap-5 min-h-0 animate-fade-in animation-delay-200">
        {/* Table Card */}
        <Card className={`flex-1 flex flex-col min-h-0 rounded-2xl border-border/50 shadow-sm overflow-hidden ${previewLead ? 'max-w-[58%]' : ''}`}>
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading leads...</p>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-2">
                  <User className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No leads found</p>
                <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="w-[200px]">Lead</TableHead>
                    <TableHead className="w-[150px]">Contact</TableHead>
                    <TableHead className="w-[90px]">Status</TableHead>
                    <TableHead className="w-[100px]">Created</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead, index) => (
                    <TableRow 
                      key={lead.id} 
                      className={`
                        cursor-pointer transition-colors border-border/30
                        ${previewLead?.id === lead.id 
                          ? 'bg-accent/5 border-l-2 border-l-foreground' 
                          : 'hover:bg-muted/40'
                        }
                      `}
                      style={{ animationDelay: `${index * 30}ms` }}
                      onClick={() => setPreviewLead(lead)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-semibold text-muted-foreground">
                              {lead.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{lead.name}</p>
                            {lead.company_name && (
                              <p className="text-xs text-muted-foreground truncate">{lead.company_name}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {lead.email && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              <span className="truncate">{lead.email}</span>
                            </div>
                          )}
                          {lead.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              <span>{lead.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${statusConfig[lead.status].bg} ${statusConfig[lead.status].color}`}>
                          {statusConfig[lead.status].label}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(lead.created_at), 'MMM d')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </Card>

        {/* Preview Panel */}
        {previewLead && (
          <Card className="w-[42%] flex flex-col rounded-2xl border-border/50 shadow-sm overflow-hidden animate-fade-in">
            <div className="p-5 border-b border-border/50">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                    <span className="text-lg font-semibold text-muted-foreground">
                      {previewLead.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{previewLead.name}</h3>
                    {previewLead.company_name && (
                      <p className="text-sm text-muted-foreground">{previewLead.company_name}</p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-xl -mr-2 -mt-2" onClick={() => setPreviewLead(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-5">
              <div className="space-y-6">
                {/* Status */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Status</p>
                  <Select
                    value={previewLead.status}
                    onValueChange={(value) => handleStatusChange(previewLead.id, value as LeadStatus)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="h-9 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {Object.entries(statusConfig).map(([key, { label }]) => (
                        <SelectItem key={key} value={key} className="rounded-lg">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Contact Info */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Contact</p>
                  <div className="space-y-2">
                    {previewLead.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{previewLead.email}</span>
                      </div>
                    )}
                    {previewLead.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{previewLead.phone}</span>
                      </div>
                    )}
                    {previewLead.company_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span>{previewLead.company_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Source */}
                {previewLead.source && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Source</p>
                    <Badge variant="secondary">{previewLead.source}</Badge>
                  </div>
                )}

                {/* Notes */}
                {previewLead.notes && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Notes</p>
                    <p className="text-sm text-muted-foreground">{previewLead.notes}</p>
                  </div>
                )}

                {/* Dates */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Timeline</p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      <span>Created {format(new Date(previewLead.created_at), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      <span>Updated {format(new Date(previewLead.updated_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Actions */}
            {canEdit && (
              <div className="p-4 border-t border-border/50 flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => handleEdit(previewLead)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button 
                  variant="outline" 
                  className="rounded-xl text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(previewLead.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default EvansLeads;
