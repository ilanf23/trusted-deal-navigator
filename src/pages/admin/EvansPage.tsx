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
  LineChart,
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
  Users, 
  BarChart3, 
  PieChartIcon,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase
} from 'lucide-react';
import { startOfYear, startOfMonth, format, subMonths } from 'date-fns';

export type TimePeriod = 'mtd' | 'ytd';

// Mock data for charts
const monthlyRevenueData = [
  { month: 'Jan', revenue: 42000, target: 45000, deals: 3 },
  { month: 'Feb', revenue: 38000, target: 45000, deals: 2 },
  { month: 'Mar', revenue: 52000, target: 45000, deals: 4 },
  { month: 'Apr', revenue: 48000, target: 45000, deals: 3 },
  { month: 'May', revenue: 61000, target: 45000, deals: 5 },
  { month: 'Jun', revenue: 55000, target: 45000, deals: 4 },
  { month: 'Jul', revenue: 44000, target: 45000, deals: 3 },
  { month: 'Aug', revenue: 67000, target: 45000, deals: 5 },
  { month: 'Sep', revenue: 51000, target: 45000, deals: 4 },
  { month: 'Oct', revenue: 58000, target: 45000, deals: 4 },
  { month: 'Nov', revenue: 49000, target: 45000, deals: 3 },
  { month: 'Dec', revenue: 35000, target: 45000, deals: 2 },
];

const pipelineStageData = [
  { name: 'Discovery', value: 8, amount: 2400000, color: '#94a3b8' },
  { name: 'Pre-Qual', value: 5, amount: 1800000, color: '#60a5fa' },
  { name: 'Docs', value: 4, amount: 1450000, color: '#818cf8' },
  { name: 'Underwriting', value: 3, amount: 980000, color: '#a78bfa' },
  { name: 'Approval', value: 2, amount: 720000, color: '#22c55e' },
];

const dealSourceData = [
  { name: 'Referral', value: 42, color: '#3b82f6' },
  { name: 'Website', value: 28, color: '#22c55e' },
  { name: 'Cold Call', value: 18, color: '#f59e0b' },
  { name: 'Other', value: 12, color: '#94a3b8' },
];

const weeklyActivityData = [
  { day: 'Mon', calls: 12, emails: 24, meetings: 3 },
  { day: 'Tue', calls: 8, emails: 18, meetings: 2 },
  { day: 'Wed', calls: 15, emails: 22, meetings: 4 },
  { day: 'Thu', calls: 10, emails: 28, meetings: 2 },
  { day: 'Fri', calls: 14, emails: 20, meetings: 5 },
];

const EvansPage = () => {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('ytd');

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

  // Calculate metrics based on time period
  const metrics = useMemo(() => {
    const data = timePeriod === 'ytd' ? monthlyRevenueData : monthlyRevenueData.slice(-1);
    const totalRevenue = data.reduce((sum, m) => sum + m.revenue, 0);
    const totalTarget = data.reduce((sum, m) => sum + m.target, 0);
    const totalDeals = data.reduce((sum, m) => sum + m.deals, 0);
    const avgDealSize = totalDeals > 0 ? totalRevenue / totalDeals : 0;
    const paceVsPlan = totalTarget > 0 ? Math.round((totalRevenue / totalTarget) * 100) : 0;
    
    return {
      totalRevenue,
      totalTarget,
      totalDeals,
      avgDealSize,
      paceVsPlan,
      pipelineValue: pipelineStageData.reduce((sum, s) => sum + s.amount, 0),
      pipelineDeals: pipelineStageData.reduce((sum, s) => sum + s.value, 0),
    };
  }, [timePeriod]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const periodLabel = timePeriod === 'ytd' ? 'Year to Date' : 'Month to Date';

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
          
          <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="mtd">MTD</TabsTrigger>
              <TabsTrigger value="ytd">YTD</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(metrics.totalRevenue)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {metrics.paceVsPlan >= 100 ? (
                      <ArrowUpRight className="h-3 w-3 text-green-500" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-amber-500" />
                    )}
                    <span className={`text-xs ${metrics.paceVsPlan >= 100 ? 'text-green-600' : 'text-amber-600'}`}>
                      {metrics.paceVsPlan}% of target
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-full bg-blue-100">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Deals Closed</p>
                  <p className="text-2xl font-bold mt-1">{metrics.totalDeals}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg: {formatCurrency(metrics.avgDealSize)}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-green-100">
                  <Briefcase className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pipeline Value</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(metrics.pipelineValue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.pipelineDeals} active deals
                  </p>
                </div>
                <div className="p-3 rounded-full bg-purple-100">
                  <Target className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
                  <p className="text-2xl font-bold mt-1">34%</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span className="text-xs text-green-600">+5% vs last period</span>
                  </div>
                </div>
                <div className="p-3 rounded-full bg-amber-100">
                  <Activity className="h-5 w-5 text-amber-600" />
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
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {dealSourceData.map((source) => (
                  <div key={source.name} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: source.color }}
                    />
                    <span className="text-xs text-muted-foreground">{source.name}</span>
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
                      width={70}
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
                  <CardDescription>Calls, emails & meetings</CardDescription>
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
                  <p className="text-xl font-bold text-blue-600">59</p>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-green-600">112</p>
                  <p className="text-xs text-muted-foreground">Total Emails</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-amber-600">16</p>
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
              <Badge variant={metrics.paceVsPlan >= 100 ? 'default' : 'secondary'}>
                {metrics.paceVsPlan >= 100 ? 'On Track' : 'Behind Pace'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{formatCurrency(metrics.totalRevenue)}</span>
                <span className="text-lg text-muted-foreground">of $600K</span>
              </div>
              <Progress value={(metrics.totalRevenue / 600000) * 100} className="h-3" />
              <div className="grid grid-cols-4 gap-4 pt-2">
                <div>
                  <p className="text-sm text-muted-foreground">Q1</p>
                  <p className="font-semibold">{formatCurrency(132000)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Q2</p>
                  <p className="font-semibold">{formatCurrency(164000)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Q3</p>
                  <p className="font-semibold">{formatCurrency(162000)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Q4</p>
                  <p className="font-semibold">{formatCurrency(142000)}</p>
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
