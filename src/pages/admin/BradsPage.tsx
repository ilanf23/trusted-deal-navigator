import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingUp, Users, Target, Handshake, Crown, Calendar, BarChart3 } from 'lucide-react';

const BradsPage = () => {
  // Brad's specific metrics (Owner role - focuses on high-value deals and strategy)
  const metrics = {
    activeDeals: 9,
    avgDaysPerDeal: 53,
    closingsLast30d: 2,
    conversionRate: 18,
    pipelineValue: 42800000,
    projectedFees: 428000,
  };

  const highValueDeals = [
    { client: 'Empire State Holdings', loanAmount: '$15.2M', fee: '$152K', stage: 'Lender Management', probability: 75, daysInPipeline: 45 },
    { client: 'Manhattan Capital Group', loanAmount: '$8.5M', fee: '$85K', stage: 'Underwriting', probability: 60, daysInPipeline: 32 },
    { client: 'Brookfield Investments', loanAmount: '$6.8M', fee: '$68K', stage: 'Path to Close', probability: 90, daysInPipeline: 68 },
    { client: 'Sterling Properties', loanAmount: '$5.2M', fee: '$52K', stage: 'Document Collection', probability: 40, daysInPipeline: 21 },
    { client: 'Crown Real Estate', loanAmount: '$4.1M', fee: '$41K', stage: 'Initial Consult', probability: 25, daysInPipeline: 7 },
  ];

  const upcomingMeetings = [
    { client: 'Empire State Holdings', type: 'Strategy Review', time: 'Today, 2:00 PM' },
    { client: 'New Client Referral', type: 'Initial Consult', time: 'Tomorrow, 10:00 AM' },
    { client: 'Brookfield Investments', type: 'Closing Prep', time: 'Wed, 11:00 AM' },
    { client: 'Lender Partner', type: 'Rate Discussion', time: 'Thu, 3:00 PM' },
  ];

  const referralPartners = [
    { name: 'John Mitchell (Attorney)', deals: 8, revenue: '$179K', lastDeal: '11 days ago' },
    { name: 'Susan Park (CPA)', deals: 6, revenue: '$175K', lastDeal: '75 days ago' },
    { name: 'Thomas Greene (Broker)', deals: 5, revenue: '$168K', lastDeal: '17 days ago' },
  ];

  const getProbabilityColor = (prob: number) => {
    if (prob >= 75) return 'text-green-600';
    if (prob >= 50) return 'text-yellow-600';
    return 'text-red-500';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-yellow-500" />
            <h1 className="text-2xl font-bold">Brad's Dashboard</h1>
          </div>
          <p className="text-muted-foreground">Strategic oversight and high-value deal management</p>
        </div>

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Loan Amount</TableHead>
                    <TableHead className="text-right">Potential Fee</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Probability</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {highValueDeals.map((deal, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{deal.client}</TableCell>
                      <TableCell className="text-right">{deal.loanAmount}</TableCell>
                      <TableCell className="text-right font-medium text-admin-teal">{deal.fee}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{deal.stage}</Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${getProbabilityColor(deal.probability)}`}>
                        {deal.probability}%
                      </TableCell>
                    </TableRow>
                  ))}
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
                  {upcomingMeetings.map((meeting, index) => (
                    <div key={index} className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg">
                      <div className="font-medium text-sm">{meeting.client}</div>
                      <div className="text-sm text-muted-foreground">{meeting.type}</div>
                      <div className="text-xs text-admin-blue">{meeting.time}</div>
                    </div>
                  ))}
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
                  {referralPartners.map((partner, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <div>
                        <div className="font-medium text-sm">{partner.name}</div>
                        <div className="text-xs text-muted-foreground">{partner.deals} deals • {partner.lastDeal}</div>
                      </div>
                      <div className="text-lg font-bold text-admin-teal">{partner.revenue}</div>
                    </div>
                  ))}
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
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>New High-Value Leads</span>
                  <span>7 / 10 target</span>
                </div>
                <Progress value={70} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Partner Meetings</span>
                  <span>4 / 6 target</span>
                </div>
                <Progress value={67} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Deals to Close</span>
                  <span>2 / 3 target</span>
                </div>
                <Progress value={67} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default BradsPage;
