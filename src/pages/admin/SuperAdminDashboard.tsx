import { useState, useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Target, BarChart3, Calendar, Users, Handshake, Gauge, CalendarDays, Eye, Shield, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useSuperAdminDashboard, getTeamMemberUrl, getTeamMemberRole, type TimePeriod } from '@/hooks/useSuperAdminDashboard';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { teamMember, isOwner, loading } = useTeamMember();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('ytd');
  const { currentMetrics, pipelineStages, teamMembers, referrals, scorecard, isLoading, isError } = useSuperAdminDashboard(timePeriod);

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Admin Dashboard');
    return () => { setPageTitle(null); };
  }, []);

  // Redirect non-owner employees to their team dashboard
  useEffect(() => {
    if (!loading && teamMember && !isOwner) {
      const founderUsers = ['ilan', 'brad', 'adam'];
      const name = teamMember.name.toLowerCase();
      if (founderUsers.includes(name)) {
        navigate(`/superadmin/${name}`, { replace: true });
      } else {
        navigate(`/admin/${name}`, { replace: true });
      }
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

  // Team average conversion rate
  const avgConversion = teamMembers.length > 0
    ? teamMembers.reduce((sum, m) => sum + m.conversion, 0) / teamMembers.length
    : 0;

  // Pipeline health
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
    avgConversion * 0.15
  );

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    return `$${(amount / 1000).toFixed(0)}K`;
  };

  const formatLargeAmount = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceLabel = (score: number) => {
    if (score >= 80) return 'Very High';
    if (score >= 70) return 'High';
    if (score >= 50) return 'Moderate';
    if (score >= 30) return 'Low';
    return 'Very Low';
  };

  const getConfidenceBg = (score: number) => {
    if (score >= 70) return 'from-green-500/20 to-green-600/10 border-green-500/30';
    if (score >= 50) return 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30';
    return 'from-red-500/20 to-red-600/10 border-red-500/30';
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

  // Error state
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
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
          <Select value={timePeriod} onValueChange={(value: TimePeriod) => setTimePeriod(value)}>
            <SelectTrigger className="w-[180px] bg-background">
              <CalendarDays className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="mtd">Month to Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Confidence Level Banner */}
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <Card className={`bg-gradient-to-r ${getConfidenceBg(overallConfidence)} border-2`}>
            <CardContent className="py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-background/80 rounded-full">
                    <Gauge className={`h-8 w-8 ${getConfidenceColor(overallConfidence)}`} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Overall Confidence Level ({shortLabel})
                    </div>
                    <div className={`text-4xl font-bold ${getConfidenceColor(overallConfidence)}`}>
                      {overallConfidence}%
                      <span className="text-lg ml-2 font-normal">({getConfidenceLabel(overallConfidence)})</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 max-w-md">
                  <Progress value={overallConfidence} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>Target: {formatCurrency(targetRevenue)}</span>
                    <span>Current: {formatCurrency(revenueAmount)} ({percentOfTarget.toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Based on</div>
                  <div className="text-xs space-y-1 mt-1">
                    <div>Pace: {paceVsPlan}% • Forecast: {forecastConfidence}%</div>
                    <div>Pipeline: {pipelineHealth.toFixed(0)}% • Team Conv: {avgConversion.toFixed(0)}%</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Row - Revenue Metrics */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-2 border-admin-teal/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Revenue {shortLabel}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-admin-teal">{formatCurrency(revenueAmount)}</div>
                <p className="text-sm text-muted-foreground mt-1">earned so far</p>
                <div className="mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Target: {formatCurrency(targetRevenue)}</span>
                    <span className="font-medium">{percentOfTarget.toFixed(0)}%</span>
                  </div>
                  <Progress value={percentOfTarget} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-admin-blue/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Pace vs Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{paceVsPlan}%</div>
                <p className="text-sm text-muted-foreground mt-1">ahead of schedule</p>
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Moving faster than planned pace
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-admin-orange/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Weighted Forecast
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-admin-orange">{formatCurrency(weightedForecast)}</div>
                <p className="text-sm text-muted-foreground mt-1">projected for the {timePeriod === 'ytd' ? 'year' : 'month'}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="secondary" className="bg-admin-orange/10 text-admin-orange">
                    {forecastConfidence}% confidence
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pipeline by Stage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-admin-blue" />
              Pipeline by Stage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Deals</TableHead>
                    <TableHead className="text-right">Requested Amount</TableHead>
                    <TableHead className="text-right">Weighted Fees</TableHead>
                    <TableHead className="text-right">Median Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pipelineStages.map(row => (
                    <TableRow key={row.stage}>
                      <TableCell className="font-medium">{row.stage}</TableCell>
                      <TableCell className="text-right">{row.deal_count}</TableCell>
                      <TableCell className="text-right">{formatLargeAmount(row.total_requested)}</TableCell>
                      <TableCell className="text-right font-medium text-admin-teal">{formatLargeAmount(row.total_weighted_fees)}</TableCell>
                      <TableCell className="text-right">{row.median_days}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Weekly Scorecard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-admin-blue" />
              Weekly Scorecard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4">
                {scorecard.map(item => (
                  <div key={item.metric_label} className="text-center p-3 bg-muted/30 rounded-lg">
                    <div className={`text-xl font-bold ${item.color_class || ''}`}>{item.metric_value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{item.metric_label}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Team Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-admin-blue" />
                Team Performance
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Click on team member to view their dashboard
              </p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead className="text-right">Active</TableHead>
                      <TableHead className="text-right">Conv %</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map(member => (
                      <TableRow key={member.name}>
                        <TableCell>
                          <div className="font-medium">{member.name}</div>
                          <div className="text-xs text-muted-foreground">{getTeamMemberRole(member.name)}</div>
                        </TableCell>
                        <TableCell className="text-right">{member.active_deals}</TableCell>
                        <TableCell className="text-right">
                          <span className={member.conversion >= 40 ? 'text-green-600 font-medium' : member.conversion === 0 ? 'text-red-500' : ''}>
                            {member.conversion}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={getTeamMemberUrl(member.name)}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Referral Engine */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Handshake className="h-5 w-5 text-admin-blue" />
                Referral Engine
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Top revenue sources - follow up opportunities
              </p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {referrals.map(referral => (
                    <div key={referral.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <div className="font-medium">{referral.name}</div>
                        <div className="text-sm text-muted-foreground">{referral.last_contact_days_ago} days ago</div>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <div className="text-lg font-bold text-admin-teal">{formatCurrency(referral.total_revenue)}</div>
                        <Badge className={getStatusColor(referral.status)}>
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
      </div>
    </AdminLayout>
  );
};

export default SuperAdminDashboard;
