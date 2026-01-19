import { useEffect, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners } from '@dnd-kit/core';
import AdminLayout from '@/components/admin/AdminLayout';
import { KanbanColumn } from '@/components/admin/KanbanColumn';
import { LeadCard } from '@/components/admin/LeadCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Filter, LayoutGrid, List } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sources, setSources] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
      
      const uniqueSources = [...new Set(data?.map(l => l.source).filter(Boolean))] as string[];
      setSources(uniqueSources);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({ title: 'Error', description: 'Failed to fetch leads', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

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

      // Refresh leads to show updated questionnaire_sent_at
      fetchLeads();
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

    // Check if dropped on a column
    if (!columns.find(c => c.status === newStatus)) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === newStatus) return;

    // Check if moving from discovery to pre_qualification
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

      // Send pre-qualification email if applicable
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
      // Revert on error
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
    
    return matchesSearch && matchesSource;
  });

  const getLeadsByStatus = (status: LeadStatus) => 
    filteredLeads.filter(lead => lead.status === status);

  const activeLead = leads.find(l => l.id === activeId);

  if (loading) {
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
            <h1 className="text-3xl font-bold">CRM Board</h1>
            <p className="text-muted-foreground">
              Drag and drop leads to update their status • {leads.length} total leads
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
              />
            ))}
          </div>

          <DragOverlay>
            {activeLead && <LeadCard lead={activeLead} />}
          </DragOverlay>
        </DndContext>
      </div>
    </AdminLayout>
  );
};

export default CRMBoard;
