import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, Users, Building2, Handshake, Crown, Settings, PieChart } from 'lucide-react';
import { useAdamsDashboard } from '@/hooks/useAdamsDashboard';

const AdamsPage = () => {
  const { metrics, lenderActivity, termSheetsPending, operationalMetrics, isLoading } = useAdamsDashboard();

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

  if (isLoading) {
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
          <div className="grid gap-6 lg:grid-cols-2">
            <Card><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
          </div>
          <Card><CardContent className="pt-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
        </div>
      </AdminLayout>
    );
  }

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
              <Table className="min-w-[500px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Lender</TableHead>
                    <TableHead className="text-right">Programs</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Rate Range</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lenderActivity.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">No lender data</TableCell>
                    </TableRow>
                  ) : (
                    lenderActivity.map((lender, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{lender.lender}</TableCell>
                        <TableCell className="text-right">{lender.activeDeals}</TableCell>
                        <TableCell className="text-right hidden md:table-cell">{lender.avgRate}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(lender.status)}>{lender.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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
              <Table className="min-w-[500px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {termSheetsPending.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">No pending term sheets</TableCell>
                    </TableRow>
                  ) : (
                    termSheetsPending.map((sheet, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{sheet.client}</TableCell>
                        <TableCell className="text-sm">{sheet.lender}</TableCell>
                        <TableCell className="text-right">{sheet.amount}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(sheet.status)}>{sheet.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
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
              {operationalMetrics.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4 col-span-4">No operational metrics configured</p>
              ) : (
                operationalMetrics.map((metric, index) => (
                  <div key={index} className="space-y-2">
                    <div className="text-sm font-medium">{metric.metric}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{metric.value}</span>
                      <span className="text-sm text-muted-foreground">/ {metric.target}</span>
                    </div>
                    <Progress value={metric.progress} className="h-2" />
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

export default AdamsPage;
