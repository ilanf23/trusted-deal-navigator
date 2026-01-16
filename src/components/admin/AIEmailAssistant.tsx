import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { DraggableBox } from '@/components/ui/draggable-box';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  RefreshCw,
  ChevronRight,
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
    icon: Sparkles,
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

  useEffect(() => {
    if (isOpen && lead) {
      setMessages([]);
      setGeneratedSubject('');
      setGeneratedBody('');
      setInput('');
    }
  }, [isOpen, lead?.id]);

  useEffect(() => {
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
      const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
      if (lastAssistant) {
        onUseEmail(`Email for ${lead?.name}`, lastAssistant.content);
        onClose();
      }
    }
  };

  const hasOutput = generatedBody || messages.some(m => m.role === 'assistant');

  return (
    <DraggableBox
      id="ai-assistant"
      title="AI Email Assistant"
      icon={<Sparkles className="w-4 h-4 text-primary" />}
      isOpen={isOpen}
      onClose={onClose}
      defaultWidth={480}
      defaultHeight={600}
      minWidth={350}
      minHeight={400}
      maxWidth={700}
      maxHeight={800}
      defaultCorner="top-right"
    >
      {/* Lead Context */}
      {lead && (
        <div className="p-3 border-b bg-muted/30 shrink-0">
          <div className="flex flex-wrap gap-2 text-sm">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3 text-muted-foreground" />
              <span className="font-medium">{lead.name}</span>
            </div>
            {lead.company_name && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Building2 className="w-3 h-3" />
                <span>{lead.company_name}</span>
              </div>
            )}
            {lead.loan_amount && (
              <Badge variant="outline" className="text-xs">
                <DollarSign className="w-3 h-3 mr-0.5" />
                {lead.loan_amount.toLocaleString()}
              </Badge>
            )}
            {lead.current_rate !== undefined && lead.current_rate !== null && (
              <Badge variant={lead.current_rate <= (lead.target_rate || 0) ? 'default' : 'secondary'} className="text-xs">
                {lead.current_rate}% → {lead.target_rate}%
              </Badge>
            )}
            {lead.loan_type && (
              <Badge variant="outline" className="text-xs">{lead.loan_type}</Badge>
            )}
          </div>
        </div>
      )}

      {/* Quick Prompts */}
      {messages.length === 0 && (
        <div className="p-3 border-b shrink-0">
          <p className="text-xs text-muted-foreground mb-2">Quick prompts:</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PROMPT_SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion.label}
                variant="outline"
                size="sm"
                className="justify-start h-8 text-xs"
                onClick={() => handleSuggestionClick(suggestion.prompt)}
                disabled={loading}
              >
                <suggestion.icon className="w-3 h-3 mr-1.5 shrink-0" />
                {suggestion.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Select a prompt or type your request.</p>
            <p className="text-xs mt-1">I have full context about this lead.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  'flex gap-2',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2',
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
              <div className="flex gap-2 justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Action Buttons */}
      {hasOutput && (
        <div className="p-3 border-t bg-muted/30 shrink-0">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="flex-1">
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button size="sm" onClick={handleUseEmail} className="flex-1 gap-1">
              Use in Email
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-3 border-t shrink-0">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI to write or refine an email..."
            className="min-h-[50px] max-h-[100px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={loading}
          />
          <Button type="submit" size="icon" className="h-[50px] w-[50px] shrink-0" disabled={loading || !input.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </form>
    </DraggableBox>
  );
};

export default AIEmailAssistant;
