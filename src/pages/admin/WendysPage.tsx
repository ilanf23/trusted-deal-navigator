import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { FileCheck, Clock, TrendingUp, CheckCircle2, AlertCircle, Phone, Mail } from 'lucide-react';
import { useWendysDashboard } from '@/hooks/useWendysDashboard';

const WendysPage = () => {
  const {
    metrics,
    clientFollowUps,
    communicationLog,
    dailyTargets,
    isLoading,
  } = useWendysDashboard();

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-500';
      case 'Medium': return 'bg-yellow-500';
      case 'Low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Wendy's Dashboard</h1>
            <p className="text-muted-foreground">Client communication and deal progression tracking</p>
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
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2"><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
          </div>
          <Card><CardContent className="pt-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Wendy's Dashboard</h1>
          <p className="text-muted-foreground">Client communication and deal progression tracking</p>
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
                <Phone className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-muted-foreground">Calls Today</span>
              </div>
              <div className="text-2xl font-bold mt-2">{metrics.callsToday}</div>
            </CardContent>
          </Card>

          <Card className="border-purple-500/20 border-2">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-purple-600" />
                <span className="text-sm text-muted-foreground">Emails Sent</span>
              </div>
              <div className="text-2xl font-bold mt-2">{metrics.emailsSent}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Client Follow-ups */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-admin-blue" />
                Client Follow-ups
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clientFollowUps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No active follow-ups.</p>
              ) : (
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead className="hidden md:table-cell">Last Contact</TableHead>
                      <TableHead>Next Action</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Stage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientFollowUps.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.client}</TableCell>
                        <TableCell className="hidden md:table-cell">{item.lastContact}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{item.nextAction}</TableCell>
                        <TableCell>
                          <Badge className={getPriorityColor(item.priority)}>{item.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.dealStage}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Today's Communication Log */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-admin-blue" />
                Today's Communications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {communicationLog.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No communications logged today.</p>
              ) : (
                <div className="space-y-3">
                  {communicationLog.map((log, index) => (
                    <div key={index} className="flex flex-col gap-1 p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {log.type === 'Call' ? (
                            <Phone className="h-4 w-4 text-green-600" />
                          ) : (
                            <Mail className="h-4 w-4 text-blue-600" />
                          )}
                          <span className="font-medium text-sm">{log.client}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{log.time}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">{log.summary}</div>
                      {log.duration !== '-' && (
                        <div className="text-xs text-muted-foreground">Duration: {log.duration}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Daily Targets */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Targets</CardTitle>
          </CardHeader>
          <CardContent>
            {dailyTargets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No targets configured.</p>
            ) : (
              <div className="space-y-4">
                {dailyTargets.map((target, index) => (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-2">
                      <span>{target.label}</span>
                      <span>{target.current} / {target.target} target</span>
                    </div>
                    <Progress value={target.progress} className="h-2" />
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

export default WendysPage;
