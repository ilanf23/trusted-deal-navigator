import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Link2, 
  Plus, 
  Eye, 
  MessageSquare, 
  Bell, 
  CheckCircle2, 
  ArrowUpRight, 
  UserPlus,
  Clock,
  Send,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  company_name: string | null;
  status: string;
}

interface EmailActionBarProps {
  emailId: string;
  threadId: string;
  emailFrom: string;
  emailSubject: string;
  emailSnippet: string;
  linkedDeal: { id: string; name: string; company_name: string | null } | null;
  nextAction: string | null;
  waitingOn: 'borrower' | 'lender' | 'internal' | 'none' | null;
  isFyi: boolean;
  allLeads: Lead[];
  onNavigate: (path: string) => void;
}

type ActionState = 'idle' | 'loading' | 'success';

export function EmailActionBar({
  emailId,
  threadId,
  emailFrom,
  emailSubject,
  emailSnippet,
  linkedDeal,
  nextAction,
  waitingOn,
  isFyi,
  allLeads,
  onNavigate,
}: EmailActionBarProps) {
  const queryClient = useQueryClient();
  const [actionState, setActionState] = useState<Record<string, ActionState>>({});
  const [linkDealOpen, setLinkDealOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [reminderDays, setReminderDays] = useState('2');
  const [reminderNote, setReminderNote] = useState('');
  const [escalateNote, setEscalateNote] = useState('');

  const setLoading = (actionId: string) => setActionState(prev => ({ ...prev, [actionId]: 'loading' }));
  const setSuccess = (actionId: string) => {
    setActionState(prev => ({ ...prev, [actionId]: 'success' }));
    setTimeout(() => setActionState(prev => ({ ...prev, [actionId]: 'idle' })), 1500);
  };
  const setIdle = (actionId: string) => setActionState(prev => ({ ...prev, [actionId]: 'idle' }));

  // Helper to extract name from email
  const extractName = (from: string) => {
    const match = from.match(/^([^<]+)/);
    if (match) return match[1].trim().replace(/"/g, '');
    return from.split('@')[0];
  };

  const extractEmail = (from: string) => {
    const match = from.match(/<([^>]+)>/);
    return (match?.[1] || from || '').trim();
  };

  // Update email metadata
  const updateMetadata = useMutation({
    mutationFn: async (updates: {
      lead_id?: string | null;
      next_action?: string | null;
      waiting_on?: 'borrower' | 'lender' | 'internal' | null;
      is_fyi?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('email_metadata')
        .select('id')
        .eq('gmail_message_id', emailId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('email_metadata')
          .update({ ...updates, last_activity_date: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_metadata')
          .insert({
            gmail_message_id: emailId,
            gmail_thread_id: threadId,
            user_id: user.id,
            ...updates,
            last_activity_date: new Date().toISOString(),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-metadata'] });
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    },
  });

  // Update thread state
  const updateThread = useMutation({
    mutationFn: async (updates: {
      lead_id?: string | null;
      next_action?: string | null;
      waiting_on?: 'borrower' | 'lender' | 'internal' | 'none' | null;
      is_triaged?: boolean;
      sla_breached?: boolean;
    }) => {
      const { data: existing } = await supabase
        .from('email_threads')
        .select('id')
        .eq('thread_id', threadId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('email_threads')
          .update(updates)
          .eq('thread_id', threadId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_threads')
          .insert({
            thread_id: threadId,
            subject: emailSubject,
            last_message_date: new Date().toISOString(),
            ...updates,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-threads'] });
    },
  });

  // Create a follow-up task
  const createTask = useMutation({
    mutationFn: async ({ title, description, priority, dueDate, leadId }: {
      title: string;
      description: string;
      priority: 'low' | 'medium' | 'high';
      dueDate: Date;
      leadId?: string;
    }) => {
      const { error } = await supabase
        .from('evan_tasks')
        .insert({
          title,
          description,
          priority,
          status: 'todo',
          group_name: 'To Do',
          due_date: dueDate.toISOString(),
          lead_id: leadId || linkedDeal?.id,
          assignee_name: 'Evan',
          tags: ['inbox-action'],
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-tasks'] });
    },
  });

  // Create nudge draft via Gmail API
  const createNudgeDraft = useMutation({
    mutationFn: async ({ nudgeType }: { nudgeType: 'borrower' | 'lender' }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const recipientEmail = extractEmail(emailFrom);
      const recipientName = extractName(emailFrom);
      const dealName = linkedDeal?.company_name || linkedDeal?.name || 'your deal';

      const subject = nudgeType === 'borrower'
        ? `Following up - ${dealName}`
        : `Checking in - ${dealName}`;

      const body = nudgeType === 'borrower'
        ? `Hi ${recipientName.split(' ')[0]},\n\nI wanted to follow up on the items we discussed. Please let me know if you have any questions or need any assistance.\n\nLooking forward to hearing from you.\n\nBest regards,\nEvan`
        : `Hi ${recipientName.split(' ')[0]},\n\nI wanted to check in on the status of ${dealName}. Could you please provide an update on where things stand?\n\nThank you for your time.\n\nBest regards,\nEvan`;

      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=create-draft`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ to: recipientEmail, subject, body }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create draft');

      // Log activity if linked to a deal
      if (linkedDeal?.id) {
        await supabase.from('lead_activities').insert({
          lead_id: linkedDeal.id,
          activity_type: 'email',
          title: `Nudge ${nudgeType} draft created`,
          content: subject,
        });

        // Update lead timestamp
        await supabase.from('leads').update({ 
          updated_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        }).eq('id', linkedDeal.id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-emails'] });
      queryClient.invalidateQueries({ queryKey: ['gmail-drafts-count'] });
    },
  });

  // Action: Link Deal
  const handleLinkDeal = async (leadId: string) => {
    setLoading('link-deal');
    try {
      await updateMetadata.mutateAsync({ lead_id: leadId });
      await updateThread.mutateAsync({ lead_id: leadId, is_triaged: true });
      setLinkDealOpen(false);
      toast.success('Deal linked successfully');
      setSuccess('link-deal');
    } catch (error: any) {
      toast.error('Failed to link deal: ' + error.message);
      setIdle('link-deal');
    }
  };

  // Action: Create New Deal
  const handleCreateDeal = () => {
    onNavigate(`/team/evan/pipeline?createDeal=true&emailFrom=${encodeURIComponent(emailFrom)}&emailSubject=${encodeURIComponent(emailSubject)}`);
  };

  // Action: Mark FYI
  const handleMarkFyi = async () => {
    setLoading('mark-fyi');
    try {
      await updateMetadata.mutateAsync({ is_fyi: true, waiting_on: null });
      await updateThread.mutateAsync({ waiting_on: 'none', is_triaged: true });
      toast.success('Marked as FYI - no action required');
      setSuccess('mark-fyi');
    } catch (error: any) {
      toast.error('Failed: ' + error.message);
      setIdle('mark-fyi');
    }
  };

  // Action: Nudge Borrower/Lender
  const handleNudge = async (type: 'borrower' | 'lender') => {
    const actionId = type === 'borrower' ? 'nudge-borrower' : 'nudge-lender';
    setLoading(actionId);
    try {
      await createNudgeDraft.mutateAsync({ nudgeType: type });
      
      // Create a follow-up task
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      
      await createTask.mutateAsync({
        title: `Follow up on nudge - ${linkedDeal?.name || extractName(emailFrom)}`,
        description: `Nudge ${type} email drafted. Verify response received.`,
        priority: 'medium',
        dueDate: tomorrow,
      });

      toast.success(`${type === 'borrower' ? 'Borrower' : 'Lender'} nudge draft created. Check Drafts folder.`);
      setSuccess(actionId);
    } catch (error: any) {
      toast.error('Failed to create nudge: ' + error.message);
      setIdle(actionId);
    }
  };

  // Action: Set Reminder
  const handleSetReminder = async () => {
    setLoading('set-reminder');
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + parseInt(reminderDays));
      dueDate.setHours(9, 0, 0, 0);

      await createTask.mutateAsync({
        title: `Reminder: ${linkedDeal?.name || extractName(emailFrom)}`,
        description: reminderNote || `Follow up on email: "${emailSubject}"`,
        priority: 'medium',
        dueDate,
      });

      setReminderDialogOpen(false);
      setReminderNote('');
      toast.success(`Reminder set for ${reminderDays} day${parseInt(reminderDays) > 1 ? 's' : ''} from now`);
      setSuccess('set-reminder');
    } catch (error: any) {
      toast.error('Failed to set reminder: ' + error.message);
      setIdle('set-reminder');
    }
  };

  // Action: Mark Received (borrower sent what we needed)
  const handleMarkReceived = async () => {
    setLoading('mark-received');
    try {
      await updateMetadata.mutateAsync({ 
        waiting_on: null, 
        next_action: 'Review received documents' 
      });
      await updateThread.mutateAsync({ 
        waiting_on: 'internal', 
        next_action: 'Review received documents' 
      });

      // Update lead status if applicable
      if (linkedDeal?.id) {
        await supabase.from('leads').update({ 
          updated_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        }).eq('id', linkedDeal.id);

        await supabase.from('lead_activities').insert({
          lead_id: linkedDeal.id,
          activity_type: 'status',
          title: 'Documents received from borrower',
          content: `Via email: ${emailSubject}`,
        });
      }

      toast.success('Marked as received. Next: Review documents.');
      setSuccess('mark-received');
    } catch (error: any) {
      toast.error('Failed: ' + error.message);
      setIdle('mark-received');
    }
  };

  // Action: Mark Responded (lender responded)
  const handleMarkResponded = async () => {
    setLoading('mark-responded');
    try {
      await updateMetadata.mutateAsync({ 
        waiting_on: null, 
        next_action: 'Review lender response' 
      });
      await updateThread.mutateAsync({ 
        waiting_on: 'internal', 
        next_action: 'Review lender response' 
      });

      // Update lead
      if (linkedDeal?.id) {
        await supabase.from('leads').update({ 
          updated_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        }).eq('id', linkedDeal.id);

        await supabase.from('lead_activities').insert({
          lead_id: linkedDeal.id,
          activity_type: 'status',
          title: 'Lender response received',
          content: `Via email: ${emailSubject}`,
        });
      }

      toast.success('Marked as responded. Next: Review lender response.');
      setSuccess('mark-responded');
    } catch (error: any) {
      toast.error('Failed: ' + error.message);
      setIdle('mark-responded');
    }
  };

  // Action: Escalate
  const handleEscalate = async () => {
    setLoading('escalate');
    try {
      // Create high-priority task for escalation
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      await createTask.mutateAsync({
        title: `ESCALATE: ${linkedDeal?.name || extractName(emailFrom)}`,
        description: escalateNote || `Escalation needed for deal. Original email: "${emailSubject}"`,
        priority: 'high',
        dueDate: tomorrow,
      });

      // Update waiting status
      await updateMetadata.mutateAsync({ 
        waiting_on: 'internal', 
        next_action: 'Escalation in progress' 
      });
      await updateThread.mutateAsync({ 
        waiting_on: 'internal', 
        next_action: 'Escalation in progress',
        sla_breached: true,
      });

      // Log activity
      if (linkedDeal?.id) {
        await supabase.from('lead_activities').insert({
          lead_id: linkedDeal.id,
          activity_type: 'status',
          title: 'Deal escalated',
          content: escalateNote || 'Escalation triggered from inbox',
        });
      }

      setEscalateDialogOpen(false);
      setEscalateNote('');
      toast.success('Deal escalated. High-priority task created.');
      setSuccess('escalate');
    } catch (error: any) {
      toast.error('Failed to escalate: ' + error.message);
      setIdle('escalate');
    }
  };

  // Action: Assign Task
  const handleAssignTask = () => {
    onNavigate(`/team/evan/tasks?createTask=true&emailSubject=${encodeURIComponent(emailSubject)}&leadId=${linkedDeal?.id || ''}`);
  };

  // Action: Mark Complete
  const handleMarkComplete = async () => {
    setLoading('mark-complete');
    try {
      await updateMetadata.mutateAsync({ 
        waiting_on: null, 
        next_action: null, 
        is_fyi: true 
      });
      await updateThread.mutateAsync({ 
        waiting_on: 'none', 
        next_action: null, 
        is_triaged: true 
      });

      if (linkedDeal?.id) {
        await supabase.from('lead_activities').insert({
          lead_id: linkedDeal.id,
          activity_type: 'status',
          title: 'Email action completed',
          content: `Completed: ${emailSubject}`,
        });
      }

      toast.success('Marked as complete');
      setSuccess('mark-complete');
    } catch (error: any) {
      toast.error('Failed: ' + error.message);
      setIdle('mark-complete');
    }
  };

  // Determine which actions to show
  const isUntriaged = !linkedDeal || !nextAction;
  
  if (isFyi) return null;

  const getButtonState = (actionId: string) => actionState[actionId] || 'idle';

  const ActionButton = ({ 
    actionId, 
    icon: Icon, 
    label, 
    variant, 
    onClick 
  }: { 
    actionId: string; 
    icon: React.ComponentType<{ className?: string }>; 
    label: string; 
    variant: 'default' | 'warning' | 'success' | 'primary';
    onClick: () => void;
  }) => {
    const state = getButtonState(actionId);
    const variantClasses = {
      default: 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300',
      warning: 'bg-amber-50 hover:bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400',
      success: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400',
      primary: 'bg-primary/10 hover:bg-primary/20 text-primary',
    };

    return (
      <button
        onClick={onClick}
        disabled={state === 'loading'}
        className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-all ${variantClasses[variant]} ${
          state === 'success' ? 'ring-2 ring-emerald-400 ring-offset-1' : ''
        } disabled:opacity-50`}
      >
        {state === 'loading' ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : state === 'success' ? (
          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
        ) : (
          <Icon className="w-3 h-3" />
        )}
        <span>{state === 'success' ? 'Done!' : label}</span>
      </button>
    );
  };

  return (
    <>
      <div className="flex items-center gap-1.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        {isUntriaged ? (
          // Untriaged actions
          <>
            {!linkedDeal && (
              <Popover open={linkDealOpen} onOpenChange={setLinkDealOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-colors bg-amber-50 hover:bg-amber-100 text-amber-600">
                    <Link2 className="w-3 h-3" />
                    <span>Link deal</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500">Link to a deal</p>
                    <ScrollArea className="max-h-48">
                      {allLeads.slice(0, 15).map((lead) => (
                        <button
                          key={lead.id}
                          onClick={() => handleLinkDeal(lead.id)}
                          className="w-full text-left px-2 py-1.5 text-sm hover:bg-slate-100 rounded flex items-center gap-2"
                        >
                          <span className="truncate">{lead.company_name || lead.name}</span>
                        </button>
                      ))}
                    </ScrollArea>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <ActionButton actionId="create-deal" icon={Plus} label="New deal" variant="default" onClick={handleCreateDeal} />
            <ActionButton actionId="mark-fyi" icon={Eye} label="Mark FYI" variant="default" onClick={handleMarkFyi} />
          </>
        ) : waitingOn === 'borrower' ? (
          // Waiting on borrower actions
          <>
            <ActionButton actionId="nudge-borrower" icon={MessageSquare} label="Nudge" variant="primary" onClick={() => handleNudge('borrower')} />
            <ActionButton actionId="set-reminder" icon={Bell} label="Remind me" variant="default" onClick={() => setReminderDialogOpen(true)} />
            <ActionButton actionId="mark-received" icon={CheckCircle2} label="Received" variant="success" onClick={handleMarkReceived} />
          </>
        ) : waitingOn === 'lender' ? (
          // Waiting on lender actions
          <>
            <ActionButton actionId="nudge-lender" icon={MessageSquare} label="Nudge" variant="primary" onClick={() => handleNudge('lender')} />
            <ActionButton actionId="escalate" icon={ArrowUpRight} label="Escalate" variant="warning" onClick={() => setEscalateDialogOpen(true)} />
            <ActionButton actionId="mark-responded" icon={CheckCircle2} label="Responded" variant="success" onClick={handleMarkResponded} />
          </>
        ) : waitingOn === 'internal' ? (
          // Internal actions
          <>
            <ActionButton actionId="assign-task" icon={UserPlus} label="Assign" variant="primary" onClick={handleAssignTask} />
            <ActionButton actionId="mark-complete" icon={CheckCircle2} label="Complete" variant="success" onClick={handleMarkComplete} />
          </>
        ) : linkedDeal && nextAction ? (
          // Triaged with next action - show done button
          <ActionButton actionId="mark-complete" icon={CheckCircle2} label="Done" variant="success" onClick={handleMarkComplete} />
        ) : null}

        {/* Set Waiting On dropdown for triaged emails */}
        {linkedDeal && !isUntriaged && !waitingOn && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-colors bg-slate-100 hover:bg-slate-200 text-slate-600">
                <Clock className="w-3 h-3" />
                <span>Set status</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="start">
              <button 
                onClick={async () => {
                  await updateMetadata.mutateAsync({ waiting_on: 'borrower' });
                  await updateThread.mutateAsync({ waiting_on: 'borrower' });
                  toast.success('Set to waiting on borrower');
                }}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-100 rounded"
              >
                Waiting on Borrower
              </button>
              <button 
                onClick={async () => {
                  await updateMetadata.mutateAsync({ waiting_on: 'lender' });
                  await updateThread.mutateAsync({ waiting_on: 'lender' });
                  toast.success('Set to waiting on lender');
                }}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-100 rounded"
              >
                Waiting on Lender
              </button>
              <button 
                onClick={async () => {
                  await updateMetadata.mutateAsync({ waiting_on: 'internal' });
                  await updateThread.mutateAsync({ waiting_on: 'internal' });
                  toast.success('Set to internal action');
                }}
                className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-100 rounded"
              >
                Internal Action
              </button>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Reminder Dialog */}
      <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Reminder</DialogTitle>
            <DialogDescription>
              Create a task to follow up on this email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Remind me in</label>
              <div className="flex gap-2 mt-1.5">
                {['1', '2', '3', '5', '7'].map((days) => (
                  <button
                    key={days}
                    onClick={() => setReminderDays(days)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      reminderDays === days 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Note (optional)</label>
              <Textarea
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
                placeholder="Add context for your future self..."
                className="mt-1.5"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSetReminder} disabled={getButtonState('set-reminder') === 'loading'}>
              {getButtonState('set-reminder') === 'loading' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Set Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Escalate Dialog */}
      <Dialog open={escalateDialogOpen} onOpenChange={setEscalateDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Escalate Deal
            </DialogTitle>
            <DialogDescription>
              This will create a high-priority task and mark the deal as at-risk.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Reason for escalation</label>
              <Textarea
                value={escalateNote}
                onChange={(e) => setEscalateNote(e.target.value)}
                placeholder="Lender unresponsive for 2 weeks, need manager intervention..."
                className="mt-1.5"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalateDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleEscalate} 
              disabled={getButtonState('escalate') === 'loading'}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {getButtonState('escalate') === 'loading' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Escalate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
