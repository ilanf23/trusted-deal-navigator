import { useEffect, useState, useRef } from 'react';
import PortalLayout from '@/components/portal/PortalLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Send, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Message = Database['public']['Tables']['messages']['Row'];
type Conversation = Database['public']['Tables']['conversations']['Row'];

const PortalMessages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    if (!user) return;
    const { data } = await supabase.from('conversations').select('*').eq('client_id', user.id).order('last_message_at', { ascending: false });
    setConversations(data || []);
    setLoading(false);
  };

  const fetchMessages = async (conversationId: string) => {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
    setMessages(data || []);
  };

  useEffect(() => { fetchConversations(); }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
      const channel = supabase.channel(`messages:${selectedConversation}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConversation}` }, (payload) => { setMessages((prev) => [...prev, payload.new as Message]); }).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedConversation]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleCreateConversation = async () => {
    if (!user || !newSubject.trim()) return;
    const { data, error } = await supabase.from('conversations').insert({ client_id: user.id, subject: newSubject.trim() }).select().single();
    if (error) { toast({ title: 'Error', description: 'Failed to create conversation', variant: 'destructive' }); return; }
    setConversations([data, ...conversations]);
    setSelectedConversation(data.id);
    setIsNewOpen(false);
    setNewSubject('');
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;
    setSending(true);
    await supabase.from('messages').insert({ conversation_id: selectedConversation, sender_id: user.id, content: newMessage.trim() });
    await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', selectedConversation);
    setNewMessage('');
    setSending(false);
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-3xl font-bold">Messages</h1><p className="text-muted-foreground">Chat with our team</p></div>
          <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />New Message</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Start New Conversation</DialogTitle></DialogHeader>
              <Input placeholder="Subject..." value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
              <DialogFooter><Button onClick={handleCreateConversation}>Start</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <div className="grid grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          <Card className="col-span-1">
            <CardHeader><CardTitle className="text-lg">Conversations</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-320px)]">
                {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div> : conversations.length === 0 ? <div className="text-center py-8 text-muted-foreground text-sm px-4">No conversations yet.</div> : conversations.map((c) => (
                  <button key={c.id} onClick={() => setSelectedConversation(c.id)} className={`w-full text-left p-4 border-b hover:bg-muted/50 ${selectedConversation === c.id ? 'bg-muted' : ''}`}>
                    <div className="font-medium truncate">{c.subject || 'No subject'}</div>
                    <div className="text-xs text-muted-foreground">{c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : ''}</div>
                  </button>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
          <Card className="col-span-2 flex flex-col">
            {selectedConversation ? (
              <>
                <CardHeader className="border-b"><CardTitle className="text-lg">{conversations.find(c => c.id === selectedConversation)?.subject}</CardTitle></CardHeader>
                <CardContent className="flex-1 flex flex-col p-0">
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.map((m) => (
                        <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] rounded-lg px-4 py-2 ${m.sender_id === user?.id ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <p>{m.content}</p>
                            <p className={`text-xs mt-1 ${m.sender_id === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{new Date(m.created_at).toLocaleTimeString()}</p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  <div className="p-4 border-t">
                    <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2">
                      <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." disabled={sending} />
                      <Button type="submit" disabled={sending || !newMessage.trim()}>{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</Button>
                    </form>
                  </div>
                </CardContent>
              </>
            ) : <div className="flex-1 flex items-center justify-center text-muted-foreground">Select a conversation</div>}
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
};
export default PortalMessages;
