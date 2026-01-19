import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Target, BarChart3, Calendar, Users, Handshake } from 'lucide-react';

const AdminDashboard = () => {
  // Pipeline data
  const pipelineStages = [
    { stage: 'Initial Consult', deals: 8, requested: '$54.7M', weightedFees: '$60K', medianDays: 9 },
    { stage: 'Onboarding', deals: 6, requested: '$46.8M', weightedFees: '$105K', medianDays: 7 },
    { stage: 'In-House Underwriting', deals: 7, requested: '$62.4M', weightedFees: '$195K', medianDays: 8 },
    { stage: 'Lender Management', deals: 5, requested: '$42.4M', weightedFees: '$249K', medianDays: 10 },
    { stage: 'Path to Close', deals: 4, requested: '$32.8M', weightedFees: '$348K', medianDays: 12 },
    { stage: 'Closed', deals: 12, requested: '$94.2M', weightedFees: '$872K', medianDays: 0 },
  ];

  // Team data
  const teamMembers = [
    { name: 'Brad', role: 'Owner', activeDeals: 9, avgDays: 53, closings: 2, conversion: 18 },
    { name: 'Maura', role: 'Processor', activeDeals: 6, avgDays: 36, closings: 5, conversion: 45 },
    { name: 'Wendy', role: 'Processor', activeDeals: 10, avgDays: 46, closings: 5, conversion: 33 },
    { name: 'Evan', role: 'Analyst', activeDeals: 5, avgDays: 35, closings: 0, conversion: 0 },
  ];

  // Referral data
  const referrals = [
    { name: 'John Mitchell', revenue: '$179K', status: 'Hot', daysAgo: 11 },
    { name: 'Susan Park', revenue: '$175K', status: 'Dormant', daysAgo: 75 },
    { name: 'Thomas Greene', revenue: '$168K', status: 'Warm', daysAgo: 17 },
    { name: "Brian O'Connor", revenue: '$149K', status: 'Dormant', daysAgo: 79 },
    { name: 'Angela Martinez', revenue: '$138K', status: 'Cold', daysAgo: 52 },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Hot': return 'bg-red-500 hover:bg-red-600';
      case 'Warm': return 'bg-orange-500 hover:bg-orange-600';
      case 'Cold': return 'bg-blue-500 hover:bg-blue-600';
      case 'Dormant': return 'bg-gray-500 hover:bg-gray-600';
      default: return 'bg-gray-500';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Performance overview and pipeline status</p>
        </div>

        {/* Top Row - Revenue Metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Revenue YTD */}
          <Card className="border-2 border-admin-teal/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                Revenue YTD
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-admin-teal">$156K</div>
              <p className="text-sm text-muted-foreground mt-1">earned so far</p>
              <div className="mt-3">
                <div className="flex justify-between text-sm mb-1">
                  <span>Target: $1.50M</span>
                  <span className="font-medium">10%</span>
                </div>
                <Progress value={10} className="h-2" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">You are at 10% of the goal</p>
            </CardContent>
          </Card>

          {/* Pace vs Plan */}
          <Card className="border-2 border-admin-blue/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Pace vs Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">224%</div>
              <p className="text-sm text-muted-foreground mt-1">ahead of schedule</p>
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <p className="text-sm text-green-700 dark:text-green-400">
                  You are moving faster than the planned pace
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Weighted Forecast */}
          <Card className="border-2 border-admin-orange/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Weighted Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-admin-orange">$1.11M</div>
              <p className="text-sm text-muted-foreground mt-1">projected for the year</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="bg-admin-orange/10 text-admin-orange">
                  74% confidence
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                If deals continue as expected, the system predicts about $1.11M in total revenue.
              </p>
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
            <p className="text-sm text-muted-foreground">
              Where deals are in the sales process. The longer a deal sits in later stages, the more valuable it becomes.
            </p>
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
                {pipelineStages.map((row) => (
                  <TableRow key={row.stage}>
                    <TableCell className="font-medium">{row.stage}</TableCell>
                    <TableCell className="text-right">{row.deals}</TableCell>
                    <TableCell className="text-right">{row.requested}</TableCell>
                    <TableCell className="text-right font-medium text-admin-teal">{row.weightedFees}</TableCell>
                    <TableCell className="text-right">{row.medianDays}</TableCell>
                  </TableRow>
                ))}
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
            <p className="text-sm text-muted-foreground">
              Tracking weekly execution activity. Work is happening, but no new revenue was booked this week yet.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4">
              {[
                { label: 'Consults Held', value: '0' },
                { label: 'Onboarding Started', value: '4' },
                { label: 'Docs Complete', value: '80%' },
                { label: 'Packages Ready', value: '5' },
                { label: 'Term Sheets', value: '7' },
                { label: 'Commitments', value: '4' },
                { label: 'Closings (30d)', value: '1' },
                { label: 'Fees Booked', value: '$0', color: 'text-muted-foreground' },
                { label: 'Fees Collected', value: '$156K', color: 'text-admin-teal' },
              ].map((item) => (
                <div key={item.label} className="text-center p-3 bg-muted/30 rounded-lg">
                  <div className={`text-xl font-bold ${item.color || ''}`}>{item.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
                </div>
              ))}
            </div>
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
                Maura and Wendy are the strongest closers. Evan needs support or better deal flow.
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                    <TableHead className="text-right">Avg Days</TableHead>
                    <TableHead className="text-right">Closings</TableHead>
                    <TableHead className="text-right">Conv %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((member) => (
                    <TableRow key={member.name}>
                      <TableCell>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-xs text-muted-foreground">{member.role}</div>
                      </TableCell>
                      <TableCell className="text-right">{member.activeDeals}</TableCell>
                      <TableCell className="text-right">{member.avgDays}</TableCell>
                      <TableCell className="text-right">{member.closings}</TableCell>
                      <TableCell className="text-right">
                        <span className={member.conversion >= 40 ? 'text-green-600 font-medium' : member.conversion === 0 ? 'text-red-500' : ''}>
                          {member.conversion}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
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
                Your best money comes from people you have not talked to recently. This is a follow-up opportunity.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {referrals.map((referral) => (
                  <div key={referral.name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
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
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
