import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TrendingUp, Target, BarChart3, Calendar, Users, Handshake, Gauge, CalendarDays, Eye, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTeamMember } from '@/hooks/useTeamMember';

type TimePeriod = 'ytd' | 'mtd';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { teamMember, isOwner, loading } = useTeamMember();
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('ytd');

  // Redirect non-owner employees to their team dashboard
  useEffect(() => {
    if (!loading && teamMember && !isOwner) {
      const adminUsers = ['ilan', 'brad', 'adam'];
      const name = teamMember.name.toLowerCase();
      if (adminUsers.includes(name)) {
        navigate(`/admin/${name}`, { replace: true });
      } else {
        navigate(`/team/${name}`, { replace: true });
      }
    }
  }, [loading, teamMember, isOwner, navigate]);
  // Metrics by time period
  const metrics = {
    ytd: {
      revenue: 156000,
      target: 1500000,
      paceVsPlan: 224,
      forecastAmount: 1110000,
      forecastConfidence: 74,
      label: 'Year to Date',
      shortLabel: 'YTD'
    },
    mtd: {
      revenue: 24000,
      target: 125000,
      paceVsPlan: 187,
      forecastAmount: 98000,
      forecastConfidence: 81,
      label: 'Month to Date',
      shortLabel: 'MTD'
    }
  };
  const currentMetrics = metrics[timePeriod];

  // Key metrics for confidence calculation
  const revenueAmount = currentMetrics.revenue;
  const targetRevenue = currentMetrics.target;
  const percentOfTarget = revenueAmount / targetRevenue * 100;
  const paceVsPlan = currentMetrics.paceVsPlan;
  const forecastConfidence = currentMetrics.forecastConfidence;
  const weightedForecast = currentMetrics.forecastAmount;
  const forecastAsPercentOfTarget = weightedForecast / targetRevenue * 100;

  // Team average conversion rate
  const avgConversion = (18 + 45 + 33 + 0) / 4;

  // Pipeline health
  const totalDeals = 8 + 6 + 7 + 5 + 4 + 12;
  const lateStageDeals = 5 + 4 + 12;
  const pipelineHealth = lateStageDeals / totalDeals * 100;
  const paceScore = Math.min(paceVsPlan, 100);
  const overallConfidence = Math.round(paceScore * 0.25 + forecastConfidence * 0.25 + Math.min(forecastAsPercentOfTarget, 100) * 0.20 + pipelineHealth * 0.15 + avgConversion * 0.15);
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    return `$${(amount / 1000).toFixed(0)}K`;
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

  // Pipeline data
  const pipelineStages = [{
    stage: 'Initial Consult',
    deals: 8,
    requested: '$54.7M',
    weightedFees: '$60K',
    medianDays: 9
  }, {
    stage: 'Onboarding',
    deals: 6,
    requested: '$46.8M',
    weightedFees: '$105K',
    medianDays: 7
  }, {
    stage: 'In-House Underwriting',
    deals: 7,
    requested: '$62.4M',
    weightedFees: '$195K',
    medianDays: 8
  }, {
    stage: 'Lender Management',
    deals: 5,
    requested: '$42.4M',
    weightedFees: '$249K',
    medianDays: 10
  }, {
    stage: 'Path to Close',
    deals: 4,
    requested: '$32.8M',
    weightedFees: '$348K',
    medianDays: 12
  }, {
    stage: 'Closed',
    deals: 12,
    requested: '$94.2M',
    weightedFees: '$872K',
    medianDays: 0
  }];

  // Team data - now with links to their dashboards
  const teamMembers = [{
    name: 'Brad',
    role: 'Owner',
    activeDeals: 9,
    avgDays: 53,
    closings: 2,
    conversion: 18,
    url: '/admin/brad'
  }, {
    name: 'Adam',
    role: 'Owner',
    activeDeals: 7,
    avgDays: 48,
    closings: 3,
    conversion: 22,
    url: '/admin/adam'
  }, {
    name: 'Maura',
    role: 'Processor',
    activeDeals: 6,
    avgDays: 36,
    closings: 5,
    conversion: 45,
    url: '/admin/maura'
  }, {
    name: 'Wendy',
    role: 'Processor',
    activeDeals: 10,
    avgDays: 46,
    closings: 5,
    conversion: 33,
    url: '/admin/wendy'
  }, {
    name: 'Evan',
    role: 'Analyst',
    activeDeals: 5,
    avgDays: 35,
    closings: 0,
    conversion: 0,
    url: '/admin/evan'
  }];

  // Referral data
  const referrals = [{
    name: 'John Mitchell',
    revenue: '$179K',
    status: 'Hot',
    daysAgo: 11
  }, {
    name: 'Susan Park',
    revenue: '$175K',
    status: 'Dormant',
    daysAgo: 75
  }, {
    name: 'Thomas Greene',
    revenue: '$168K',
    status: 'Warm',
    daysAgo: 17
  }, {
    name: "Brian O'Connor",
    revenue: '$149K',
    status: 'Dormant',
    daysAgo: 79
  }, {
    name: 'Angela Martinez',
    revenue: '$138K',
    status: 'Cold',
    daysAgo: 52
  }];
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Hot':
        return 'bg-red-500 hover:bg-red-600';
      case 'Warm':
        return 'bg-orange-500 hover:bg-orange-600';
      case 'Cold':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'Dormant':
        return 'bg-gray-500 hover:bg-gray-600';
      default:
        return 'bg-gray-500';
    }
  };
  return <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-admin-blue" />
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            </div>
            <p className="text-muted-foreground">Company-wide performance overview</p>
          </div>
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
        <Card className={`bg-gradient-to-r ${getConfidenceBg(overallConfidence)} border-2`}>
          <CardContent className="py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-background/80 rounded-full">
                  <Gauge className={`h-8 w-8 ${getConfidenceColor(overallConfidence)}`} />
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Overall Confidence Level ({currentMetrics.shortLabel})
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

        {/* Top Row - Revenue Metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-2 border-admin-teal/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Revenue {currentMetrics.shortLabel}
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

        {/* Pipeline by Stage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-admin-blue" />
              Pipeline by Stage
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                {pipelineStages.map(row => <TableRow key={row.stage}>
                    <TableCell className="font-medium">{row.stage}</TableCell>
                    <TableCell className="text-right">{row.deals}</TableCell>
                    <TableCell className="text-right">{row.requested}</TableCell>
                    <TableCell className="text-right font-medium text-admin-teal">{row.weightedFees}</TableCell>
                    <TableCell className="text-right">{row.medianDays}</TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4">
              {[{
              label: 'Consults Held',
              value: '0'
            }, {
              label: 'Onboarding Started',
              value: '4'
            }, {
              label: 'Docs Complete',
              value: '80%'
            }, {
              label: 'Packages Ready',
              value: '5'
            }, {
              label: 'Term Sheets',
              value: '7'
            }, {
              label: 'Commitments',
              value: '4'
            }, {
              label: 'Closings (30d)',
              value: '1'
            }, {
              label: 'Fees Booked',
              value: '$0',
              color: 'text-muted-foreground'
            }, {
              label: 'Fees Collected',
              value: '$156K',
              color: 'text-admin-teal'
            }].map(item => <div key={item.label} className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className={`text-xl font-bold ${item.color || ''}`}>{item.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
                </div>)}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Team Performance - with View Dashboard buttons */}
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
                  {teamMembers.map(member => <TableRow key={member.name}>
                      <TableCell>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.role}</div>
                      </TableCell>
                      <TableCell className="text-right">{member.activeDeals}</TableCell>
                      <TableCell className="text-right">
                        <span className={member.conversion >= 40 ? 'text-green-600 font-medium' : member.conversion === 0 ? 'text-red-500' : ''}>
                          {member.conversion}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={member.url}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>)}
                </TableBody>
              </Table>
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
              <div className="space-y-3">
                {referrals.map(referral => <div key={referral.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <div className="font-medium">{referral.name}</div>
                      <div className="text-sm text-muted-foreground">{referral.daysAgo} days ago</div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div className="text-lg font-bold text-admin-teal">{referral.revenue}</div>
                      <Badge className={getStatusColor(referral.status)}>
                        {referral.status}
                      </Badge>
                    </div>
                  </div>)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>;
};
export default SuperAdminDashboard;