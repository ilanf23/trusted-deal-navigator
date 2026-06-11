import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Inbox,
  Send,
  File,
  Pencil,
  Users,
  Building,
  CalendarClock,
  FileText,
  Star,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { GmailLabel } from '@/components/gmail/gmailHelpers';

const DEFAULT_LABEL_DOT = '#9aa0a6';

export type FolderType =
  | 'inbox'
  | 'starred'
  | 'sent'
  | 'drafts'
  | 'external'
  | 'internal'
  | 'followup'
  | 'templates'
  | 'spam'
  | 'trash';

interface GmailSidebarProps {
  activeFolder: FolderType;
  onFolderChange: (folder: FolderType) => void;
  onComposeClick: () => void;
  counts?: {
    inbox?: number;
    drafts?: number;
    external?: number;
    internal?: number;
    followup?: number;
  };
  /** User-created Gmail labels (names + colors as set up in Gmail) */
  labels?: GmailLabel[];
  /** Currently active label filter (null = no label filter) */
  activeLabelId?: string | null;
  /** Toggle the label filter. Called with null when clearing. */
  onLabelSelect?: (labelId: string | null) => void;
  /** Email count per label id (within loaded emails) */
  labelCounts?: Record<string, number>;
}

export function GmailSidebar({
  activeFolder,
  onFolderChange,
  onComposeClick,
  counts = {},
  labels = [],
  activeLabelId = null,
  onLabelSelect,
  labelCounts = {},
}: GmailSidebarProps) {
  const folderButton = (
    folder: FolderType,
    label: string,
    icon: React.ReactNode,
    count?: number,
    variant?: 'warning' | 'danger'
  ) => {
    const isActive = activeFolder === folder;
    const baseClasses = 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors duration-150';

    let activeClasses = 'bg-primary/10 text-primary font-semibold border-l-2 border-primary pl-3';
    let inactiveClasses = 'text-slate-600 dark:text-slate-400 hover:bg-muted/60 hover:text-slate-900 dark:hover:text-slate-100';

    if (variant === 'warning') {
      activeClasses = 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 font-semibold border-l-2 border-amber-500 pl-3';
      inactiveClasses = 'text-slate-600 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-300';
    } else if (variant === 'danger') {
      activeClasses = 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 font-semibold border-l-2 border-red-500 pl-3';
      inactiveClasses = 'text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300';
    }

    return (
      <button
        onClick={() => onFolderChange(folder)}
        className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {count !== undefined && count > 0 && (
          variant === 'warning' || variant === 'danger' ? (
            <span className={`flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white rounded-full ${
              variant === 'danger' ? 'bg-red-500' : 'bg-amber-500'
            }`}>
              {count}
            </span>
          ) : (
            <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-muted-foreground bg-muted rounded-full">{count}</span>
          )
        )}
      </button>
    );
  };

  return (
    <div className="w-56 flex flex-col bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 h-full">
      {/* Compose Button */}
      <div className="p-4">
        <Button
          onClick={onComposeClick}
          className="w-full justify-center gap-2 h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium shadow-sm"
        >
          <Pencil className="w-4 h-4" />
          Compose
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-2">
        <nav className="space-y-0.5 pb-2">
          {/* Primary folders */}
          {folderButton('inbox', 'Inbox', <Inbox className="w-4 h-4" />, counts.inbox)}
          {folderButton('starred', 'Starred', <Star className="w-4 h-4" />)}
          {folderButton('sent', 'Sent', <Send className="w-4 h-4" />)}
          {folderButton('drafts', 'Drafts', <File className="w-4 h-4" />, counts.drafts)}

          <div className="h-px bg-slate-200 dark:bg-slate-700 my-3" />

          {/* Categories */}
          <div className="px-3.5 mt-4 mb-2 text-[11px] uppercase tracking-wide text-slate-400 font-medium">
            Categories
          </div>

          {folderButton('external', 'Borrowers', <Building className="w-4 h-4" />, counts.external)}
          {folderButton('internal', 'Internal', <Users className="w-4 h-4" />, counts.internal)}
          {folderButton('followup', '7-Day Follow Up', <CalendarClock className="w-4 h-4 text-amber-500" />, counts.followup, 'warning')}

          {/* Gmail labels (user-created, mirrors Gmail) */}
          {onLabelSelect && labels.length > 0 && (
            <>
              <div className="h-px bg-slate-200 dark:bg-slate-700 my-3" />
              <div className="px-3.5 mt-4 mb-2 text-[11px] uppercase tracking-wide text-slate-400 font-medium">
                Labels
              </div>
              {labels.map((label) => {
                const isActive = activeLabelId === label.id;
                const count = labelCounts[label.id];
                return (
                  <button
                    key={label.id}
                    onClick={() => onLabelSelect(isActive ? null : label.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm transition-colors duration-150 ${
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary pl-3'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-muted/60 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                    title={label.name}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10"
                      style={{ backgroundColor: label.color?.backgroundColor || DEFAULT_LABEL_DOT }}
                    />
                    <span className="flex-1 text-left truncate">{label.name}</span>
                    {count !== undefined && count > 0 && (
                      <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-muted-foreground bg-muted rounded-full">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}

          <div className="h-px bg-slate-200 dark:bg-slate-700 my-3" />

          {/* Resources */}
          {folderButton('templates', 'Templates', <FileText className="w-4 h-4" />)}

          <div className="h-px bg-slate-200 dark:bg-slate-700 my-3" />

          {/* Other folders */}
          {folderButton('spam', 'Spam', <AlertCircle className="w-4 h-4" />)}
          {folderButton('trash', 'Trash', <Trash2 className="w-4 h-4" />)}
        </nav>
      </ScrollArea>
    </div>
  );
}
