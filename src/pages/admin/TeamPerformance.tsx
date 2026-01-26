import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Target,
  BarChart3,
  Users,
  Briefcase,
  Loader2,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { startOfYear, startOfMonth, format, eachMonthOfInterval, differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';

type TimePeriod = 'mtd' | 'ytd';

const STAGE_COLORS: Record<string, string> = {
  discovery: '#0066FF',
  pre_qualification: '#1a75ff',
  document_collection: '#3385ff',
  underwriting: '#FF8000',
  approval: '#e67300',
  funded: '#10b981',
};

const TeamPerformance = () => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('ytd');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('evan');

  const now = new Date();
  const periodStart = timePeriod === 'ytd' ? startOfYear(now) : startOfMonth(now);

  // Fetch Evan's team member ID
  const { data: evanTeamMember } = useQuery({
    queryKey: ['evan-team-member'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name')
        .ilike('name', 'evan')
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch leads data for metrics
  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['team-leads-analytics', timePeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          name,
          status,
          source,
          created_at,
          converted_at,
          last_activity_at,
          pipeline_leads (
            stage_id,
            pipeline_stages (name, color)
          ),
          lead_responses (
            loan_amount,
            funding_amount
          )
        `)
        .gte('created_at', periodStart.toISOString());

      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch pipeline leads for stage distribution
  const { data: pipelineData, isLoading: pipelineLoading } = useQuery({
    queryKey: ['team-pipeline-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          status,
          last_activity_at,
          created_at,
          pipeline_leads (
            stage_id,
            pipeline_stages (name, color)
          ),
          lead_responses (
            loan_amount
          )
        `)
        .neq('status', 'funded');

      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch funded leads for revenue
  const { data: fundedLeads, isLoading: fundedLoading } = useQuery({
    queryKey: ['team-funded-analytics', timePeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          converted_at,
          lead_responses (
            loan_amount
          )
        `)
        .eq('status', 'funded')
        .gte('converted_at', periodStart.toISOString());

      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch Evan's tasks
  const { data: tasksData } = useQuery({
    queryKey: ['evan-tasks-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_tasks')
        .select('id, status, is_completed, due_date, priority');
      if (error) throw error;
      return data;
    },
  });

  // Fetch Evan's communications
  const { data: communicationsData } = useQuery({
    queryKey: ['evan-communications-summary', timePeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_communications')
        .select('id, communication_type, created_at, duration_seconds')
        .gte('created_at', periodStart.toISOString());
      if (error) throw error;
      return data;
    },
  });

  // Calculate Evan's metrics
  const evanMetrics = useMemo(() => {
    if (!leadsData && !pipelineData && !fundedLeads) {
      return {
        totalRevenue: 0,
        totalDeals: 0,
        avgDealSize: 0,
        pipelineValue: 0,
        pipelineDeals: 0,
        winRate: 0,
        staleDeals: 0,
        callsCount: 0,
        emailsCount: 0,
        tasksCompleted: 0,
        tasksPending: 0,
        avgCallDuration: 0,
      };
    }

    const fundedDealsWithAmount = fundedLeads?.filter(
      (lead) => lead.lead_responses && lead.lead_responses.length > 0 && lead.lead_responses[0]?.loan_amount
    ) || [];

    const totalLoanVolume = fundedDealsWithAmount.reduce(
      (sum, lead) => sum + (lead.lead_responses?.[0]?.loan_amount || 0),
      0
    );
    const totalRevenue = totalLoanVolume * 0.02;
    const totalDeals = fundedDealsWithAmount.length;
    const avgDealSize = totalDeals > 0 ? totalRevenue / totalDeals : 0;

    const pipelineLeadsWithAmount = pipelineData?.filter(
      (lead) => lead.lead_responses && lead.lead_responses.length > 0
    ) || [];
    const pipelineValue = pipelineLeadsWithAmount.reduce(
      (sum, lead) => sum + (lead.lead_responses?.[0]?.loan_amount || 0) * 0.02,
      0
    );
    const pipelineDeals = pipelineData?.length || 0;

    // Calculate stale deals (no activity in 7+ days)
    const staleDeals = pipelineData?.filter((lead) => {
      const lastActivity = lead.last_activity_at || lead.created_at;
      return differenceInDays(now, new Date(lastActivity)) >= 7;
    }).length || 0;

    const totalLeadsInPeriod = leadsData?.length || 0;
    const winRate = totalLeadsInPeriod > 0 ? Math.round((totalDeals / totalLeadsInPeriod) * 100) : 0;

    // Communications stats
    const calls = communicationsData?.filter(c => c.communication_type === 'call') || [];
    const emails = communicationsData?.filter(c => c.communication_type === 'email') || [];
    const totalCallDuration = calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    const avgCallDuration = calls.length > 0 ? Math.round(totalCallDuration / calls.length / 60) : 0;

    // Tasks stats
    const tasksCompleted = tasksData?.filter(t => t.is_completed).length || 0;
    const tasksPending = tasksData?.filter(t => !t.is_completed).length || 0;

    return {
      totalRevenue,
      totalDeals,
      avgDealSize,
      pipelineValue,
      pipelineDeals,
      winRate,
      staleDeals,
      callsCount: calls.length,
      emailsCount: emails.length,
      tasksCompleted,
      tasksPending,
      avgCallDuration,
    };
  }, [leadsData, pipelineData, fundedLeads, communicationsData, tasksData, now]);

  // Monthly revenue chart data
  const monthlyRevenueData = useMemo(() => {
    const months = eachMonthOfInterval({
      start: startOfYear(now),
      end: now,
    });

    return months.map((month) => {
      const monthStart = month;
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

      const monthlyFunded = fundedLeads?.filter((lead) => {
        const convertedAt = lead.converted_at ? new Date(lead.converted_at) : null;
        return convertedAt && convertedAt >= monthStart && convertedAt <= monthEnd;
      }) || [];

      const revenue = monthlyFunded.reduce(
        (sum, lead) => sum + (lead.lead_responses?.[0]?.loan_amount || 0) * 0.02,
        0
      );

      return {
        month: format(month, 'MMM'),
        revenue,
        target: 125000,
        deals: monthlyFunded.length,
      };
    });
  }, [fundedLeads, now]);

  // Pipeline stage distribution
  const pipelineStageData = useMemo(() => {
    if (!pipelineData) return [];

    const stageMap: Record<string, { count: number; amount: number; color: string }> = {};

    pipelineData.forEach((lead) => {
      const stageName = lead.pipeline_leads?.[0]?.pipeline_stages?.name || lead.status || 'Unknown';
      const stageColor = lead.pipeline_leads?.[0]?.pipeline_stages?.color || STAGE_COLORS[lead.status] || '#94a3b8';
      
      if (!stageMap[stageName]) {
        stageMap[stageName] = { count: 0, amount: 0, color: stageColor };
      }
      stageMap[stageName].count++;
      stageMap[stageName].amount += (lead.lead_responses?.[0]?.loan_amount || 0) * 0.02;
    });

    return Object.entries(stageMap).map(([name, data]) => ({
      name,
      value: data.count,
      amount: data.amount,
      color: data.color,
    }));
  }, [pipelineData]);

  // Activity breakdown data
  const activityData = useMemo(() => {
    return [
      { name: 'Calls', value: evanMetrics.callsCount, color: '#0066FF' },
      { name: 'Emails', value: evanMetrics.emailsCount, color: '#FF8000' },
      { name: 'Tasks Done', value: evanMetrics.tasksCompleted, color: '#10b981' },
    ];
  }, [evanMetrics]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const periodLabel = timePeriod === 'ytd' ? 'Year to Date' : 'Month to Date';
  const isLoading = leadsLoading || pipelineLoading || fundedLoading;

  const annualTarget = 1500000;
  const ytdRevenue = monthlyRevenueData.reduce((sum, m) => sum + m.revenue, 0);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading team performance...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Team Performance</h1>
              <p className="text-sm text-muted-foreground">Employee results & metrics dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
              <TabsList className="bg-muted/50">
                <TabsTrigger value="mtd">MTD</TabsTrigger>
                <TabsTrigger value="ytd">YTD</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Employee Selector Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { id: 'evan', name: 'Evan', role: 'Analyst', active: true },
            { id: 'brad', name: 'Brad', role: 'Owner', active: false },
            { id: 'adam', name: 'Adam', role: 'Owner', active: false },
            { id: 'maura', name: 'Maura', role: 'Processor', active: false },
            { id: 'wendy', name: 'Wendy', role: 'Processor', active: false },
          ].map((emp) => (
            <Card
              key={emp.id}
              className={`cursor-pointer transition-all ${
                selectedEmployee === emp.id
                  ? 'border-primary bg-primary/5 shadow-md'
                  : emp.active
                  ? 'hover:border-primary/50 hover:bg-muted/30'
                  : 'opacity-50 cursor-not-allowed'
              }`}
              onClick={() => emp.active && setSelectedEmployee(emp.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-background">
                    <AvatarFallback className={selectedEmployee === emp.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}>
                      {emp.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.role}</p>
                  </div>
                </div>
                {!emp.active && (
                  <Badge variant="secondary" className="mt-2 text-[10px]">Coming Soon</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Evan's Dashboard */}
        {selectedEmployee === 'evan' && (
          <>
            {/* Goal Progress */}
            <Card className="bg-gradient-to-r from-primary/5 via-background to-orange-500/5 border-primary/20">
              <CardContent className="py-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-2 border-primary">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">E</AvatarFallback>
                    </Avatar>
                    <div>
                      <h2 className="text-xl font-bold">Evan's Performance</h2>
                      <p className="text-sm text-muted-foreground">{periodLabel} Results</p>
                    </div>
                  </div>
                  <div className="flex-1 max-w-lg">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">Revenue Goal Progress</span>
                      <span className="text-muted-foreground">{formatCurrency(ytdRevenue)} / $1.5M</span>
                    </div>
                    <Progress value={(ytdRevenue / annualTarget) * 100} className="h-3" />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{((ytdRevenue / annualTarget) * 100).toFixed(1)}% achieved</span>
                      <span>{formatCurrency(annualTarget - ytdRevenue)} to go</span>
                    </div>
                  </div>
                  <Button asChild variant="outline">
                    <Link to="/team/evan" className="gap-2">
                      View Full Dashboard
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-l-4 border-l-primary">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                      <p className="text-2xl font-bold">{formatCurrency(evanMetrics.totalRevenue)}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <ArrowUpRight className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-green-600">{evanMetrics.totalDeals} deals closed</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-full bg-primary/10">
                      <DollarSign className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Pipeline Value</p>
                      <p className="text-2xl font-bold">{formatCurrency(evanMetrics.pipelineValue)}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Briefcase className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{evanMetrics.pipelineDeals} active deals</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-full bg-orange-500/10">
                      <Target className="h-6 w-6 text-orange-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
                      <p className="text-2xl font-bold">{evanMetrics.winRate}%</p>
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        <span className="text-xs text-muted-foreground">Conversion rate</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-full bg-green-500/10">
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`border-l-4 ${evanMetrics.staleDeals > 0 ? 'border-l-red-500' : 'border-l-slate-300'}`}>
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Stale Deals</p>
                      <p className={`text-2xl font-bold ${evanMetrics.staleDeals > 0 ? 'text-red-600' : ''}`}>
                        {evanMetrics.staleDeals}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">7+ days inactive</span>
                      </div>
                    </div>
                    <div className={`p-3 rounded-full ${evanMetrics.staleDeals > 0 ? 'bg-red-500/10' : 'bg-muted'}`}>
                      <AlertTriangle className={`h-6 w-6 ${evanMetrics.staleDeals > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Monthly Revenue Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Monthly Revenue Trend
                  </CardTitle>
                  <CardDescription>Revenue performance over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyRevenueData}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0066FF" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#0066FF" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                          contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#0066FF"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorRevenue)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Pipeline by Stage */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Pipeline Distribution
                  </CardTitle>
                  <CardDescription>Deals by stage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px] flex items-center justify-center">
                    {pipelineStageData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pipelineStageData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {pipelineStageData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, name: string) => [
                              `${value} deals`,
                              name,
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-muted-foreground text-sm">No pipeline data</p>
                    )}
                  </div>
                  {pipelineStageData.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {pipelineStageData.slice(0, 6).map((stage) => (
                        <div key={stage.name} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="text-xs text-muted-foreground truncate">{stage.name}</span>
                          <span className="text-xs font-medium ml-auto">{stage.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Activity Stats */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-primary/10">
                      <Phone className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-2xl font-bold">{evanMetrics.callsCount}</p>
                      <p className="text-sm text-muted-foreground">Calls Made</p>
                    </div>
                    {evanMetrics.avgCallDuration > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        ~{evanMetrics.avgCallDuration} min avg
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-orange-500/10">
                      <Mail className="h-5 w-5 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-2xl font-bold">{evanMetrics.emailsCount}</p>
                      <p className="text-sm text-muted-foreground">Emails Sent</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-green-500/10">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-2xl font-bold">{evanMetrics.tasksCompleted}</p>
                      <p className="text-sm text-muted-foreground">Tasks Completed</p>
                    </div>
                    {evanMetrics.tasksPending > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {evanMetrics.tasksPending} pending
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default TeamPerformance;
