import { useEffect, useState } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useQuery } from '@tanstack/react-query';
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
import { Plus, Loader2, FileText, Phone, Mail, Building2, X, ChevronRight, User, Calendar, Clock, Sparkles, Users, PhoneIncoming, PhoneOutgoing, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import { format, formatDistanceToNow } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];
type TeamMember = Database['public']['Tables']['team_members']['Row'];

interface LeadWithOwner extends Lead {
  team_member?: TeamMember | null;
}

const statusConfig: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  initial_review: { label: 'Initial Review', color: 'text-blue-600', bg: 'bg-blue-50' },
  moving_to_underwriting: { label: 'Moving to UW', color: 'text-cyan-600', bg: 'bg-cyan-50' },
  onboarding: { label: 'Onboarding', color: 'text-amber-600', bg: 'bg-amber-50' },
  underwriting: { label: 'Underwriting', color: 'text-orange-600', bg: 'bg-orange-50' },
  ready_for_wu_approval: { label: 'Ready for Approval', color: 'text-purple-600', bg: 'bg-purple-50' },
  pre_approval_issued: { label: 'Pre-Approval Issued', color: 'text-violet-600', bg: 'bg-violet-50' },
  won: { label: 'Won', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  lost: { label: 'Lost', color: 'text-red-600', bg: 'bg-red-50' },
  discovery: { label: 'Discovery', color: 'text-blue-500', bg: 'bg-blue-50' },
  questionnaire: { label: 'Questionnaire', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  pre_qualification: { label: 'Pre-Qual', color: 'text-cyan-500', bg: 'bg-cyan-50' },
  document_collection: { label: 'Documents', color: 'text-amber-500', bg: 'bg-amber-50' },
  approval: { label: 'Approved', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  funded: { label: 'Funded', color: 'text-violet-500', bg: 'bg-violet-50' },
  review_kill_keep: { label: 'Review Kill/Keep', color: 'text-red-600', bg: 'bg-red-50' },
  waiting_on_needs_list: { label: 'Waiting Needs List', color: 'text-amber-600', bg: 'bg-amber-50' },
  waiting_on_client: { label: 'Waiting on Client', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  complete_files_for_review: { label: 'Complete Files', color: 'text-teal-600', bg: 'bg-teal-50' },
  need_structure_from_brad: { label: 'Need Structure', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  maura_underwriting: { label: 'UW Review', color: 'text-pink-600', bg: 'bg-pink-50' },
  brad_underwriting: { label: 'Senior UW', color: 'text-sky-600', bg: 'bg-sky-50' },
  need_structure: { label: 'Need Structure', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  underwriting_review: { label: 'UW Review', color: 'text-pink-600', bg: 'bg-pink-50' },
  senior_underwriting: { label: 'Senior UW', color: 'text-sky-600', bg: 'bg-sky-50' },
  uw_paused: { label: 'UW Paused', color: 'text-gray-600', bg: 'bg-gray-50' },
};

const AdminLeads = () => {
  const [leads, setLeads] = useState<LeadWithOwner[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
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

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Leads');
    return () => { setPageTitle(null); };
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('is_active', true)
        .not('name', 'ilike', 'adam')
        .not('name', 'ilike', 'ilan')
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

  // Fetch touchpoints for all leads
  const { data: touchpoints = {} } = useQuery({
    queryKey: ['admin-leads-touchpoints', leads.map(l => l.id)],
    queryFn: async () => {
      if (leads.length === 0) return {};
      
      const leadIds = leads.map(l => l.id);
      const { data, error } = await supabase
        .from('communications')
        .select('lead_id, communication_type, direction, created_at')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const touchpointMap: Record<string, { type: string; direction: string; date: string }> = {};
      (data || []).forEach((comm) => {
        if (comm.lead_id && !touchpointMap[comm.lead_id]) {
          touchpointMap[comm.lead_id] = {
            type: comm.communication_type,
            direction: comm.direction,
            date: comm.created_at,
          };
        }
      });
      
      return touchpointMap;
    },
    enabled: leads.length > 0,
  });

  const getTouchpointIcon = (type: string, direction: string) => {
    if (type === 'call') {
      return direction === 'inbound' 
        ? <PhoneIncoming className="w-3 h-3 text-green-600" />
        : <PhoneOutgoing className="w-3 h-3 text-blue-600" />;
    }
    if (type === 'email') {
      return <Mail className="w-3 h-3 text-purple-600" />;
    }
    if (type === 'sms') {
      return <MessageSquare className="w-3 h-3 text-cyan-600" />;
    }
    return <MessageSquare className="w-3 h-3 text-muted-foreground" />;
  };

  const getTouchpointLabel = (type: string, direction: string) => {
    if (type === 'call') {
      return direction === 'inbound' ? 'Inbound call' : 'Outbound call';
    }
    if (type === 'email') {
      return direction === 'inbound' ? 'Email received' : 'Email sent';
    }
    if (type === 'sms') {
      return direction === 'inbound' ? 'SMS received' : 'SMS sent';
    }
    return type;
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = !search || 
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.email?.toLowerCase().includes(search.toLowerCase()) ||
      lead.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      lead.phone?.toLowerCase().includes(search.toLowerCase());
    const matchesOwner = ownerFilter === 'all' || lead.assigned_to === ownerFilter;
    return matchesSearch && matchesOwner;
  });

  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<LeadStatus, number>);

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-112px)]">
        {/* Header Section */}
        <div className="flex items-start justify-end mb-6">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 px-4 rounded-xl bg-foreground text-background hover:bg-foreground/90 shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]">
                <Plus className="w-4 h-4 mr-2" strokeWidth={2} />
                <span className="font-medium">New Lead</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl border-border/50 shadow-2xl">
              <DialogHeader className="pb-2">
                <DialogTitle className="text-lg font-semibold">Create New Lead</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Add a new lead to your pipeline
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="name" className="text-[13px] font-medium">Name *</Label>
                  <Input
                    id="name"
                    value={newLead.name}
                    onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
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
                      value={newLead.email}
                      onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                      placeholder="john@company.com"
                      className="mt-1.5 h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-[13px] font-medium">Phone</Label>
                    <Input
                      id="phone"
                      value={newLead.phone}
                      onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
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
                      value={newLead.company_name}
                      onChange={(e) => setNewLead({ ...newLead, company_name: e.target.value })}
                      placeholder="Acme Corp"
                      className="mt-1.5 h-10 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label htmlFor="source" className="text-[13px] font-medium">Source</Label>
                    <Input
                      id="source"
                      value={newLead.source}
                      onChange={(e) => setNewLead({ ...newLead, source: e.target.value })}
                      placeholder="Website, Referral..."
                      className="mt-1.5 h-10 rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="notes" className="text-[13px] font-medium">Notes</Label>
                    <Textarea
                      id="notes"
                      value={newLead.notes}
                      onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                      placeholder="Additional notes..."
                      className="mt-1.5 rounded-xl resize-none"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="assigned_to" className="text-[13px] font-medium">Owner</Label>
                    <Select
                      value={newLead.assigned_to || teamMembers.find(m => m.name === 'Evan')?.id || ''}
                      onValueChange={(value) => setNewLead({ ...newLead, assigned_to: value })}
                    >
                      <SelectTrigger className="mt-1.5 h-10 rounded-xl">
                        <SelectValue placeholder="Select owner" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id} className="rounded-lg">
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2 pt-2">
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button onClick={handleCreateLead} disabled={isSubmitting} className="rounded-xl bg-foreground text-background hover:bg-foreground/90">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Lead
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

          {/* Owner Filter */}
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-40 h-9 rounded-xl">
              <Users className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by owner" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="rounded-lg">All Sales Reps</SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.id} className="rounded-lg">
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search */}
          <div className="flex-1 max-w-xs">
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-xl bg-white border-border/50 focus:border-foreground/20 transition-colors"
            />
          </div>
        </div>

        {/* Main Content - Split View */}
        <div className="flex-1 flex gap-5 min-h-0 animate-fade-in animation-delay-200">
          {/* Table Card */}
          <Card className={`flex-1 flex flex-col min-h-0 rounded-2xl border-border/50 shadow-sm overflow-hidden ${previewLead ? 'max-w-[58%]' : ''}`}>
            <ScrollArea className="flex-1">
              {loading ? (
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
                      <TableHead className="w-[180px]">Lead</TableHead>
                      <TableHead className="w-[130px]">Contact</TableHead>
                      <TableHead className="w-[140px]">Last Touchpoint</TableHead>
                      <TableHead className="w-[90px]">Owner</TableHead>
                      <TableHead className="w-[80px]">Status</TableHead>
                      <TableHead className="w-[90px]">Created</TableHead>
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
                        onDoubleClick={() => {
                          setSelectedLead(lead);
                          setIsDetailOpen(true);
                        }}
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
                          {touchpoints[lead.id] ? (
                            <div className="flex items-center gap-2">
                              {getTouchpointIcon(touchpoints[lead.id].type, touchpoints[lead.id].direction)}
                              <div className="min-w-0">
                                <p className="text-[11px] font-medium text-foreground truncate">
                                  {getTouchpointLabel(touchpoints[lead.id].type, touchpoints[lead.id].direction)}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(touchpoints[lead.id].date), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/50">No contact yet</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-[12px] font-medium text-foreground/80">
                            {lead.team_member?.name || '—'}
                          </span>
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

                  {/* Owner Select */}
                  <div>
                    <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Owner</h4>
                    <Select
                      value={previewLead.assigned_to || ''}
                      onValueChange={(value) => {
                        handleOwnerChange(previewLead.id, value);
                        const newOwner = teamMembers.find(m => m.id === value);
                        setPreviewLead({ ...previewLead, assigned_to: value, team_member: newOwner || null });
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl border-border/50">
                        <SelectValue placeholder="Select owner" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id} className="rounded-lg">
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Status Select */}
                  <div>
                    <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Status</h4>
                    <Select
                      value={previewLead.status}
                      onValueChange={(value) => {
                        handleStatusChange(previewLead.id, value as LeadStatus);
                        setPreviewLead({ ...previewLead, status: value as LeadStatus });
                      }}
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
                  <div className="pt-2">
                    <Button 
                      className="w-full h-11 rounded-xl bg-foreground text-background hover:bg-foreground/90 shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98]" 
                      onClick={() => {
                        setSelectedLead(previewLead);
                        setIsDetailOpen(true);
                      }}
                    >
                      <span className="font-medium">View Full Details</span>
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </div>
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
