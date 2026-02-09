import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, ChevronDown, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/components/ui/sonner';

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  in_review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  funded: 'bg-emerald-100 text-emerald-800',
};

const loanTypes = ['Commercial Real Estate', 'Business Acquisition', 'Working Capital', 'SBA Loan', 'Bridge Loan', 'Other'];
const urgencyOptions = ['Urgent', 'Standard', 'No Rush'];

const PartnerReferrals = () => {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState<any[]>([]);
  const [history, setHistory] = useState<Record<string, any[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', company_name: '',
    loan_amount: '', loan_type: '', property_address: '',
    urgency: 'Standard', notes: '',
  });

  const fetchReferrals = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('partner_referrals')
      .select('*')
      .eq('partner_id', user.id)
      .order('created_at', { ascending: false });
    setReferrals(data || []);
  };

  const fetchHistory = async (referralId: string) => {
    const { data } = await supabase
      .from('partner_referral_status_history')
      .select('*')
      .eq('referral_id', referralId)
      .order('changed_at', { ascending: true });
    setHistory(prev => ({ ...prev, [referralId]: data || [] }));
  };

  useEffect(() => {
    fetchReferrals();

    if (!user) return;
    const channel = supabase
      .channel('partner-referrals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partner_referrals', filter: `partner_id=eq.${user.id}` }, () => fetchReferrals())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'partner_referral_status_history' }, (payload) => {
        const rid = (payload.new as any).referral_id;
        fetchHistory(rid);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const { error } = await supabase.from('partner_referrals').insert({
      partner_id: user.id,
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      company_name: form.company_name || null,
      loan_amount: form.loan_amount ? Number(form.loan_amount) : null,
      loan_type: form.loan_type || null,
      property_address: form.property_address || null,
      urgency: form.urgency,
      notes: form.notes || null,
    });

    if (error) {
      toast.error('Failed to submit referral');
    } else {
      toast.success('Referral submitted successfully!');
      setForm({ name: '', email: '', phone: '', company_name: '', loan_amount: '', loan_type: '', property_address: '', urgency: 'Standard', notes: '' });
      setDialogOpen(false);
      fetchReferrals();
    }
    setSubmitting(false);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Referrals</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Referral</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Submit a Referral</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Name *</Label>
                    <Input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Loan Amount</Label>
                    <Input type="number" value={form.loan_amount} onChange={e => setForm(f => ({ ...f, loan_amount: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Loan Type</Label>
                    <Select value={form.loan_type} onValueChange={v => setForm(f => ({ ...f, loan_type: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        {loanTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Property Address</Label>
                  <Input value={form.property_address} onChange={e => setForm(f => ({ ...f, property_address: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Urgency</Label>
                  <Select value={form.urgency} onValueChange={v => setForm(f => ({ ...f, urgency: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {urgencyOptions.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional details..." />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Referral'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="pt-6">
            {referrals.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No referrals yet. Click "New Referral" to get started.</p>
            ) : (
              <div className="space-y-2">
                {referrals.map((r) => (
                  <Collapsible key={r.id} onOpenChange={(open) => { if (open && !history[r.id]) fetchHistory(r.id); }}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50 transition-colors">
                        <div className="text-left">
                          <p className="font-medium">{r.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.company_name && `${r.company_name} • `}
                            {r.loan_type && `${r.loan_type} • `}
                            {r.loan_amount && `$${Number(r.loan_amount).toLocaleString()} • `}
                            {format(new Date(r.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[r.status] || ''} variant="secondary">
                            {r.status.replace('_', ' ')}
                          </Badge>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-6 pl-4 border-l-2 border-border py-3 space-y-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status Timeline</p>
                        {(history[r.id] || []).map((h) => (
                          <div key={h.id} className="flex items-start gap-3">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm">
                                {h.old_status ? (
                                  <><span className="text-muted-foreground">{h.old_status.replace('_', ' ')}</span> → <span className="font-medium">{h.new_status.replace('_', ' ')}</span></>
                                ) : (
                                  <span className="font-medium">Submitted</span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">{format(new Date(h.changed_at), 'MMM d, yyyy h:mm a')}</p>
                              {h.note && <p className="text-xs text-muted-foreground mt-1 italic">{h.note}</p>}
                            </div>
                          </div>
                        ))}
                        {!history[r.id] && <p className="text-xs text-muted-foreground">Loading timeline...</p>}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default PartnerReferrals;
