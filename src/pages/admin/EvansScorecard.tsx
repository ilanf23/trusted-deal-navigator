import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import EvanLayout from '@/components/evan/EvanLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users,
  Phone,
  Mail,
  MessageSquare,
  UserPlus,
  Trophy,
  ArrowRightLeft,
  TrendingUp,
  Loader2,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { startOfMonth, format, subMonths, differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';

// Stage labels for display
const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  discovery: 'Initial Consult',
  pre_qualification: 'Onboarding',
  document_collection: 'Underwriting',
  underwriting: 'Lender Mgmt',
  approval: 'Path to Close',
  funded: 'Funded',
  lost: 'Lost',
};

const EvansScorecard = () => {
  const [monthFilter, setMonthFilter] = useState<string>('current');
  const [repFilter, setRepFilter] = useState<string>('evan');

  const now = new Date();
  const monthStart = monthFilter === 'current' 
    ? startOfMonth(now) 
    : startOfMonth(subMonths(now, 1));

  // Get Evan's team member ID for filtering
  const { data: evanMember } = useQuery({
    queryKey: ['evan-member-id'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id')
        .eq('name', 'Evan')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch all leads (for counting new leads this period)
  const { data: allLeads, isLoading: leadsLoading } = useQuery({
    queryKey: ['scorecard-all-leads', repFilter, evanMember?.id, monthFilter],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('id, name, company_name, status, assigned_to, created_at, updated_at');
      
      if (repFilter === 'evan' && evanMember?.id) {
        query = query.eq('assigned_to', evanMember.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: repFilter === 'all' || !!evanMember?.id,
  });

  // Fetch communications (touchpoints)
  const { data: communications } = useQuery({
    queryKey: ['scorecard-communications', monthFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_communications')
        .select('id, communication_type, direction, created_at, lead_id, duration_seconds')
        .gte('created_at', monthStart.toISOString());
      if (error) throw error;
      return data;
    },
  });

  // Fetch lead activities (for stage movements)
  const { data: leadActivities } = useQuery({
    queryKey: ['scorecard-activities', monthFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('id, lead_id, activity_type, title, content, created_at')
        .gte('created_at', monthStart.toISOString());
      if (error) throw error;
      return data;
    },
  });

  // Fetch tasks for follow-up tracking
  const { data: tasks } = useQuery({
    queryKey: ['scorecard-tasks', monthFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_tasks')
        .select('id, title, is_completed, lead_id, created_at, due_date')
        .gte('created_at', monthStart.toISOString());
      if (error) throw error;
      return data;
    },
  });

  // Calculate lead-centric metrics
  const metrics = useMemo(() => {
    if (!allLeads) return null;

    // New leads this period
    const newLeadsThisPeriod = allLeads.filter(
      (lead) => new Date(lead.created_at) >= monthStart
    );

    // Leads by status
    const activeLeads = allLeads.filter(
      (lead) => !['funded', 'lost'].includes(lead.status)
    );
    const closedWon = allLeads.filter(
      (lead) => lead.status === 'funded' && new Date(lead.updated_at) >= monthStart
    );
    const closedLost = allLeads.filter(
      (lead) => lead.status === 'lost' && new Date(lead.updated_at) >= monthStart
    );

    // Touchpoints breakdown
    const calls = communications?.filter((c) => c.communication_type === 'call') || [];
    const emails = communications?.filter((c) => c.communication_type === 'email') || [];
    const sms = communications?.filter((c) => c.communication_type === 'sms') || [];
    
    const inboundCalls = calls.filter((c) => c.direction === 'inbound');
    const outboundCalls = calls.filter((c) => c.direction === 'outbound');
    
    const totalTouchpoints = (communications?.length || 0);

    // Calculate total call duration in minutes
    const totalCallMinutes = calls.reduce((sum, call) => 
      sum + (call.duration_seconds || 0) / 60, 0
    );

    // Unique leads contacted
    const uniqueLeadsContacted = new Set(
      communications?.filter((c) => c.lead_id).map((c) => c.lead_id) || []
    ).size;

    // Stage movements from activities
    const stageChanges = leadActivities?.filter(
      (a) => a.activity_type === 'stage_change' || a.title?.includes('moved to')
    ) || [];

    // Tasks metrics
    const tasksCompleted = tasks?.filter((t) => t.is_completed).length || 0;
    const tasksCreated = tasks?.length || 0;
    const tasksOverdue = tasks?.filter(
      (t) => !t.is_completed && t.due_date && new Date(t.due_date) < now
    ).length || 0;

    // Recent stage movements for display
    const recentMovements = stageChanges.slice(0, 10).map((activity) => {
      const lead = allLeads.find((l) => l.id === activity.lead_id);
      return {
        id: activity.id,
        leadName: lead?.name || 'Unknown',
        company: lead?.company_name || '',
        action: activity.title || activity.content || 'Stage changed',
        date: activity.created_at,
      };
    });

    // Leads needing attention (no touchpoint in 7+ days)
    const leadsNeedingAttention = activeLeads.filter((lead) => {
      const lastTouchpoint = communications?.find((c) => c.lead_id === lead.id);
      if (!lastTouchpoint) return true;
      return differenceInDays(now, new Date(lastTouchpoint.created_at)) >= 7;
    }).slice(0, 10);

    return {
      // Lead counts
      totalLeads: allLeads.length,
      activeLeads: activeLeads.length,
      newLeads: newLeadsThisPeriod.length,
      closedWon: closedWon.length,
      closedLost: closedLost.length,
      
      // Touchpoints
      totalTouchpoints,
      calls: calls.length,
      inboundCalls: inboundCalls.length,
      outboundCalls: outboundCalls.length,
      emails: emails.length,
      sms: sms.length,
      totalCallMinutes: Math.round(totalCallMinutes),
      uniqueLeadsContacted,
      
      // Stage movements
      stageMovements: stageChanges.length,
      recentMovements,
      
      // Tasks
      tasksCreated,
      tasksCompleted,
      tasksOverdue,
      
      // Attention needed
      leadsNeedingAttention,
    };
  }, [allLeads, communications, leadActivities, tasks, monthStart, now]);

  if (leadsLoading) {
    return (
      <EvanLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading scorecard...</p>
          </div>
        </div>
      </EvanLayout>
    );
  }

  if (!metrics) return null;

  return (
    <EvanLayout>
      <div className="space-y-6">
        {/* Header with Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Lead Scorecard</h1>
            <p className="text-muted-foreground">Track your lead activity & performance</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">{format(now, 'MMMM')}</SelectItem>
                <SelectItem value="previous">{format(subMonths(now, 1), 'MMMM')}</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Evan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Company</SelectItem>
                <SelectItem value="evan">Evan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Section 1: Lead Overview */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">Active Leads</span>
              </div>
              <p className="text-3xl font-bold">{metrics.activeLeads}</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-200 dark:border-emerald-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                <UserPlus className="h-4 w-4" />
                <span className="text-xs font-medium">New Leads</span>
              </div>
              <p className="text-3xl font-bold">{metrics.newLeads}</p>
              <p className="text-xs text-muted-foreground">this period</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                <Trophy className="h-4 w-4" />
                <span className="text-xs font-medium">Closed Won</span>
              </div>
              <p className="text-3xl font-bold">{metrics.closedWon}</p>
              <p className="text-xs text-muted-foreground">this period</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/20 border-red-200 dark:border-red-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium">Closed Lost</span>
              </div>
              <p className="text-3xl font-bold">{metrics.closedLost}</p>
              <p className="text-xs text-muted-foreground">this period</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                <ArrowRightLeft className="h-4 w-4" />
                <span className="text-xs font-medium">Stage Moves</span>
              </div>
              <p className="text-3xl font-bold">{metrics.stageMovements}</p>
              <p className="text-xs text-muted-foreground">this period</p>
            </CardContent>
          </Card>
        </div>

        {/* Section 2: Touchpoints */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Touchpoints This Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-primary">{metrics.totalTouchpoints}</p>
                <p className="text-sm text-muted-foreground">Total Touchpoints</p>
              </div>
              
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Phone className="h-4 w-4 text-blue-500" />
                </div>
                <p className="text-2xl font-bold">{metrics.calls}</p>
                <p className="text-xs text-muted-foreground">Calls</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics.totalCallMinutes} mins
                </p>
              </div>

              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Phone className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-2xl font-bold">{metrics.outboundCalls}</p>
                <p className="text-xs text-muted-foreground">Outbound</p>
              </div>

              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Phone className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-2xl font-bold">{metrics.inboundCalls}</p>
                <p className="text-xs text-muted-foreground">Inbound</p>
              </div>
              
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Mail className="h-4 w-4 text-purple-500" />
                </div>
                <p className="text-2xl font-bold">{metrics.emails}</p>
                <p className="text-xs text-muted-foreground">Emails</p>
              </div>
              
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <MessageSquare className="h-4 w-4 text-green-500" />
                </div>
                <p className="text-2xl font-bold">{metrics.sms}</p>
                <p className="text-xs text-muted-foreground">SMS</p>
              </div>

              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Users className="h-4 w-4 text-indigo-500" />
                </div>
                <p className="text-2xl font-bold">{metrics.uniqueLeadsContacted}</p>
                <p className="text-xs text-muted-foreground">Leads Reached</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Tasks & Follow-ups */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Tasks & Follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/30 rounded-lg">
                <p className="text-3xl font-bold">{metrics.tasksCreated}</p>
                <p className="text-sm text-muted-foreground">Tasks Created</p>
              </div>
              
              <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                <p className="text-3xl font-bold text-emerald-600">{metrics.tasksCompleted}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
              
              <div className={`text-center p-4 rounded-lg ${metrics.tasksOverdue > 0 ? 'bg-red-50 dark:bg-red-950/30' : 'bg-muted/30'}`}>
                <p className={`text-3xl font-bold ${metrics.tasksOverdue > 0 ? 'text-red-600' : ''}`}>
                  {metrics.tasksOverdue}
                </p>
                <p className="text-sm text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Recent Stage Movements */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Recent Stage Movements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.recentMovements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ArrowRightLeft className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No stage movements this period</p>
              </div>
            ) : (
              <div className="space-y-2">
                {metrics.recentMovements.map((movement) => (
                  <div 
                    key={movement.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{movement.leadName}</p>
                      {movement.company && (
                        <p className="text-xs text-muted-foreground">{movement.company}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="text-xs">
                        {movement.action}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(movement.date), 'MMM d')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 5: Leads Needing Attention */}
        <Card className={metrics.leadsNeedingAttention.length > 5 ? 'border-amber-500/30' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Leads Needing Attention
              {metrics.leadsNeedingAttention.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {metrics.leadsNeedingAttention.length} leads
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground">No touchpoint in 7+ days</p>
          </CardHeader>
          <CardContent>
            {metrics.leadsNeedingAttention.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p>All leads have been contacted recently!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {metrics.leadsNeedingAttention.map((lead) => (
                  <div 
                    key={lead.id}
                    className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800"
                  >
                    <div>
                      <p className="font-medium">{lead.name}</p>
                      {lead.company_name && (
                        <p className="text-xs text-muted-foreground">{lead.company_name}</p>
                      )}
                      <Badge variant="outline" className="text-xs mt-1">
                        {STAGE_LABELS[lead.status] || lead.status}
                      </Badge>
                    </div>
                    <Link 
                      to={`/team/evan/pipeline`}
                      className="text-primary hover:underline text-xs flex items-center gap-1"
                    >
                      View <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </EvanLayout>
  );
};

export default EvansScorecard;
