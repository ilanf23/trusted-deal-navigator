import { useEffect, useState, useRef } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RichTextInput } from '@/components/ui/rich-text-input';
import { 
  Hash, 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Loader2, 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing,
  MessageSquare,
  Users,
  Settings,
  Headphones,
  FileText,
  Lock
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

// Mock team members for DMs
const TEAM_MEMBERS = [
  { id: '1', name: 'Brad Hettich', status: 'online', initials: 'BH', color: 'bg-blue-500' },
  { id: '2', name: 'Wendy Stanwick', status: 'online', initials: 'WS', color: 'bg-green-500' },
  { id: '3', name: 'Adam', status: 'online', initials: 'A', color: 'bg-purple-500' },
  { id: '4', name: 'Maura Cannon', status: 'away', initials: 'MC', color: 'bg-pink-500' },
  { id: '5', name: 'Evan Hettich', status: 'online', initials: 'EH', color: 'bg-orange-500' },
  { id: '6', name: 'Ilan', status: 'online', initials: 'I', color: 'bg-cyan-500' },
];

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

const formatDayDivider = (dateString: string) => {
  const date = new Date(dateString);
  if (isToday(date)) {
    return 'Today';
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  return format(date, 'EEEE, MMMM d');
};

const AdminMessages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<ConversationWithClient[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<'call-ratings' | 'general' | string>('call-ratings');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [callRatings, setCallRatings] = useState<CallRatingNotification[]>([]);
  const [ratingsLoading, setRatingsLoading] = useState(true);
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchCallRatings = async () => {
    try {
      const { data, error } = await supabase
        .from('call_rating_notifications')
        .select('*')
        .order('created_at', { ascending: true });
      
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
    if (selectedChannel && selectedChannel !== 'call-ratings' && selectedChannel !== 'general') {
      fetchMessages(selectedChannel);

      const channel = supabase
        .channel(`messages:${selectedChannel}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedChannel}`,
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
  }, [selectedChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, callRatings]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel || selectedChannel === 'call-ratings' || !user) return;

    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedChannel,
        sender_id: user.id,
        content: newMessage.trim(),
      });

      if (error) throw error;

      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedChannel);

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
    if (rating >= 8) return 'bg-green-500';
    if (rating >= 6) return 'bg-blue-500';
    if (rating >= 4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Group call ratings by date for day dividers
  const groupedRatings = callRatings.reduce((acc, rating) => {
    const dateKey = format(new Date(rating.created_at), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(rating);
    return acc;
  }, {} as Record<string, CallRatingNotification[]>);

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-80px)] -m-6 overflow-hidden">
        {/* Slack-style Sidebar */}
        <div className="w-64 bg-[#3F0E40] text-white flex flex-col">
          {/* Workspace Header */}
          <div className="p-4 border-b border-white/10">
            <button className="flex items-center gap-2 hover:bg-white/10 rounded-lg px-2 py-1 -ml-2 transition-colors w-full">
              <span className="font-bold text-lg">CommercialLendingX</span>
              <ChevronDown className="w-4 h-4 opacity-60" />
            </button>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {/* Quick Links */}
              <button className="flex items-center gap-3 w-full px-3 py-1.5 rounded-md text-[#CFBCCF] hover:bg-white/10 transition-colors text-sm">
                <MessageSquare className="w-4 h-4" />
                <span>Threads</span>
              </button>
              <button className="flex items-center gap-3 w-full px-3 py-1.5 rounded-md text-[#CFBCCF] hover:bg-white/10 transition-colors text-sm">
                <Headphones className="w-4 h-4" />
                <span>Huddles</span>
              </button>
              <button className="flex items-center gap-3 w-full px-3 py-1.5 rounded-md text-[#CFBCCF] hover:bg-white/10 transition-colors text-sm">
                <FileText className="w-4 h-4" />
                <span>Drafts</span>
              </button>

              {/* Channels Section */}
              <div className="pt-4">
                <button 
                  onClick={() => setChannelsOpen(!channelsOpen)}
                  className="flex items-center gap-1 w-full px-2 py-1 text-[#CFBCCF] hover:text-white transition-colors text-sm"
                >
                  {channelsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span className="font-medium">Channels</span>
                </button>
                
                {channelsOpen && (
                  <div className="mt-1 space-y-0.5">
                    <button
                      onClick={() => setSelectedChannel('call-ratings')}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm transition-colors ${
                        selectedChannel === 'call-ratings' 
                          ? 'bg-[#1164A3] text-white' 
                          : 'text-[#CFBCCF] hover:bg-white/10'
                      }`}
                    >
                      <Hash className="w-4 h-4" />
                      <span>call-ratings</span>
                      {unreadRatingsCount > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                          {unreadRatingsCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setSelectedChannel('general')}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm transition-colors ${
                        selectedChannel === 'general' 
                          ? 'bg-[#1164A3] text-white' 
                          : 'text-[#CFBCCF] hover:bg-white/10'
                      }`}
                    >
                      <Hash className="w-4 h-4" />
                      <span>general</span>
                    </button>
                    <button
                      className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm text-[#CFBCCF] hover:bg-white/10 transition-colors"
                    >
                      <Lock className="w-4 h-4" />
                      <span>team</span>
                    </button>
                    <button className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm text-[#CFBCCF] hover:bg-white/10 transition-colors">
                      <Plus className="w-4 h-4" />
                      <span>Add channels</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Direct Messages Section */}
              <div className="pt-4">
                <button 
                  onClick={() => setDmsOpen(!dmsOpen)}
                  className="flex items-center gap-1 w-full px-2 py-1 text-[#CFBCCF] hover:text-white transition-colors text-sm"
                >
                  {dmsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  <span className="font-medium">Direct messages</span>
                </button>
                
                {dmsOpen && (
                  <div className="mt-1 space-y-0.5">
                    {TEAM_MEMBERS.map((member) => (
                      <button
                        key={member.id}
                        className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm text-[#CFBCCF] hover:bg-white/10 transition-colors"
                      >
                        <div className="relative">
                          <Avatar className="w-5 h-5">
                            <AvatarFallback className={`${member.color} text-white text-[10px]`}>
                              {member.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#3F0E40] ${
                            member.status === 'online' ? 'bg-green-500' : 'bg-transparent border-[#CFBCCF]'
                          }`} />
                        </div>
                        <span className="truncate">{member.name}</span>
                      </button>
                    ))}
                    <button className="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm text-[#CFBCCF] hover:bg-white/10 transition-colors">
                      <Plus className="w-4 h-4" />
                      <span>Add teammates</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col bg-[#1A1D21]">
          {/* Channel Header */}
          <div className="h-12 border-b border-white/10 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-[#D1D2D3]" />
              <span className="font-bold text-white">
                {selectedChannel === 'call-ratings' ? 'call-ratings' : selectedChannel === 'general' ? 'general' : 'messages'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-1.5 rounded hover:bg-white/10 text-[#D1D2D3] transition-colors">
                <Users className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded hover:bg-white/10 text-[#D1D2D3] transition-colors">
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-1">
              {selectedChannel === 'call-ratings' ? (
                ratingsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-[#D1D2D3]" />
                  </div>
                ) : callRatings.length === 0 ? (
                  <div className="text-center py-12 text-[#ABABAD]">
                    <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>No call ratings yet.</p>
                    <p className="text-sm">Ratings will appear here when leads are created from calls.</p>
                  </div>
                ) : (
                  Object.entries(groupedRatings).map(([dateKey, ratings]) => (
                    <div key={dateKey}>
                      {/* Day Divider */}
                      <div className="flex items-center gap-4 py-4">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-xs font-medium text-[#ABABAD] bg-[#1A1D21] px-2">
                          {formatDayDivider(ratings[0].created_at)}
                        </span>
                        <div className="flex-1 h-px bg-white/10" />
                      </div>

                      {/* Messages for this day */}
                      {ratings.map((rating) => (
                        <div
                          key={rating.id}
                          onClick={() => !rating.read_at && markRatingAsRead(rating.id)}
                          className={`group flex gap-3 px-4 py-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer ${
                            !rating.read_at ? 'bg-white/5' : ''
                          }`}
                        >
                          {/* Avatar with rating */}
                          <div className="relative flex-shrink-0">
                            <div className={`w-9 h-9 rounded-lg ${getRatingColor(rating.call_rating)} flex items-center justify-center text-white font-bold text-sm`}>
                              {rating.call_rating}
                            </div>
                            {rating.call_direction === 'inbound' ? (
                              <PhoneIncoming className="absolute -bottom-1 -right-1 w-4 h-4 text-green-400 bg-[#1A1D21] rounded-full p-0.5" />
                            ) : (
                              <PhoneOutgoing className="absolute -bottom-1 -right-1 w-4 h-4 text-blue-400 bg-[#1A1D21] rounded-full p-0.5" />
                            )}
                          </div>

                          {/* Message Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="font-bold text-white hover:underline cursor-pointer">
                                {rating.lead_name}
                              </span>
                              <span className="text-xs text-[#ABABAD]">
                                {formatMessageDate(rating.created_at)}
                              </span>
                              {!rating.read_at && (
                                <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-medium">
                                  New
                                </span>
                              )}
                            </div>
                            
                            <div className="text-[#D1D2D3] text-sm mt-0.5">
                              <span className="text-[#ABABAD]">{rating.lead_phone}</span>
                              {rating.rating_reasoning && (
                                <p className="mt-1">{rating.rating_reasoning}</p>
                              )}
                            </div>

                            {rating.transcript_preview && (
                              <details className="mt-2 text-sm">
                                <summary className="cursor-pointer text-[#1D9BD1] hover:underline">
                                  View transcript preview
                                </summary>
                                <div className="mt-2 p-3 bg-white/5 rounded-lg text-[#ABABAD] whitespace-pre-wrap border-l-4 border-[#1D9BD1]">
                                  {rating.transcript_preview}
                                  {rating.transcript_preview.length >= 500 && '...'}
                                </div>
                              </details>
                            )}

                            {/* Reactions */}
                            <div className="flex items-center gap-1 mt-2">
                              <button className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-[#D1D2D3] transition-colors">
                                👍 1
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )
              ) : selectedChannel === 'general' ? (
                <div className="text-center py-12 text-[#ABABAD]">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>This is the beginning of #general</p>
                  <p className="text-sm mt-1">Send a message to get started!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className="group flex gap-3 px-4 py-2 hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarFallback className="bg-blue-500 text-white text-sm">
                          {message.sender_id === user?.id ? 'Y' : 'C'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-white">
                            {message.sender_id === user?.id ? 'You' : 'Client'}
                          </span>
                          <span className="text-xs text-[#ABABAD]">
                            {formatMessageDate(message.created_at)}
                          </span>
                        </div>
                        <p className="text-[#D1D2D3] text-sm mt-0.5">{message.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Message Input */}
          <div className="p-4 border-t border-white/10">
            <RichTextInput
              value={newMessage}
              onChange={setNewMessage}
              onSubmit={handleSendMessage}
              placeholder={`Message #${selectedChannel === 'call-ratings' ? 'call-ratings' : selectedChannel === 'general' ? 'general' : 'channel'}`}
              disabled={sending || selectedChannel === 'call-ratings'}
              sending={sending}
              channelName={`#${selectedChannel === 'call-ratings' ? 'call-ratings' : selectedChannel === 'general' ? 'general' : 'channel'}`}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminMessages;
