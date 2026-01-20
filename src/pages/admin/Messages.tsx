import { useEffect, useState, useRef } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, Loader2, Phone, Star, PhoneIncoming, PhoneOutgoing, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { format } from 'date-fns';

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

const AdminMessages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<ConversationWithClient[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('ratings');
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

      // Fetch client emails
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

      // Subscribe to new messages
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

      // Update conversation last_message_at
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

  const getRatingColor = (rating: number) => {
    if (rating >= 8) return 'text-green-600 bg-green-100';
    if (rating >= 6) return 'text-blue-600 bg-blue-100';
    if (rating >= 4) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getRatingEmoji = (rating: number) => {
    if (rating >= 8) return '🌟';
    if (rating >= 6) return '👍';
    if (rating >= 4) return '📊';
    return '⚠️';
  };

  const unreadRatingsCount = callRatings.filter(r => !r.read_at).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground">Call ratings & client conversations</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[calc(100vh-200px)]">
          <TabsList className="mb-4">
            <TabsTrigger value="ratings" className="gap-2">
              <Phone className="h-4 w-4" />
              Call Ratings
              {unreadRatingsCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                  {unreadRatingsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="conversations" className="gap-2">
              <Send className="h-4 w-4" />
              Client Messages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ratings" className="h-full mt-0">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Evan's Call Ratings
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-380px)]">
                  {ratingsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : callRatings.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No call ratings yet.</p>
                      <p className="text-sm">Ratings will appear here when leads are created from calls.</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {callRatings.map((rating) => (
                        <div
                          key={rating.id}
                          className={`p-4 hover:bg-muted/50 transition-colors ${!rating.read_at ? 'bg-blue-50/50' : ''}`}
                          onClick={() => !rating.read_at && markRatingAsRead(rating.id)}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`flex items-center justify-center w-14 h-14 rounded-xl font-bold text-xl ${getRatingColor(rating.call_rating)}`}>
                              {rating.call_rating}/10
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">{rating.lead_name}</span>
                                {rating.call_direction === 'inbound' ? (
                                  <PhoneIncoming className="h-4 w-4 text-green-600" />
                                ) : (
                                  <PhoneOutgoing className="h-4 w-4 text-blue-600" />
                                )}
                                {!rating.read_at && (
                                  <Badge variant="secondary" className="text-xs">New</Badge>
                                )}
                                {rating.read_at && (
                                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground mb-2">
                                {rating.lead_phone} • {rating.call_date}
                              </div>
                              {rating.rating_reasoning && (
                                <p className="text-sm text-foreground/80 mb-2">
                                  {getRatingEmoji(rating.call_rating)} {rating.rating_reasoning}
                                </p>
                              )}
                              {rating.transcript_preview && (
                                <details className="text-xs">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    View transcript preview
                                  </summary>
                                  <p className="mt-2 p-3 bg-muted rounded-lg text-muted-foreground whitespace-pre-wrap">
                                    {rating.transcript_preview}
                                    {rating.transcript_preview.length >= 500 && '...'}
                                  </p>
                                </details>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(rating.created_at), 'MMM d, h:mm a')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conversations" className="h-full mt-0">
            <div className="grid grid-cols-3 gap-6 h-full">
              {/* Conversations List */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle className="text-lg">Conversations</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-380px)]">
                    {loading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : conversations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm px-4">
                        No conversations yet. Clients can start conversations from their portal.
                      </div>
                    ) : (
                      conversations.map((convo) => (
                        <button
                          key={convo.id}
                          onClick={() => setSelectedConversation(convo.id)}
                          className={`w-full text-left p-4 border-b hover:bg-muted/50 transition-colors ${
                            selectedConversation === convo.id ? 'bg-muted' : ''
                          }`}
                        >
                          <div className="font-medium truncate">{convo.client_email}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {convo.subject || 'No subject'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {convo.last_message_at ? new Date(convo.last_message_at).toLocaleDateString() : ''}
                          </div>
                        </button>
                      ))
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Messages */}
              <Card className="col-span-2 flex flex-col">
                {selectedConversation ? (
                  <>
                    <CardHeader className="border-b">
                      <CardTitle className="text-lg">{selectedConvo?.client_email}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col p-0">
                      <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                          {messages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                  message.sender_id === user?.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                }`}
                              >
                                <p>{message.content}</p>
                                <p className={`text-xs mt-1 ${
                                  message.sender_id === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                }`}>
                                  {new Date(message.created_at).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>
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
                          />
                          <Button type="submit" disabled={sending || !newMessage.trim()}>
                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </Button>
                        </form>
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    Select a conversation to view messages
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminMessages;
