import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Lock, List, ChevronDown, ChevronRight, Plus, Phone, Mail, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import PipelineSharingModal from '@/components/admin/PipelineSharingModal';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

// Brand colors: Blue (#0066FF) for early stages, Orange (#FF8000) for later stages
const stages: { status: LeadStatus; title: string; bgColor: string; borderColor: string; textColor: string; barColor: string }[] = [
  { status: 'discovery', title: 'Discovery', bgColor: 'bg-[#0066FF]/10', borderColor: 'border-[#0066FF]', textColor: 'text-[#0066FF]', barColor: 'bg-[#0066FF]' },
  { status: 'pre_qualification', title: 'Pre-Qual', bgColor: 'bg-[#0066FF]/10', borderColor: 'border-[#0066FF]', textColor: 'text-[#0066FF]', barColor: 'bg-[#1a75ff]' },
  { status: 'document_collection', title: 'Doc Collection', bgColor: 'bg-[#3385ff]/10', borderColor: 'border-[#3385ff]', textColor: 'text-[#3385ff]', barColor: 'bg-[#3385ff]' },
  { status: 'underwriting', title: 'Underwriting', bgColor: 'bg-[#FF8000]/10', borderColor: 'border-[#FF8000]', textColor: 'text-[#FF8000]', barColor: 'bg-[#FF8000]' },
  { status: 'approval', title: 'Approval', bgColor: 'bg-[#FF8000]/10', borderColor: 'border-[#FF8000]', textColor: 'text-[#FF8000]', barColor: 'bg-[#e67300]' },
  { status: 'funded', title: 'Funded', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-600', textColor: 'text-emerald-700', barColor: 'bg-emerald-600' },
];

const EvansPipeline = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { teamMember, isOwner } = useTeamMember();
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [detailDialogLead, setDetailDialogLead] = useState<Lead | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<LeadStatus, boolean>>({} as Record<LeadStatus, boolean>);
  const [callingLeadId, setCallingLeadId] = useState<string | null>(null);
  const [sharingModalOpen, setSharingModalOpen] = useState(false);

  const canEdit = isOwner || teamMember?.name?.toLowerCase() === 'evan';

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

  // Fetch team members for "Assigned To" column
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name');
      if (error) throw error;
      return data;
    },
  });

  const teamMemberMap = teamMembers.reduce((acc, tm) => {
    acc[tm.id] = tm.name;
    return acc;
  }, {} as Record<string, string>);

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
      queryClient.invalidateQueries({ queryKey: ['evans-pipeline-touchpoints'] });
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
    // Navigate to Gmail with compose pre-filled
    navigate(`/team/evan/gmail?compose=true&to=${encodeURIComponent(lead.email)}&name=${encodeURIComponent(lead.name)}`);
  };

  const sources = [...new Set(leads.map(lead => lead.source).filter(Boolean))];

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, previousStatus }: { id: string; status: LeadStatus; previousStatus: LeadStatus }) => {
      if (!canEdit) throw new Error('Not authorized to update this lead');
      const updates: Partial<Lead> = { status };
      if (status === 'pre_qualification') {
        updates.qualified_at = new Date().toISOString();
      } else if (status === 'funded') {
        updates.converted_at = new Date().toISOString();
      }
      const { error } = await supabase.from('leads').update(updates).eq('id', id);
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
    return matchesSearch && matchesSource;
  });

  const getLeadsByStatus = (status: LeadStatus) => 
    filteredLeads.filter(lead => lead.status === status);

  const toggleSection = (status: LeadStatus) => {
    setCollapsedSections(prev => ({
      ...prev,
      [status]: !prev[status]
    }));
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const stageCounts = stages.map(stage => ({
    ...stage,
    count: getLeadsByStatus(stage.status).length
  }));
  const totalLeads = filteredLeads.length;

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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Pipeline</h1>
            <span className="text-sm text-slate-500 font-medium">{totalLeads} leads</span>
            {!canEdit && (
              <Badge variant="outline" className="gap-1 text-slate-500 border-slate-300">
                <Lock className="h-3 w-3" />
                View Only
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEdit && evanId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSharingModalOpen(true)}
                className="border-[#0066FF]/30 text-[#0066FF] hover:bg-[#0066FF]/5"
              >
                <Users className="w-4 h-4 mr-2" />
                Share
              </Button>
            )}
            <Link to="/user/evan/leads">
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

        {/* Grouped Table View */}
        <div className="flex-1 overflow-auto border border-slate-200 rounded-md bg-white">
          {/* Table Header */}
          <div className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-[32px_32px_minmax(140px,1.2fr)_90px_minmax(100px,1fr)_minmax(140px,1fr)_90px_80px_100px_90px] gap-3 px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <div></div>
              <div></div>
              <div>Name</div>
              <div>Stage</div>
              <div>Company</div>
              <div>Contact</div>
              <div>Owner</div>
              <div>Source</div>
              <div>Last Touch</div>
              <div>Updated</div>
            </div>
          </div>

          {/* Grouped Sections */}
          <div>
            {stages.map((stage) => {
              const stageLeads = getLeadsByStatus(stage.status);
              const isCollapsed = collapsedSections[stage.status];

              return (
                <Collapsible
                  key={stage.status}
                  id={`section-${stage.status}`}
                  open={!isCollapsed}
                  onOpenChange={() => toggleSection(stage.status)}
                >
                  {/* Section Header */}
                  <CollapsibleTrigger asChild>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors border-l-[3px] border-b border-b-slate-100",
                        stage.borderColor
                      )}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                      <Badge 
                        variant="outline"
                        className={cn(
                          "font-semibold text-xs px-2 py-0.5 rounded",
                          stage.bgColor,
                          stage.textColor,
                          stage.borderColor
                        )}
                      >
                        {stage.title}
                      </Badge>
                      <span className="text-xs text-slate-500 font-medium">
                        {stageLeads.length} {stageLeads.length === 1 ? 'lead' : 'leads'}
                      </span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1 text-slate-400 hover:text-[#0066FF] hover:bg-[#0066FF]/5">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CollapsibleTrigger>

                  {/* Section Content */}
                  <CollapsibleContent>
                    {stageLeads.length === 0 ? (
                      <div className="px-12 py-4 text-sm text-slate-400 italic border-b border-slate-100">
                        No leads in this stage
                      </div>
                    ) : (
                      <TooltipProvider>
                        <div>
                          {stageLeads.map((lead, idx) => {
                            const touchpoint = touchpoints[lead.id];
                            const ownerName = lead.assigned_to ? teamMemberMap[lead.assigned_to] : null;
                            const isCallingThis = callingLeadId === lead.id;
                            return (
                              <div
                                key={lead.id}
                                className={cn(
                                  "grid grid-cols-[32px_32px_minmax(140px,1.2fr)_90px_minmax(100px,1fr)_minmax(140px,1fr)_90px_80px_100px_90px] gap-3 px-4 py-2.5 hover:bg-slate-50/80 cursor-pointer items-center text-sm transition-colors",
                                  idx < stageLeads.length - 1 && "border-b border-slate-50"
                                )}
                                onClick={() => setDetailDialogLead(lead)}
                              >
                                <div className="flex items-center justify-center">
                                  <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300 text-[#0066FF] focus:ring-[#0066FF]/20" 
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div>
                                  <Avatar className="h-7 w-7 bg-[#0066FF]">
                                    <AvatarFallback className="text-[10px] text-white font-semibold bg-[#0066FF]">
                                      {getInitials(lead.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                </div>
                                <div className="font-medium text-slate-900 truncate">{lead.name}</div>
                                <div>
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-[10px] font-medium px-1.5 py-0 rounded",
                                      stage.bgColor,
                                      stage.textColor,
                                      "border-transparent"
                                    )}
                                  >
                                    {stage.title}
                                  </Badge>
                                </div>
                                <div className="text-slate-600 truncate text-[13px]">
                                  {lead.company_name || '—'}
                                </div>
                                <div className="flex items-center gap-2">
                                  {lead.phone && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={(e) => handleCall(e, lead)}
                                          disabled={isCallingThis}
                                          className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-full bg-green-100 hover:bg-green-200 transition-colors disabled:opacity-50 border border-green-300"
                                        >
                                          {isCallingThis ? (
                                            <Loader2 className="h-4 w-4 text-green-700 animate-spin" />
                                          ) : (
                                            <Phone className="h-4 w-4 text-green-700" />
                                          )}
                                          <span className="text-xs font-medium text-green-700">Call</span>
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        <p>Call {lead.phone}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {lead.email && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={(e) => handleEmail(e, lead)}
                                          className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-full bg-[#0066FF]/10 hover:bg-[#0066FF]/20 transition-colors border border-[#0066FF]/30"
                                        >
                                          <Mail className="h-4 w-4 text-[#0066FF]" />
                                          <span className="text-xs font-medium text-[#0066FF]">Email</span>
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top">
                                        <p>Email {lead.email}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {!lead.phone && !lead.email && <span className="text-slate-300 text-xs">—</span>}
                                </div>
                                <div className="text-xs text-slate-600 truncate">
                                  {ownerName || <span className="text-slate-300">—</span>}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {lead.source || <span className="text-slate-300">—</span>}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {touchpoint ? (
                                    <span className="capitalize">
                                      {touchpoint.type}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: false })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </TooltipProvider>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </div>
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

      {/* Pipeline Sharing Modal */}
      {evanId && (
        <PipelineSharingModal
          open={sharingModalOpen}
          onOpenChange={setSharingModalOpen}
          ownerId={evanId}
          ownerName="Evan"
        />
      )}
    </AdminLayout>
  );
};

export default EvansPipeline;
