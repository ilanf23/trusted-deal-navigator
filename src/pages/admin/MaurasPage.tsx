import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileCheck, Clock, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useMaurasDashboard } from '@/hooks/useMaurasDashboard';

const MaurasPage = () => {
  const {
    metrics,
    processingQueue,
    recentActivity,
    dailyProgress,
    isLoading,
  } = useMaurasDashboard();

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

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Maura's Dashboard</h1>
            <p className="text-muted-foreground">Document processing and loan package management</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-12" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
              <CardContent><Skeleton className="h-48 w-full" /></CardContent>
            </Card>
            <Card>
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-48 w-full" /></CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><Skeleton className="h-6 w-36" /></CardHeader>
            <CardContent><Skeleton className="h-24 w-full" /></CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

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
              {processingQueue.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No items in the processing queue.</p>
              ) : (
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Document Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="text-right hidden md:table-cell">Days</TableHead>
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
                        <TableCell className="text-right hidden md:table-cell">{item.daysInQueue}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
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
              {recentActivity.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No recent activity.</p>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity, index) => (
                    <div key={index} className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg">
                      <div className="font-medium text-sm">{activity.action}</div>
                      <div className="text-sm text-muted-foreground">{activity.client} - {activity.document}</div>
                      <div className="text-xs text-muted-foreground">{activity.time}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Daily Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyProgress.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No progress goals configured.</p>
            ) : (
              <div className="space-y-4">
                {dailyProgress.map((goal, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-2">
                      <span>{goal.label}</span>
                      <span>{goal.current} / {goal.target} target</span>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
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

export default MaurasPage;
