import { useEffect, useState, useRef } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  MessageSquare,
  Send,
  User,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { format, isToday, isYesterday } from 'date-fns';

type Message = Database['public']['Tables']['messages']['Row'];
type Conversation = Database['public']['Tables']['conversations']['Row'];

interface ConversationWithClient extends Conversation {
  client_email?: string;
}

const formatMessageDate = (dateString: string) => {
  const date = new Date(dateString);
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  if (isYesterday(date)) {
    return 'Yesterday at ' + format(date, 'h:mm a');
  }
  return format(date, 'MMM d, yyyy') + ' at ' + format(date, 'h:mm a');
};

const AdminMessages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<ConversationWithClient[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Messages');
    return () => { setPageTitle(null); };
  }, []);

  const fetchConversations = async () => {
    try {
      const { data: convos, error } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false });
      
      if (error) throw error;

      const clientIds = convos?.map(c => c.client_id) || [];
      const { data: profiles } = await supabase
        .from('users')
        .select('user_id, email')
        .in('user_id', clientIds);

      const convosWithEmail = convos?.map(c => ({
        ...c,
        client_email: profiles?.find(p => p.user_id === c.client_id)?.email || 'Unknown',
      })) || [];

      setConversations(convosWithEmail);
      if (convosWithEmail.length > 0 && !selectedConversation) {
        setSelectedConversation(convosWithEmail[0].id);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);

      const channel = supabase
        .channel(`messages:${selectedConversation}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as Message]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation,
        sender_id: user.id,
        content: newMessage.trim(),
      });

      if (error) throw error;

      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedConversation);

      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const selectedConvo = conversations.find(c => c.id === selectedConversation);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
              {/* Conversations List */}
              <Card className="lg:col-span-1 border">
                <CardHeader className="py-3 px-4 border-b bg-muted/30">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    Conversations
                    <Badge variant="secondary" className="font-normal">{conversations.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[520px]">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : conversations.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">No conversations</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {conversations.map((convo) => (
                          <button
                            key={convo.id}
                            onClick={() => setSelectedConversation(convo.id)}
                            className={`w-full p-3 text-left transition-colors ${
                              selectedConversation === convo.id 
                                ? 'bg-muted border-l-2 border-l-primary' 
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                  {convo.client_email?.charAt(0).toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {convo.client_email || 'Unknown'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {convo.subject || 'No subject'}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Messages Panel */}
              <Card className="lg:col-span-2 flex flex-col border">
                <CardHeader className="py-3 px-4 border-b bg-muted/30">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    {selectedConvo?.client_email || 'Select a conversation'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0">
                  <ScrollArea className="flex-1 p-4">
                    {!selectedConversation ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p className="text-sm">Select a conversation to view messages</p>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p className="text-sm">No messages yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[75%] rounded-lg px-3 py-2 ${
                                msg.sender_id === user?.id
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              <p className="text-sm">{msg.content}</p>
                              <p className={`text-[10px] mt-1 flex items-center gap-1 ${
                                msg.sender_id === user?.id 
                                  ? 'text-primary-foreground/70' 
                                  : 'text-muted-foreground'
                              }`}>
                                {formatMessageDate(msg.created_at)}
                                {msg.sender_id === user?.id && (
                                  <CheckCircle2 className="w-3 h-3 ml-1" />
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  {/* Message Input */}
                  {selectedConversation && (
                    <div className="p-3 border-t">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendMessage();
                        }}
                        className="flex gap-2"
                      >
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type a message..."
                          disabled={sending}
                          className="flex-1"
                        />
                        <Button type="submit" size="sm" disabled={sending || !newMessage.trim()}>
                          {sending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      </form>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminMessages;
