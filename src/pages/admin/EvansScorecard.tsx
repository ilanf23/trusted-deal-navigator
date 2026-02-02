import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import EvanLayout from '@/components/evan/EvanLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Target,
  Clock,
  Users,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Phone,
  Mail,
} from 'lucide-react';
import { differenceInDays, startOfMonth, format, subMonths } from 'date-fns';
import { Link } from 'react-router-dom';

// Stage configuration with SLA targets (in days)
const STAGE_CONFIG = {
  discovery: { label: 'Initial Consult', sla: 3, order: 1 },
  pre_qualification: { label: 'Onboarding', sla: 5, order: 2 },
  document_collection: { label: 'Underwriting', sla: 7, order: 3 },
  underwriting: { label: 'Lender Mgmt', sla: 10, order: 4 },
  approval: { label: 'Path to Close', sla: 5, order: 5 },
};

// Historical conversion rates by stage (mock - would come from analytics)
const CONVERSION_RATES = {
  discovery: 0.4,
  pre_qualification: 0.6,
  document_collection: 0.7,
  underwriting: 0.85,
  approval: 0.95,
};

const EvansScorecard = () => {
  const [monthFilter, setMonthFilter] = useState<string>('current');
  const [repFilter, setRepFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');

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

  // Fetch all pipeline leads with responses
  const { data: pipelineLeads, isLoading: pipelineLoading } = useQuery({
    queryKey: ['scorecard-pipeline', repFilter, evanMember?.id],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select(`
          id,
          name,
          company_name,
          status,
          assigned_to,
          created_at,
          updated_at,
          waiting_on,
          lead_responses (loan_amount),
          team_members!leads_assigned_to_team_member_fkey (name)
        `)
        .not('status', 'in', '(funded,lost)');
      
      // Filter by Evan when "evan" is selected
      if (repFilter === 'evan' && evanMember?.id) {
        query = query.eq('assigned_to', evanMember.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: repFilter === 'all' || !!evanMember?.id,
  });

  // Fetch funded leads for this month
  const { data: fundedLeads } = useQuery({
    queryKey: ['scorecard-funded', monthFilter, repFilter, evanMember?.id],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select(`
          id,
          name,
          converted_at,
          assigned_to,
          lead_responses (loan_amount),
          team_members!leads_assigned_to_team_member_fkey (name)
        `)
        .eq('status', 'funded')
        .gte('converted_at', monthStart.toISOString());
      
      // Filter by Evan when "evan" is selected
      if (repFilter === 'evan' && evanMember?.id) {
        query = query.eq('assigned_to', evanMember.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: repFilter === 'all' || !!evanMember?.id,
  });

  // Fetch team members for rep scorecards
  const { data: teamMembers } = useQuery({
    queryKey: ['scorecard-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .in('name', ['Evan', 'Brad', 'Maura', 'Wendy']);
      if (error) throw error;
      return data;
    },
  });

  // Fetch communications for response time analysis
  const { data: communications } = useQuery({
    queryKey: ['scorecard-communications', monthFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_communications')
        .select('*')
        .gte('created_at', monthStart.toISOString());
      if (error) throw error;
      return data;
    },
  });

  // Fetch tasks for follow-up compliance
  const { data: tasks } = useQuery({
    queryKey: ['scorecard-tasks', monthFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_tasks')
        .select('*')
        .gte('created_at', monthStart.toISOString());
      if (error) throw error;
      return data;
    },
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!pipelineLeads) return null;

    const MONTHLY_TARGET = 125000; // $125K/month revenue target
    
    // Pipeline by stage
    const stageData: Record<string, { deals: number; value: number; totalDays: number; overSla: number }> = {};
    const stuckDeals: Array<{
      id: string;
      name: string;
      company: string;
      stage: string;
      daysStuck: number;
      owner: string;
      waitingOn: string;
      value: number;
    }> = [];

    pipelineLeads.forEach((lead) => {
      const stage = lead.status as string;
      const config = STAGE_CONFIG[stage as keyof typeof STAGE_CONFIG];
      if (!config) return;

      const loanAmount = lead.lead_responses?.[0]?.loan_amount || 0;
      const revenue = loanAmount * 0.02;
      const daysInStage = differenceInDays(now, new Date(lead.updated_at));
      const isOverSla = daysInStage > config.sla;

      if (!stageData[stage]) {
        stageData[stage] = { deals: 0, value: 0, totalDays: 0, overSla: 0 };
      }
      stageData[stage].deals++;
      stageData[stage].value += revenue;
      stageData[stage].totalDays += daysInStage;
      if (isOverSla) stageData[stage].overSla++;

      // Track stuck deals (over SLA)
      if (isOverSla) {
        stuckDeals.push({
          id: lead.id,
          name: lead.name,
          company: lead.company_name || '',
          stage: config.label,
          daysStuck: daysInStage,
          owner: (lead.team_members as any)?.name || 'Unassigned',
          waitingOn: lead.waiting_on || 'Unknown',
          value: revenue,
        });
      }
    });

    // Sort stuck deals by days stuck (most overdue first)
    stuckDeals.sort((a, b) => b.daysStuck - a.daysStuck);

    // Calculate projections
    let worstCase = 0;
    let likelyCase = 0;
    let bestCase = 0;

    pipelineLeads.forEach((lead) => {
      const stage = lead.status as string;
      const rate = CONVERSION_RATES[stage as keyof typeof CONVERSION_RATES] || 0;
      const loanAmount = lead.lead_responses?.[0]?.loan_amount || 0;
      const revenue = loanAmount * 0.02;

      worstCase += revenue * (rate * 0.5);
      likelyCase += revenue * rate;
      bestCase += revenue * (rate + (1 - rate) * 0.3);
    });

    // Revenue closed this month
    const revenueClosed = fundedLeads?.reduce((sum, lead) => {
      const loanAmount = lead.lead_responses?.[0]?.loan_amount || 0;
      return sum + loanAmount * 0.02;
    }, 0) || 0;

    // Rep scorecards
    const repData: Record<string, {
      name: string;
      activeDeals: number;
      pipelineValue: number;
      dealsClosed: number;
      revenueClosed: number;
      tasksCompleted: number;
      tasksDue: number;
      callsMade: number;
      emailsSent: number;
    }> = {};

    // Initialize reps
    teamMembers?.forEach((tm) => {
      repData[tm.id] = {
        name: tm.name,
        activeDeals: 0,
        pipelineValue: 0,
        dealsClosed: 0,
        revenueClosed: 0,
        tasksCompleted: 0,
        tasksDue: 0,
        callsMade: 0,
        emailsSent: 0,
      };
    });

    // Count active deals per rep
    pipelineLeads.forEach((lead) => {
      if (lead.assigned_to && repData[lead.assigned_to]) {
        repData[lead.assigned_to].activeDeals++;
        const loanAmount = lead.lead_responses?.[0]?.loan_amount || 0;
        repData[lead.assigned_to].pipelineValue += loanAmount * 0.02;
      }
    });

    // Count funded deals per rep
    fundedLeads?.forEach((lead) => {
      if (lead.assigned_to && repData[lead.assigned_to]) {
        repData[lead.assigned_to].dealsClosed++;
        const loanAmount = lead.lead_responses?.[0]?.loan_amount || 0;
        repData[lead.assigned_to].revenueClosed += loanAmount * 0.02;
      }
    });

    // Task completion (simplified - assign all to Evan for now)
    const tasksCompleted = tasks?.filter((t) => t.is_completed).length || 0;
    const tasksDue = tasks?.filter((t) => !t.is_completed && t.due_date).length || 0;

    // Communications (simplified)
    const callsMade = communications?.filter((c) => c.communication_type === 'call').length || 0;
    const emailsSent = communications?.filter((c) => c.communication_type === 'email').length || 0;

    // Assign to Evan if exists
    const evanMember = teamMembers?.find((tm) => tm.name === 'Evan');
    if (evanMember && repData[evanMember.id]) {
      repData[evanMember.id].tasksCompleted = tasksCompleted;
      repData[evanMember.id].tasksDue = tasksDue;
      repData[evanMember.id].callsMade = callsMade;
      repData[evanMember.id].emailsSent = emailsSent;
    }

    return {
      monthlyTarget: MONTHLY_TARGET,
      revenueClosed,
      projectedRevenue: likelyCase + revenueClosed,
      gap: MONTHLY_TARGET - (likelyCase + revenueClosed),
      worstCase: worstCase + revenueClosed,
      likelyCase: likelyCase + revenueClosed,
      bestCase: bestCase + revenueClosed,
      stageData,
      stuckDeals: stuckDeals.slice(0, 10),
      repData: Object.values(repData).sort((a, b) => b.revenueClosed - a.revenueClosed),
      totalPipelineValue: Object.values(stageData).reduce((sum, s) => sum + s.value, 0),
      totalDeals: pipelineLeads.length,
    };
  }, [pipelineLeads, fundedLeads, teamMembers, tasks, communications, now]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const getHealthStatus = (actual: number, target: number, inverse = false) => {
    const ratio = actual / target;
    if (inverse) {
      if (ratio > 1.5) return 'red';
      if (ratio > 1) return 'yellow';
      return 'green';
    }
    if (ratio >= 1) return 'green';
    if (ratio >= 0.7) return 'yellow';
    return 'red';
  };

  const getStatusColor = (status: 'red' | 'yellow' | 'green') => {
    switch (status) {
      case 'red': return 'bg-red-500/10 text-red-600 border-red-500/30';
      case 'yellow': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case 'green': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
    }
  };

  const getStatusIcon = (status: 'red' | 'yellow' | 'green') => {
    switch (status) {
      case 'red': return <AlertCircle className="h-4 w-4" />;
      case 'yellow': return <AlertTriangle className="h-4 w-4" />;
      case 'green': return <CheckCircle2 className="h-4 w-4" />;
    }
  };

  if (pipelineLoading) {
    return (
      <EvanLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading sales control panel...</p>
          </div>
        </div>
      </EvanLayout>
    );
  }

  if (!metrics) return null;

  const overallHealth = metrics.gap > 0 ? (metrics.gap > metrics.monthlyTarget * 0.3 ? 'red' : 'yellow') : 'green';

  return (
    <EvanLayout>
      <div className="space-y-6">
        {/* Header with Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Sales Control Panel</h1>
            <p className="text-muted-foreground">Real-time pipeline health & performance</p>
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
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Company</SelectItem>
                <SelectItem value="evan">Evan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Section 1: Target vs Projection */}
        <Card className={`border-2 ${getStatusColor(overallHealth)}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Target vs Projection
              </CardTitle>
              <Badge variant="outline" className={getStatusColor(overallHealth)}>
                {getStatusIcon(overallHealth)}
                <span className="ml-1">
                  {overallHealth === 'green' ? 'On Track' : overallHealth === 'yellow' ? 'At Risk' : 'Off Track'}
                </span>
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Monthly Target */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Monthly Target</p>
                <p className="text-3xl font-bold">{formatCurrency(metrics.monthlyTarget)}</p>
              </div>
              
              {/* Projected Revenue */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Projected Revenue</p>
                <p className="text-3xl font-bold text-primary">{formatCurrency(metrics.projectedRevenue)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(metrics.revenueClosed)} closed + {formatCurrency(metrics.likelyCase - metrics.revenueClosed)} pipeline
                </p>
              </div>
              
              {/* Gap */}
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Gap to Goal</p>
                <p className={`text-3xl font-bold ${metrics.gap > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {metrics.gap > 0 ? `-${formatCurrency(metrics.gap)}` : `+${formatCurrency(Math.abs(metrics.gap))}`}
                </p>
              </div>
              
              {/* Scenarios */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Forecast Range</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-red-600">Worst:</span>
                    <span className="font-medium">{formatCurrency(metrics.worstCase)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-600">Likely:</span>
                    <span className="font-medium">{formatCurrency(metrics.likelyCase)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-600">Best:</span>
                    <span className="font-medium">{formatCurrency(metrics.bestCase)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Pipeline Health by Stage */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Pipeline Health by Stage
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Healthy</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Risk</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Broken</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Stage</th>
                    <th className="text-right py-3 px-2 font-medium"># Deals</th>
                    <th className="text-right py-3 px-2 font-medium">$ Value</th>
                    <th className="text-right py-3 px-2 font-medium">Avg Days</th>
                    <th className="text-right py-3 px-2 font-medium">SLA Target</th>
                    <th className="text-right py-3 px-2 font-medium">Over SLA</th>
                    <th className="text-center py-3 px-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(STAGE_CONFIG)
                    .sort(([, a], [, b]) => a.order - b.order)
                    .map(([stage, config]) => {
                      const data = metrics.stageData[stage] || { deals: 0, value: 0, totalDays: 0, overSla: 0 };
                      const avgDays = data.deals > 0 ? Math.round(data.totalDays / data.deals) : 0;
                      const overSlaPercent = data.deals > 0 ? (data.overSla / data.deals) * 100 : 0;
                      
                      let status: 'red' | 'yellow' | 'green' = 'green';
                      if (overSlaPercent > 50) status = 'red';
                      else if (overSlaPercent > 25 || avgDays > config.sla) status = 'yellow';

                      return (
                        <tr key={stage} className={`border-b ${status === 'red' ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                          <td className="py-3 px-2 font-medium">{config.label}</td>
                          <td className="text-right py-3 px-2">{data.deals}</td>
                          <td className="text-right py-3 px-2">{formatCurrency(data.value)}</td>
                          <td className={`text-right py-3 px-2 ${avgDays > config.sla ? 'text-red-600 font-medium' : ''}`}>
                            {avgDays}d
                          </td>
                          <td className="text-right py-3 px-2 text-muted-foreground">{config.sla}d</td>
                          <td className={`text-right py-3 px-2 ${data.overSla > 0 ? 'text-red-600 font-medium' : ''}`}>
                            {data.overSla}
                          </td>
                          <td className="text-center py-3 px-2">
                            <Badge variant="outline" className={getStatusColor(status)}>
                              {getStatusIcon(status)}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50">
                    <td className="py-3 px-2 font-bold">Total Pipeline</td>
                    <td className="text-right py-3 px-2 font-bold">{metrics.totalDeals}</td>
                    <td className="text-right py-3 px-2 font-bold">{formatCurrency(metrics.totalPipelineValue)}</td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Stuck Deals */}
        <Card className={metrics.stuckDeals.length > 5 ? 'border-red-500/30' : ''}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Stuck Deals
                {metrics.stuckDeals.length > 0 && (
                  <Badge variant="destructive" className="ml-2">{metrics.stuckDeals.length} Over SLA</Badge>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {metrics.stuckDeals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p>No deals currently over SLA. Pipeline is healthy!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Deal</th>
                      <th className="text-left py-3 px-2 font-medium">Stage</th>
                      <th className="text-right py-3 px-2 font-medium">Days Stuck</th>
                      <th className="text-left py-3 px-2 font-medium">Owner</th>
                      <th className="text-left py-3 px-2 font-medium">Waiting On</th>
                      <th className="text-right py-3 px-2 font-medium">Value</th>
                      <th className="text-center py-3 px-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.stuckDeals.map((deal, idx) => (
                      <tr key={deal.id} className={`border-b ${idx < 3 ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                        <td className="py-3 px-2">
                          <div>
                            <p className="font-medium">{deal.name}</p>
                            {deal.company && <p className="text-xs text-muted-foreground">{deal.company}</p>}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="outline">{deal.stage}</Badge>
                        </td>
                        <td className={`text-right py-3 px-2 font-bold ${deal.daysStuck > 14 ? 'text-red-600' : 'text-amber-600'}`}>
                          {deal.daysStuck}d
                        </td>
                        <td className="py-3 px-2">{deal.owner}</td>
                        <td className="py-3 px-2">
                          <Badge variant="secondary" className="text-xs">{deal.waitingOn}</Badge>
                        </td>
                        <td className="text-right py-3 px-2 font-medium">{formatCurrency(deal.value)}</td>
                        <td className="text-center py-3 px-2">
                          <Link 
                            to={`/team/evan/pipeline`}
                            className="text-primary hover:underline text-xs flex items-center justify-center gap-1"
                          >
                            View <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 4: Rep Scorecards */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Rep Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.repData.map((rep, idx) => {
                const followUpCompliance = rep.tasksDue + rep.tasksCompleted > 0 
                  ? Math.round((rep.tasksCompleted / (rep.tasksDue + rep.tasksCompleted)) * 100)
                  : 100;
                
                const performance = rep.revenueClosed > 0 ? 'green' : rep.activeDeals > 3 ? 'yellow' : 'red';

                return (
                  <div 
                    key={rep.name}
                    className={`p-4 rounded-lg border-2 ${getStatusColor(performance)}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-lg">{rep.name}</h3>
                      {idx === 0 && rep.revenueClosed > 0 && (
                        <Badge className="bg-amber-500 text-white">Top Performer</Badge>
                      )}
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Active Deals</span>
                        <span className="font-medium">{rep.activeDeals}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pipeline Value</span>
                        <span className="font-medium">{formatCurrency(rep.pipelineValue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Deals Closed</span>
                        <span className="font-bold text-primary">{rep.dealsClosed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Revenue Closed</span>
                        <span className="font-bold text-primary">{formatCurrency(rep.revenueClosed)}</span>
                      </div>
                      
                      <div className="pt-2 border-t mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Follow-up
                          </span>
                          <span className={`font-medium ${followUpCompliance < 70 ? 'text-red-600' : ''}`}>
                            {followUpCompliance}%
                          </span>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {rep.callsMade}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {rep.emailsSent}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </EvanLayout>
  );
};

export default EvansScorecard;
