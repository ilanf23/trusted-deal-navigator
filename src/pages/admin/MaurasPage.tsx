import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileCheck, Clock, TrendingUp, CheckCircle2, AlertCircle, Users } from 'lucide-react';

const MaurasPage = () => {
  // Maura's specific metrics (Processor role - focuses on document processing)
  const metrics = {
    activeDeals: 6,
    avgDaysPerDeal: 36,
    closingsLast30d: 5,
    conversionRate: 45,
    docsProcessedToday: 12,
    pendingReview: 8,
  };

  const processingQueue = [
    { client: 'Johnson Holdings', type: 'Financial Statements', status: 'In Review', priority: 'High', daysInQueue: 1 },
    { client: 'Metro Properties LLC', type: 'Tax Returns', status: 'Pending', priority: 'Medium', daysInQueue: 2 },
    { client: 'Coastal Investments', type: 'Appraisal Report', status: 'In Review', priority: 'High', daysInQueue: 1 },
    { client: 'Summit Enterprises', type: 'Personal Financial Statement', status: 'Pending', priority: 'Low', daysInQueue: 3 },
    { client: 'Harbor View Group', type: 'Operating Agreement', status: 'Complete', priority: 'Medium', daysInQueue: 0 },
    { client: 'Valley Commercial', type: 'Rent Roll', status: 'In Review', priority: 'High', daysInQueue: 1 },
  ];

  const recentActivity = [
    { action: 'Completed review', client: 'ABC Properties', document: 'Loan Application', time: '10 min ago' },
    { action: 'Requested revision', client: 'XYZ Holdings', document: 'Bank Statements', time: '25 min ago' },
    { action: 'Approved package', client: 'Delta Corp', document: 'Full Package', time: '1 hour ago' },
    { action: 'Started review', client: 'Omega LLC', document: 'Title Report', time: '2 hours ago' },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-500';
      case 'Medium': return 'bg-yellow-500';
      case 'Low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Complete': return 'bg-green-500';
      case 'In Review': return 'bg-blue-500';
      case 'Pending': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Maura's Dashboard</h1>
          <p className="text-muted-foreground">Document processing and loan package management</p>
        </div>

        {/* Performance Metrics */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card className="border-admin-teal/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-admin-teal" />
                <span className="text-sm text-muted-foreground">Active Deals</span>
              </div>
              <div className="text-2xl font-bold mt-2">{metrics.activeDeals}</div>
            </CardContent>
          </Card>
          
          <Card className="border-admin-blue/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-admin-blue" />
                <span className="text-sm text-muted-foreground">Avg Days/Deal</span>
              </div>
              <div className="text-2xl font-bold mt-2">{metrics.avgDaysPerDeal}</div>
            </CardContent>
          </Card>

          <Card className="border-green-500/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm text-muted-foreground">Closings (30d)</span>
              </div>
              <div className="text-2xl font-bold mt-2 text-green-600">{metrics.closingsLast30d}</div>
            </CardContent>
          </Card>

          <Card className="border-admin-orange/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-admin-orange" />
                <span className="text-sm text-muted-foreground">Conversion</span>
              </div>
              <div className="text-2xl font-bold mt-2 text-admin-orange">{metrics.conversionRate}%</div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-muted-foreground">Processed Today</span>
              </div>
              <div className="text-2xl font-bold mt-2">{metrics.docsProcessedToday}</div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="text-sm text-muted-foreground">Pending Review</span>
              </div>
              <div className="text-2xl font-bold mt-2 text-yellow-600">{metrics.pendingReview}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Processing Queue */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-admin-blue" />
                Document Processing Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Document Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processingQueue.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.client}</TableCell>
                      <TableCell>{item.type}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(item.status)}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`border-0 ${getPriorityColor(item.priority)} text-white`}>
                          {item.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.daysInQueue}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-admin-blue" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg">
                    <div className="font-medium text-sm">{activity.action}</div>
                    <div className="text-sm text-muted-foreground">{activity.client} - {activity.document}</div>
                    <div className="text-xs text-muted-foreground">{activity.time}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Documents Processed</span>
                  <span>12 / 15 target</span>
                </div>
                <Progress value={80} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Packages Completed</span>
                  <span>3 / 4 target</span>
                </div>
                <Progress value={75} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Review Queue Cleared</span>
                  <span>60%</span>
                </div>
                <Progress value={60} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default MaurasPage;
