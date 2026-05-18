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

const AssistantAvatar = () => (
  <Avatar className="h-7 w-7 shrink-0 ring-1 ring-primary/15">
    <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
      <Bot className="h-3.5 w-3.5" />
    </AvatarFallback>
  </Avatar>
);

const UserAvatar = ({ url, name }: { url?: string | null; name?: string }) => (
  <Avatar className="h-7 w-7 shrink-0">
    {url ? (
      <img src={url} alt={name || 'You'} className="h-full w-full object-cover" />
    ) : (
      <AvatarFallback className="bg-muted text-foreground/70">
        <User className="h-3.5 w-3.5" />
      </AvatarFallback>
    )}
  </Avatar>
);

const TypingDots = () => (
  <div className="flex items-center gap-1 py-2">
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60" />
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:120ms]" />
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:240ms]" />
  </div>
);

const ChatMessages = ({ messages, isLoading, userAvatarUrl, userName }: ChatMessagesProps) => {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:px-6">
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';
        return (
          <div
            key={i}
            className={cn(
              'flex gap-3',
              isUser ? 'flex-row-reverse' : 'flex-row',
            )}
          >
            {isUser ? <UserAvatar url={userAvatarUrl} name={userName} /> : <AssistantAvatar />}
            <div className={cn('min-w-0 flex-1', isUser && 'flex justify-end')}>
              {isUser ? (
                <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm">
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
              ) : (
                <div className="pt-0.5">
                  {msg.content === '' && isLoading && i === messages.length - 1 ? (
                    <TypingDots />
                  ) : (
                    <div className="prose prose-sm max-w-none break-words text-foreground dark:prose-invert prose-p:my-2 prose-p:leading-relaxed prose-pre:my-3 prose-pre:rounded-lg prose-pre:bg-muted prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:mt-4 prose-headings:mb-2">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChatMessages;
