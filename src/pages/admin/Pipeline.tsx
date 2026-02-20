import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Kanban } from 'lucide-react';
import EvanLayout from '@/components/evan/EvanLayout';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { KanbanColumn } from '@/components/admin/KanbanColumn';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import { cn } from '@/lib/utils';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

const statusOrder: LeadStatus[] = [
  'initial_review',
  'moving_to_underwriting',
  'onboarding',
  'underwriting',
  'ready_for_wu_approval',
  'pre_approval_issued',
  'won',
];

const stageConfig: Record<string, { title: string; color: string }> = {
  initial_review: { title: 'Initial Review', color: 'bg-blue-600' },
  moving_to_underwriting: { title: 'Moving to UW', color: 'bg-cyan-600' },
  onboarding: { title: 'Onboarding', color: 'bg-amber-600' },
  underwriting: { title: 'Underwriting', color: 'bg-orange-600' },
  ready_for_wu_approval: { title: 'Ready for Approval', color: 'bg-violet-600' },
  pre_approval_issued: { title: 'Pre-Approval Issued', color: 'bg-purple-600' },
  won: { title: 'Won', color: 'bg-emerald-600' },
};

const Pipeline = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [detailDialogLead, setDetailDialogLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Fetch leads
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['pipeline-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .in('status', statusOrder)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  // Fetch team members for owner filter
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch latest touchpoints
  const { data: touchpoints = {} } = useQuery({
    queryKey: ['pipeline-touchpoints'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_communications')
        .select('lead_id, communication_type, direction, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const map: Record<string, { type: string; direction: string; date: string }> = {};
      for (const row of data || []) {
        if (row.lead_id && !map[row.lead_id]) {
          map[row.lead_id] = {
            type: row.communication_type,
            direction: row.direction,
            date: row.created_at,
          };
        }
      }
      return map;
    },
  });

  // Update lead status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: LeadStatus }) => {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-leads'] });
      toast.success('Lead moved successfully');
    },
    onError: () => {
      toast.error('Failed to move lead');
    },
  });

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesSearch =
        !searchTerm ||
        lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesOwner =
        ownerFilter === 'all' ||
        lead.assigned_to?.toLowerCase() === ownerFilter.toLowerCase();

      return matchesSearch && matchesOwner;
    });
  }, [leads, searchTerm, ownerFilter]);

  // Group leads by status
  const leadsByStatus = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    for (const status of statusOrder) {
      grouped[status] = filteredLeads.filter((l) => l.status === status);
    }
    return grouped;
  }, [filteredLeads]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const leadId = active.id as string;
    const newStatus = over.id as LeadStatus;
    const lead = leads.find((l) => l.id === leadId);
    if (lead && lead.status !== newStatus) {
      updateStatusMutation.mutate({ leadId, newStatus });
    }
  };

  if (isLoading) {
    return (
      <EvanLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </EvanLayout>
    );
  }

  return (
    <EvanLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2">
            <Kanban className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-xl font-bold text-foreground">Pipeline</h1>
            <Badge variant="secondary" className="ml-2">
              {filteredLeads.length} deals
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                {teamMembers.map((tm) => (
                  <SelectItem key={tm.id} value={tm.name.toLowerCase()}>
                    {tm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Kanban Board */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
            {statusOrder.map((status) => {
              const config = stageConfig[status];
              return (
                <KanbanColumn
                  key={status}
                  status={status}
                  leads={leadsByStatus[status] || []}
                  title={config.title}
                  color={config.color}
                  touchpoints={touchpoints}
                  onLeadClick={(lead) => setDetailDialogLead(lead)}
                />
              );
            })}
          </div>
        </DndContext>

        {/* Lead Detail Dialog */}
        {detailDialogLead && (
          <LeadDetailDialog
            lead={detailDialogLead}
            open={!!detailDialogLead}
            onOpenChange={(open) => {
              if (!open) setDetailDialogLead(null);
            }}
          />
        )}
      </div>
    </EvanLayout>
  );
};

export default Pipeline;
