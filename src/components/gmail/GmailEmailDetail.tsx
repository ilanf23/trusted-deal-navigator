import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Reply, Forward } from 'lucide-react';
import { format } from 'date-fns';
import {
  GmailEmail,
  extractSenderName,
  extractEmailAddress,
  toRenderableHtml,
  formatEmailDate,
} from './gmailHelpers';

interface GmailEmailDetailProps {
  email: GmailEmail;
  onBack: () => void;
  onReply: (email: GmailEmail) => void;
  onForward?: (email: GmailEmail) => void;
  /** Optional side panel (e.g. Evan's deal sidebar) */
  sidePanel?: React.ReactNode;
  /** Optional slot rendered below the email body (e.g. InlineReplyBox) */
  belowBody?: React.ReactNode;
  /** Optional slot rendered between action bar and email body */
  aboveBody?: React.ReactNode;
}

export function GmailEmailDetail({
  email,
  onBack,
  onReply,
  onForward,
  sidePanel,
  belowBody,
  aboveBody,
}: GmailEmailDetailProps) {
  return (
    <div className="h-full flex">
      {/* Email Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Action bar */}
        <div className="p-3 border-b border-border flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => onReply(email)} className="gap-2">
              <Reply className="w-4 h-4" />
              Reply
            </Button>
            {onForward && (
              <Button variant="ghost" size="sm" onClick={() => onForward(email)} className="gap-2">
                <Forward className="w-4 h-4" />
                Forward
              </Button>
            )}
          </div>
        </div>

        {aboveBody}

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            {/* Subject */}
            <h2 className="text-xl font-semibold">{email.subject}</h2>

            {/* Sender info */}
            <div className="flex items-start gap-3">
              <Avatar className="w-10 h-10 flex-shrink-0">
                {email.senderPhoto && <AvatarImage src={email.senderPhoto} />}
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {extractSenderName(email.from).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{extractSenderName(email.from)}</p>
                  <p className="text-xs text-muted-foreground flex-shrink-0">
                    {formatEmailDate(email.date)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">{email.from}</p>
                <p className="text-xs text-muted-foreground">
                  To: {email.to || '(unknown)'}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html: toRenderableHtml(
                    (email.body && email.body.trim()) ? email.body : email.snippet,
                  ),
                }}
              />
            </div>

            {belowBody}
          </div>
        </ScrollArea>
      </div>

      {/* Optional side panel */}
      {sidePanel}
    </div>
  );
}
