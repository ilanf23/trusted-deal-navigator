import { useState, useEffect, useCallback } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Phone, Mail, Building2, Calendar, Edit, Trash2, User, Loader2, ChevronRight, ChevronDown, X, Clock, Sparkles, FileText, PhoneCall, PhoneIncoming, PhoneOutgoing, Play, MessageSquare, Kanban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useUndo } from '@/contexts/UndoContext';
import EvanLayout from '@/components/evan/EvanLayout';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import ResizableColumnHeader from '@/components/admin/ResizableColumnHeader';

type Communication = Database['public']['Tables']['communications']['Row'];

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

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
  maura_underwriting: { label: 'Maura UW', color: 'text-pink-600', bg: 'bg-pink-50' },
  brad_underwriting: { label: 'Brad UW', color: 'text-sky-600', bg: 'bg-sky-50' },
  need_structure: { label: 'Need Structure', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  underwriting_review: { label: 'UW Review', color: 'text-pink-600', bg: 'bg-pink-50' },
  senior_underwriting: { label: 'Senior UW', color: 'text-sky-600', bg: 'bg-sky-50' },
  uw_paused: { label: 'UW Paused', color: 'text-gray-600', bg: 'bg-gray-50' },
};

const DEFAULT_EL_COL_WIDTHS: Record<string, number> = { lead: 180, contact: 130, touchpoint: 140, status: 100, created: 90 };

const EmployeeLeads = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { teamMember, isOwner } = useTeamMember();
  const { registerUndo } = useUndo();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [previewLead, setPreviewLead] = useState<Lead | null>(null);
  const [detailDialogLead, setDetailDialogLead] = useState<Lead | null>(null);
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    source: '',
    status: 'discovery' as LeadStatus,
    notes: '',
  });
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('employee-leads-column-widths');
      if (saved) return { ...DEFAULT_EL_COL_WIDTHS, ...JSON.parse(saved) };
    } catch { /* ignore corrupt localStorage */ }
    return DEFAULT_EL_COL_WIDTHS;
  });
  const handleColumnResize = useCallback((columnId: string, newWidth: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [columnId]: newWidth };
      localStorage.setItem('employee-leads-column-widths', JSON.stringify(next));
      return next;
    });
  }, []);

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Leads');
    return () => { setPageTitle(null); };
  }, []);

  // Fetch communications for selected lead
  const { data: communications = [] } = useQuery({
    queryKey: ['lead-communications', previewLead?.id],
    queryFn: async () => {
      if (!previewLead?.id) return [];
      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .eq('lead_id', previewLead.id)
        .eq('communication_type', 'call')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Communication[];
    },
    enabled: !!previewLead?.id,
  });

  const toggleTranscript = (commId: string) => {
    setExpandedTranscripts(prev => {
      const next = new Set(prev);
      if (next.has(commId)) {
        next.delete(commId);
      } else {
        next.add(commId);
      }
      return next;
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'Unknown duration';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTranscript = (transcript: string | null) => {
    if (!transcript) return null;
    return transcript.split('\n').map((line, index) => {
      const isAgent = line.toLowerCase().startsWith('agent:');
      const isCaller = line.toLowerCase().startsWith('caller:');
      return (
        <p key={index} className={`text-[13px] py-1 ${isAgent ? 'text-blue-600' : isCaller ? 'text-foreground' : 'text-muted-foreground'}`}>
          {line}
        </p>
      );
    });
  };

  const evanId = teamMember?.id;

  // Check if current user can edit
  const canEdit = isOwner || !!teamMember;

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

  // Fetch last touchpoint for each lead
  const { data: touchpoints = {} } = useQuery({
    queryKey: ['evans-leads-touchpoints', leads.map(l => l.id)],
    queryFn: async () => {
      if (leads.length === 0) return {};
      
      // Get the most recent communication for each lead
      const leadIds = leads.map(l => l.id);
      const { data, error } = await supabase
        .from('communications')
        .select('lead_id, communication_type, direction, created_at')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Group by lead_id and take the most recent
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
      
      // Get lead data before deleting (for undo)
      const { data: leadToDelete } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();
      
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
      
      return leadToDelete;
    },
    onSuccess: (deletedLead) => {
      queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead deleted successfully');
      setPreviewLead(null);
      
      // Register undo for lead deletion
      if (deletedLead) {
        registerUndo({
          label: `Deleted ${deletedLead.name}`,
          execute: async () => {
            const { error } = await supabase.from('leads').insert({
              ...deletedLead,
              updated_at: new Date().toISOString(),
            });
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
            toast.success('Lead restored');
          },
        });
      }
    },
    onError: () => toast.error('Failed to delete lead'),
  });

  const handleStatusChange = async (leadId: string, newStatus: LeadStatus, leadName?: string) => {
    // Get current status before updating (for undo)
    const lead = leads.find(l => l.id === leadId);
    const previousStatus = lead?.status;
    
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
      
      // Register undo for status change
      if (previousStatus) {
        registerUndo({
          label: `${leadName || lead?.name || 'Lead'} moved to ${statusConfig[newStatus]?.label || newStatus}`,
          execute: async () => {
            const { error: undoError } = await supabase
              .from('leads')
              .update({ status: previousStatus })
              .eq('id', leadId);
            if (undoError) throw undoError;
            queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
            toast.success('Undo successful');
          },
        });
      }
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

  const toggleLeadSelection = (id: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const isAllSelected = filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.has(l.id));

  const ColHeader = ({ colKey, children, className: extraClassName, style: extraStyle }: {
    colKey?: string;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }) => {
    const widthKey = colKey ?? 'lead';
    const width = columnWidths[widthKey] ?? 120;
    return (
      <th
        className={`px-4 py-1.5 text-left whitespace-nowrap group/col transition-colors hover:z-20 ${extraClassName ?? ''}`}
        style={{ width: `${width}px`, minWidth: 60, maxWidth: 500, backgroundColor: '#eee6f6', border: '1px solid #c8bdd6', ...extraStyle }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#d8cce8'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#eee6f6'; }}
      >
        <ResizableColumnHeader
          columnId={widthKey}
          currentWidth={`${width}px`}
          onResize={handleColumnResize}
        >
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-[#3b2778] dark:text-muted-foreground">
            {children}
          </span>
        </ResizableColumnHeader>
      </th>
    );
  };

  return (
    <EvanLayout>
      <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Header Section */}
      <div className="flex items-start justify-end mb-6">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin/pipeline')}
            className="h-9 px-4 border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <Kanban className="w-4 h-4 mr-2" />
            Pipeline View
          </Button>
          
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
              <table className="w-full text-sm" style={{ tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <ColHeader className="sticky top-0 z-30 group/hdr" style={{ left: 0, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                      <div className="shrink-0" title="Select all" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedLeadIds(new Set(filteredLeads.map(l => l.id)));
                            else setSelectedLeadIds(new Set());
                          }}
                          className="h-5 w-5 rounded-none border-slate-300 dark:border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                        />
                      </div>
                      <User className="h-4 w-4" /> Lead
                    </ColHeader>
                    <ColHeader colKey="contact" className="sticky top-0 z-10">
                      <Phone className="h-4 w-4" /> Contact
                    </ColHeader>
                    <ColHeader colKey="touchpoint" className="sticky top-0 z-10">
                      <MessageSquare className="h-4 w-4" /> Touchpoint
                    </ColHeader>
                    <ColHeader colKey="status" className="sticky top-0 z-10">
                      <Sparkles className="h-4 w-4" /> Status
                    </ColHeader>
                    <ColHeader colKey="created" className="sticky top-0 z-10">
                      <Calendar className="h-4 w-4" /> Created
                    </ColHeader>
                    <th className="w-10 px-2 py-1.5 sticky top-0 z-10" style={{ backgroundColor: '#eee6f6', border: '1px solid #c8bdd6' }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const touchpoint = touchpoints[lead.id];
                    const getTouchpointIcon = () => {
                      if (!touchpoint) return <MessageSquare className="w-3 h-3 text-muted-foreground/50" />;
                      if (touchpoint.type === 'call') {
                        if (touchpoint.direction === 'inbound') return <PhoneIncoming className="w-3 h-3 text-blue-500" />;
                        return <PhoneOutgoing className="w-3 h-3 text-green-500" />;
                      }
                      if (touchpoint.type === 'email') return <Mail className="w-3 h-3 text-purple-500" />;
                      if (touchpoint.type === 'sms') return <MessageSquare className="w-3 h-3 text-cyan-500" />;
                      return <MessageSquare className="w-3 h-3 text-muted-foreground" />;
                    };
                    const getTouchpointLabel = () => {
                      if (!touchpoint) return 'No contact yet';
                      const typeLabels: Record<string, string> = {
                        call: touchpoint.direction === 'inbound' ? 'Inbound call' : 'Outbound call',
                        email: 'Email',
                        sms: 'SMS',
                      };
                      return typeLabels[touchpoint.type] || touchpoint.type;
                    };

                    const isDetailSelected = detailDialogLead?.id === lead.id;
                    const isBulkSelected = selectedLeadIds.has(lead.id);

                    const stickyBg = isDetailSelected
                      ? 'bg-[#eee6f6] dark:bg-purple-950 group-hover:bg-[#e0d4f0] dark:group-hover:bg-purple-900'
                      : isBulkSelected
                        ? 'bg-[#eee6f6] dark:bg-violet-950/30 group-hover:bg-[#e0d4f0] dark:group-hover:bg-violet-900/40'
                        : 'bg-white dark:bg-card group-hover:bg-[#f8f9fb] dark:group-hover:bg-muted';

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setDetailDialogLead(lead)}
                        className={`cursor-pointer transition-colors duration-100 group ${
                          isDetailSelected
                            ? 'bg-[#eee6f6] dark:bg-purple-950/30 hover:bg-[#e0d4f0] dark:hover:bg-purple-950/40 border-l-[3px] border-l-[#3b2778]'
                            : isBulkSelected
                              ? 'bg-[#eee6f6]/60 dark:bg-violet-950/20 hover:bg-[#eee6f6]/80'
                              : 'bg-white dark:bg-card hover:bg-[#f8f9fb] dark:hover:bg-muted/30'
                        }`}
                      >
                        {/* Lead (sticky) */}
                        <td className={`pl-4 pr-6 py-1.5 overflow-hidden sticky left-0 z-[5] transition-colors ${stickyBg}`} style={{ border: '1px solid #c8bdd6', boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}>
                          <div className="flex items-center gap-3">
                            <div className="shrink-0" title="Select" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isBulkSelected}
                                onCheckedChange={() => toggleLeadSelection(lead.id)}
                                className="h-5 w-5 rounded-none border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
                              />
                            </div>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center flex-shrink-0">
                              <span className="text-[13px] font-semibold text-foreground/70">
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
                        </td>
                        {/* Contact */}
                        <td className="px-4 py-1.5 overflow-hidden" style={{ border: '1px solid #c8bdd6' }}>
                          <div className="space-y-0.5">
                            {lead.phone && (
                              <p className="text-[13px] text-muted-foreground flex items-center gap-1.5">
                                <Phone className="w-3 h-3" />
                                {lead.phone}
                              </p>
                            )}
                            {lead.email && (
                              <p className="text-[13px] text-muted-foreground flex items-center gap-1.5 truncate max-w-[120px]">
                                <Mail className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{lead.email}</span>
                              </p>
                            )}
                          </div>
                        </td>
                        {/* Last Touchpoint */}
                        <td className="px-4 py-1.5 overflow-hidden" style={{ border: '1px solid #c8bdd6' }}>
                          <div className="flex items-center gap-2">
                            {getTouchpointIcon()}
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-foreground truncate">
                                {getTouchpointLabel()}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {touchpoint
                                  ? formatDistanceToNow(new Date(touchpoint.date), { addSuffix: true })
                                  : '—'
                                }
                              </p>
                            </div>
                          </div>
                        </td>
                        {/* Status */}
                        <td className="px-4 py-1.5 overflow-hidden" style={{ border: '1px solid #c8bdd6' }}>
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusConfig[lead.status].bg} ${statusConfig[lead.status].color}`}>
                              {statusConfig[lead.status].label}
                            </span>
                            {lead.questionnaire_completed_at && (
                              <FileText className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                          </div>
                        </td>
                        {/* Created */}
                        <td className="px-4 py-1.5 overflow-hidden" style={{ border: '1px solid #c8bdd6' }}>
                          <p className="text-[13px] text-muted-foreground">
                            {format(new Date(lead.created_at), 'MMM d')}
                          </p>
                        </td>
                        {/* Detail arrow */}
                        <td className="px-2 py-1.5 w-10" style={{ border: '1px solid #c8bdd6' }}>
                          <ChevronRight className={`w-4 h-4 transition-all duration-150 ${
                            isDetailSelected
                              ? 'text-[#3b2778]'
                              : 'text-transparent group-hover:text-muted-foreground'
                          }`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
                {/* Call Transcripts */}
                {communications.length > 0 && (
                  <>
                    <div className="section-divider" />
                    <div>
                      <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        Call Transcripts ({communications.length})
                      </h4>
                      <div className="space-y-2">
                        {communications.map((comm) => (
                          <Collapsible
                            key={comm.id}
                            open={expandedTranscripts.has(comm.id)}
                            onOpenChange={() => toggleTranscript(comm.id)}
                          >
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                                    {comm.direction === 'inbound' ? (
                                      <PhoneIncoming className="w-4 h-4 text-green-600" />
                                    ) : (
                                      <PhoneOutgoing className="w-4 h-4 text-blue-600" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[13px] font-medium text-foreground">
                                      {comm.direction === 'inbound' ? 'Inbound Call' : 'Outbound Call'}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {format(new Date(comm.created_at), 'MMM d, yyyy h:mm a')} · {formatDuration(comm.duration_seconds)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {comm.transcript ? (
                                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 border-emerald-200">
                                      Transcript
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-600 border-amber-200">
                                      No Transcript
                                    </Badge>
                                  )}
                                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedTranscripts.has(comm.id) ? 'rotate-180' : ''}`} />
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-2 p-3 rounded-xl bg-muted/20 border border-border/50">
                                {comm.recording_url && (
                                  <a
                                    href={comm.recording_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-[12px] text-blue-600 hover:text-blue-700 mb-3 p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                                  >
                                    <Play className="w-3 h-3" />
                                    Play Recording
                                  </a>
                                )}
                                {comm.transcript ? (
                                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                                    {formatTranscript(comm.transcript)}
                                  </div>
                                ) : (
                                  <p className="text-[13px] text-muted-foreground italic">
                                    No transcript available for this call.
                                  </p>
                                )}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    </div>
                  </>
                )}

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

      {/* Lead Detail Dialog */}
      <LeadDetailDialog
        lead={detailDialogLead}
        open={!!detailDialogLead}
        onOpenChange={(open) => !open && setDetailDialogLead(null)}
        onLeadUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
        }}
      />
    </EvanLayout>
  );
};

export default EmployeeLeads;
