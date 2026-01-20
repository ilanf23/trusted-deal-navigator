import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Bug, Send, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const BugReporting = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);
  const [newBug, setNewBug] = useState({
    title: '',
    description: '',
    priority: 'medium',
    page_url: '',
  });

  const submitBug = useMutation({
    mutationFn: async (bug: typeof newBug) => {
      const { error } = await supabase.from('bug_reports').insert({
        title: bug.title,
        description: bug.description,
        priority: bug.priority,
        page_url: bug.page_url || null,
        submitted_by: user?.email?.split('@')[0] || 'Unknown',
        submitted_by_email: user?.email,
        browser_info: navigator.userAgent,
        assigned_to: 'Ilan',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bug-reports'] });
      queryClient.invalidateQueries({ queryKey: ['bug-stats'] });
      setNewBug({ title: '', description: '', priority: 'medium', page_url: '' });
      setSubmitted(true);
      toast.success('Bug report sent to Ilan!');
    },
    onError: () => toast.error('Failed to submit bug report'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newBug.title.trim()) {
      submitBug.mutate(newBug);
    }
  };

  const handleNewReport = () => {
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <AdminLayout>
        <div className="max-w-2xl mx-auto mt-12">
          <Card className="text-center">
            <CardContent className="py-16">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Bug Report Sent!</h2>
              <p className="text-muted-foreground mb-6">
                Your report has been sent to Ilan @maverick.AI. He'll look into it shortly.
              </p>
              <Button onClick={handleNewReport}>
                Report Another Bug
              </Button>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Bug Reporting</h1>
          <p className="text-muted-foreground mt-1">
            Report bugs directly to Ilan @maverick.AI
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Report a Bug
            </CardTitle>
            <CardDescription>
              Describe the issue you encountered and Ilan will be notified immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Title *</label>
                <Input
                  placeholder="Brief description of the issue..."
                  value={newBug.title}
                  onChange={(e) => setNewBug({ ...newBug, title: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1.5 block">Description</label>
                <Textarea
                  placeholder="Detailed steps to reproduce, expected vs actual behavior..."
                  value={newBug.description}
                  onChange={(e) => setNewBug({ ...newBug, description: e.target.value })}
                  rows={5}
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
                  <label className="text-sm font-medium mb-1.5 block">Page URL (optional)</label>
                  <Input
                    value={newBug.page_url}
                    onChange={(e) => setNewBug({ ...newBug, page_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
              
              <Button 
                type="submit"
                className="w-full" 
                disabled={!newBug.title.trim() || submitBug.isPending}
              >
                <Send className="h-4 w-4 mr-2" />
                {submitBug.isPending ? 'Sending...' : 'Send to Ilan'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default BugReporting;
