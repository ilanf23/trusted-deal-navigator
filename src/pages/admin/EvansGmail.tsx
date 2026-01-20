import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Mail, 
  Send, 
  Inbox, 
  FileEdit, 
  Loader2, 
  RefreshCw,
  Star,
  Paperclip,
  Clock,
  User,
  ArrowLeft,
  Trash2,
  Reply,
  Forward
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body?: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
}

const EvansGmail = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('inbox');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Check Gmail connection status
  const { data: gmailConnection, isLoading: connectionLoading } = useQuery({
    queryKey: ['gmail-connection'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_connections')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch leads for quick email
  const { data: leads = [] } = useQuery({
    queryKey: ['evans-leads-for-email'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, phone, company_name')
        .not('email', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as Lead[];
    },
  });

  // Fetch emails from Gmail API
  const { data: emails = [], isLoading: emailsLoading, refetch: refetchEmails } = useQuery({
    queryKey: ['gmail-emails', activeTab],
    queryFn: async () => {
      if (!gmailConnection) return [];
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      
      const query = activeTab === 'sent' ? 'in:sent' : 'in:inbox';
      
      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=list&q=${encodeURIComponent(query)}&maxResults=50`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch emails');
      }
      
      // Transform messages to Email format
      return (data?.messages || []).map((msg: any) => ({
        id: msg.id,
        threadId: msg.threadId,
        subject: msg.subject || '(No Subject)',
        from: msg.from || '',
        to: msg.to || '',
        date: msg.date || new Date().toISOString(),
        snippet: msg.snippet || '',
        body: msg.body || '',
        isRead: !msg.isUnread,
        isStarred: msg.labelIds?.includes('STARRED') || false,
        labels: msg.labelIds || [],
      })) as Email[];
    },
    enabled: !!gmailConnection,
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async ({ to, subject, body }: { to: string; subject: string; body: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ to, subject, body }),
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }
      
      return data;
      return data;
    },
    onSuccess: () => {
      toast.success('Email sent successfully!');
      setComposeOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setSelectedLead(null);
      queryClient.invalidateQueries({ queryKey: ['gmail-emails'] });
    },
    onError: (error: any) => {
      toast.error('Failed to send email: ' + error.message);
    },
  });

  const handleSendEmail = async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setSending(true);
    try {
      await sendEmailMutation.mutateAsync({
        to: composeTo.trim(),
        subject: composeSubject.trim(),
        body: composeBody.trim(),
      });
    } finally {
      setSending(false);
    }
  };

  const handleEmailToLead = (lead: Lead) => {
    setSelectedLead(lead);
    setComposeTo(lead.email || '');
    setComposeSubject(`Following up - ${lead.company_name || lead.name}`);
    setComposeBody(`Hi ${lead.name.split(' ')[0]},\n\nI hope this email finds you well.\n\n`);
    setComposeOpen(true);
  };

  const handleConnectGmail = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in first');
        return;
      }

      const redirectUri = `${window.location.origin}/admin/inbox/callback`;
      
      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=get-oauth-url`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ redirect_uri: redirectUri }),
        }
      );
      
      const data = await response.json();
      
      if (data?.url) {
        // Store the return path in localStorage
        localStorage.setItem('gmail_return_path', '/user/evan/gmail');
        window.location.href = data.url;
      } else {
        toast.error('Failed to get OAuth URL');
      }
    } catch (error: any) {
      toast.error('Failed to start Gmail connection: ' + error.message);
    }
  };

  if (connectionLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-admin-blue" />
        </div>
      </AdminLayout>
    );
  }

  // Show connection prompt if not connected
  if (!gmailConnection) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Gmail</h1>
            <p className="text-muted-foreground">Send and receive emails directly from Evan's portal</p>
          </div>

          <Card className="max-w-lg mx-auto mt-12">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle>Connect Your Gmail</CardTitle>
              <CardDescription>
                Connect your Gmail account to send and receive emails directly from this portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={handleConnectGmail} size="lg" className="gap-2">
                <Mail className="w-5 h-5" />
                Connect Gmail Account
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                We'll only access your email with your permission.
              </p>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gmail</h1>
            <p className="text-muted-foreground">
              Connected as {gmailConnection.email}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchEmails()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => setComposeOpen(true)}>
              <FileEdit className="w-4 h-4 mr-2" />
              Compose
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left sidebar - Quick actions & Leads */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Quick Email</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[300px]">
                  <div className="p-3 space-y-1">
                    {leads.slice(0, 15).map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => handleEmailToLead(lead)}
                        className="w-full text-left p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-admin-blue/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-admin-blue" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{lead.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Main email area */}
          <Card className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="pb-0">
                <TabsList>
                  <TabsTrigger value="inbox" className="gap-2">
                    <Inbox className="w-4 h-4" />
                    Inbox
                  </TabsTrigger>
                  <TabsTrigger value="sent" className="gap-2">
                    <Send className="w-4 h-4" />
                    Sent
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              
              <CardContent className="p-0">
                <TabsContent value="inbox" className="m-0">
                  {selectedEmail ? (
                    <div className="p-4">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setSelectedEmail(null)}
                        className="mb-4"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Inbox
                      </Button>
                      <div className="space-y-4">
                        <div className="border-b pb-4">
                          <h2 className="text-xl font-semibold">{selectedEmail.subject}</h2>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>From: {selectedEmail.from}</span>
                            <span>•</span>
                            <span>{format(new Date(selectedEmail.date), 'MMM d, yyyy h:mm a')}</span>
                          </div>
                        </div>
                        <div className="prose prose-sm max-w-none">
                          <div dangerouslySetInnerHTML={{ __html: selectedEmail.body || selectedEmail.snippet }} />
                        </div>
                        <div className="flex gap-2 pt-4 border-t">
                          <Button size="sm" variant="outline">
                            <Reply className="w-4 h-4 mr-2" />
                            Reply
                          </Button>
                          <Button size="sm" variant="outline">
                            <Forward className="w-4 h-4 mr-2" />
                            Forward
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px]">
                      {emailsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : emails.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
                          <p>No emails in your inbox</p>
                        </div>
                      ) : (
                        <div className="divide-y">
                          {emails.map((email) => (
                            <button
                              key={email.id}
                              onClick={() => setSelectedEmail(email)}
                              className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                                !email.isRead ? 'bg-blue-50/50' : ''
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {email.isStarred && (
                                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 mt-1" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={`font-medium truncate ${!email.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                                      {email.from}
                                    </span>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {format(new Date(email.date), 'MMM d')}
                                    </span>
                                  </div>
                                  <p className={`text-sm truncate ${!email.isRead ? 'font-medium' : ''}`}>
                                    {email.subject}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate mt-1">
                                    {email.snippet}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  )}
                </TabsContent>
                
                <TabsContent value="sent" className="m-0">
                  <ScrollArea className="h-[500px]">
                    {emailsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : emails.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Send className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No sent emails</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {emails.map((email) => (
                          <button
                            key={email.id}
                            onClick={() => setSelectedEmail(email)}
                            className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium truncate">
                                    To: {email.to}
                                  </span>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {format(new Date(email.date), 'MMM d')}
                                  </span>
                                </div>
                                <p className="text-sm truncate">{email.subject}</p>
                                <p className="text-xs text-muted-foreground truncate mt-1">
                                  {email.snippet}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        {/* Compose Dialog */}
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                {selectedLead ? `Email to ${selectedLead.name}` : 'New Email'}
              </DialogTitle>
              <DialogDescription>
                Compose and send an email
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="to">To</Label>
                <Input
                  id="to"
                  type="email"
                  placeholder="recipient@example.com"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Email subject"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="body">Message</Label>
                <Textarea
                  id="body"
                  placeholder="Write your message..."
                  className="min-h-[200px]"
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setComposeOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendEmail} disabled={sending}>
                {sending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Email
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default EvansGmail;
