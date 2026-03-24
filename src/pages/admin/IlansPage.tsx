import { useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Bug, Code2, Wrench, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const IlansPage = () => {
  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Developer Dashboard');
    return () => { setPageTitle(null); };
  }, []);

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
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border hover:border-primary/30 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Open Bugs</p>
                  <p className="text-3xl font-bold text-destructive">{bugStats?.open || 0}</p>
                </div>
                <div className="p-3 rounded-full bg-destructive/10">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border hover:border-primary/30 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                  <p className="text-3xl font-bold text-primary">{bugStats?.inProgress || 0}</p>
                </div>
                <div className="p-3 rounded-full bg-primary/10">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border hover:border-primary/30 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Resolved</p>
                  <p className="text-3xl font-bold text-green-600">{bugStats?.resolved || 0}</p>
                </div>
                <div className="p-3 rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border hover:border-primary/30 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Reports</p>
                  <p className="text-3xl font-bold">{bugStats?.total || 0}</p>
                </div>
                <div className="p-3 rounded-full bg-muted">
                  <Bug className="h-8 w-8 text-muted-foreground" />
                </div>
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
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bug className="h-5 w-5 text-primary" />
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
