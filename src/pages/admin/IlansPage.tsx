import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Bug, Code2, Wrench, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const IlansPage = () => {
  // Fetch bug report stats
  const { data: bugStats } = useQuery({
    queryKey: ['bug-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bug_reports')
        .select('status');
      if (error) throw error;
      
      const open = data?.filter(b => b.status === 'open').length || 0;
      const inProgress = data?.filter(b => b.status === 'in_progress').length || 0;
      const resolved = data?.filter(b => b.status === 'resolved').length || 0;
      
      return { open, inProgress, resolved, total: data?.length || 0 };
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="pb-4">
          <h1 className="text-3xl font-semibold tracking-tight">Developer Dashboard</h1>
          <p className="text-muted-foreground mt-1">Development tools and bug tracking</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Open Bugs</p>
                  <p className="text-3xl font-bold text-orange-600">{bugStats?.open || 0}</p>
                </div>
                <AlertCircle className="h-10 w-10 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                  <p className="text-3xl font-bold text-blue-600">{bugStats?.inProgress || 0}</p>
                </div>
                <Clock className="h-10 w-10 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Resolved</p>
                  <p className="text-3xl font-bold text-emerald-600">{bugStats?.resolved || 0}</p>
                </div>
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Reports</p>
                  <p className="text-3xl font-bold">{bugStats?.total || 0}</p>
                </div>
                <Bug className="h-10 w-10 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/admin/ilan/bugs">
            <Card className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] hover:border-primary/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                    <Bug className="h-5 w-5 text-orange-600" />
                  </div>
                  Bug Testing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  View and manage bug reports submitted by team members
                </p>
              </CardContent>
            </Card>
          </Link>
          
          <Card className="opacity-50 cursor-not-allowed">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Code2 className="h-5 w-5 text-muted-foreground" />
                </div>
                Code Review
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Coming Soon</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Review and manage code changes
              </p>
            </CardContent>
          </Card>
          
          <Card className="opacity-50 cursor-not-allowed">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Wrench className="h-5 w-5 text-muted-foreground" />
                </div>
                System Settings
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Coming Soon</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                Configure system-wide settings
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default IlansPage;
