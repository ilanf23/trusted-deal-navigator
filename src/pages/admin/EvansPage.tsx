import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Line,
  Area,
  AreaChart,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  BarChart3, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  Loader2
} from 'lucide-react';
import { startOfYear, startOfMonth, format, subMonths, eachMonthOfInterval, startOfDay, subDays, eachDayOfInterval, getDay } from 'date-fns';

export type TimePeriod = 'mtd' | 'ytd';

const STAGE_COLORS: Record<string, string> = {
  discovery: '#94a3b8',
  pre_qualification: '#60a5fa',
  document_collection: '#818cf8',
  underwriting: '#a78bfa',
  approval: '#22c55e',
  funded: '#10b981',
};

const SOURCE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#94a3b8'];

const EvansPage = () => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('ytd');

  const now = new Date();
  const periodStart = timePeriod === 'ytd' ? startOfYear(now) : startOfMonth(now);

  // Fetch Evan's team member ID
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

  // Fetch leads with their responses (for loan amounts)
  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['evan-leads-analytics', evanId, timePeriod],
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
          lead_responses (
            loan_amount,
            funding_amount
          )
        `)
        .gte('created_at', periodStart.toISOString());
      
      if (error) throw error;
      return data;
    },
    enabled: true,
  });

  // Fetch communications for activity data
  const { data: communicationsData, isLoading: commsLoading } = useQuery({
    queryKey: ['evan-communications-analytics', timePeriod],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_communications')
        .select('id, communication_type, direction, created_at, duration_seconds')
        .gte('created_at', periodStart.toISOString())
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch all leads for pipeline (not just period-filtered)
  const { data: pipelineData, isLoading: pipelineLoading } = useQuery({
    queryKey: ['evan-pipeline-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          status,
          lead_responses (
            loan_amount,
            funding_amount
          )
        `)
        .neq('status', 'funded');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch funded leads for revenue calculation
  const { data: fundedLeads, isLoading: fundedLoading } = useQuery({
    queryKey: ['evan-funded-analytics', timePeriod],
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
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!leadsData && !pipelineData && !fundedLeads) {
      return {
        totalRevenue: 0,
        totalDeals: 0,
        avgDealSize: 0,
        pipelineValue: 0,
        pipelineDeals: 0,
        winRate: 0,
      };
    }

    // Revenue from funded deals (assuming 2% fee)
    const fundedDealsWithAmount = fundedLeads?.filter(
      (lead) => lead.lead_responses && lead.lead_responses.length > 0 && lead.lead_responses[0]?.loan_amount
    ) || [];
    
    const totalLoanVolume = fundedDealsWithAmount.reduce(
      (sum, lead) => sum + (lead.lead_responses?.[0]?.loan_amount || 0),
      0
    );
    const totalRevenue = totalLoanVolume * 0.02; // 2% fee
    const totalDeals = fundedDealsWithAmount.length;
    const avgDealSize = totalDeals > 0 ? totalRevenue / totalDeals : 0;

    // Pipeline value
    const pipelineLeadsWithAmount = pipelineData?.filter(
      (lead) => lead.lead_responses && lead.lead_responses.length > 0
    ) || [];
    const pipelineValue = pipelineLeadsWithAmount.reduce(
      (sum, lead) => sum + (lead.lead_responses?.[0]?.loan_amount || 0) * 0.02,
      0
    );
    const pipelineDeals = pipelineData?.length || 0;

    // Win rate (funded / total leads in period)
    const totalLeadsInPeriod = leadsData?.length || 0;
    const winRate = totalLeadsInPeriod > 0 ? Math.round((totalDeals / totalLeadsInPeriod) * 100) : 0;

    return {
      totalRevenue,
      totalDeals,
      avgDealSize,
      pipelineValue,
      pipelineDeals,
      winRate,
    };
  }, [leadsData, pipelineData, fundedLeads]);

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
        target: 50000, // $50K monthly target
        deals: monthlyFunded.length,
      };
    });
  }, [fundedLeads, now]);

  // Pipeline stage data
  const pipelineStageData = useMemo(() => {
    if (!pipelineData) return [];

    const stageMap: Record<string, { count: number; amount: number }> = {};
    
    pipelineData.forEach((lead) => {
      const status = lead.status;
      if (!stageMap[status]) {
        stageMap[status] = { count: 0, amount: 0 };
      }
      stageMap[status].count++;
      stageMap[status].amount += (lead.lead_responses?.[0]?.loan_amount || 0) * 0.02;
    });

    const stageOrder = ['discovery', 'pre_qualification', 'document_collection', 'underwriting', 'approval'];
    const stageLabels: Record<string, string> = {
      discovery: 'Discovery',
      pre_qualification: 'Pre-Qual',
      document_collection: 'Docs',
      underwriting: 'Underwriting',
      approval: 'Approval',
    };

    return stageOrder
      .filter((stage) => stageMap[stage])
      .map((stage) => ({
        name: stageLabels[stage] || stage,
        value: stageMap[stage].count,
        amount: stageMap[stage].amount,
        color: STAGE_COLORS[stage] || '#94a3b8',
      }));
  }, [pipelineData]);

  // Deal sources chart data
  const dealSourceData = useMemo(() => {
    if (!leadsData) return [];

    const sourceMap: Record<string, number> = {};
    leadsData.forEach((lead) => {
      const source = lead.source || 'Other';
      sourceMap[source] = (sourceMap[source] || 0) + 1;
    });

    const total = Object.values(sourceMap).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(sourceMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count], index) => ({
        name,
        value: total > 0 ? Math.round((count / total) * 100) : 0,
        color: SOURCE_COLORS[index] || '#94a3b8',
      }));
  }, [leadsData]);

  // Weekly activity data
  const weeklyActivityData = useMemo(() => {
    if (!communicationsData) return [];

    const last7Days = eachDayOfInterval({
      start: subDays(now, 6),
      end: now,
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return last7Days.map((day) => {
      const dayStart = startOfDay(day);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayCommunications = communicationsData.filter((comm) => {
        const commDate = new Date(comm.created_at);
        return commDate >= dayStart && commDate < dayEnd;
      });

      const calls = dayCommunications.filter((c) => c.communication_type === 'call').length;
      const emails = dayCommunications.filter((c) => c.communication_type === 'email').length;
      const meetings = dayCommunications.filter((c) => c.communication_type === 'meeting').length;

      return {
        day: dayNames[getDay(day)],
        calls,
        emails,
        meetings,
      };
    });
  }, [communicationsData, now]);

  // Activity totals
  const activityTotals = useMemo(() => {
    if (!communicationsData) return { calls: 0, emails: 0, meetings: 0 };

    return {
      calls: communicationsData.filter((c) => c.communication_type === 'call').length,
      emails: communicationsData.filter((c) => c.communication_type === 'email').length,
      meetings: communicationsData.filter((c) => c.communication_type === 'meeting').length,
    };
  }, [communicationsData]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const periodLabel = timePeriod === 'ytd' ? 'Year to Date' : 'Month to Date';
  const isLoading = leadsLoading || commsLoading || pipelineLoading || fundedLoading;

  // Calculate quarterly revenue for annual goal
  const quarterlyRevenue = useMemo(() => {
    if (!fundedLeads) return [0, 0, 0, 0];

    const quarters = [0, 0, 0, 0];
    fundedLeads?.forEach((lead) => {
      if (lead.converted_at) {
        const month = new Date(lead.converted_at).getMonth();
        const quarter = Math.floor(month / 3);
        quarters[quarter] += (lead.lead_responses?.[0]?.loan_amount || 0) * 0.02;
      }
    });
    return quarters;
  }, [fundedLeads]);

  const annualTarget = 600000;
  const ytdRevenue = monthlyRevenueData.reduce((sum, m) => sum + m.revenue, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
              <p className="text-sm text-muted-foreground">Performance metrics & insights</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
              <TabsList className="bg-muted/50">
                <TabsTrigger value="mtd">MTD</TabsTrigger>
                <TabsTrigger value="ytd">YTD</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 dark:from-blue-950/30 dark:to-background dark:border-blue-900/30">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(metrics.totalRevenue)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {metrics.totalRevenue > 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-green-500" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-amber-500" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {periodLabel}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/50">
                  <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-white border-green-100 dark:from-green-950/30 dark:to-background dark:border-green-900/30">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Deals Closed</p>
                  <p className="text-2xl font-bold mt-1">{metrics.totalDeals}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg: {formatCurrency(metrics.avgDealSize)}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/50">
                  <Briefcase className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100 dark:from-purple-950/30 dark:to-background dark:border-purple-900/30">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pipeline Value</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(metrics.pipelineValue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.pipelineDeals} active deals
                  </p>
                </div>
                <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/50">
                  <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100 dark:from-amber-950/30 dark:to-background dark:border-amber-900/30">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
                  <p className="text-2xl font-bold mt-1">{metrics.winRate}%</p>
                  <div className="flex items-center gap-1 mt-1">
                    {metrics.winRate >= 30 ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-amber-500" />
                    )}
                    <span className="text-xs text-muted-foreground">Conversion rate</span>
                  </div>
                </div>
                <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/50">
                  <Activity className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Trend Chart - Takes 2 columns */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Revenue vs Target</CardTitle>
                  <CardDescription>Monthly performance comparison</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {periodLabel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyRevenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis 
                      tick={{ fontSize: 12 }} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => `$${value / 1000}k`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                      name="Revenue"
                    />
                    <Line
                      type="monotone"
                      dataKey="target"
                      stroke="#94a3b8"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Target"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Deal Sources Pie Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Deal Sources</CardTitle>
              <CardDescription>Lead origin breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                {dealSourceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dealSourceData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {dealSourceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => [`${value}%`, '']}
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No data available
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {dealSourceData.map((source) => (
                  <div key={source.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: source.color }}
                    />
                    <span className="text-xs text-muted-foreground truncate">{source.name}</span>
                    <span className="text-xs font-medium ml-auto">{source.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline Funnel */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Pipeline Stages</CardTitle>
                  <CardDescription>Deals by stage with values</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                {pipelineStageData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={pipelineStageData} 
                      layout="vertical"
                      margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        tick={{ fontSize: 12 }} 
                        tickLine={false} 
                        axisLine={false}
                        width={80}
                      />
                      <Tooltip 
                        formatter={(value: number, name: string) => [
                          name === 'value' ? `${value} deals` : formatCurrency(value),
                          name === 'value' ? 'Deals' : 'Value'
                        ]}
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar 
                        dataKey="value" 
                        radius={[0, 4, 4, 0]}
                      >
                        {pipelineStageData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No deals in pipeline
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <span className="text-sm text-muted-foreground">Total Pipeline</span>
                <span className="text-lg font-bold">{formatCurrency(metrics.pipelineValue)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Activity Chart */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Weekly Activity</CardTitle>
                  <CardDescription>Calls, emails & meetings (last 7 days)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyActivityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend 
                      iconType="circle" 
                      iconSize={8}
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                    <Bar dataKey="calls" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Calls" />
                    <Bar dataKey="emails" fill="#22c55e" radius={[4, 4, 0, 0]} name="Emails" />
                    <Bar dataKey="meetings" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Meetings" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t mt-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-blue-600">{activityTotals.calls}</p>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-green-600">{activityTotals.emails}</p>
                  <p className="text-xs text-muted-foreground">Total Emails</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-amber-600">{activityTotals.meetings}</p>
                  <p className="text-xs text-muted-foreground">Total Meetings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row - Target Progress */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Annual Goal Progress</CardTitle>
                <CardDescription>Road to $600K revenue target</CardDescription>
              </div>
              <Badge variant={ytdRevenue >= annualTarget * 0.8 ? 'default' : 'secondary'}>
                {ytdRevenue >= annualTarget * 0.8 ? 'On Track' : 'Behind Pace'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{formatCurrency(ytdRevenue)}</span>
                <span className="text-lg text-muted-foreground">of $600K</span>
              </div>
              <Progress value={(ytdRevenue / annualTarget) * 100} className="h-3" />
              <div className="grid grid-cols-4 gap-4 pt-2">
                <div>
                  <p className="text-sm text-muted-foreground">Q1</p>
                  <p className="font-semibold">{formatCurrency(quarterlyRevenue[0])}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Q2</p>
                  <p className="font-semibold">{formatCurrency(quarterlyRevenue[1])}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Q3</p>
                  <p className="font-semibold">{formatCurrency(quarterlyRevenue[2])}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Q4</p>
                  <p className="font-semibold">{formatCurrency(quarterlyRevenue[3])}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default EvansPage;
