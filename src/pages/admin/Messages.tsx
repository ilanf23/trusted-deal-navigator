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
  User,
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Star,
  Zap,
  MessageCircle,
  Bell,
  ArrowUpRight,
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

  const getRatingStyle = (rating: number) => {
    if (rating >= 8) return {
      bg: 'bg-gradient-to-br from-emerald-50 to-green-100',
      border: 'border-emerald-300',
      text: 'text-emerald-700',
      icon: <Star className="w-4 h-4 text-emerald-500" />,
      label: 'Excellent'
    };
    if (rating >= 6) return {
      bg: 'bg-gradient-to-br from-blue-50 to-indigo-100',
      border: 'border-blue-300',
      text: 'text-blue-700',
      icon: <TrendingUp className="w-4 h-4 text-blue-500" />,
      label: 'Good'
    };
    if (rating >= 4) return {
      bg: 'bg-gradient-to-br from-amber-50 to-orange-100',
      border: 'border-amber-300',
      text: 'text-amber-700',
      icon: <AlertCircle className="w-4 h-4 text-amber-500" />,
      label: 'Fair'
    };
    return {
      bg: 'bg-gradient-to-br from-red-50 to-rose-100',
      border: 'border-red-300',
      text: 'text-red-700',
      icon: <AlertCircle className="w-4 h-4 text-red-500" />,
      label: 'Needs Work'
    };
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
        {/* Header with gradient accent */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-blue-500/10 to-indigo-500/10 p-6 border border-primary/20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Messages
              </h1>
            </div>
            <p className="text-muted-foreground italic">
              Your central hub for <span className="text-primary font-medium">call analytics</span> and <span className="text-blue-600 font-medium">client communications</span>
            </p>
          </div>
        </div>

        <Tabs defaultValue="call-ratings" className="w-full">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="call-ratings" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-blue-600 data-[state=active]:text-white">
              <Zap className="w-4 h-4" />
              Call Ratings
              {unreadRatingsCount > 0 && (
                <Badge className="ml-1 h-5 px-1.5 text-xs bg-white text-primary">
                  {unreadRatingsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="client-messages" className="gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white">
              <MessageCircle className="w-4 h-4" />
              Client Messages
            </TabsTrigger>
          </TabsList>

          {/* Call Ratings Tab */}
          <TabsContent value="call-ratings" className="mt-6 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-emerald-600 italic">Excellent Calls</p>
                      <p className="text-3xl font-bold text-emerald-700">{excellentCalls}</p>
                    </div>
                    <div className="p-3 rounded-full bg-emerald-100">
                      <Star className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600 italic">Average Rating</p>
                      <p className="text-3xl font-bold text-blue-700">{avgRating}<span className="text-lg text-blue-400">/10</span></p>
                    </div>
                    <div className="p-3 rounded-full bg-blue-100">
                      <TrendingUp className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600 italic">Total Calls</p>
                      <p className="text-3xl font-bold text-orange-700">{callRatings.length}</p>
                    </div>
                    <div className="p-3 rounded-full bg-orange-100">
                      <Phone className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-lg border-b">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Bell className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <span className="text-lg">Call Rating Notifications</span>
                    <p className="text-sm font-normal text-muted-foreground italic mt-0.5">
                      AI-powered insights from your recent calls
                    </p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {ratingsLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                    <p className="text-muted-foreground italic">Loading your call analytics...</p>
                  </div>
                ) : callRatings.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/10 to-blue-500/10 flex items-center justify-center">
                      <Phone className="h-10 w-10 text-primary/50" />
                    </div>
                    <p className="font-semibold text-lg mb-2">No call ratings yet</p>
                    <p className="text-muted-foreground italic max-w-md mx-auto">
                      When you make or receive calls, AI will automatically analyze them and provide ratings here.
                    </p>
                    <ul className="mt-4 text-sm text-muted-foreground space-y-2">
                      <li className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Automatic call transcription</span>
                      </li>
                      <li className="flex items-center justify-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span>AI-powered performance scoring</span>
                      </li>
                      <li className="flex items-center justify-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        <span>Actionable improvement suggestions</span>
                      </li>
                    </ul>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {callRatings.map((rating) => {
                      const style = getRatingStyle(rating.call_rating);
                      return (
                        <div
                          key={rating.id}
                          onClick={() => !rating.read_at && markRatingAsRead(rating.id)}
                          className={`group p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer hover:shadow-md hover:-translate-y-0.5 ${style.bg} ${style.border} ${
                            !rating.read_at ? 'ring-2 ring-primary/30 ring-offset-2' : ''
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            {/* Rating Badge */}
                            <div className={`flex-shrink-0 w-16 h-16 rounded-xl border-2 ${style.border} bg-white/80 flex flex-col items-center justify-center shadow-sm`}>
                              <span className={`font-bold text-2xl ${style.text}`}>{rating.call_rating}</span>
                              <span className={`text-[10px] font-medium ${style.text} opacity-70`}>{style.label}</span>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="font-bold text-lg">{rating.lead_name}</span>
                                <Badge variant="outline" className={`text-xs gap-1 ${style.text} border-current`}>
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
                                  <Badge className="text-xs bg-primary text-white animate-pulse">
                                    <Sparkles className="w-3 h-3 mr-1" />
                                    New
                                  </Badge>
                                )}
                              </div>
                              
                              {rating.rating_reasoning && (
                                <div className="mb-3">
                                  <p className="text-sm text-muted-foreground italic leading-relaxed">
                                    "{rating.rating_reasoning}"
                                  </p>
                                </div>
                              )}

                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {rating.lead_phone || 'No phone'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatMessageDate(rating.created_at)}
                                </span>
                                <span className="flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ArrowUpRight className="w-3 h-3" />
                                  View details
                                </span>
                              </div>
                            </div>

                            {/* Icon indicator */}
                            <div className="flex-shrink-0">
                              {style.icon}
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[650px]">
              {/* Conversations List */}
              <Card className="lg:col-span-1 border-0 shadow-lg overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-blue-600" />
                    <span>Conversations</span>
                    <Badge variant="secondary" className="ml-auto">{conversations.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[550px]">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
                        <p className="text-sm text-muted-foreground italic">Loading conversations...</p>
                      </div>
                    ) : conversations.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                          <MessageSquare className="h-8 w-8 text-blue-400" />
                        </div>
                        <p className="font-medium mb-1">No conversations yet</p>
                        <p className="text-sm text-muted-foreground italic">
                          Client messages will appear here
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {conversations.map((convo, index) => (
                          <button
                            key={convo.id}
                            onClick={() => setSelectedConversation(convo.id)}
                            className={`w-full p-4 text-left transition-all duration-200 ${
                              selectedConversation === convo.id 
                                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500' 
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className={`w-10 h-10 ring-2 ${
                                selectedConversation === convo.id ? 'ring-blue-300' : 'ring-slate-200'
                              }`}>
                                <AvatarFallback className={`text-sm font-medium ${
                                  selectedConversation === convo.id 
                                    ? 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white' 
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {convo.client_email?.charAt(0).toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {convo.client_email || 'Unknown'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate italic">
                                  {convo.subject || 'No subject'}
                                </p>
                              </div>
                              {index === 0 && (
                                <Badge className="bg-green-100 text-green-700 text-[10px]">Latest</Badge>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Messages Panel */}
              <Card className="lg:col-span-2 flex flex-col border-0 shadow-lg overflow-hidden">
                <CardHeader className="pb-3 border-b bg-gradient-to-r from-slate-50 to-slate-100">
                  <CardTitle className="text-base flex items-center gap-3">
                    <Avatar className="w-8 h-8 ring-2 ring-blue-200">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-sm">
                        {selectedConvo?.client_email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span>{selectedConvo?.client_email || 'Select a conversation'}</span>
                      {selectedConvo && (
                        <p className="text-xs font-normal text-muted-foreground italic">
                          {selectedConvo.subject || 'Direct message'}
                        </p>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0 bg-gradient-to-b from-slate-50/50 to-white">
                  <ScrollArea className="flex-1 p-4">
                    {!selectedConversation ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
                          <MessageCircle className="w-10 h-10 text-blue-400" />
                        </div>
                        <p className="font-medium mb-1">Select a conversation</p>
                        <p className="text-sm italic">Choose from the list to view messages</p>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-4">
                          <Send className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="font-medium mb-1">No messages yet</p>
                        <p className="text-sm italic">Start the conversation below</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                                msg.sender_id === user?.id
                                  ? 'bg-gradient-to-r from-primary to-blue-600 text-white rounded-br-md'
                                  : 'bg-white border border-slate-200 rounded-bl-md'
                              }`}
                            >
                              <p className="text-sm leading-relaxed">{msg.content}</p>
                              <p className={`text-[10px] mt-1.5 flex items-center gap-1 ${
                                msg.sender_id === user?.id 
                                  ? 'text-white/70' 
                                  : 'text-muted-foreground'
                              }`}>
                                <Clock className="w-3 h-3" />
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
                    <div className="p-4 border-t bg-white">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendMessage();
                        }}
                        className="flex gap-3"
                      >
                        <Input
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Type your message..."
                          disabled={sending}
                          className="flex-1 rounded-full border-2 focus:border-primary px-4"
                        />
                        <Button 
                          type="submit" 
                          disabled={sending || !newMessage.trim()}
                          className="rounded-full w-12 h-10 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
                        >
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
