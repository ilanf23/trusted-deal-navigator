import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users, Handshake, Calendar, Eye, AlertCircle, Loader2,
  ChevronDown, ChevronUp, Filter,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useSuperAdminDashboard, getTeamMemberUrl, getTeamMemberRole, type TimePeriod } from '@/hooks/useSuperAdminDashboard';
import { CompactKPITile, CompactKPITileSkeleton } from '@/components/admin/dashboard/CompactKPITile';
import { RevenueComboChart, type ComboChartDataPoint } from '@/components/admin/dashboard/RevenueComboChart';
import { ActivityHeatmap, ActivityHeatmapSkeleton } from '@/components/admin/dashboard/ActivityHeatmap';
import { PipelineStageBar, PipelineStageBarSkeleton, type PipelineStageData } from '@/components/admin/dashboard/PipelineStageBar';
import { cn } from '@/lib/utils';

const PIPELINE_STAGE_COLORS: Record<string, string> = {
  'Discovery': 'blue',
  'Pre-Qualification': 'cyan',
  'Document Collection': 'amber',
  'Underwriting': 'orange',
  'Lender Management': 'violet',
  'Path to Close': 'emerald',
  'Closed': 'teal',
};

const formatCurrency = (amount: number) => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  return `$${(amount / 1000).toFixed(0)}K`;
};

const formatLargeAmount = (amount: number) => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
};

const getConfidenceGradient = (score: number) => {
  if (score >= 70) return 'from-emerald-500 to-emerald-400';
  if (score >= 50) return 'from-amber-500 to-amber-400';
  return 'from-red-500 to-red-400';
};

const getConfidenceLabel = (score: number) => {
  if (score >= 80) return 'Very High';
  if (score >= 70) return 'High';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'Low';
  return 'Very Low';
};

const getConversionColor = (rate: number) => {
  if (rate > 20) return 'text-emerald-600 dark:text-emerald-400';
  if (rate >= 10) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Hot': return 'bg-red-500 hover:bg-red-600';
    case 'Warm': return 'bg-orange-500 hover:bg-orange-600';
    case 'Cold': return 'bg-blue-500 hover:bg-blue-600';
    case 'Dormant': return 'bg-gray-500 hover:bg-gray-600';
    default: return 'bg-gray-500';
  }
};

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { teamMember, isOwner, loading } = useTeamMember();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('ytd');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [pipelineExpanded, setPipelineExpanded] = useState(false);

  const {
    currentMetrics, pipelineStages, teamMembers, referrals, scorecard,
    teamUsers, activityHeatmapData, sparklineData, revenueByTeamMember,
    periodOverPeriod, isLoading, isError, heatmapLoading, sparklineLoading,
    annualTarget,
  } = useSuperAdminDashboard(timePeriod);

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Admin Dashboard');
    return () => { setPageTitle(null); };
  }, [setPageTitle]);

  useEffect(() => {
    if (!loading && teamMember && !isOwner) {
      navigate(`/admin/${teamMember.name.toLowerCase()}`, { replace: true });
    }
  }, [loading, teamMember, isOwner, navigate]);

  // Derived metrics
  const revenueAmount = currentMetrics?.current_amount ?? 0;
  const targetRevenue = currentMetrics?.target_amount ?? 1;
  const percentOfTarget = (revenueAmount / targetRevenue) * 100;
  const paceVsPlan = currentMetrics?.pace_vs_plan ?? 0;
  const forecastConfidence = currentMetrics?.forecast_confidence ?? 0;
  const weightedForecast = currentMetrics?.forecast_amount ?? 0;
  const forecastAsPercentOfTarget = (weightedForecast / targetRevenue) * 100;

  const shortLabel = timePeriod === 'ytd' ? 'YTD' : 'MTD';

  const avgConversion = teamMembers.length > 0
    ? teamMembers.reduce((sum, m) => sum + m.conversion, 0) / teamMembers.length
    : 0;

  const totalDeals = pipelineStages.reduce((sum, s) => sum + s.deal_count, 0);
  const lateStageDeals = pipelineStages
    .filter(s => ['Lender Management', 'Path to Close', 'Closed'].includes(s.stage))
    .reduce((sum, s) => sum + s.deal_count, 0);
  const pipelineHealth = totalDeals > 0 ? (lateStageDeals / totalDeals) * 100 : 0;

  const paceScore = Math.min(paceVsPlan, 100);
  const overallConfidence = Math.round(
    paceScore * 0.25 +
    forecastConfidence * 0.25 +
    Math.min(forecastAsPercentOfTarget, 100) * 0.20 +
    pipelineHealth * 0.15 +
    avgConversion * 0.15,
  );

  const totalPipelineValue = pipelineStages.reduce((sum, s) => sum + s.total_requested, 0);

  // Combo chart data from sparkline (12 months)
  const comboChartData: ComboChartDataPoint[] = useMemo(() => {
    const now = new Date();
    const monthlyTarget = annualTarget / 12;
    let cumulative = 0;

    return sparklineData.revenue.map((rev, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      cumulative += rev;
      return {
        label,
        revenue: rev,
        cumulative,
        target: monthlyTarget * (i + 1),
      };
    });
  }, [sparklineData.revenue, annualTarget]);

  // Pipeline bar data
  const pipelineBarData: PipelineStageData[] = useMemo(() => {
    return pipelineStages.map((s) => ({
      stageId: s.stage,
      stageName: s.stage,
      dealCount: s.deal_count,
      totalValue: s.total_requested,
      weightedForecast: s.total_weighted_fees,
      colorName: PIPELINE_STAGE_COLORS[s.stage],
    }));
  }, [pipelineStages]);

  // Team member filter
  const toggleMember = useCallback((name: string) => {
    setSelectedMembers((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }, []);

  const filteredTeamMembers = useMemo(() => {
    if (selectedMembers.length === 0) return teamMembers;
    return teamMembers.filter((m) => selectedMembers.includes(m.name));
  }, [teamMembers, selectedMembers]);

  // Revenue bar for team performance (relative to max)
  const maxTeamRevenue = useMemo(() => {
    if (revenueByTeamMember.length === 0) return 1;
    return Math.max(...revenueByTeamMember.map((m) => m.revenue), 1);
  }, [revenueByTeamMember]);

  const teamRevenueMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of revenueByTeamMember) map.set(m.name, m.revenue);
    return map;
  }, [revenueByTeamMember]);

  if (isError) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">Failed to load dashboard</h2>
              <p className="text-muted-foreground">There was an error loading the dashboard data. Please try refreshing the page.</p>
              <Button onClick={() => window.location.reload()}>Refresh Page</Button>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        {/* Unified filter bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  selectedMembers.length > 0
                    ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted ring-1 ring-border/50',
                )}>
                  <Filter className="h-3.5 w-3.5" />
                  {selectedMembers.length === 0
                    ? 'All Members'
                    : `${selectedMembers.length} member${selectedMembers.length > 1 ? 's' : ''}`}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-3" align="end">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium">Filter by Member</p>
                  {selectedMembers.length > 0 && (
                    <button
                      onClick={() => setSelectedMembers([])}
                      className="text-xs text-primary hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {teamMembers.map((member) => (
                    <label
                      key={member.name}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedMembers.includes(member.name)}
                        onCheckedChange={() => toggleMember(member.name)}
                      />
                      <span className="text-xs">{member.name}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Tabs value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
              <TabsList className="bg-muted/60 rounded-full p-1 h-9">
                {(['mtd', 'ytd'] as const).map((p) => (
                  <TabsTrigger
                    key={p}
                    value={p}
                    className="rounded-full px-4 text-xs font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-muted data-[state=active]:shadow-sm transition-all"
                  >
                    {p.toUpperCase()}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Confidence banner — horizontal bar + pills */}
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <Card className="border border-border/60">
            <CardContent className="py-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Confidence ({shortLabel})
                    </span>
                    <span className={cn(
                      'text-2xl font-bold',
                      overallConfidence >= 70 ? 'text-emerald-600 dark:text-emerald-400' :
                      overallConfidence >= 50 ? 'text-amber-600 dark:text-amber-400' :
                      'text-red-500 dark:text-red-400',
                    )}>
                      {overallConfidence}%
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {getConfidenceLabel(overallConfidence)}
                    </Badge>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{formatCurrency(revenueAmount)}</span>
                    {' '}of{' '}
                    <span>{formatCurrency(targetRevenue)}</span>
                    {' '}({percentOfTarget.toFixed(0)}%)
                  </div>
                </div>

                <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/50">
                  <div
                    className={cn('h-full rounded-full bg-gradient-to-r transition-all', getConfidenceGradient(overallConfidence))}
                    style={{ width: `${Math.min(overallConfidence, 100)}%` }}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { label: 'Pace', value: `${paceVsPlan}%` },
                    { label: 'Forecast', value: `${forecastConfidence}%` },
                    { label: 'Pipeline Health', value: `${pipelineHealth.toFixed(0)}%` },
                    { label: 'Team Conv', value: `${avgConversion.toFixed(0)}%` },
                    { label: 'Forecast Amt', value: formatCurrency(weightedForecast) },
                  ].map((pill) => (
                    <span
                      key={pill.label}
                      className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1 text-[11px]"
                    >
                      <span className="text-muted-foreground">{pill.label}:</span>
                      <span className="font-medium text-foreground">{pill.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI tiles — 6 across on desktop */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <CompactKPITileSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <CompactKPITile
              label={`Revenue ${shortLabel}`}
              value={periodOverPeriod.revenue.current}
              variant="currency"
              deltaAbsolute={periodOverPeriod.revenue.delta}
              deltaPercent={periodOverPeriod.revenue.deltaPercent}
              sparkline={{ values: sparklineData.revenue }}
              comparisonLabel="vs previous period"
            />
            <CompactKPITile
              label="Pace vs Plan"
              value={paceVsPlan}
              variant="percentage"
              trend={paceVsPlan >= 100 ? 'up' : paceVsPlan >= 80 ? 'neutral' : 'down'}
              comparisonLabel={paceVsPlan >= 100 ? 'Ahead of schedule' : 'Behind schedule'}
            />
            <CompactKPITile
              label="Weighted Forecast"
              value={weightedForecast}
              variant="currency"
              comparisonLabel={`${forecastConfidence}% confidence`}
            />
            <CompactKPITile
              label="Pipeline Total"
              value={totalPipelineValue}
              variant="currency"
              sparkline={{ values: sparklineData.pipeline }}
              comparisonLabel={`${totalDeals} deal${totalDeals !== 1 ? 's' : ''}`}
            />
            <CompactKPITile
              label="Team Win Rate"
              value={periodOverPeriod.winRate.current}
              variant="percentage"
              deltaAbsolute={periodOverPeriod.winRate.delta}
              sparkline={{ values: sparklineData.winRate }}
              comparisonLabel="won / (won + lost)"
            />
            <CompactKPITile
              label="Active Deals"
              value={totalDeals}
              variant="count"
              comparisonLabel={`${lateStageDeals} in late stage`}
            />
          </div>
        )}

        {/* Full-width revenue combo chart */}
        <RevenueComboChart
          data={comboChartData}
          isLoading={sparklineLoading}
          title="Company Revenue"
          description={`Monthly revenue with cumulative trend — ${shortLabel}`}
          showScopeToggle={false}
          showSourceFilter={false}
        />

        {/* Activity Heatmap */}
        {heatmapLoading ? (
          <ActivityHeatmapSkeleton />
        ) : (
          <ActivityHeatmap
            data={activityHeatmapData}
            title="Deal Activity"
          />
        )}

        {/* Pipeline stage bar + expandable detail table */}
        <div className="space-y-0">
          {isLoading ? <PipelineStageBarSkeleton /> : <PipelineStageBar stages={pipelineBarData} />}
          {pipelineStages.length > 0 && (
            <div className="px-1">
              <button
                onClick={() => setPipelineExpanded(!pipelineExpanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                {pipelineExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {pipelineExpanded ? 'Hide' : 'Show'} stage details
              </button>
              {pipelineExpanded && (
                <Card className="border-t-0 rounded-t-none">
                  <CardContent className="pt-3 pb-3">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Stage</TableHead>
                          <TableHead className="text-xs text-right">Deals</TableHead>
                          <TableHead className="text-xs text-right">Requested Amount</TableHead>
                          <TableHead className="text-xs text-right">Weighted Fees</TableHead>
                          <TableHead className="text-xs text-right">Median Days</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pipelineStages.map((row) => (
                          <TableRow key={row.stage}>
                            <TableCell className="text-xs font-medium">{row.stage}</TableCell>
                            <TableCell className="text-xs text-right">{row.deal_count}</TableCell>
                            <TableCell className="text-xs text-right">{formatLargeAmount(row.total_requested)}</TableCell>
                            <TableCell className="text-xs text-right font-medium text-emerald-600 dark:text-emerald-400">
                              {formatLargeAmount(row.total_weighted_fees)}
                            </TableCell>
                            <TableCell className="text-xs text-right">{row.median_days}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Team Performance */}
          <Card>
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Team Performance
                </CardTitle>
                <span className="text-[11px] text-muted-foreground">
                  Click to view dashboard
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[11px]">Member</TableHead>
                      <TableHead className="text-[11px] text-right">Active</TableHead>
                      <TableHead className="text-[11px] text-right">Revenue</TableHead>
                      <TableHead className="text-[11px] text-right">Conv %</TableHead>
                      <TableHead className="text-[11px] w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTeamMembers.map((member) => {
                      const revenue = teamRevenueMap.get(member.name) ?? 0;
                      const barWidth = maxTeamRevenue > 0 ? (revenue / maxTeamRevenue) * 100 : 0;

                      return (
                        <TableRow key={member.name}>
                          <TableCell className="py-2">
                            <div className="text-xs font-medium">{member.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {getTeamMemberRole(member.name, teamUsers)}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-right py-2">{member.active_deals}</TableCell>
                          <TableCell className="text-right py-2">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-xs font-medium">{formatLargeAmount(revenue)}</span>
                              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary/60"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <span className={cn('text-xs font-medium', getConversionColor(member.conversion))}>
                              {member.conversion}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
                              <Link to={getTeamMemberUrl(member.name, teamUsers)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Referral Engine */}
          <Card>
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-muted-foreground" />
                  Referral Engine
                </CardTitle>
                <span className="text-[11px] text-muted-foreground">
                  Top revenue sources
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {referrals.map((referral) => (
                    <div key={referral.name} className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div>
                        <div className="text-xs font-medium">{referral.name}</div>
                        <div className="text-[10px] text-muted-foreground">{referral.last_contact_days_ago}d ago</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(referral.total_revenue)}
                        </span>
                        <Badge className={cn('text-[10px]', getStatusColor(referral.status))}>
                          {referral.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Weekly Scorecard */}
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Weekly Scorecard
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3">
                {scorecard.map((item) => (
                  <div key={item.metric_label} className="text-center p-2 bg-muted/30 rounded-md">
                    <div className={cn('text-lg font-bold', item.color_class || '')}>{item.metric_value}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{item.metric_label}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default SuperAdminDashboard;
