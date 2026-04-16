import { useState, useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, List, Phone, Mail, Loader2, Users, Landmark } from 'lucide-react';
import { TouchpointCell } from '@/components/admin/TouchpointChip';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import { CrmAvatar } from '@/components/admin/CrmAvatar';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAssignableUsers } from '@/hooks/useAssignableUsers';
import {
  KanbanBoard,
  KanbanColumn,
  KanbanCardShell,
  useKanbanDrag,
} from '@/components/admin/pipeline/kanban';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];
type TeamMember = Database['public']['Tables']['users']['Row'];

interface LeadWithOwner extends Lead {
  team_member?: TeamMember | null;
}

// Brand colors: Blue (#0066FF) for early stages, Orange (#FF8000) for later stages
const stages: { status: LeadStatus; title: string; bgColor: string; borderColor: string; textColor: string; barColor: string }[] = [
  { status: 'initial_review', title: 'Initial Review', bgColor: 'bg-[#0066FF]/10', borderColor: 'border-[#0066FF]', textColor: 'text-[#0066FF]', barColor: 'bg-[#0066FF]' },
  { status: 'moving_to_underwriting', title: 'Moving to UW', bgColor: 'bg-[#0891b2]/10', borderColor: 'border-[#0891b2]', textColor: 'text-[#0891b2]', barColor: 'bg-[#0891b2]' },
  { status: 'onboarding', title: 'Onboarding', bgColor: 'bg-[#d97706]/10', borderColor: 'border-[#d97706]', textColor: 'text-[#d97706]', barColor: 'bg-[#d97706]' },
  { status: 'underwriting', title: 'Underwriting', bgColor: 'bg-[#FF8000]/10', borderColor: 'border-[#FF8000]', textColor: 'text-[#FF8000]', barColor: 'bg-[#FF8000]' },
  { status: 'ready_for_wu_approval', title: 'Ready for Approval', bgColor: 'bg-[#7c3aed]/10', borderColor: 'border-[#7c3aed]', textColor: 'text-[#7c3aed]', barColor: 'bg-[#7c3aed]' },
  { status: 'pre_approval_issued', title: 'Pre-Approval Issued', bgColor: 'bg-[#8b5cf6]/10', borderColor: 'border-[#8b5cf6]', textColor: 'text-[#8b5cf6]', barColor: 'bg-[#8b5cf6]' },
  { status: 'won', title: 'Won', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-600', textColor: 'text-emerald-700', barColor: 'bg-emerald-600' },
];

type LeadCardProps = {
  lead: Lead;
  ownerName: string | null;
  touchpoint: { type: string; direction: string; date: string } | undefined;
  isDragging: boolean;
  isCalling: boolean;
  onClick: () => void;
  onCall: (e: React.MouseEvent) => void;
  onEmail: (e: React.MouseEvent) => void;
};

function LeadCard({
  lead,
  ownerName,
  touchpoint,
  isDragging,
  isCalling,
  onClick,
  onCall,
  onEmail,
}: LeadCardProps) {
  return (
    <KanbanCardShell
      id={lead.id}
      title={lead.name}
      isDragging={isDragging}
      onClick={onClick}
      body={
        <>
          {lead.company_name && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <Landmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{lead.company_name}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            {lead.phone && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={onCall}
                    disabled={isCalling}
                    className="inline-flex items-center justify-center gap-1 h-6 px-2 rounded-full bg-green-100 hover:bg-green-200 transition-colors disabled:opacity-50 border border-green-300"
                  >
                    {isCalling ? (
                      <Loader2 className="h-3 w-3 text-green-700 animate-spin" />
                    ) : (
                      <Phone className="h-3 w-3 text-green-700" />
                    )}
                    <span className="text-[10px] font-medium text-green-700">Call</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top"><p>Call {lead.phone}</p></TooltipContent>
              </Tooltip>
            )}
            {lead.email && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={onEmail}
                    className="inline-flex items-center justify-center gap-1 h-6 px-2 rounded-full bg-[#0066FF]/10 hover:bg-[#0066FF]/20 transition-colors border border-[#0066FF]/30"
                  >
                    <Mail className="h-3 w-3 text-[#0066FF]" />
                    <span className="text-[10px] font-medium text-[#0066FF]">Email</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top"><p>Email {lead.email}</p></TooltipContent>
              </Tooltip>
            )}
          </div>
        </>
      }
      footer={
        <>
          <div className="flex items-center gap-2 text-muted-foreground min-w-0">
            <CrmAvatar name={ownerName ?? '—'} size="xs" />
            <span className="text-[11px] font-medium truncate">{ownerName ?? 'Unassigned'}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <TouchpointCell touchpoint={touchpoint} />
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: false })}
            </span>
          </div>
        </>
      }
    />
  );
}

const CRMBoard = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [detailDialogLead, setDetailDialogLead] = useState<Lead | null>(null);
  const [callingLeadId, setCallingLeadId] = useState<string | null>(null);

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Company Pipeline');
    return () => { setPageTitle(null); };
  }, []);

  // Fetch team members for owner filter — only assignable users
  const { data: teamMembers = [] } = useAssignableUsers();

  const teamMemberMap = teamMembers.reduce((acc, tm) => {
    acc[tm.id] = tm.name;
    return acc;
  }, {} as Record<string, string>);

  // Fetch ALL leads (company-wide) with owner info
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['crm-all-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('potential')
        .select('*, team_member:users(id, name, email, position)')
        .order('updated_at', { ascending: false });

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

  // Call mutation
  const makeCallMutation = useMutation({
    mutationFn: async ({ phone, leadId }: { phone: string; leadId: string }) => {
      const { data, error } = await supabase.functions.invoke('twilio-call', {
        body: {
          to: phone,
          leadId: leadId,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-all-touchpoints'] });
      toast.success(`Call initiated to ${data.to}!`);
      setCallingLeadId(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to initiate call: ${error.message}`);
      setCallingLeadId(null);
    },
  });

  const handleCall = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    if (!lead.phone) {
      toast.error('No phone number available');
      return;
    }
    setCallingLeadId(lead.id);
    makeCallMutation.mutate({ phone: lead.phone, leadId: lead.id });
  };

  const handleEmail = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    if (!lead.email) {
      toast.error('No email address available');
      return;
    }
    // Navigate to Gmail with compose pre-filled (using Evan's gmail for now)
    navigate(`/admin/gmail?compose=true&to=${encodeURIComponent(lead.email)}&name=${encodeURIComponent(lead.name)}`);
  };

  const sources = [...new Set(leads.map(lead => lead.source).filter(Boolean))];

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, previousStatus }: { id: string; status: LeadStatus; previousStatus: LeadStatus }) => {
      const updates: Partial<Lead> = { status };
      if (status === 'pre_qualification') {
        updates.qualified_at = new Date().toISOString();
      } else if (status === 'funded') {
        updates.converted_at = new Date().toISOString();
      }
      const { error } = await supabase.from('potential').update(updates).eq('id', id);
      if (error) throw error;

      if (previousStatus === 'discovery' && status === 'pre_qualification') {
        try {
          const { error: emailError } = await supabase.functions.invoke('send-prequalification-email', {
            body: { leadId: id },
          });
          if (emailError) {
            console.error('Failed to send questionnaire email:', emailError);
            toast.error('Lead moved but questionnaire email failed to send');
          } else {
            toast.success('Questionnaire email sent!');
          }
        } catch (err) {
          console.error('Error sending questionnaire email:', err);
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crm-all-leads'] });
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
      queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      if (!(variables.previousStatus === 'discovery' && variables.status === 'pre_qualification')) {
        toast.success('Lead status updated');
      }
    },
    onError: () => toast.error('Failed to update lead status'),
  });

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
    const matchesOwner = ownerFilter === 'all' || lead.assigned_to === ownerFilter;
    return matchesSearch && matchesSource && matchesOwner;
  });

  const getLeadsByStatus = (status: LeadStatus) =>
    filteredLeads.filter(lead => lead.status === status);

  const stageCounts = stages.map(stage => ({
    ...stage,
    count: getLeadsByStatus(stage.status).length
  }));

  const { dragged: draggedLead, handleDragStart, handleDragEnd } = useKanbanDrag<Lead>({
    items: filteredLeads,
    getGroupKey: (lead) => lead.status,
    validGroupKeys: stages.map(s => s.status),
    onMove: (lead, fromStatus, toStatus) => {
      updateStatusMutation.mutate({
        id: lead.id,
        status: toStatus as LeadStatus,
        previousStatus: fromStatus as LeadStatus,
      });
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0066FF]"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-end mb-6">
          <div className="flex items-center gap-2">
            <Link to="/admin/leads">
              <Button variant="outline" size="sm" className="border-slate-200 text-slate-600 hover:bg-slate-50">
                <List className="w-4 h-4 mr-2" />
                List View
              </Button>
            </Link>
          </div>
        </div>

        {/* Pipeline Progress Bar - Streak Style */}
        <div className="flex h-14 mb-6">
          {stageCounts.map((stage, index) => {
            const isFirst = index === 0;
            const isLast = index === stageCounts.length - 1;
            
            return (
              <div
                key={stage.status}
                className="relative flex-1 cursor-pointer group"
                onClick={() => {
                  const element = document.getElementById(`section-${stage.status}`);
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {/* Main segment */}
                <div 
                  className={cn(
                    "absolute inset-0 flex items-center justify-center transition-all group-hover:brightness-110",
                    stage.barColor,
                    isFirst && "rounded-l-md",
                    isLast && "rounded-r-md"
                  )}
                  style={{
                    clipPath: isLast 
                      ? 'polygon(0 0, calc(100% - 0px) 0, 100% 50%, calc(100% - 0px) 100%, 0 100%, 16px 50%)'
                      : isFirst
                        ? 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%, 0 50%)'
                        : 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%, 16px 50%)'
                  }}
                >
                  <div className="flex flex-col items-center text-white pl-2">
                    <span className="text-2xl font-bold tracking-tight leading-none">{stage.count}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-95 mt-0.5">{stage.title}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 max-w-sm">
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-3 border-slate-200 focus:border-[#0066FF] focus:ring-[#0066FF]/20"
            />
          </div>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-48 border-slate-200">
              <Users className="w-4 h-4 mr-2 text-slate-400" />
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
            <SelectTrigger className="w-48 border-slate-200">
              <Filter className="w-4 h-4 mr-2 text-slate-400" />
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
          <div className="text-sm text-slate-500">
            Showing {filteredLeads.length} of {leads.length} leads
          </div>
        </div>

        {/* Kanban Board */}
        <TooltipProvider>
          <div className="flex-1 overflow-hidden border border-slate-200 rounded-md bg-white">
            <KanbanBoard
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              overlay={
                draggedLead ? (
                  <Card className="p-3 shadow-lg border border-blue-300 rotate-2 cursor-grabbing w-56 bg-card">
                    <div className="flex items-center gap-2">
                      <CrmAvatar name={draggedLead.name} size="xs" />
                      <p className="text-sm font-semibold text-foreground truncate">{draggedLead.name}</p>
                    </div>
                  </Card>
                ) : null
              }
            >
              {stages.map((stage) => {
                const stageLeads = getLeadsByStatus(stage.status);
                return (
                  <KanbanColumn
                    key={stage.status}
                    id={stage.status}
                    label={stage.title}
                    color={stage.barColor}
                    itemIds={stageLeads.map(l => l.id)}
                    emptyMessage="Drop leads here"
                  >
                    {stageLeads.map(lead => {
                      const ownerName = lead.assigned_to ? (teamMemberMap[lead.assigned_to] ?? null) : null;
                      return (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          ownerName={ownerName}
                          touchpoint={touchpoints[lead.id]}
                          isDragging={draggedLead?.id === lead.id}
                          isCalling={callingLeadId === lead.id}
                          onClick={() => setDetailDialogLead(lead)}
                          onCall={(e) => handleCall(e, lead)}
                          onEmail={(e) => handleEmail(e, lead)}
                        />
                      );
                    })}
                  </KanbanColumn>
                );
              })}
            </KanbanBoard>
          </div>
        </TooltipProvider>
      </div>

      {/* Lead Detail Dialog */}
      <LeadDetailDialog
        lead={detailDialogLead}
        open={!!detailDialogLead}
        onOpenChange={(open) => !open && setDetailDialogLead(null)}
        onLeadUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ['crm-all-leads'] });
          queryClient.invalidateQueries({ queryKey: ['evans-pipeline-leads'] });
          queryClient.invalidateQueries({ queryKey: ['evans-leads'] });
        }}
      />
    </AdminLayout>
  );
};

export default CRMBoard;
