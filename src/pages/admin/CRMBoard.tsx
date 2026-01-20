import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import AdminLayout from '@/components/admin/AdminLayout';
import { KanbanColumn } from '@/components/admin/KanbanColumn';
import { LeadCard } from '@/components/admin/LeadCard';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Filter, List, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];
type TeamMember = Database['public']['Tables']['team_members']['Row'];

interface LeadWithOwner extends Lead {
  team_member?: TeamMember | null;
}

// Subtle gradient progression from lighter (left) to darker (right)
const columns: { status: LeadStatus; title: string; color: string }[] = [
  { status: 'discovery', title: 'Discovery', color: 'bg-[hsl(195,55%,50%)]' },
  { status: 'pre_qualification', title: 'Pre-Qualification', color: 'bg-[hsl(200,55%,46%)]' },
  { status: 'document_collection', title: 'Document Collection', color: 'bg-[hsl(205,58%,42%)]' },
  { status: 'underwriting', title: 'Underwriting', color: 'bg-[hsl(210,62%,38%)]' },
  { status: 'approval', title: 'Approval', color: 'bg-[hsl(215,66%,34%)]' },
  { status: 'funded', title: 'Funded', color: 'bg-[hsl(220,70%,30%)]' },
];

const CRMBoard = () => {
  const queryClient = useQueryClient();
  const [leads, setLeads] = useState<LeadWithOwner[]>([]);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [sources, setSources] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailDialogLead, setDetailDialogLead] = useState<Lead | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Fetch all team members for owner filter
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  // Fetch ALL leads (company-wide) with owner info
  const { data: leadsData, isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ['crm-all-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*, team_member:team_members(id, name, email, role)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as LeadWithOwner[]) || [];
    },
  });

  // Fetch touchpoints for all leads
  const { data: touchpoints = {} } = useQuery({
    queryKey: ['crm-all-touchpoints', leads.map(l => l.id)],
    queryFn: async () => {
      if (leads.length === 0) return {};
      
      const leadIds = leads.map(l => l.id);
      const { data, error } = await supabase
        .from('evan_communications')
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

  // Update local state when data changes
  useEffect(() => {
    if (leadsData) {
      setLeads(leadsData);
      const uniqueSources = [...new Set(leadsData.map(l => l.source).filter(Boolean))] as string[];
      setSources(uniqueSources);
    }
  }, [leadsData]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const sendPrequalificationEmail = async (leadId: string) => {
    try {
      console.log('Sending pre-qualification email for lead:', leadId);
      const response = await supabase.functions.invoke('send-prequalification-email', {
        body: { leadId },
      });

      if (response.error) {
        console.error('Error sending email:', response.error);
        toast({
          title: 'Email Failed',
          description: 'Could not send pre-qualification email. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Email Sent',
        description: 'Pre-qualification questionnaire has been sent to the lead.',
      });

      refetchLeads();
    } catch (error) {
      console.error('Error invoking edge function:', error);
      toast({
        title: 'Error',
        description: 'Failed to send pre-qualification email',
        variant: 'destructive',
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as LeadStatus;

    if (!columns.find(c => c.status === newStatus)) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === newStatus) return;

    const isMovingToPreQual = lead.status === 'discovery' && newStatus === 'pre_qualification';
    const hasEmail = !!lead.email;
    const alreadySentQuestionnaire = !!lead.questionnaire_sent_at;

    // Optimistic update
    setLeads(prev => prev.map(l => 
      l.id === leadId ? { ...l, status: newStatus } : l
    ));

    try {
      const updateData: Partial<Lead> = { status: newStatus };
      
      if (newStatus === 'approval' && !lead.qualified_at) {
        updateData.qualified_at = new Date().toISOString();
      }
      if (newStatus === 'funded' && !lead.converted_at) {
        updateData.converted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId);

      if (error) throw error;

      toast({ 
        title: 'Lead Updated', 
        description: `${lead.name} moved to ${columns.find(c => c.status === newStatus)?.title}` 
      });

      if (isMovingToPreQual && hasEmail && !alreadySentQuestionnaire) {
        sendPrequalificationEmail(leadId);
      } else if (isMovingToPreQual && !hasEmail) {
        toast({
          title: 'No Email Address',
          description: 'Cannot send questionnaire - lead has no email address.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating lead:', error);
      setLeads(prev => prev.map(l => 
        l.id === leadId ? { ...l, status: lead.status } : l
      ));
      toast({ title: 'Error', description: 'Failed to update lead', variant: 'destructive' });
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !search || 
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.email?.toLowerCase().includes(search.toLowerCase()) ||
      lead.company_name?.toLowerCase().includes(search.toLowerCase());
    
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
    const matchesOwner = ownerFilter === 'all' || lead.assigned_to === ownerFilter;
    
    return matchesSearch && matchesSource && matchesOwner;
  });

  const getLeadsByStatus = (status: LeadStatus) => 
    filteredLeads.filter(lead => lead.status === status);

  const activeLead = leads.find(l => l.id === activeId);

  if (leadsLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Company Pipeline</h1>
            <p className="text-muted-foreground">
              All sales reps • Drag and drop leads to update status • {leads.length} total leads
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/leads">
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-48">
              <Users className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sales Reps</SelectItem>
              {teamMembers.map(member => (
                <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources.map(source => (
                <SelectItem key={source} value={source}>{source}</SelectItem>
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
            {columns.map(column => (
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
          queryClient.invalidateQueries({ queryKey: ['crm-all-leads'] });
        }}
      />
    </AdminLayout>
  );
};

export default CRMBoard;
