import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileCheck, Clock, TrendingUp, CheckCircle2, AlertCircle, Phone, Mail } from 'lucide-react';

const WendysPage = () => {
  // Wendy's specific metrics (Processor role - focuses on client communication)
  const metrics = {
    activeDeals: 10,
    avgDaysPerDeal: 46,
    closingsLast30d: 5,
    conversionRate: 33,
    callsToday: 18,
    emailsSent: 24,
  };

  const clientFollowUps = [
    { client: 'Apex Real Estate', lastContact: '2 days ago', nextAction: 'Follow up on bank statements', priority: 'High', dealStage: 'Document Collection' },
    { client: 'Pinnacle Holdings', lastContact: '1 day ago', nextAction: 'Schedule closing call', priority: 'High', dealStage: 'Path to Close' },
    { client: 'Riverfront Properties', lastContact: '3 days ago', nextAction: 'Request updated financials', priority: 'Medium', dealStage: 'Underwriting' },
    { client: 'Sunrise Ventures', lastContact: 'Today', nextAction: 'Send term sheet', priority: 'High', dealStage: 'Lender Management' },
    { client: 'Golden Gate LLC', lastContact: '4 days ago', nextAction: 'Check on appraisal status', priority: 'Medium', dealStage: 'Document Collection' },
    { client: 'Pacific Coast Group', lastContact: '1 week ago', nextAction: 'Re-engage client', priority: 'Low', dealStage: 'Initial Consult' },
  ];

  const communicationLog = [
    { type: 'Call', client: 'Apex Real Estate', summary: 'Discussed missing documents', duration: '12 min', time: '9:30 AM' },
    { type: 'Email', client: 'Pinnacle Holdings', summary: 'Sent closing checklist', duration: '-', time: '10:15 AM' },
    { type: 'Call', client: 'Sunrise Ventures', summary: 'Term sheet review', duration: '25 min', time: '11:00 AM' },
    { type: 'Email', client: 'Riverfront Properties', summary: 'Requested P&L statement', duration: '-', time: '11:45 AM' },
    { type: 'Call', client: 'Golden Gate LLC', summary: 'Appraisal update', duration: '8 min', time: '2:00 PM' },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-500';
      case 'Medium': return 'bg-yellow-500';
      case 'Low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead>Next Action</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Stage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientFollowUps.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.client}</TableCell>
                      <TableCell>{item.lastContact}</TableCell>
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
            </CardContent>
          </Card>
        </div>

        {/* Daily Targets */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Targets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Client Calls</span>
                  <span>18 / 20 target</span>
                </div>
                <Progress value={90} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Follow-up Emails</span>
                  <span>24 / 25 target</span>
                </div>
                <Progress value={96} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Deal Progressions</span>
                  <span>3 / 5 target</span>
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

export default WendysPage;
