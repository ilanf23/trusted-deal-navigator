import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, Loader2, ChevronDown, RefreshCw, X, Unplug, Search } from 'lucide-react';
import { GmailTemplatesView } from '@/components/gmail/GmailTemplatesView';
import { GmailTaskDialog } from '@/components/admin/GmailTaskDialog';
import GmailComposeDialog from '@/components/admin/GmailComposeDialog';
import LeadDetailDialog from '@/components/admin/LeadDetailDialog';
import { GmailSidebar } from '@/components/admin/inbox/GmailSidebar';
import { cn } from '@/lib/utils';
import { EVAN_SIGNATURE_HTML, appendSignature } from '@/lib/email-signature';
import { useGmailLogic } from '@/hooks/useGmailLogic';
import { GmailEmailDetail } from '@/components/employee/gmail/GmailEmailDetail';
import { GmailEmailList } from '@/components/employee/gmail/GmailEmailList';

interface GmailCRMViewProps {
  userKey: string;
  callbackPrefix: 'admin' | 'superadmin';
  returnPath?: string;
}

export function GmailCRMView({ userKey, callbackPrefix, returnPath }: GmailCRMViewProps) {
  const logic = useGmailLogic({ userKey, callbackPrefix, returnPath });

  const {
    connectionLoading,
    gmailConnection,
    handleConnectGmail,
    disconnectGmail,
    isGeneratingEmail,
    activeFolder, setActiveFolder,
    setSelectedEmailId,
    setComposeOpen, setComposeTo, setComposeSubject, setComposeBody,
    composeOpen, composeTo, composeSubject, composeBody, composeSending,
    handleSendEmail, clearCompose, clearComposeParams,
    openedDraftIdRef, handledComposeKeyRef,
    isRefreshing, handleRefresh,
    searchQuery, setSearchQuery,
    filteredEmails,
    startEmailIndex, endEmailIndex,
    currentPage, setCurrentPage, totalPages,
    selectedEmail,
    emailTemplates,
    leadDetailOpen, setLeadDetailOpen,
    selectedLeadIdForDetail, setSelectedLeadIdForDetail,
    allLeads,
    taskDialogOpen, setTaskDialogOpen,
    taskInitialTitle, taskInitialDescription, taskInitialLeadId,
    emailsLoading,
  } = logic;

  if (connectionLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!gmailConnection) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <div className="text-center">
          <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Connect Gmail</h2>
          <p className="text-sm text-muted-foreground mb-4">Connect your Gmail account to view emails</p>
          <Button onClick={handleConnectGmail}>Connect Gmail</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Email generation loading overlay */}
      {isGeneratingEmail && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border rounded-xl p-6 shadow-xl flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Generating email draft...</p>
            <p className="text-xs text-muted-foreground">Using AI to craft your message</p>
          </div>
        </div>
      )}
      <div className="flex h-[calc(100vh-100px)] border rounded-lg overflow-hidden bg-background">
        {/* Sidebar */}
        <GmailSidebar
          activeFolder={activeFolder}
          onFolderChange={(folder) => {
            setActiveFolder(folder);
            setSelectedEmailId(null);
          }}
          onComposeClick={() => {
            setComposeTo('');
            setComposeSubject('');
            setComposeBody(EVAN_SIGNATURE_HTML);
            setComposeOpen(true);
          }}
          counts={logic.folderCounts}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Header with Search and Refresh */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-9 w-9 rounded-lg"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </Button>

            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-10 rounded-lg bg-background"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>

            {/* Pagination Controls */}
            {filteredEmails.length > 0 && (
              <div className="flex items-center gap-2 text-muted-foreground ml-auto">
                <span className="text-xs bg-muted rounded-md px-2.5 py-1">{startEmailIndex}-{endEmailIndex} of {filteredEmails.length}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronDown className="w-4 h-4 rotate-90" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronDown className="w-4 h-4 -rotate-90" />
                </Button>
              </div>
            )}

            {/* Disconnect Gmail */}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto rounded-lg"
              onClick={disconnectGmail}
            >
              <Unplug className="w-4 h-4 mr-1.5" />
              Disconnect
            </Button>
          </div>

          {/* Email List / Email View */}
          <div className="flex-1 overflow-hidden relative">
            {/* Refresh overlay */}
            {isRefreshing && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary/80" />
                  <p className="text-sm text-muted-foreground">Refreshing emails...</p>
                </div>
              </div>
            )}
            {selectedEmail ? (
              <GmailEmailDetail logic={logic} />
            ) : activeFolder === 'templates' ? (
              <GmailTemplatesView
                onUseTemplate={(subject, body) => {
                  setComposeTo('');
                  setComposeSubject(subject);
                  setComposeBody(body);
                  setComposeOpen(true);
                }}
              />
            ) : (
              <GmailEmailList logic={logic} />
            )}
          </div>
        </div>
      </div>

      {/* Compose Dialog */}
      <GmailComposeDialog
        isOpen={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          logic.openedDraftIdRef.current = null;
          logic.handledComposeKeyRef.current = null;
          clearComposeParams();
        }}
        onDiscard={() => {
          clearCompose();
          logic.openedDraftIdRef.current = null;
          logic.handledComposeKeyRef.current = null;
          clearComposeParams();
        }}
        to={composeTo}
        onToChange={setComposeTo}
        subject={composeSubject}
        onSubjectChange={setComposeSubject}
        body={composeBody}
        onBodyChange={setComposeBody}
        onSend={handleSendEmail}
        sending={composeSending}
        templates={emailTemplates}
      />

      {/* Lead Detail Dialog */}
      {selectedLeadIdForDetail && (
        <LeadDetailDialog
          lead={allLeads.find(l => l.id === selectedLeadIdForDetail) || null}
          open={leadDetailOpen}
          onOpenChange={(open) => {
            setLeadDetailOpen(open);
            if (!open) setSelectedLeadIdForDetail(null);
          }}
        />
      )}

      {/* Task Creation Dialog */}
      <GmailTaskDialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        initialTitle={taskInitialTitle}
        initialDescription={taskInitialDescription}
        initialLeadId={taskInitialLeadId}
      />
    </>
  );
}
