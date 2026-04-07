import { useEffect, useState, useRef } from 'react';
import { useAdminTopBar } from '@/contexts/AdminTopBarContext';
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
  User,
  Clock,
  CheckCircle2,
  TrendingUp,
  BarChart3,
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
  lead?: { name: string; phone: string | null; email: string | null } | null;
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

  const { setPageTitle } = useAdminTopBar();
  useEffect(() => {
    setPageTitle('Messages');
    return () => { setPageTitle(null); };
  }, []);

  const fetchCallRatings = async () => {
    try {
      const { data, error } = await supabase
        .from('call_rating_notifications')
        .select('*, lead:pipeline(name, phone, email)')
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

  const getRatingStyle = (rating: number) => {
    if (rating >= 8) return { border: 'border-l-green-600', bg: 'bg-card', text: 'text-green-600' };
    if (rating >= 6) return { border: 'border-l-blue-600', bg: 'bg-card', text: 'text-blue-600' };
    if (rating >= 4) return { border: 'border-l-amber-600', bg: 'bg-card', text: 'text-amber-600' };
    return { border: 'border-l-red-600', bg: 'bg-card', text: 'text-red-600' };
  };

  const selectedConvo = conversations.find(c => c.id === selectedConversation);

  // Stats for call ratings
  const excellentCalls = callRatings.filter(r => r.call_rating >= 8).length;
  const avgRating = callRatings.length > 0 
    ? (callRatings.reduce((sum, r) => sum + r.call_rating, 0) / callRatings.length).toFixed(1)
    : '0';

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Tabs defaultValue="client-messages" className="w-full">
          <TabsList className="bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
            <TabsTrigger value="client-messages" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
              <MessageSquare className="w-4 h-4" />
              Client Messages
            </TabsTrigger>
            <TabsTrigger value="call-ratings" className="gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
              <Phone className="w-4 h-4" />
              Call Ratings
              {unreadRatingsCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-primary/10 text-primary">
                  {unreadRatingsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Call Ratings Tab */}
          <TabsContent value="call-ratings" className="mt-6 space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Excellent Calls</p>
                      <p className="text-2xl font-semibold mt-1">{excellentCalls}</p>
                    </div>
                    <div className="p-2 rounded-md bg-green-50 dark:bg-green-950">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Average Rating</p>
                      <p className="text-2xl font-semibold mt-1">{avgRating}<span className="text-sm text-muted-foreground">/10</span></p>
                    </div>
                    <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Calls</p>
                      <p className="text-2xl font-semibold mt-1">{callRatings.length}</p>
                    </div>
                    <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800">
                      <Phone className="w-5 h-5 text-slate-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border">
              <CardHeader className="border-b bg-muted/30">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  Call Rating History
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {ratingsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : callRatings.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <Phone className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="font-medium text-sm">No call ratings</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ratings will appear here when calls are analyzed.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {callRatings.map((rating) => {
                      const style = getRatingStyle(rating.call_rating);
                      return (
                        <div
                          key={rating.id}
                          onClick={() => !rating.read_at && markRatingAsRead(rating.id)}
                          className={`p-4 border-l-4 ${style.border} hover:bg-muted/30 transition-colors cursor-pointer ${
                            !rating.read_at ? 'bg-primary/5' : ''
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            {/* Rating Score */}
                            <div className={`flex-shrink-0 w-12 h-12 rounded border flex items-center justify-center font-semibold text-lg ${style.text} bg-background`}>
                              {rating.call_rating}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{rating.lead?.name || 'Unknown'}</span>
                                <Badge variant="outline" className="text-xs gap-1 font-normal">
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
                                {rating.lead?.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {rating.lead?.phone}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatMessageDate(rating.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Client Messages Tab */}
          <TabsContent value="client-messages" className="mt-6">
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
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminMessages;
