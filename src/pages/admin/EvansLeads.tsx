import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Phone, Mail, Building2, Calendar, Edit, Trash2, Lock, User, Loader2, ChevronRight, X, Clock, Sparkles, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';
import AdminLayout from '@/components/admin/AdminLayout';

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
    <AdminLayout>
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
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 rounded-xl bg-white border-border/50 focus:border-foreground/20 transition-colors"
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
                            <span className="text-sm font-semibold text-foreground/70">
                              {lead.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-foreground truncate">{lead.name}</p>
                            {lead.company_name && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                                <Building2 className="w-3 h-3 flex-shrink-0" />
                                {lead.company_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {lead.phone && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <Phone className="w-3 h-3" />
                              {lead.phone}
                            </p>
                          )}
                          {lead.email && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                              <Mail className="w-3 h-3" />
                              {lead.email}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusConfig[lead.status].bg} ${statusConfig[lead.status].color}`}>
                            {statusConfig[lead.status].label}
                          </span>
                          {lead.questionnaire_completed_at && (
                            <FileText className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(lead.created_at), 'MMM d, yyyy')}
                        </p>
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
          <div className="w-[42%] min-w-[340px] flex flex-col preview-panel animate-slide-in-right">
            <div className="preview-panel-header flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-foreground/10 to-foreground/5 flex items-center justify-center">
                  <User className="w-5 h-5 text-foreground/70" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Lead Details</h3>
                  <p className="text-[11px] text-muted-foreground">Click fields to edit</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-lg hover:bg-muted/60" 
                onClick={() => setPreviewLead(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-5 space-y-5">
                {/* Name & Status */}
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{previewLead.name}</h2>
                  {previewLead.company_name && (
                    <p className="text-sm text-muted-foreground mt-0.5">{previewLead.company_name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${statusConfig[previewLead.status].bg} ${statusConfig[previewLead.status].color}`}>
                      <Sparkles className="w-3 h-3" />
                      {statusConfig[previewLead.status].label}
                    </span>
                    {previewLead.questionnaire_completed_at && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-emerald-50 text-emerald-600">
                        <FileText className="w-3 h-3" />
                        Questionnaire
                      </span>
                    )}
                  </div>
                </div>

                <div className="section-divider" />

                {/* Contact Info */}
                <div>
                  <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Contact Information</h4>
                  <div className="space-y-2">
                    {previewLead.phone && (
                      <a href={`tel:${previewLead.phone}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors group">
                        <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                          <Phone className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-foreground">{previewLead.phone}</p>
                          <p className="text-[11px] text-muted-foreground">Phone</p>
                        </div>
                      </a>
                    )}
                    {previewLead.email && (
                      <a href={`mailto:${previewLead.email}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors group">
                        <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                          <Mail className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-foreground">{previewLead.email}</p>
                          <p className="text-[11px] text-muted-foreground">Email</p>
                        </div>
                      </a>
                    )}
                  </div>
                </div>

                {/* Source */}
                {previewLead.source && (
                  <>
                    <div className="section-divider" />
                    <div>
                      <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Source</h4>
                      <p className="text-[13px] text-foreground">{previewLead.source}</p>
                    </div>
                  </>
                )}

                <div className="section-divider" />

                {/* Timeline */}
                <div>
                  <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Timeline</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-muted/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">Created</span>
                      </div>
                      <p className="text-[13px] font-medium text-foreground">
                        {format(new Date(previewLead.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">Updated</span>
                      </div>
                      <p className="text-[13px] font-medium text-foreground">
                        {format(new Date(previewLead.updated_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {previewLead.notes && (
                  <>
                    <div className="section-divider" />
                    <div>
                      <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Notes</h4>
                      <p className="text-[13px] text-foreground p-3 rounded-xl bg-muted/30 whitespace-pre-wrap">
                        {previewLead.notes}
                      </p>
                    </div>
                  </>
                )}

                <div className="section-divider" />

                {/* Status Select */}
                <div>
                  <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Status</h4>
                  <Select
                    value={previewLead.status}
                    onValueChange={(value) => {
                      handleStatusChange(previewLead.id, value as LeadStatus);
                      setPreviewLead({ ...previewLead, status: value as LeadStatus });
                    }}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="h-10 rounded-xl border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {(Object.keys(statusConfig) as LeadStatus[]).map((status) => (
                        <SelectItem key={status} value={status} className="rounded-lg">
                          {statusConfig[status].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Actions */}
                {canEdit && (
                  <div className="pt-2 space-y-2">
                    <Button 
                      variant="outline"
                      className="w-full h-11 rounded-xl shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]" 
                      onClick={() => handleEdit(previewLead)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      <span className="font-medium">Edit Lead</span>
                    </Button>
                    <Button 
                      variant="outline"
                      className="w-full h-11 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/5 transition-all duration-200 active:scale-[0.98]"
                      onClick={() => deleteMutation.mutate(previewLead.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      <span className="font-medium">Delete Lead</span>
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
      </div>
    </AdminLayout>
  );
};

export default EvansLeads;
