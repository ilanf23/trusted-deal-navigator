import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Bug, Send, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

const FloatingBugReport = () => {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
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
        page_url: bug.page_url || window.location.href,
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

  const handleClose = () => {
    setOpen(false);
    // Reset form after dialog closes
    setTimeout(() => {
      setSubmitted(false);
      setNewBug({ title: '', description: '', priority: 'medium', page_url: '' });
    }, 200);
  };

  const handleOpen = () => {
    // Pre-fill the current page URL
    setNewBug(prev => ({ ...prev, page_url: window.location.href }));
    setOpen(true);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl bg-destructive hover:bg-destructive/90 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
        title="Report a bug"
      >
        <Bug className="w-7 h-7 group-hover:scale-110 transition-transform" color="white" strokeWidth={2.5} />
      </button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <DialogTitle className="text-xl mb-2">Bug Report Sent!</DialogTitle>
              <DialogDescription className="mb-6">
                Your report has been sent to Ilan. He'll look into it shortly.
              </DialogDescription>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button onClick={() => {
                  setSubmitted(false);
                  setNewBug({ title: '', description: '', priority: 'medium', page_url: window.location.href });
                }}>
                  Report Another
                </Button>
              </div>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bug className="h-5 w-5 text-destructive" />
                  Report a Bug
                </DialogTitle>
                <DialogDescription>
                  Describe the issue and it will be sent to Ilan.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Title *</label>
                  <Input
                    placeholder="Brief description of the issue..."
                    value={newBug.title}
                    onChange={(e) => setNewBug({ ...newBug, title: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Description</label>
                  <Textarea
                    placeholder="Steps to reproduce, expected vs actual behavior..."
                    value={newBug.description}
                    onChange={(e) => setNewBug({ ...newBug, description: e.target.value })}
                    rows={4}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
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
                      placeholder="Auto-filled"
                      className="text-xs"
                    />
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    className="flex-1" 
                    disabled={!newBug.title.trim() || submitBug.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {submitBug.isPending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FloatingBugReport;
