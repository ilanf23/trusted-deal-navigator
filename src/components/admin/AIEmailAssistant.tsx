import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sparkles,
  Send,
  Loader2,
  Copy,
  Check,
  Mail,
  User,
  Building2,
  DollarSign,
  Percent,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadContext {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  loan_type?: string | null;
  loan_amount?: number | null;
  current_rate?: number | null;
  target_rate?: number | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIEmailAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  lead: LeadContext | null;
  onUseEmail: (subject: string, body: string) => void;
}

const PROMPT_SUGGESTIONS = [
  {
    label: 'Rate Alert',
    prompt: 'Write a compelling rate alert email. Their target rate has been reached and it\'s time to refinance.',
    icon: Percent,
  },
  {
    label: 'Check-In',
    prompt: 'Write a friendly check-in email. Ask how they\'re doing and if their financing needs have changed.',
    icon: RefreshCw,
  },
  {
    label: 'Follow Up',
    prompt: 'Write a professional follow-up email. Reference their loan inquiry and offer to answer questions.',
    icon: Mail,
  },
  {
    label: 'Introduction',
    prompt: 'Write a warm introduction email. Thank them for their interest and explain how we can help.',
    icon: User,
  },
];

const AIEmailAssistant = ({ isOpen, onClose, lead, onUseEmail }: AIEmailAssistantProps) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedSubject, setGeneratedSubject] = useState('');
  const [generatedBody, setGeneratedBody] = useState('');
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && lead) {
      // Reset state when opening with a new lead
      setMessages([]);
      setGeneratedSubject('');
      setGeneratedBody('');
      setInput('');
    }
  }, [isOpen, lead?.id]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || !lead) return;

    const userMessage: Message = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-email-chat', {
        body: {
          leadId: lead.id,
          messages: [...messages, userMessage],
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const assistantMessage: Message = { role: 'assistant', content: data.response };
      setMessages(prev => [...prev, assistantMessage]);

      // If we got a structured email, extract it
      if (data.subject && data.body) {
        setGeneratedSubject(data.subject);
        setGeneratedBody(data.body);
      }
    } catch (error: any) {
      console.error('AI chat error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to get AI response',
        variant: 'destructive',
      });
      // Remove the user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestionClick = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleCopy = () => {
    const text = generatedBody || messages[messages.length - 1]?.content || '';
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied to clipboard' });
  };

  const handleUseEmail = () => {
    if (generatedSubject && generatedBody) {
      onUseEmail(generatedSubject, generatedBody);
      onClose();
    } else if (messages.length > 0) {
      // Try to use the last assistant message as the body
      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
      if (lastAssistant) {
        onUseEmail(`Email for ${lead?.name}`, lastAssistant.content);
        onClose();
      }
    }
  };

  const hasOutput = generatedBody || messages.some(m => m.role === 'assistant');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Email Assistant
          </DialogTitle>
          
          {/* Lead Context Card */}
          {lead && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{lead.name}</span>
                </div>
                {lead.company_name && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span>{lead.company_name}</span>
                  </div>
                )}
                {lead.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{lead.email}</span>
                  </div>
                )}
                {lead.loan_amount && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span>${lead.loan_amount.toLocaleString()}</span>
                  </div>
                )}
                {lead.current_rate !== undefined && lead.current_rate !== null && (
                  <Badge variant={lead.current_rate <= (lead.target_rate || 0) ? 'default' : 'secondary'}>
                    {lead.current_rate}% → {lead.target_rate}%
                  </Badge>
                )}
                {lead.loan_type && (
                  <Badge variant="outline">{lead.loan_type}</Badge>
                )}
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Main Content Area */}
        <div className="flex-1 flex min-h-0">
          {/* Chat Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Prompt Suggestions */}
            {messages.length === 0 && (
              <div className="p-6 border-b">
                <p className="text-sm text-muted-foreground mb-3">Quick prompts:</p>
                <div className="grid grid-cols-2 gap-2">
                  {PROMPT_SUGGESTIONS.map((suggestion) => (
                    <Button
                      key={suggestion.label}
                      variant="outline"
                      className="justify-start h-auto py-3 px-4"
                      onClick={() => handleSuggestionClick(suggestion.prompt)}
                      disabled={loading}
                    >
                      <suggestion.icon className="w-4 h-4 mr-2 shrink-0" />
                      <span className="text-left">{suggestion.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 p-6" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Start a conversation or use a quick prompt above.</p>
                  <p className="text-sm mt-1">I have full context about this lead's data.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex gap-3',
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-lg px-4 py-3',
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                      >
                        <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-3 justify-start">
                      <div className="bg-muted rounded-lg px-4 py-3">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="p-4 border-t shrink-0">
              <div className="flex gap-2">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask AI to write or refine an email..."
                  className="min-h-[60px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  disabled={loading}
                />
                <Button type="submit" size="icon" className="h-[60px] w-[60px]" disabled={loading || !input.trim()}>
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </div>
            </form>
          </div>

          {/* Preview Panel */}
          {hasOutput && (
            <div className="w-80 border-l flex flex-col shrink-0">
              <div className="p-4 border-b bg-muted/50">
                <h3 className="font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Generated Email
                </h3>
              </div>
              <ScrollArea className="flex-1 p-4">
                {generatedSubject && (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-1">Subject:</p>
                    <p className="font-medium text-sm">{generatedSubject}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Body:</p>
                  <p className="text-sm whitespace-pre-wrap">
                    {generatedBody || messages.filter(m => m.role === 'assistant').pop()?.content || ''}
                  </p>
                </div>
              </ScrollArea>
              <div className="p-4 border-t flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy} className="flex-1">
                  {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button size="sm" onClick={handleUseEmail} className="flex-1">
                  <Mail className="w-4 h-4 mr-1" />
                  Use Email
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIEmailAssistant;
