import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import EvanLayout from '@/components/evan/EvanLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  Loader2,
  Calculator,
  CheckCircle2,
  Circle,
  Clock,
  CalendarDays
} from 'lucide-react';
import { startOfYear, startOfMonth, format, eachMonthOfInterval, isAfter, isBefore, addDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { TopActions } from '@/components/evan/dashboard/TopActions';
import { NudgesWidget } from '@/components/evan/dashboard/NudgesWidget';

export type TimePeriod = 'mtd' | 'ytd';

// Brand-aligned chart colors - Blue (#0066FF) and Orange (#FF8000) palette
const STAGE_COLORS: Record<string, string> = {
  discovery: 'hsl(217, 91%, 60%)',      // Primary blue
  pre_qualification: 'hsl(217, 91%, 50%)', // Darker blue
  document_collection: 'hsl(217, 91%, 40%)', // Even darker blue
  underwriting: 'hsl(30, 100%, 50%)',    // Brand orange
  approval: 'hsl(30, 100%, 45%)',        // Darker orange
  funded: 'hsl(142, 50%, 45%)',          // Success green (keep for contrast)
};

// Brand colors for Deal Sources pie chart
const SOURCE_COLORS = [
  'hsl(217, 91%, 50%)',   // Primary blue
  'hsl(30, 100%, 50%)',   // Brand orange
  'hsl(217, 91%, 65%)',   // Light blue
  'hsl(30, 100%, 65%)',   // Light orange
  'hsl(217, 91%, 35%)',   // Dark blue
  'hsl(30, 100%, 35%)',   // Dark orange
];

const EvansPage = () => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('ytd');
  const [calcLoanAmount, setCalcLoanAmount] = useState<string>('500000');
  const [calcExtraDeals, setCalcExtraDeals] = useState<string>('0');

  const now = new Date();
  const periodStart = timePeriod === 'ytd' ? startOfYear(now) : startOfMonth(now);

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) {
      return 'Good morning, Evan!';
    } else if (hour >= 12 && hour < 16) {
      const dayName = format(now, 'EEEE');
      return `Happy ${dayName}, Evan!`;
    } else {
      return 'Good afternoon, Evan!';
    }
  };

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
  const { data: leadsData, isLoading: leadsLoading, isFetching: leadsFetching } = useQuery({
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
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch upcoming tasks
  const { data: upcomingTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['evan-upcoming-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_tasks')
        .select('*')
        .eq('is_completed', false)
        .lte('due_date', addDays(now, 7).toISOString())
        .order('due_date', { ascending: true })
        .limit(6);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch all leads for pipeline (not just period-filtered)
  const { data: pipelineData, isLoading: pipelineLoading, isFetching: pipelineFetching } = useQuery({
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
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch funded leads for revenue calculation
  const { data: fundedLeads, isLoading: fundedLoading, isFetching: fundedFetching } = useQuery({
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
    staleTime: 0,
    refetchOnMount: 'always',
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
      const monthLabel = format(month, 'MMM');
      
      const monthlyFunded = fundedLeads?.filter((lead) => {
        const convertedAt = lead.converted_at ? new Date(lead.converted_at) : null;
        return convertedAt && convertedAt >= monthStart && convertedAt <= monthEnd;
      }) || [];

      const revenue = monthlyFunded.reduce(
        (sum, lead) => sum + (lead.lead_responses?.[0]?.loan_amount || 0) * 0.02,
        0
      );

      return {
        month: monthLabel,
        revenue,
        target: 125000, // $1.5M / 12 months
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

  // Commission calculator
  const commissionCalc = useMemo(() => {
    const loanAmount = parseFloat(calcLoanAmount) || 0;
    const extraDeals = parseInt(calcExtraDeals) || 0;
    
    // Base commission: 2% of loan amount
    const baseCommission = loanAmount * 0.02;
    
    // Extra bonus: 10% additional per extra deal closed
    const bonusMultiplier = 1 + (extraDeals * 0.10);
    const totalCommission = baseCommission * bonusMultiplier;
    const bonusAmount = totalCommission - baseCommission;
    
    return {
      baseCommission,
      bonusAmount,
      totalCommission,
      bonusPercentage: extraDeals * 10,
    };
  }, [calcLoanAmount, calcExtraDeals]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const periodLabel = timePeriod === 'ytd' ? 'Year to Date' : 'Month to Date';
  const isLoading = leadsLoading || pipelineLoading || fundedLoading;
  const isFetching = leadsFetching || pipelineFetching || fundedFetching;

  // Calculate quarterly revenue for annual goal - MUST be before early return
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

  const annualTarget = 1500000; // $1.5M goal
  const ytdRevenue = monthlyRevenueData.reduce((sum, m) => sum + m.revenue, 0);

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 dark:bg-red-950/50';
      case 'medium': return 'text-amber-600 bg-amber-50 dark:bg-amber-950/50';
      case 'low': return 'text-green-600 bg-green-50 dark:bg-green-950/50';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return isBefore(new Date(dueDate), now);
  };
  
  // Show loading state on initial load to prevent flash of stale data
  if (isLoading) {
    return (
      <EvanLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </EvanLayout>
    );
  }

  return (
    <EvanLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header - responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{getGreeting()}</h1>
            <p className="text-sm md:text-base text-muted-foreground">Here's your performance overview</p>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
              <TabsList className="bg-muted/50 h-8 md:h-9">
                <TabsTrigger value="mtd" className="text-xs md:text-sm px-2 md:px-3">MTD</TabsTrigger>
                <TabsTrigger value="ytd" className="text-xs md:text-sm px-2 md:px-3">YTD</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Annual Goal Progress - Hero Style */}
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-white">
          {/* Background decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <CardContent className="relative z-10 p-6 md:p-8">
            <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
              {/* Main content */}
              <div className="flex-1 text-center lg:text-left space-y-4">
                <div>
                  <p className="text-white/70 text-sm font-medium uppercase tracking-wider">2026 Revenue Goal</p>
                  <div className="flex items-baseline gap-2 justify-center lg:justify-start mt-1">
                    <span className="text-4xl md:text-5xl font-bold">{formatCurrency(ytdRevenue)}</span>
                    <span className="text-xl md:text-2xl text-white/60">/ $1.5M</span>
                  </div>
                </div>
                
                {/* Motivational message */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 max-w-md mx-auto lg:mx-0">
                  {ytdRevenue >= annualTarget * 0.8 ? (
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-green-300" />
                      </div>
                      <div>
                        <p className="font-semibold">You're on fire! 🔥</p>
                        <p className="text-sm text-white/70">Keep this momentum going</p>
                      </div>
                    </div>
                  ) : ytdRevenue >= annualTarget * 0.5 ? (
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/20 rounded-lg">
                        <Target className="h-5 w-5 text-amber-300" />
                      </div>
                      <div>
                        <p className="font-semibold">Halfway there!</p>
                        <p className="text-sm text-white/70">{formatCurrency(annualTarget - ytdRevenue)} to go</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <Activity className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">Building momentum</p>
                        <p className="text-sm text-white/70">{formatCurrency(annualTarget - ytdRevenue)} to reach your goal</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Revenue Chart */}
              <div className="w-full lg:w-[400px] h-[160px] bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <p className="text-xs text-white/60 mb-2 font-medium uppercase tracking-wider">Monthly Revenue</p>
                <ResponsiveContainer width="100%" height="85%">
                  <AreaChart data={monthlyRevenueData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <defs>
                      <linearGradient id="heroRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="rgba(255,255,255,0.4)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="rgba(255,255,255,0.1)" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }}
                      interval={0}
                    />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(0,0,0,0.8)', 
                        border: 'none', 
                        borderRadius: '8px',
                        color: 'white'
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                      labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="rgba(255,255,255,0.8)" 
                      strokeWidth={2}
                      fill="url(#heroRevenueGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* P&L Revenue Breakdown */}
        <Card className="border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                P&L Revenue Breakdown
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {timePeriod === 'ytd' ? 'Year to Date' : 'Month to Date'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              // Calculate revenue per increment based on time period
              const periodRevenue = timePeriod === 'ytd' ? ytdRevenue : monthlyRevenueData[monthlyRevenueData.length - 1]?.revenue || 0;
              
              // YTD calculations
              const dayOfYear = Math.floor((now.getTime() - startOfYear(now).getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const weekOfYear = Math.ceil(dayOfYear / 7);
              const monthOfYear = now.getMonth() + 1;
              
              // MTD calculations
              const dayOfMonth = now.getDate();
              const weekOfMonth = Math.ceil(dayOfMonth / 7);
              
              const increments = timePeriod === 'ytd' 
                ? [
                    { label: 'Per Day', value: periodRevenue / dayOfYear, count: dayOfYear, unit: 'days' },
                    { label: 'Per Week', value: periodRevenue / weekOfYear, count: weekOfYear, unit: 'weeks' },
                    { label: 'Per Month', value: periodRevenue / monthOfYear, count: monthOfYear, unit: 'months' },
                  ]
                : [
                    { label: 'Per Day', value: periodRevenue / dayOfMonth, count: dayOfMonth, unit: 'days' },
                    { label: 'Per Week', value: periodRevenue / Math.max(1, weekOfMonth), count: weekOfMonth, unit: 'weeks' },
                  ];

              return (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {increments.map((inc) => (
                    <div key={inc.label} className="p-4 rounded-lg bg-muted/50 border">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{inc.label}</p>
                      <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(inc.value)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Based on {inc.count} {inc.unit}
                      </p>
                    </div>
                  ))}
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Revenue</p>
                    <p className="text-2xl font-bold mt-1">{formatCurrency(periodRevenue)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {timePeriod === 'ytd' ? `Jan 1 - ${format(now, 'MMM d')}` : format(now, 'MMMM yyyy')}
                    </p>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* KPI Cards Row - responsive */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
          <Card className="border hover:border-primary/30 transition-colors">
            <CardContent className="pt-4 md:pt-5 px-3 md:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm font-medium text-muted-foreground">Revenue</p>
                  <p className="text-lg md:text-2xl font-bold mt-0.5 md:mt-1">{formatCurrency(metrics.totalRevenue)}</p>
                  <div className="flex items-center gap-1 mt-0.5 md:mt-1">
                    {metrics.totalRevenue > 0 ? (
                      <ArrowUpRight className="h-2.5 w-2.5 md:h-3 md:w-3 text-green-600" />
                    ) : (
                      <ArrowDownRight className="h-2.5 w-2.5 md:h-3 md:w-3 text-red-500" />
                    )}
                    <span className="text-[10px] md:text-xs text-muted-foreground">
                      {periodLabel}
                    </span>
                  </div>
                </div>
                <div className="p-2 md:p-3 rounded-full bg-primary/10">
                  <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border hover:border-primary/30 transition-colors">
            <CardContent className="pt-4 md:pt-5 px-3 md:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm font-medium text-muted-foreground">Deals Closed</p>
                  <p className="text-lg md:text-2xl font-bold mt-0.5 md:mt-1">{metrics.totalDeals}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
                    Avg: {formatCurrency(metrics.avgDealSize)}
                  </p>
                </div>
                <div className="p-2 md:p-3 rounded-full bg-muted">
                  <Briefcase className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border hover:border-primary/30 transition-colors">
            <CardContent className="pt-4 md:pt-5 px-3 md:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm font-medium text-muted-foreground">Pipeline</p>
                  <p className="text-lg md:text-2xl font-bold mt-0.5 md:mt-1">{formatCurrency(metrics.pipelineValue)}</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">
                    {metrics.pipelineDeals} deals
                  </p>
                </div>
                <div className="p-2 md:p-3 rounded-full bg-muted">
                  <Target className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border hover:border-primary/30 transition-colors">
            <CardContent className="pt-4 md:pt-5 px-3 md:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs md:text-sm font-medium text-muted-foreground">Win Rate</p>
                  <p className="text-lg md:text-2xl font-bold mt-0.5 md:mt-1">{metrics.winRate}%</p>
                  <div className="flex items-center gap-1 mt-0.5 md:mt-1">
                    {metrics.winRate >= 30 ? (
                      <TrendingUp className="h-2.5 w-2.5 md:h-3 md:w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-2.5 w-2.5 md:h-3 md:w-3 text-red-500" />
                    )}
                    <span className="text-[10px] md:text-xs text-muted-foreground">Conversion</span>
                  </div>
                </div>
                <div className="p-2 md:p-3 rounded-full bg-muted">
                  <Activity className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Nudges Widget - Only shows if there are leads needing follow-up */}
        <NudgesWidget evanId={evanId} />

        {/* Top 10 Actions Now */}
        <TopActions evanId={evanId} />

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

          {/* Upcoming To-Do Section */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Upcoming To-Do</CardTitle>
                  <CardDescription>Tasks due in the next 7 days</CardDescription>
                </div>
                <Link to="/user/evan/tasks">
                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">
                    View All
                  </Badge>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tasksLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : upcomingTasks && upcomingTasks.length > 0 ? (
                  upcomingTasks.map((task) => (
                    <div 
                      key={task.id} 
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="mt-0.5">
                        {task.is_completed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {task.due_date && (
                            <div className={`flex items-center gap-1 text-xs ${isOverdue(task.due_date) ? 'text-red-600' : 'text-muted-foreground'}`}>
                              {isOverdue(task.due_date) ? (
                                <Clock className="h-3 w-3" />
                              ) : (
                                <CalendarDays className="h-3 w-3" />
                              )}
                              {format(new Date(task.due_date), 'MMM d')}
                            </div>
                          )}
                          {task.priority && (
                            <Badge variant="secondary" className={`text-xs py-0 px-1.5 ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>No upcoming tasks!</p>
                    <p className="text-xs mt-1">You're all caught up</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Commission Calculator */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Commission Calculator</CardTitle>
                <CardDescription>Estimate your earnings with bonus for extra deals</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Inputs */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loanAmount">Loan Amount</Label>
                  <Input
                    id="loanAmount"
                    type="number"
                    value={calcLoanAmount}
                    onChange={(e) => setCalcLoanAmount(e.target.value)}
                    placeholder="500000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="extraDeals">Extra Deals Closed This Period</Label>
                  <Input
                    id="extraDeals"
                    type="number"
                    min="0"
                    max="10"
                    value={calcExtraDeals}
                    onChange={(e) => setCalcExtraDeals(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    +10% commission bonus per extra deal
                  </p>
                </div>
              </div>

              {/* Results */}
              <div className="md:col-span-2 grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Base Commission (2%)</p>
                  <p className="text-xl font-bold">{formatCurrencyFull(commissionCalc.baseCommission)}</p>
                </div>
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 text-center">
                  <p className="text-xs text-green-600 dark:text-green-400 mb-1">
                    Bonus (+{commissionCalc.bonusPercentage}%)
                  </p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    +{formatCurrencyFull(commissionCalc.bonusAmount)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-primary/10 text-center">
                  <p className="text-xs text-primary mb-1">Total Commission</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrencyFull(commissionCalc.totalCommission)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </EvanLayout>
  );
};

export default EvansPage;
