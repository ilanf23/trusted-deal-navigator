import { Bot, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  userAvatarUrl?: string | null;
  userName?: string;
}

const ChatMessages = ({ messages, isLoading, userAvatarUrl, userName }: ChatMessagesProps) => {
  return (
    <div className="space-y-3">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={cn(
            "flex gap-2",
            msg.role === 'user' ? 'justify-end' : 'justify-start'
          )}
        >
          {msg.role === 'assistant' && (
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                <Bot className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
          )}
          <div
            className={cn(
              "max-w-[85%] rounded-xl px-3 py-2 text-sm",
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            )}
          >
            <div className="text-xs leading-relaxed prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
          {msg.role === 'user' && (
            <Avatar className="h-6 w-6 shrink-0">
              {userAvatarUrl ? (
                <img src={userAvatarUrl} alt={userName || 'User'} className="h-full w-full object-cover" />
              ) : (
                <AvatarFallback className="bg-muted text-xs">
                  <User className="h-3 w-3" />
                </AvatarFallback>
              )}
            </Avatar>
          )}
        </div>
      ))}
      {isLoading && messages[messages.length - 1]?.content === '' && (
        <div className="flex gap-2">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              <Bot className="h-3 w-3" />
            </AvatarFallback>
          </Avatar>
          <div className="bg-muted rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:0.1s]" />
              <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:0.2s]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessages;
