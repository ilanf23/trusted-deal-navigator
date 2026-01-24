import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mail, Inbox, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  isRead: boolean;
  senderPhoto?: string | null;
}

const extractSenderName = (from: string) => {
  const match = from.match(/^([^<]+)/);
  if (match) return match[1].trim().replace(/"/g, '');
  return from.split('@')[0];
};

const EvansGmail = () => {
  const { user } = useAuth();
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  // Check Gmail connection
  const { data: gmailConnection, isLoading: connectionLoading } = useQuery({
    queryKey: ['evan-gmail-connection'],
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

  // Fetch emails
  const { data: emails = [], isLoading: emailsLoading } = useQuery({
    queryKey: ['evan-gmail-emails'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const response = await fetch(
        `https://pcwiwtajzqnayfwvqsbh.supabase.co/functions/v1/gmail-api?action=list&q=in:inbox&maxResults=50&fetchPhotos=true`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch emails');

      return (data?.messages || []).map((msg: any) => ({
        id: msg.id,
        threadId: msg.threadId,
        subject: msg.subject || '(No Subject)',
        from: msg.from || '',
        date: msg.date || new Date().toISOString(),
        snippet: msg.snippet || '',
        isRead: !msg.isUnread,
        senderPhoto: msg.senderPhoto || null,
      })) as Email[];
    },
    enabled: !!gmailConnection,
  });

  // Connect Gmail
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
        localStorage.setItem('gmail_return_path', '/team/evan/gmail');
        window.location.href = data.url;
      } else {
        toast.error('Failed to get OAuth URL');
      }
    } catch (error: any) {
      toast.error('Failed to connect: ' + error.message);
    }
  };

  // Loading
  if (connectionLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[calc(100vh-100px)]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  // Not connected
  if (!gmailConnection) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[calc(100vh-100px)]">
          <div className="text-center">
            <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Connect Gmail</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Gmail account to view emails
            </p>
            <Button onClick={handleConnectGmail}>
              Connect Gmail
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const selectedEmail = emails.find(e => e.id === selectedEmailId);

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-100px)] border rounded-lg overflow-hidden bg-background">
        {/* Sidebar */}
        <div className="w-48 border-r bg-muted/30 p-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 text-primary text-sm font-medium">
            <Inbox className="w-4 h-4" />
            Inbox
          </div>
        </div>

        {/* Email List / Email View */}
        <div className="flex-1 overflow-hidden">
          {selectedEmailId ? (
            // Full Email View
            <div className="h-full flex flex-col">
              <div className="p-3 border-b flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedEmailId(null)}>
                  ← Back
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-6">
                  <h1 className="text-xl font-semibold mb-4">{selectedEmail?.subject}</h1>
                  <div className="flex items-center gap-3 mb-6">
                    <Avatar className="w-10 h-10">
                      {selectedEmail?.senderPhoto && <AvatarImage src={selectedEmail.senderPhoto} />}
                      <AvatarFallback>
                        {selectedEmail ? extractSenderName(selectedEmail.from).charAt(0).toUpperCase() : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{selectedEmail ? extractSenderName(selectedEmail.from) : ''}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedEmail ? format(new Date(selectedEmail.date), 'MMM d, yyyy, h:mm a') : ''}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{selectedEmail?.snippet}</p>
                </div>
              </ScrollArea>
            </div>
          ) : (
            // Email List View
            <div className="h-full flex flex-col">
              <div className="p-3 border-b">
                <h2 className="font-semibold text-sm">Inbox</h2>
              </div>
              <ScrollArea className="flex-1">
                {emailsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : emails.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No emails
                  </div>
                ) : (
                  <div>
                    {emails.map((email) => (
                      <div
                        key={email.id}
                        onClick={() => setSelectedEmailId(email.id)}
                        className={`p-3 border-b cursor-pointer hover:bg-muted/50 ${
                          !email.isRead ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Avatar className="w-6 h-6">
                            {email.senderPhoto && <AvatarImage src={email.senderPhoto} />}
                            <AvatarFallback className="text-xs">
                              {extractSenderName(email.from).charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className={`text-sm truncate flex-1 ${!email.isRead ? 'font-semibold' : ''}`}>
                            {extractSenderName(email.from)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(email.date), 'MMM d')}
                          </span>
                        </div>
                        <p className={`text-sm truncate ${!email.isRead ? 'font-medium' : ''}`}>
                          {email.subject}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {email.snippet}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default EvansGmail;
