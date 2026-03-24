import { useState, useEffect } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { Bug, Plus, AlertCircle, Clock, CheckCircle2, ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DbTableBadge } from '@/components/admin/DbTableBadge';

interface BugReport {
  id: string;
  title: string;
  description: string | null;
  priority: string | null;
  status: string | null;
  submitted_by: string | null;
  submitted_by_email: string | null;
  page_url: string | null;
  browser_info: string | null;
  created_at: string;
  resolved_at: string | null;
}

const BugTesting = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Bug Testing');
    return () => { setPageTitle(null); };
  }, []);
  const [newBug, setNewBug] = useState({
    title: '',
    description: '',
    priority: 'medium',
    page_url: window.location.href,
  });

  const { data: bugs = [], isLoading } = useQuery({
    queryKey: ['bug-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bug_reports')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as BugReport[];
    },
  });

  const submitBug = useMutation({
    mutationFn: async (bug: typeof newBug) => {
      const { error } = await supabase.from('bug_reports').insert({
        title: bug.title,
        description: bug.description,
        priority: bug.priority,
        page_url: bug.page_url,
        submitted_by: user?.email?.split('@')[0] || 'Unknown',
        submitted_by_email: user?.email,
        browser_info: navigator.userAgent,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
      queryClient.invalidateQueries({ queryKey: ['bug-stats'] });
      setNewBug({ title: '', description: '', priority: 'medium', page_url: window.location.href });
      setIsDialogOpen(false);
      toast.success('Bug report submitted!');
    },
    onError: () => toast.error('Failed to submit bug report'),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase.from('bug_reports').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
      queryClient.invalidateQueries({ queryKey: ['bug-stats'] });
      toast.success('Status updated');
    },
  });

  const deleteBug = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bug_reports').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
      queryClient.invalidateQueries({ queryKey: ['bug-stats'] });
      toast.success('Bug report deleted');
    },
  });

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'open': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'in_progress': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'resolved': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      default: return <Bug className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'open': return <Badge className="bg-orange-100 text-orange-700 border-orange-200">Open</Badge>;
      case 'in_progress': return <Badge className="bg-blue-100 text-blue-700 border-blue-200">In Progress</Badge>;
      case 'resolved': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Resolved</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case 'critical': return <Badge className="bg-red-100 text-red-700 border-red-200">Critical</Badge>;
      case 'high': return <Badge className="bg-orange-100 text-orange-700 border-orange-200">High</Badge>;
      case 'medium': return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Medium</Badge>;
      case 'low': return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Low</Badge>;
      default: return null;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-end">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                Report Bug
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5" />
                  Report a Bug
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Title</label>
                  <Input
                    placeholder="Brief description of the issue..."
                    value={newBug.title}
                    onChange={(e) => setNewBug({ ...newBug, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Description</label>
                  <Textarea
                    placeholder="Detailed steps to reproduce, expected vs actual behavior..."
                    value={newBug.description}
                    onChange={(e) => setNewBug({ ...newBug, description: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Priority</label>
                    <Select value={newBug.priority} onValueChange={(v) => setNewBug({ ...newBug, priority: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Page URL</label>
                    <Input
                      value={newBug.page_url}
                      onChange={(e) => setNewBug({ ...newBug, page_url: e.target.value })}
                      placeholder="Current page URL"
                    />
                  </div>
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => submitBug.mutate(newBug)}
                  disabled={!newBug.title.trim() || submitBug.isPending}
                >
                  Submit Bug Report
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Bug List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/20 border-t-foreground animate-spin" />
          </div>
        ) : bugs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Bug className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg mb-1">No bug reports yet</h3>
              <p className="text-muted-foreground text-sm mb-4">When team members report bugs, they'll appear here</p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Report First Bug
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bugs.map((bug) => (
              <Card key={bug.id} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-muted mt-0.5">
                      {getStatusIcon(bug.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-medium">{bug.title}</h3>
                        {getStatusBadge(bug.status)}
                        {getPriorityBadge(bug.priority)}
                      </div>
                      
                      {bug.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{bug.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[8px] bg-primary/10">
                              {(bug.submitted_by || 'U').substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{bug.submitted_by || 'Unknown'}</span>
                        </div>
                        <span>•</span>
                        <span>{format(parseISO(bug.created_at), 'MMM d, h:mm a')}</span>
                        {bug.page_url && (
                          <>
                            <span>•</span>
                            <a 
                              href={bug.page_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:text-primary"
                            >
                              View Page <ExternalLink className="h-3 w-3" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Select 
                        value={bug.status || 'open'} 
                        onValueChange={(v) => updateStatus.mutate({ id: bug.id, status: v })}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteBug.mutate(bug.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default BugTesting;
