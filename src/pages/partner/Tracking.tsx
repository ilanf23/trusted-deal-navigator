import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import { Plus, CalendarIcon, Trash2, Filter, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type TrackingRecord = {
  id: string;
  partner_id: string;
  referral_id: string;
  tracking_status: string;
  priority: string;
  internal_notes: string | null;
  last_contacted_at: string | null;
  next_follow_up: string | null;
  created_at: string;
  updated_at: string;
  referral?: {
    id: string;
    name: string;
    company_name: string | null;
    status: string;
    loan_type: string | null;
    loan_amount: number | null;
    email: string | null;
    phone: string | null;
  };
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  low: 'bg-muted text-muted-foreground',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  closed: 'bg-muted text-muted-foreground',
};

const Tracking = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [sortField, setSortField] = useState<'priority' | 'next_follow_up'>('next_follow_up');
  const [sortAsc, setSortAsc] = useState(true);

  // Fetch tracking records with referral data
  const { data: trackingRecords = [], isLoading } = useQuery({
    queryKey: ['partner-tracking', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_tracking')
        .select('*, referral:partner_referrals(id, name, company_name, status, loan_type, loan_amount, email, phone)')
        .eq('partner_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as TrackingRecord[];
    },
    enabled: !!user,
  });

  // Fetch unlinked referrals for the link dialog
  const { data: unlinkedReferrals = [] } = useQuery({
    queryKey: ['unlinked-referrals', user?.id, trackingRecords],
    queryFn: async () => {
      const linkedIds = trackingRecords.map((t) => t.referral_id);
      const { data, error } = await supabase
        .from('partner_referrals')
        .select('id, name, company_name, loan_type, loan_amount, status')
        .eq('partner_id', user!.id);
      if (error) throw error;
      return (data || []).filter((r) => !linkedIds.includes(r.id));
    },
    enabled: !!user,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('partner-tracking-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_tracking', filter: `partner_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['partner-tracking'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const linkReferral = useMutation({
    mutationFn: async (referralId: string) => {
      const { error } = await supabase.from('partner_tracking').insert({
        partner_id: user!.id,
        referral_id: referralId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-referrals'] });
      toast({ title: 'Referral linked to tracking' });
      setLinkDialogOpen(false);
    },
    onError: () => toast({ title: 'Failed to link referral', variant: 'destructive' }),
  });

  const updateTracking = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: unknown }) => {
      const { error } = await supabase.from('partner_tracking').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partner-tracking'] }),
    onError: () => toast({ title: 'Failed to update', variant: 'destructive' }),
  });

  const removeTracking = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('partner_tracking').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-tracking'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-referrals'] });
      toast({ title: 'Removed from tracking' });
    },
    onError: () => toast({ title: 'Failed to remove', variant: 'destructive' }),
  });

  // Filter and sort
  const priorityOrder = { high: 0, normal: 1, low: 2 };
  const filtered = trackingRecords
    .filter((t) => filterPriority === 'all' || t.priority === filterPriority)
    .sort((a, b) => {
      if (sortField === 'priority') {
        const diff = (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1);
        return sortAsc ? diff : -diff;
      }
      const aDate = a.next_follow_up || '';
      const bDate = b.next_follow_up || '';
      return sortAsc ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
    });

  const toggleSort = (field: 'priority' | 'next_follow_up') => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Referral Tracking</h1>
          <p className="text-sm text-muted-foreground mt-1">Link and manage your referrals for pipeline tracking</p>
        </div>
        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1.5" />Link Referral</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Link a Referral to Tracking</DialogTitle></DialogHeader>
            {unlinkedReferrals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">All your referrals are already linked.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {unlinkedReferrals.map((r) => (
                  <Card key={r.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => linkReferral.mutate(r.id)}>
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.company_name || 'No company'} · {r.loan_type || 'N/A'}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{r.status}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {trackingRecords.length === 0 ? 'No referrals linked yet. Click "Link Referral" to get started.' : 'No results match the current filter.'}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referral</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('priority')}>
                    <span className="flex items-center gap-1">Priority <ArrowUpDown className="w-3 h-3" /></span>
                  </TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('next_follow_up')}>
                    <span className="flex items-center gap-1">Follow-up <ArrowUpDown className="w-3 h-3" /></span>
                  </TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{t.referral?.name || '—'}</p>
                        <p className="text-xs text-muted-foreground">{t.referral?.company_name || ''}{t.referral?.loan_type ? ` · ${t.referral.loan_type}` : ''}</p>
                        {t.referral?.loan_amount && <p className="text-xs text-muted-foreground">${Number(t.referral.loan_amount).toLocaleString()}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs', statusColors[t.referral?.status || ''] || '')} variant="secondary">
                        {t.referral?.status || '—'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={t.priority} onValueChange={(v) => updateTracking.mutate({ id: t.id, priority: v })}>
                        <SelectTrigger className="h-7 w-24 text-xs border-0 bg-transparent p-0">
                          <Badge className={cn('text-xs', priorityColors[t.priority])}>{t.priority}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={t.tracking_status} onValueChange={(v) => updateTracking.mutate({ id: t.id, tracking_status: v })}>
                        <SelectTrigger className="h-7 w-24 text-xs border-0 bg-transparent p-0">
                          <Badge className={cn('text-xs', statusColors[t.tracking_status])}>{t.tracking_status}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 text-xs px-2 font-normal">
                            <CalendarIcon className="w-3 h-3 mr-1" />
                            {t.next_follow_up ? format(new Date(t.next_follow_up), 'MMM d') : 'Set date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={t.next_follow_up ? new Date(t.next_follow_up) : undefined}
                            onSelect={(date) => updateTracking.mutate({ id: t.id, next_follow_up: date ? format(date, 'yyyy-MM-dd') : null })}
                          />
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <Input
                        className="h-7 text-xs border-0 bg-transparent px-1"
                        placeholder="Add notes..."
                        defaultValue={t.internal_notes || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (t.internal_notes || '')) {
                            updateTracking.mutate({ id: t.id, internal_notes: e.target.value || null });
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeTracking.mutate(t.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Tracking;
