import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, Loader2, FileText, Phone, Mail, Building2, Calendar, X, ChevronRight, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];
type TeamMember = Database['public']['Tables']['team_members']['Row'];

interface LeadWithOwner extends Lead {
  team_member?: TeamMember | null;
}

const statusColors: Record<LeadStatus, string> = {
  discovery: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  pre_qualification: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  document_collection: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
  underwriting: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  approval: 'bg-green-500/10 text-green-600 border-green-500/20',
  funded: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

const statusLabels: Record<LeadStatus, string> = {
  discovery: 'Discovery',
  pre_qualification: 'Pre-Qual',
  document_collection: 'Docs',
  underwriting: 'UW',
  approval: 'Approval',
  funded: 'Funded',
};

const AdminLeads = () => {
  const [leads, setLeads] = useState<LeadWithOwner[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadWithOwner | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [previewLead, setPreviewLead] = useState<LeadWithOwner | null>(null);
  const { toast } = useToast();

  const [newLead, setNewLead] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    source: '',
    notes: '',
    assigned_to: '',
  });

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const fetchLeads = async () => {
    try {
      let query = supabase
        .from('leads')
        .select('*, team_member:team_members(id, name, email, role)')
        .order('created_at', { ascending: false });
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as LeadStatus);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setLeads((data as LeadWithOwner[]) || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({ title: 'Error', description: 'Failed to fetch leads', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [statusFilter]);

  const handleCreateLead = async () => {
    if (!newLead.name) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Get default owner (Evan) if none selected
      const assignedTo = newLead.assigned_to || teamMembers.find(m => m.name === 'Evan')?.id || teamMembers[0]?.id || null;
      
      const { error } = await supabase.from('leads').insert({
        name: newLead.name,
        email: newLead.email || null,
        phone: newLead.phone || null,
        company_name: newLead.company_name || null,
        source: newLead.source || null,
        notes: newLead.notes || null,
        assigned_to: assignedTo,
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Lead created successfully' });
      setIsCreateOpen(false);
      setNewLead({ name: '', email: '', phone: '', company_name: '', source: '', notes: '', assigned_to: '' });
      fetchLeads();
    } catch (error) {
      console.error('Error creating lead:', error);
      toast({ title: 'Error', description: 'Failed to create lead', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOwnerChange = async (leadId: string, newOwnerId: string) => {
    try {
      const { error } = await supabase.from('leads').update({ assigned_to: newOwnerId }).eq('id', leadId);
      
      if (error) throw error;
      
      toast({ title: 'Success', description: 'Lead owner updated' });
      fetchLeads();
    } catch (error) {
      console.error('Error updating lead owner:', error);
      toast({ title: 'Error', description: 'Failed to update owner', variant: 'destructive' });
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const updateData: Partial<Lead> = { status: newStatus };
      
      if (newStatus === 'approval') {
        updateData.qualified_at = new Date().toISOString();
      }

      const { error } = await supabase.from('leads').update(updateData).eq('id', leadId);
      
      if (error) throw error;
      
      toast({ title: 'Success', description: 'Lead status updated' });
      fetchLeads();
    } catch (error) {
      console.error('Error updating lead:', error);
      toast({ title: 'Error', description: 'Failed to update lead', variant: 'destructive' });
    }
  };

  const filteredLeads = leads.filter((lead) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      lead.name.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      lead.company_name?.toLowerCase().includes(searchLower) ||
      lead.phone?.toLowerCase().includes(searchLower)
    );
  });

  // Calculate status counts
  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<LeadStatus, number>);

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-80px)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Leads</h1>
            <p className="text-sm text-muted-foreground">{leads.length} total leads</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
                <DialogDescription>Enter the lead's information</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={newLead.name}
                    onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newLead.email}
                      onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                      placeholder="john@company.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newLead.phone}
                      onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={newLead.company_name}
                      onChange={(e) => setNewLead({ ...newLead, company_name: e.target.value })}
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div>
                    <Label htmlFor="source">Source</Label>
                    <Input
                      id="source"
                      value={newLead.source}
                      onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                      placeholder="Website, Referral..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={newLead.notes}
                      onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                      placeholder="Additional notes..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="assigned_to">Owner</Label>
                    <Select
                      value={newLead.assigned_to || teamMembers.find(m => m.name === 'Evan')?.id || ''}
                      onValueChange={(value) => setNewLead({ ...newLead, assigned_to: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select owner" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateLead} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Lead
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Status Pills */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
            className="h-7 text-xs"
          >
            All ({leads.length})
          </Button>
          {(Object.keys(statusLabels) as LeadStatus[]).map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(status)}
              className="h-7 text-xs"
            >
              {statusLabels[status]} ({statusCounts[status] || 0})
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search by name, email, company, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-9"
          />
        </div>

        {/* Main Content - Split View */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Table */}
          <Card className={`flex-1 flex flex-col min-h-0 ${previewLead ? 'max-w-[60%]' : ''}`}>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No leads found.
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow className="text-xs">
                      <TableHead className="w-[180px] py-2">Name / Company</TableHead>
                      <TableHead className="w-[140px] py-2">Contact</TableHead>
                      <TableHead className="w-[70px] py-2">Owner</TableHead>
                      <TableHead className="w-[80px] py-2">Source</TableHead>
                      <TableHead className="w-[80px] py-2">Status</TableHead>
                      <TableHead className="w-[80px] py-2">Created</TableHead>
                      <TableHead className="w-[36px] py-2"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => (
                      <TableRow 
                        key={lead.id} 
                        className={`cursor-pointer text-xs ${previewLead?.id === lead.id ? 'bg-accent' : 'hover:bg-muted/50'}`}
                        onClick={() => setPreviewLead(lead)}
                        onDoubleClick={() => {
                          setSelectedLead(lead);
                          setIsDetailOpen(true);
                        }}
                      >
                        <TableCell className="py-2">
                          <div className="flex flex-col">
                            <span className="font-medium truncate">{lead.name}</span>
                            {lead.company_name && (
                              <span className="text-muted-foreground text-[11px] flex items-center gap-1 truncate">
                                <Building2 className="w-3 h-3" />
                                {lead.company_name}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex flex-col gap-0.5">
                            {lead.phone && (
                              <span className="text-muted-foreground text-[11px] flex items-center gap-1 truncate">
                                <Phone className="w-3 h-3" />
                                {lead.phone}
                              </span>
                            )}
                            {lead.email && (
                              <span className="text-muted-foreground text-[11px] flex items-center gap-1 truncate">
                                <Mail className="w-3 h-3" />
                                {lead.email}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="text-[11px] font-medium text-primary">
                            {lead.team_member?.name || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          {lead.source && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {lead.source}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-1">
                            <Badge className={`text-[10px] px-1.5 py-0 ${statusColors[lead.status]}`}>
                              {statusLabels[lead.status]}
                            </Badge>
                            {lead.questionnaire_completed_at && (
                              <FileText className="w-3 h-3 text-green-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-muted-foreground text-[11px]">
                          {format(new Date(lead.created_at), 'MMM d, yy')}
                        </TableCell>
                        <TableCell className="py-2">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
            <Card className="w-[40%] min-w-[320px] flex flex-col">
              <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Lead Details
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewLead(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <ScrollArea className="flex-1">
                <CardContent className="space-y-4">
                  {/* Name & Status */}
                  <div>
                    <h3 className="font-semibold text-lg">{previewLead.name}</h3>
                    {previewLead.company_name && (
                      <p className="text-sm text-muted-foreground">{previewLead.company_name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={statusColors[previewLead.status]}>
                        {statusLabels[previewLead.status]}
                      </Badge>
                      {previewLead.questionnaire_completed_at && (
                        <Badge variant="outline" className="text-green-600 border-green-500/20">
                          <FileText className="w-3 h-3 mr-1" />
                          Questionnaire
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Contact</h4>
                    {previewLead.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <a href={`tel:${previewLead.phone}`} className="hover:underline">{previewLead.phone}</a>
                      </div>
                    )}
                    {previewLead.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <a href={`mailto:${previewLead.email}`} className="hover:underline">{previewLead.email}</a>
                      </div>
                    )}
                  </div>

                  {/* Source */}
                  {previewLead.source && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Source</h4>
                      <p className="text-sm">{previewLead.source}</p>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Timeline</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-muted-foreground">Created</p>
                        <p className="font-medium">{format(new Date(previewLead.created_at), 'MMM d, yyyy')}</p>
                      </div>
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-muted-foreground">Updated</p>
                        <p className="font-medium">{format(new Date(previewLead.updated_at), 'MMM d, yyyy')}</p>
                      </div>
                      {previewLead.qualified_at && (
                        <div className="bg-muted/50 rounded p-2">
                          <p className="text-muted-foreground">Qualified</p>
                          <p className="font-medium">{format(new Date(previewLead.qualified_at), 'MMM d, yyyy')}</p>
                        </div>
                      )}
                      {previewLead.questionnaire_sent_at && (
                        <div className="bg-muted/50 rounded p-2">
                          <p className="text-muted-foreground">Quest. Sent</p>
                          <p className="font-medium">{format(new Date(previewLead.questionnaire_sent_at), 'MMM d, yyyy')}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {previewLead.notes && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Notes</h4>
                      <p className="text-sm bg-muted/50 rounded p-2 whitespace-pre-wrap">{previewLead.notes}</p>
                    </div>
                  )}

                  {/* Owner */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Owner</h4>
                    <Select
                      value={previewLead.assigned_to || ''}
                      onValueChange={(value) => {
                        handleOwnerChange(previewLead.id, value);
                        const newOwner = teamMembers.find(m => m.id === value);
                        setPreviewLead({ ...previewLead, assigned_to: value, team_member: newOwner || null });
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select owner" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status Change */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Change Status</h4>
                    <Select
                      value={previewLead.status}
                      onValueChange={(value) => {
                        handleStatusChange(previewLead.id, value as LeadStatus);
                        setPreviewLead({ ...previewLead, status: value as LeadStatus });
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="discovery">Discovery</SelectItem>
                        <SelectItem value="pre_qualification">Pre-Qualification</SelectItem>
                        <SelectItem value="document_collection">Document Collection</SelectItem>
                        <SelectItem value="underwriting">Underwriting</SelectItem>
                        <SelectItem value="approval">Approval</SelectItem>
                        <SelectItem value="funded">Funded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Actions */}
                  <div className="pt-2">
                    <Button 
                      className="w-full" 
                      size="sm"
                      onClick={() => {
                        setSelectedLead(previewLead);
                        setIsDetailOpen(true);
                      }}
                    >
                      Open Full Details
                    </Button>
                  </div>
                </CardContent>
              </ScrollArea>
            </Card>
          )}
        </div>

        <LeadDetailDialog
          lead={selectedLead}
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          onLeadUpdated={fetchLeads}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminLeads;
