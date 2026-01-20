import { useEffect, useState, useRef } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing,
  MessageSquare,
  Send,
  User
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { format, isToday, isYesterday } from 'date-fns';

type Message = Database['public']['Tables']['messages']['Row'];
type Conversation = Database['public']['Tables']['conversations']['Row'];

interface CallRatingNotification {
  id: string;
  lead_id: string | null;
  communication_id: string | null;
  lead_name: string;
  lead_phone: string | null;
  lead_email: string | null;
  call_date: string;
  call_direction: string;
  call_rating: number;
  rating_reasoning: string | null;
  transcript_preview: string | null;
  created_at: string;
  read_at: string | null;
}

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
  const [callRatings, setCallRatings] = useState<CallRatingNotification[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchCallRatings = async () => {
    try {
      const { data, error } = await supabase
        .from('call_rating_notifications')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCallRatings((data || []) as CallRatingNotification[]);
    } catch (error) {
      console.error('Error fetching call ratings:', error);
    } finally {
      setRatingsLoading(false);
    }
  };

  const markRatingAsRead = async (id: string) => {
    await supabase
      .from('call_rating_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    
    setCallRatings(prev => prev.map(r => 
      r.id === id ? { ...r, read_at: new Date().toISOString() } : r
    ));
  };

  const fetchConversations = async () => {
    try {
      const { data: convos, error } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false });
      
      if (error) throw error;

      const clientIds = convos?.map(c => c.client_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
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
    fetchCallRatings();
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

  const unreadRatingsCount = callRatings.filter(r => !r.read_at).length;

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (rating >= 6) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (rating >= 4) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const selectedConvo = conversations.find(c => c.id === selectedConversation);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Messages</h1>
          <p className="text-muted-foreground mt-1">Communication center for calls and client messages</p>
        </div>

        <Tabs defaultValue="call-ratings" className="w-full">
          <TabsList>
            <TabsTrigger value="call-ratings" className="gap-2">
              <Phone className="w-4 h-4" />
              Call Ratings
              {unreadRatingsCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                  {unreadRatingsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="client-messages" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Client Messages
            </TabsTrigger>
          </TabsList>

          {/* Call Ratings Tab */}
          <TabsContent value="call-ratings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  Call Rating Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                {ratingsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : callRatings.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No call ratings yet</p>
                    <p className="text-sm">Ratings will appear here when leads are created from calls.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {callRatings.map((rating) => (
                      <div
                        key={rating.id}
                        onClick={() => !rating.read_at && markRatingAsRead(rating.id)}
                        className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                          !rating.read_at 
                            ? 'bg-primary/5 border-primary/20' 
                            : 'bg-card hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Rating Badge */}
                          <div className={`flex-shrink-0 w-12 h-12 rounded-lg border-2 flex items-center justify-center font-bold text-lg ${getRatingColor(rating.call_rating)}`}>
                            {rating.call_rating}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">{rating.lead_name}</span>
                              <Badge variant="outline" className="text-xs gap-1">
                                {rating.call_direction === 'inbound' ? (
                                  <>
                                    <PhoneIncoming className="w-3 h-3" />
                                    Inbound
                                  </>
                                ) : (
                                  <>
                                    <PhoneOutgoing className="w-3 h-3" />
                                    Outbound
                                  </>
                                )}
                              </Badge>
                              {!rating.read_at && (
                                <Badge variant="default" className="text-xs">New</Badge>
                              )}
                            </div>
                            
                            {rating.rating_reasoning && (
                              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                {rating.rating_reasoning}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {rating.lead_phone && <span>{rating.lead_phone}</span>}
                              <span>{formatMessageDate(rating.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Client Messages Tab */}
          <TabsContent value="client-messages" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
              {/* Conversations List */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Conversations</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {loading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : conversations.length === 0 ? (
                      <div className="text-center py-8 px-4 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No conversations yet</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {conversations.map((convo) => (
                          <button
                            key={convo.id}
                            onClick={() => setSelectedConversation(convo.id)}
                            className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                              selectedConversation === convo.id ? 'bg-muted' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="w-9 h-9">
                                <AvatarFallback className="bg-primary/10 text-primary text-sm">
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
              <Card className="lg:col-span-2 flex flex-col">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4" />
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
                      <div className="space-y-4">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                msg.sender_id === user?.id
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              <p className="text-sm">{msg.content}</p>
                              <p className={`text-xs mt-1 ${
                                msg.sender_id === user?.id 
                                  ? 'text-primary-foreground/70' 
                                  : 'text-muted-foreground'
                              }`}>
                                {formatMessageDate(msg.created_at)}
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
                    <div className="p-4 border-t">
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
                        <Button type="submit" disabled={sending || !newMessage.trim()}>
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
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminMessages;
