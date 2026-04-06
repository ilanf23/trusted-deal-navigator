import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  Phone, 
  FileUp, 
  Mail, 
  ArrowRight, 
  Zap,
  Calendar,
  MessageSquare
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface QuickActionsProps {
  evanId?: string;
}

export const QuickActions = ({ evanId }: QuickActionsProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showLogCall, setShowLogCall] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [callData, setCallData] = useState({ phoneNumber: '', notes: '' });
  const [noteContent, setNoteContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogCall = async () => {
    if (!callData.phoneNumber) {
      toast.error('Phone number is required');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('communications').insert({
        communication_type: 'call',
        direction: 'outbound',
        phone_number: callData.phoneNumber,
        content: callData.notes,
        status: 'completed',
      });

      if (error) throw error;

      toast.success('Call logged successfully');
      setShowLogCall(false);
      setCallData({ phoneNumber: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
    } catch (error) {
      toast.error('Failed to log call');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) {
      toast.error('Note content is required');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('notes').insert({
        content: noteContent,
      });

      if (error) throw error;

      toast.success('Note added successfully');
      setShowAddNote(false);
      setNoteContent('');
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
    } catch (error) {
      toast.error('Failed to add note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const actions = [
    {
      label: 'Add Deal',
      icon: Plus,
      onClick: () => navigate('/admin/leads'),
    },
    {
      label: 'Log Call',
      icon: Phone,
      onClick: () => setShowLogCall(true),
    },
    {
      label: 'Add Note',
      icon: MessageSquare,
      onClick: () => setShowAddNote(true),
    },
    {
      label: 'Pipeline',
      icon: ArrowRight,
      onClick: () => navigate('/admin/pipeline'),
    },
  ];

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-muted-foreground" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {actions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                onClick={action.onClick}
                className="h-auto py-4 flex flex-col gap-2"
              >
                <action.icon className="h-5 w-5" />
                <span className="text-xs font-medium">{action.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Log Call Dialog */}
      <Dialog open={showLogCall} onOpenChange={setShowLogCall}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log a Call</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="(555) 123-4567"
                value={callData.phoneNumber}
                onChange={(e) => setCallData({ ...callData, phoneNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Call notes..."
                value={callData.notes}
                onChange={(e) => setCallData({ ...callData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowLogCall(false)}>
                Cancel
              </Button>
              <Button onClick={handleLogCall} disabled={isSubmitting}>
                Log Call
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Quick Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                placeholder="Write your note..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddNote(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddNote} disabled={isSubmitting}>
                Save Note
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
