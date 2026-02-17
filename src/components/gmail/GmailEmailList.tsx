import { Mail, Loader2, Star } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GmailEmail, extractSenderName, formatEmailDate } from './gmailHelpers';

interface GmailEmailListProps {
  emails: GmailEmail[];
  loading: boolean;
  searchQuery?: string;
  onSelectEmail: (email: GmailEmail) => void;
  /** Optional render prop for per-email custom actions / badges */
  renderEmailExtra?: (email: GmailEmail) => React.ReactNode;
  /** Optional custom row class resolver */
  rowClassName?: (email: GmailEmail) => string;
}

export function GmailEmailList({
  emails,
  loading,
  searchQuery,
  onSelectEmail,
  renderEmailExtra,
  rowClassName,
}: GmailEmailListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Mail className="h-12 w-12 mb-4" />
        <p>{searchQuery ? 'No emails match your search' : 'No emails'}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="divide-y">
        {emails.map((email) => {
          const extraClassName = rowClassName?.(email) ?? '';
          return (
            <div
              key={email.id}
              onClick={() => onSelectEmail(email)}
              className={`px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                !email.isRead ? 'bg-primary/5 font-medium' : ''
              } ${extraClassName}`}
            >
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-6 h-6 flex-shrink-0">
                      {email.senderPhoto && <AvatarImage src={email.senderPhoto} />}
                      <AvatarFallback className="text-xs">
                        {extractSenderName(email.from).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm">
                      {extractSenderName(email.from)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                      {formatEmailDate(email.date)}
                    </span>
                  </div>
                  <p className="text-sm truncate">{email.subject}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {email.snippet}
                  </p>
                </div>
                {email.isStarred && (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                )}
              </div>
              {renderEmailExtra?.(email)}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
