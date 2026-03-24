import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, Users, Target, Handshake, Crown, Calendar, BarChart3 } from 'lucide-react';
import { useBradsDashboard } from '@/hooks/useBradsDashboard';

const BradsPage = () => {
  const { metrics, highValueDeals, upcomingMeetings, referralPartners, monthlyGoals, isLoading } = useBradsDashboard();

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle("Brad's Dashboard");
    return () => { setPageTitle(null); };
  }, []);

  const getProbabilityColor = (prob: number) => {
    if (prob >= 75) return 'text-green-600';
    if (prob >= 50) return 'text-yellow-600';
    return 'text-red-500';
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2"><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
            <div className="space-y-6">
              <Card><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
              <Card><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Performance Metrics */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card className="border-admin-teal/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-admin-teal" />
                <span className="text-sm text-muted-foreground">Active Deals</span>
              </div>
              <div className="text-2xl font-bold mt-2">{metrics.activeDeals}</div>
            </CardContent>
          </Card>
          
          <Card className="border-admin-blue/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-admin-blue" />
                <span className="text-sm text-muted-foreground">Avg Days/Deal</span>
              </div>
              <div className="text-2xl font-bold mt-2">{metrics.avgDaysPerDeal}</div>
            </CardContent>
          </Card>

          <Card className="border-green-500/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-sm text-muted-foreground">Closings (30d)</span>
              </div>
              <div className="text-2xl font-bold mt-2 text-green-600">{metrics.closingsLast30d}</div>
            </CardContent>
          </Card>

          <Card className="border-admin-orange/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-admin-orange" />
                <span className="text-sm text-muted-foreground">Conversion</span>
              </div>
              <div className="text-2xl font-bold mt-2 text-admin-orange">{metrics.conversionRate}%</div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-purple-600" />
                <span className="text-sm text-muted-foreground">Pipeline Value</span>
              </div>
              <div className="text-2xl font-bold mt-2">${(metrics.pipelineValue / 1000000).toFixed(1)}M</div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-yellow-600" />
                <span className="text-sm text-muted-foreground">Projected Fees</span>
              </div>
              <div className="text-2xl font-bold mt-2 text-yellow-600">${(metrics.projectedFees / 1000).toFixed(0)}K</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* High Value Deals */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-admin-blue" />
                High-Value Deals in Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Loan Amount</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Potential Fee</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Probability</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {highValueDeals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">No deals in pipeline</TableCell>
                    </TableRow>
                  ) : (
                    highValueDeals.map((deal, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{deal.client}</TableCell>
                        <TableCell className="text-right">{deal.loanAmount}</TableCell>
                        <TableCell className="text-right font-medium text-admin-teal hidden md:table-cell">{deal.fee}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{deal.stage}</Badge>
                        </TableCell>
                        <TableCell className={`text-right font-medium ${getProbabilityColor(deal.probability)}`}>
                          {deal.probability}%
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Upcoming Meetings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-admin-blue" />
                  Upcoming Meetings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingMeetings.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No upcoming meetings</p>
                  ) : (
                    upcomingMeetings.map((meeting, index) => (
                      <div key={index} className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg">
                        <div className="font-medium text-sm">{meeting.client}</div>
                        <div className="text-sm text-muted-foreground">{meeting.type}</div>
                        <div className="text-xs text-admin-blue">{meeting.time}</div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Referral Partners */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Handshake className="h-5 w-5 text-admin-blue" />
                  Top Referral Partners
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {referralPartners.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No referral data</p>
                  ) : (
                    referralPartners.map((partner, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                        <div>
                          <div className="font-medium text-sm">{partner.name}</div>
                          <div className="text-xs text-muted-foreground">{partner.deals} deals • {partner.lastDeal}</div>
                        </div>
                        <div className="text-lg font-bold text-admin-teal">{partner.revenue}</div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Monthly Goals */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Goals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyGoals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No goals configured</p>
              ) : (
                monthlyGoals.map((goal, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-2">
                      <span>{goal.label}</span>
                      <span>{goal.current} / {goal.target} target</span>
                    </div>
                    <Progress value={goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0} className="h-2" />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default BradsPage;
