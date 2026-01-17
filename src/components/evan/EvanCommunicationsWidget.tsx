import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, MessageSquare, Plus, ArrowUpRight, ArrowDownLeft, Clock, Send, Loader2, PhoneCall } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Communication {
  id: string;
  lead_id: string | null;
  communication_type: string;
  direction: string;
  content: string | null;
  phone_number: string | null;
  duration_seconds: number | null;
  status: string | null;
  created_at: string;
}

interface Lead {
  id: string;
  name: string;
  phone: string | null;
}

export const EvanCommunicationsWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSmsOpen, setIsSmsOpen] = useState(false);
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [newComm, setNewComm] = useState({
    lead_id: '',
    communication_type: 'call',
    direction: 'outbound',
    content: '',
    phone_number: '',
    duration_seconds: '',
  });
  const [smsData, setSmsData] = useState({
    to: '',
    message: '',
    leadId: '',
  });
  const [callData, setCallData] = useState({
    to: '',
    leadId: '',
  });
  const queryClient = useQueryClient();

  const { data: communications = [], isLoading } = useQuery({
    queryKey: ['evan-communications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evan_communications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Communication[];
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-for-comm'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, phone')
        .order('name');
      if (error) throw error;
      return data as Lead[];
    },
  });

  const addCommunication = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('evan_communications')
        .insert({
          lead_id: newComm.lead_id || null,
          communication_type: newComm.communication_type,
          direction: newComm.direction,
          content: newComm.content || null,
          phone_number: newComm.phone_number || null,
          duration_seconds: newComm.duration_seconds ? parseInt(newComm.duration_seconds) : null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evan-communications'] });
      setNewComm({
        lead_id: '',
        communication_type: 'call',
        direction: 'outbound',
        content: '',
        phone_number: '',
        duration_seconds: '',
      });
      setIsOpen(false);
      toast.success('Communication logged');
    },
    onError: () => toast.error('Failed to log communication'),
  });

  const sendSms = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('twilio-sms', {
        body: {
          to: smsData.to,
          message: smsData.message,
          leadId: smsData.leadId || undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['evan-communications'] });
      setSmsData({ to: '', message: '', leadId: '' });
      setIsSmsOpen(false);
      toast.success(`SMS sent successfully! Status: ${data.status}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to send SMS: ${error.message}`);
    },
  });

  const makeCall = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('twilio-call', {
        body: {
          to: callData.to,
          leadId: callData.leadId || undefined,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['evan-communications'] });
      setCallData({ to: '', leadId: '' });
      setIsCallOpen(false);
      toast.success(`Call initiated to ${data.to}! Status: ${data.status}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to initiate call: ${error.message}`);
    },
  });

  const filteredComms = communications.filter(comm => {
    if (activeTab === 'all') return true;
    return comm.communication_type === activeTab;
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="h-5 w-5 text-primary" />
            Communications
          </CardTitle>
          <div className="flex gap-2">
            {/* Make Call Dialog */}
            <Dialog open={isCallOpen} onOpenChange={setIsCallOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700">
                  <PhoneCall className="h-4 w-4 mr-1" /> Call
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Make a Call via Twilio</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Select
                    value={callData.leadId}
                    onValueChange={(value) => {
                      const lead = leads.find(l => l.id === value);
                      setCallData(prev => ({
                        ...prev,
                        leadId: value,
                        to: lead?.phone || prev.to,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Lead (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {leads.filter(l => l.phone).map(lead => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.name} ({lead.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Phone number (e.g., +15551234567)"
                    value={callData.to}
                    onChange={(e) => setCallData(prev => ({ ...prev, to: e.target.value }))}
                  />

                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    <p className="font-medium mb-1">How it works:</p>
                    <p>Twilio will call the number and connect it to your Twilio phone line. Make sure your phone is ready to receive the call.</p>
                  </div>

                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700" 
                    onClick={() => makeCall.mutate()}
                    disabled={!callData.to || makeCall.isPending}
                  >
                    {makeCall.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Initiating Call...
                      </>
                    ) : (
                      <>
                        <PhoneCall className="h-4 w-4 mr-2" />
                        Make Call
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Send SMS Dialog */}
            <Dialog open={isSmsOpen} onOpenChange={setIsSmsOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="default">
                  <Send className="h-4 w-4 mr-1" /> SMS
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send SMS via Twilio</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Select
                    value={smsData.leadId}
                    onValueChange={(value) => {
                      const lead = leads.find(l => l.id === value);
                      setSmsData(prev => ({
                        ...prev,
                        leadId: value,
                        to: lead?.phone || prev.to,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Lead (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {leads.filter(l => l.phone).map(lead => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.name} ({lead.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Phone number (e.g., +15551234567)"
                    value={smsData.to}
                    onChange={(e) => setSmsData(prev => ({ ...prev, to: e.target.value }))}
                  />

                  <Textarea
                    placeholder="Type your message..."
                    value={smsData.message}
                    onChange={(e) => setSmsData(prev => ({ ...prev, message: e.target.value }))}
                    className="min-h-[100px]"
                  />

                  <div className="text-xs text-muted-foreground">
                    {smsData.message.length}/160 characters
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={() => sendSms.mutate()}
                    disabled={!smsData.to || !smsData.message || sendSms.isPending}
                  >
                    {sendSms.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send SMS
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Log Communication Dialog */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" /> Log
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Communication</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Select
                    value={newComm.communication_type}
                    onValueChange={(value) => setNewComm(prev => ({ ...prev, communication_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="call">Phone Call</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={newComm.direction}
                    onValueChange={(value) => setNewComm(prev => ({ ...prev, direction: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbound">Inbound</SelectItem>
                      <SelectItem value="outbound">Outbound</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={newComm.lead_id}
                    onValueChange={(value) => {
                      const lead = leads.find(l => l.id === value);
                      setNewComm(prev => ({
                        ...prev,
                        lead_id: value,
                        phone_number: lead?.phone || prev.phone_number,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Lead (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {leads.map(lead => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.name} {lead.phone ? `(${lead.phone})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Phone number"
                    value={newComm.phone_number}
                    onChange={(e) => setNewComm(prev => ({ ...prev, phone_number: e.target.value }))}
                  />

                  {newComm.communication_type === 'call' && (
                    <Input
                      type="number"
                      placeholder="Duration (seconds)"
                      value={newComm.duration_seconds}
                      onChange={(e) => setNewComm(prev => ({ ...prev, duration_seconds: e.target.value }))}
                    />
                  )}

                  <Textarea
                    placeholder={newComm.communication_type === 'sms' ? 'SMS content' : 'Call notes'}
                    value={newComm.content}
                    onChange={(e) => setNewComm(prev => ({ ...prev, content: e.target.value }))}
                  />

                  <Button className="w-full" onClick={() => addCommunication.mutate()}>
                    Log Communication
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mb-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="sms">SMS</TabsTrigger>
            <TabsTrigger value="call">Calls</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="flex-1 overflow-y-auto mt-0">
            {isLoading ? (
              <div className="text-center text-muted-foreground py-4">Loading...</div>
            ) : filteredComms.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">No communications logged</div>
            ) : (
              <div className="space-y-2">
                {filteredComms.map((comm) => (
                  <div
                    key={comm.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      comm.communication_type === 'sms' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-500'
                    }`}>
                      {comm.communication_type === 'sms' ? (
                        <MessageSquare className="h-4 w-4" />
                      ) : (
                        <Phone className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {comm.direction === 'inbound' ? (
                            <><ArrowDownLeft className="h-3 w-3 mr-1" /> Inbound</>
                          ) : (
                            <><ArrowUpRight className="h-3 w-3 mr-1" /> Outbound</>
                          )}
                        </Badge>
                        {comm.phone_number && (
                          <span className="text-xs text-muted-foreground">{comm.phone_number}</span>
                        )}
                        {comm.duration_seconds && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(comm.duration_seconds)}
                          </span>
                        )}
                        {comm.status && (
                          <Badge variant="secondary" className="text-xs">
                            {comm.status}
                          </Badge>
                        )}
                      </div>
                      {comm.content && (
                        <p className="text-sm mt-1 text-muted-foreground line-clamp-2">{comm.content}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(comm.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
