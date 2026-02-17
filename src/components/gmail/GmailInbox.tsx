import { useState, useMemo } from 'react';
import { Loader2, RefreshCw, Plus, Inbox, Star, Send, FileText, LogOut, Search, X, ArrowLeft, Reply, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGmailConnection } from '@/hooks/useGmailConnection';
import { GmailConnectScreen } from './GmailConnectScreen';
import { GmailEmailList } from './GmailEmailList';
import { GmailEmailDetail } from './GmailEmailDetail';
import { GmailEmail, extractEmailAddress, extractSenderName } from './gmailHelpers';

export type BasicFolder = 'inbox' | 'starred' | 'sent' | 'drafts';

export interface GmailInboxConfig {
  userKey: string;
  callbackPrefix: 'admin' | 'superadmin';
  returnPath?: string;
  /** Render prop for custom email list row extras */
  renderEmailExtra?: (email: GmailEmail) => React.ReactNode;
  /** Render prop for the email detail side panel */
  renderDetailSidePanel?: (email: GmailEmail) => React.ReactNode;
  /** Render prop for below-body content in detail view */
  renderDetailBelowBody?: (email: GmailEmail, helpers: { onReply: () => void }) => React.ReactNode;
  /** Custom sidebar component */
  renderSidebar?: (props: {
    activeFolder: string;
    onFolderChange: (folder: string) => void;
    onCompose: () => void;
    counts: Record<string, number>;
    connectionEmail?: string;
    onDisconnect: () => void;
  }) => React.ReactNode;
  /** Called when compose is triggered */
  onCompose?: (context?: { to?: string; subject?: string; body?: string; threadId?: string; inReplyTo?: string }) => void;
  /** Override email list to inject mock data, CRM filtering, etc. */
  transformEmails?: (emails: GmailEmail[], folder: string) => GmailEmail[];
}

interface GmailInboxProps {
  config: GmailInboxConfig;
}

export function GmailInbox({ config }: GmailInboxProps) {
  const {
    userKey,
    callbackPrefix,
    returnPath,
    renderEmailExtra,
    renderDetailSidePanel,
    renderDetailBelowBody,
    renderSidebar,
    onCompose,
    transformEmails,
  } = config;

  const gmail = useGmailConnection({
    userKey,
    callbackPrefix,
    returnPath,
    maxResults: 50,
    fetchPhotos: true,
  });

  const [activeFolder, setActiveFolder] = useState<string>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<GmailEmail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Build folder query
  const folderQuery = useMemo(() => {
    switch (activeFolder) {
      case 'sent': return 'in:sent';
      case 'starred': return 'is:starred';
      case 'drafts': return 'in:drafts';
      default: return 'in:inbox';
    }
  }, [activeFolder]);

  // Fetch emails for active folder
  const { data: emailsData, isLoading: emailsLoading, refetch: refetchEmails } = gmail.useEmails(folderQuery);
  const emails = emailsData?.emails || [];
  const needsReauth = emailsData?.needsAuth === true;

  // Folder counts
  const { data: inboxCount = 0 } = gmail.useFolderCount('in:inbox', activeFolder !== 'inbox');
  const { data: draftsCount = 0 } = gmail.useFolderCount('in:drafts', activeFolder !== 'drafts');

  const counts: Record<string, number> = {
    inbox: activeFolder === 'inbox' ? (emailsData?.totalCount || 0) : inboxCount,
    drafts: activeFolder === 'drafts' ? (emailsData?.totalCount || 0) : draftsCount,
  };

  // Apply transform (for mock data, CRM filtering, etc.)
  const displayEmails = useMemo(() => {
    let result = transformEmails ? transformEmails(emails, activeFolder) : emails;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.subject.toLowerCase().includes(q) ||
          e.from.toLowerCase().includes(q) ||
          e.snippet.toLowerCase().includes(q),
      );
    }
    return result;
  }, [emails, activeFolder, searchQuery, transformEmails]);

  // ── Loading ──────────────────────────────────────────────────────
  if (gmail.connectionLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Not connected ────────────────────────────────────────────────
  if (!gmail.gmailConnection) {
    return (
      <GmailConnectScreen
        variant="connect"
        onConnect={gmail.connectGmail}
        isConnecting={gmail.isConnecting}
      />
    );
  }

  // ── Needs re-auth ────────────────────────────────────────────────
  if (needsReauth) {
    return (
      <GmailConnectScreen
        variant="reauth"
        onConnect={gmail.connectGmail}
        onDisconnect={gmail.disconnectGmail}
        isConnecting={gmail.isConnecting}
      />
    );
  }

  const handleCompose = () => {
    onCompose?.();
  };

  const handleReply = (email: GmailEmail) => {
    const senderEmail = extractEmailAddress(email.from);
    const replySubject = email.subject.toLowerCase().startsWith('re:')
      ? email.subject
      : `Re: ${email.subject}`;
    onCompose?.({
      to: senderEmail,
      subject: replySubject,
      threadId: email.threadId,
      inReplyTo: email.id,
    });
  };

  const handleForward = (email: GmailEmail) => {
    const fwdSubject = email.subject.toLowerCase().startsWith('fwd:')
      ? email.subject
      : `Fwd: ${email.subject}`;
    const forwardBody = `\n\n---------- Forwarded message ---------\nFrom: ${email.from}\nDate: ${email.date}\nSubject: ${email.subject}\n\n${email.body || email.snippet}`;
    onCompose?.({ subject: fwdSubject, body: forwardBody });
  };

  // ── Default sidebar ──────────────────────────────────────────────
  const defaultSidebar = (
    <div className="w-64 border-r flex flex-col">
      <div className="p-4">
        <Button onClick={handleCompose} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Compose
        </Button>
      </div>
      <nav className="flex-1 px-2 space-y-1">
        {([
          { id: 'inbox', label: 'Inbox', icon: <Inbox className="h-4 w-4" />, count: counts.inbox },
          { id: 'starred', label: 'Starred', icon: <Star className="h-4 w-4" /> },
          { id: 'sent', label: 'Sent', icon: <Send className="h-4 w-4" /> },
          { id: 'drafts', label: 'Drafts', icon: <FileText className="h-4 w-4" />, count: counts.drafts },
        ] as const).map((f) => (
          <button
            key={f.id}
            onClick={() => { setActiveFolder(f.id); setSelectedEmail(null); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
              activeFolder === f.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
            }`}
          >
            <div className="flex items-center gap-3">
              {f.icon}
              {f.label}
            </div>
            {'count' in f && (f.count ?? 0) > 0 && (
              <span className="text-xs font-medium">{f.count}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">{gmail.gmailConnection?.email}</span>
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={gmail.disconnectGmail}>
            <LogOut className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar */}
      {renderSidebar
        ? renderSidebar({
            activeFolder,
            onFolderChange: (f) => { setActiveFolder(f); setSelectedEmail(null); },
            onCompose: handleCompose,
            counts,
            connectionEmail: gmail.gmailConnection?.email,
            onDisconnect: gmail.disconnectGmail,
          })
        : defaultSidebar}

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="border-b px-4 py-2 flex items-center gap-4">
          {selectedEmail && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          <div className="flex-1 relative max-w-md">
            <Input
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-3"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetchEmails()}
            disabled={emailsLoading}
          >
            <RefreshCw className={`h-4 w-4 ${emailsLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Email list or detail */}
        <div className="flex-1 overflow-hidden">
          {selectedEmail ? (
            <GmailEmailDetail
              email={selectedEmail}
              onBack={() => setSelectedEmail(null)}
              onReply={handleReply}
              onForward={handleForward}
              sidePanel={renderDetailSidePanel?.(selectedEmail)}
              belowBody={renderDetailBelowBody?.(selectedEmail, {
                onReply: () => handleReply(selectedEmail),
              })}
            />
          ) : (
            <GmailEmailList
              emails={displayEmails}
              loading={emailsLoading}
              searchQuery={searchQuery}
              onSelectEmail={setSelectedEmail}
              renderEmailExtra={renderEmailExtra}
            />
          )}
        </div>
      </div>
    </div>
  );
}
