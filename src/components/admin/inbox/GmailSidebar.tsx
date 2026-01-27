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
}

export function GmailSidebar({
  activeFolder,
  onFolderChange,
  onComposeClick,
  counts = {},
}: GmailSidebarProps) {
  const folderButton = (
    folder: FolderType,
    label: string,
    icon: React.ReactNode,
    count?: number,
    variant?: 'warning' | 'danger'
  ) => {
    const isActive = activeFolder === folder;
    const baseClasses = 'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors';
    
    let activeClasses = 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium';
    let inactiveClasses = 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100';
    
    if (variant === 'warning') {
      activeClasses = 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 font-medium';
      inactiveClasses = 'text-slate-600 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-700 dark:hover:text-amber-300';
    } else if (variant === 'danger') {
      activeClasses = 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 font-medium';
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
            <span className={`flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-semibold text-white rounded ${
              variant === 'danger' ? 'bg-red-500' : 'bg-amber-500'
            }`}>
              {count}
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-500">{count}</span>
          )
        )}
      </button>
    );
  };

  return (
    <div className="w-52 flex flex-col bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 h-full">
      {/* Compose Button */}
      <div className="p-3">
        <Button 
          onClick={onComposeClick}
          className="w-full justify-center gap-2 h-9 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium shadow-sm"
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
          
          <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />
          
          {/* Categories */}
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 font-medium">
            Categories
          </div>
          
          {folderButton('external', 'Borrowers', <Building className="w-4 h-4" />, counts.external)}
          {folderButton('internal', 'Internal', <Users className="w-4 h-4" />, counts.internal)}
          {folderButton('followup', '7-Day Follow Up', <CalendarClock className="w-4 h-4 text-amber-500" />, counts.followup, 'warning')}
          
          <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />
          
          {/* Resources */}
          {folderButton('templates', 'Templates', <FileText className="w-4 h-4" />)}
          
          <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />
          
          {/* Other folders */}
          {folderButton('spam', 'Spam', <AlertCircle className="w-4 h-4" />)}
          {folderButton('trash', 'Trash', <Trash2 className="w-4 h-4" />)}
        </nav>
      </ScrollArea>
    </div>
  );
}

