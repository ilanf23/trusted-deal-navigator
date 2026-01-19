import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, TrendingUp, Users, Building2, Handshake, Crown, Settings, PieChart } from 'lucide-react';

const AdamsPage = () => {
  // Adam's specific metrics (Owner role - focuses on lender relationships and operations)
  const metrics = {
    activeDeals: 7,
    avgDaysPerDeal: 48,
    closingsLast30d: 3,
    conversionRate: 22,
    lenderRelationships: 24,
    pendingTermSheets: 8,
  };

  const lenderActivity = [
    { lender: 'First National Bank', activeDeals: 4, avgRate: '7.25%', lastDeal: '5 days ago', status: 'Active' },
    { lender: 'Pacific Commercial', activeDeals: 3, avgRate: '7.50%', lastDeal: '12 days ago', status: 'Active' },
    { lender: 'SBA Express Lending', activeDeals: 2, avgRate: '6.75%', lastDeal: '3 days ago', status: 'Active' },
    { lender: 'Capital One Commercial', activeDeals: 2, avgRate: '7.00%', lastDeal: '18 days ago', status: 'Needs Attention' },
    { lender: 'Wells Fargo CRE', activeDeals: 1, avgRate: '7.75%', lastDeal: '30 days ago', status: 'Dormant' },
  ];

  const termSheetsPending = [
    { client: 'Metro Holdings', lender: 'First National Bank', amount: '$4.2M', submitted: '3 days ago', status: 'Under Review' },
    { client: 'Harbor Group', lender: 'Pacific Commercial', amount: '$2.8M', submitted: '5 days ago', status: 'Countered' },
    { client: 'Summit LLC', lender: 'SBA Express Lending', amount: '$1.5M', submitted: '2 days ago', status: 'Under Review' },
    { client: 'Vista Properties', lender: 'Capital One', amount: '$3.1M', submitted: '7 days ago', status: 'Pending Response' },
  ];

  const operationalMetrics = [
    { metric: 'Avg Days to Term Sheet', value: '14 days', target: '12 days', progress: 85 },
    { metric: 'Lender Response Rate', value: '78%', target: '85%', progress: 92 },
    { metric: 'Term Sheet Acceptance', value: '65%', target: '70%', progress: 93 },
    { metric: 'Closing Efficiency', value: '28 days', target: '30 days', progress: 100 },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-500';
      case 'Needs Attention': return 'bg-yellow-500';
      case 'Dormant': return 'bg-gray-500';
      case 'Under Review': return 'bg-blue-500';
      case 'Countered': return 'bg-orange-500';
      case 'Pending Response': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-yellow-500" />
            <h1 className="text-2xl font-bold">Adam's Dashboard</h1>
          </div>
          <p className="text-muted-foreground">Lender relationships and operational efficiency</p>
        </div>

        {/* Performance Metrics */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card className="border-admin-teal/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-admin-teal" />
                <span className="text-sm text-muted-foreground">Active Deals</span>
              </div>
              <div className="text-2xl font-bold mt-2">{metrics.activeDeals}</div>
            </CardContent>
          </Card>
          
          <Card className="border-admin-blue/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-admin-blue" />
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
                <PieChart className="h-5 w-5 text-admin-orange" />
                <span className="text-sm text-muted-foreground">Conversion</span>
              </div>
              <div className="text-2xl font-bold mt-2 text-admin-orange">{metrics.conversionRate}%</div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-600" />
                <span className="text-sm text-muted-foreground">Lender Partners</span>
              </div>
              <div className="text-2xl font-bold mt-2">{metrics.lenderRelationships}</div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-yellow-600" />
                <span className="text-sm text-muted-foreground">Pending Terms</span>
              </div>
              <div className="text-2xl font-bold mt-2 text-yellow-600">{metrics.pendingTermSheets}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Lender Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-admin-blue" />
                Lender Partner Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lender</TableHead>
                    <TableHead className="text-right">Deals</TableHead>
                    <TableHead className="text-right">Avg Rate</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lenderActivity.map((lender, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{lender.lender}</TableCell>
                      <TableCell className="text-right">{lender.activeDeals}</TableCell>
                      <TableCell className="text-right">{lender.avgRate}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(lender.status)}>{lender.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Pending Term Sheets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Handshake className="h-5 w-5 text-admin-blue" />
                Pending Term Sheets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Lender</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {termSheetsPending.map((sheet, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{sheet.client}</TableCell>
                      <TableCell className="text-sm">{sheet.lender}</TableCell>
                      <TableCell className="text-right">{sheet.amount}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(sheet.status)}>{sheet.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Operational Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-admin-blue" />
              Operational Efficiency Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {operationalMetrics.map((metric, index) => (
                <div key={index} className="space-y-2">
                  <div className="text-sm font-medium">{metric.metric}</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{metric.value}</span>
                    <span className="text-sm text-muted-foreground">/ {metric.target}</span>
                  </div>
                  <Progress value={metric.progress} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdamsPage;
