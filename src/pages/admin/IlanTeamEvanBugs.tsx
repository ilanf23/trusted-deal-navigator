import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Bug, ExternalLink, Clock, User } from 'lucide-react';

const IlanTeamEvanBugs = () => {
  const { data: bugReports, isLoading } = useQuery({
    queryKey: ['evan-bug-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bug_reports')
        .select('*')
        .eq('submitted_by_email', 'evan@test.com')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400';
      case 'high':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400';
      case 'low':
        return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400';
      case 'in_progress':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400';
      case 'resolved':
        return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400';
      case 'closed':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Bug className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Evan's Bug Reports</h1>
            <p className="text-sm text-muted-foreground">
              Bug reports submitted by Evan
            </p>
          </div>
        </div>

        {/* Bug Reports List */}
        <ScrollArea className="h-[calc(100vh-200px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : bugReports && bugReports.length > 0 ? (
            <div className="space-y-4 pr-4">
              {bugReports.map((bug) => (
                <Card key={bug.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{bug.title}</CardTitle>
                      <div className="flex gap-2">
                        <Badge className={getPriorityColor(bug.priority)}>
                          {bug.priority || 'No priority'}
                        </Badge>
                        <Badge className={getStatusColor(bug.status)}>
                          {bug.status?.replace('_', ' ') || 'open'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {bug.description && (
                      <p className="text-sm text-muted-foreground">
                        {bug.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(bug.created_at), 'MMM d, yyyy h:mm a')}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {bug.submitted_by || 'Unknown'}
                      </div>
                      {bug.page_url && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-xs text-primary"
                          onClick={() => window.open(bug.page_url!, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Page
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Bug className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No bug reports from Evan yet</p>
            </div>
          )}
        </ScrollArea>
      </div>
    </AdminLayout>
  );
};

export default IlanTeamEvanBugs;
