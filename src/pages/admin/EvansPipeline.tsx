import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Lock, List } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { KanbanColumn } from '@/components/admin/KanbanColumn';
import { LeadCard } from '@/components/admin/LeadCard';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Link } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

// Match the main CRM Board column colors
const columns: { status: LeadStatus; title: string; color: string }[] = [
  { status: 'discovery', title: 'Discovery', color: 'bg-[hsl(195,55%,50%)]' },
  { status: 'questionnaire', title: 'Questionnaire', color: 'bg-[hsl(198,55%,48%)]' },
  { status: 'pre_qualification', title: 'Pre-Qualification', color: 'bg-[hsl(200,55%,46%)]' },
  { status: 'document_collection', title: 'Document Collection', color: 'bg-[hsl(205,58%,42%)]' },
  { status: 'underwriting', title: 'Underwriting', color: 'bg-[hsl(210,62%,38%)]' },
  { status: 'approval', title: 'Approval', color: 'bg-[hsl(215,66%,34%)]' },
  { status: 'funded', title: 'Funded', color: 'bg-[hsl(220,70%,30%)]' },
];

const EvansPipeline = () => {
  const queryClient = useQueryClient();
  const { teamMember, isOwner } = useTeamMember();
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [detailDialogLead, setDetailDialogLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Check if current user can edit (is Evan or is owner/super admin)
  const canEdit = isOwner || teamMember?.name?.toLowerCase() === 'evan';

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

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['evans-pipeline-leads', evanId],
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
    queryKey: ['evans-pipeline-touchpoints', leads.map(l => l.id)],
    queryFn: async () => {
      if (leads.length === 0) return {};
      
      const leadIds = leads.map(l => l.id);
      const { data, error } = await supabase
        .from('evan_communications')
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

  const sources = [...new Set(leads.map(lead => lead.source).filter(Boolean))];

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      if (!canEdit) throw new Error('Not authorized to update this lead');
      const updates: Partial<Lead> = { status };
      if (status === 'pre_qualification') {
        updates.qualified_at = new Date().toISOString();
      } else if (status === 'funded') {
        updates.converted_at = new Date().toISOString();
      }
      const { error } = await supabase.from('leads').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: () => toast.error('Failed to update lead status'),
  });

  const handleDragStart = (event: DragStartEvent) => {
    const lead = leads.find(l => l.id === event.active.id);
    setActiveLead(lead || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveLead(null);
    const { active, over } = event;
    if (!over || !canEdit) return;

    const leadId = active.id as string;
    const newStatus = over.id as LeadStatus;
    const lead = leads.find(l => l.id === leadId);

    if (lead && lead.status !== newStatus) {
      updateStatusMutation.mutate({ id: leadId, status: newStatus });
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
    return matchesSearch && matchesSource;
  });

  const getLeadsByStatus = (status: LeadStatus) => 
    filteredLeads.filter(lead => lead.status === status);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold">Pipeline</h1>
          <p className="text-muted-foreground">
            {canEdit ? 'Drag and drop leads to update their status' : 'View-only access'} • {leads.length} total leads
          </p>
          {!canEdit && (
            <Badge variant="outline" className="mt-2 gap-1">
              <Lock className="h-3 w-3" />
              View Only
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link to="/user/evan/leads">
            <Button variant="outline" size="sm">
              <List className="w-4 h-4 mr-2" />
              List View
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-48">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map((source) => (
              <SelectItem key={source} value={source!}>
                {source}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground">
          Showing {filteredLeads.length} of {leads.length} leads
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
          {columns.map((column) => (
            <KanbanColumn
              key={column.status}
              status={column.status}
              title={column.title}
              color={column.color}
              leads={getLeadsByStatus(column.status)}
              touchpoints={touchpoints}
              onLeadClick={(lead) => setDetailDialogLead(lead)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeLead && <LeadCard lead={activeLead} touchpoint={touchpoints[activeLead.id]} />}
        </DragOverlay>
      </DndContext>
      </div>

      {/* Lead Detail Dialog */}
      <LeadDetailDialog
        lead={detailDialogLead}
        open={!!detailDialogLead}
        onOpenChange={(open) => !open && setDetailDialogLead(null)}
        onLeadUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
          queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
        }}
      />
    </AdminLayout>
  );
};

export default EvansPipeline;
