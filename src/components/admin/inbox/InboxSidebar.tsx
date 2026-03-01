import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Inbox,
  Star,
  Send,
  Pencil,
  File,
  AlertTriangle,
  User,
  UserCheck,
  Building2,
  Clock,
  Zap,
  ExternalLink,
  Mail,
  LogOut,
  Loader2,
  Users,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';

export type FolderType = 
  | 'inbox' 
  | 'starred' 
  | 'sent' 
  | 'drafts' 
  | 'templates' 
  | 'untriaged' 
  | 'internal' 
  | 'external'
  | 'waiting-borrower'
  | 'waiting-lender'
  | 'waiting-internal'
  | 'at-risk';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface NudgeLead {
  id: string;
  name: string;
  email: string | null;
  updated_at: string;
}

interface InboxSidebarProps {
  activeFolder: FolderType;
  onFolderChange: (folder: FolderType) => void;
  onComposeClick: () => void;
  counts: {
    inbox: number;
    drafts: number;
    internal: number;
    external: number;
    untriaged: number;
    waitingOnBorrower: number;
    waitingOnLender: number;
    waitingInternal: number;
    atRisk: number;
  };
  templates: EmailTemplate[];
  onTemplateClick: (template: EmailTemplate) => void;
  isTemplateLoading: boolean;
  nudgeLeads: NudgeLead[];
  nudgesLoading: boolean;
  onNudgeClick: (lead: NudgeLead) => void;
  isNudgeLoading: boolean;
  onDisconnect: () => void;
  onLogout: () => void;
}

export function InboxSidebar({
  activeFolder,
  onFolderChange,
  onComposeClick,
  counts,
  templates,
  onTemplateClick,
  isTemplateLoading,
  nudgeLeads,
  nudgesLoading,
  onNudgeClick,
  isNudgeLoading,
  onDisconnect,
  onLogout,
}: InboxSidebarProps) {
  const folderButton = (
    folder: FolderType,
    label: string,
    icon: React.ReactNode,
    count?: number,
    variant?: 'warning' | 'danger' | 'success'
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
    <div className="w-52 flex flex-col bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
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
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {/* Primary folders */}
        {folderButton('inbox', 'Inbox', <Inbox className="w-4 h-4" />, counts.inbox)}
        {folderButton('external', 'External', <Users className="w-4 h-4" />, counts.external)}
        {folderButton('internal', 'Internal', <User className="w-4 h-4" />, counts.internal)}
        
        <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />
        
        {/* Operational views */}
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 font-medium">
          Operational
        </div>
        
        {folderButton('untriaged', 'Untriaged', <AlertTriangle className="w-4 h-4 text-amber-500" />, counts.untriaged, 'warning')}
        {folderButton('waiting-borrower', 'Waiting: Borrower', <UserCheck className="w-4 h-4" />, counts.waitingOnBorrower)}
        {folderButton('waiting-lender', 'Waiting: Lender', <Building2 className="w-4 h-4" />, counts.waitingOnLender)}
        {folderButton('waiting-internal', 'Waiting: Internal', <Clock className="w-4 h-4" />, counts.waitingInternal)}
        {folderButton('at-risk', 'At Risk', <AlertTriangle className="w-4 h-4 text-red-500" />, counts.atRisk, 'danger')}
        
        <div className="h-px bg-slate-200 dark:bg-slate-700 my-2" />
        
        {/* Standard folders */}
        {folderButton('starred', 'Starred', <Star className="w-4 h-4" />)}
        {folderButton('sent', 'Sent', <Send className="w-4 h-4" />)}
        {folderButton('drafts', 'Drafts', <File className="w-4 h-4" />, counts.drafts)}
        
        {/* Templates */}
        <HoverCard openDelay={100} closeDelay={200}>
          <HoverCardTrigger asChild>
            <button
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                activeFolder === 'templates' 
                  ? 'bg-slate-200 text-slate-900 font-medium' 
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <File className="w-4 h-4" />
              <span className="flex-1 text-left">Templates</span>
              <span className="text-xs text-slate-400">{templates.length}</span>
            </button>
          </HoverCardTrigger>
          <HoverCardContent side="right" align="start" className="w-64 p-2 rounded-md">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 px-2 py-1">
                Click a template to create a draft
              </p>
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => onTemplateClick(template)}
                  disabled={isTemplateLoading}
                  className="w-full flex flex-col items-start gap-0.5 px-3 py-2 rounded-md text-left transition-colors hover:bg-slate-100 disabled:opacity-50"
                >
                  <span className="text-sm font-medium text-slate-900">
                    {template.name}
                  </span>
                  <span className="text-xs text-slate-500 line-clamp-1">
                    {template.subject}
                  </span>
                </button>
              ))}
            </div>
          </HoverCardContent>
        </HoverCard>
        
        {/* Nudges section */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between px-3 py-1.5 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span className="font-medium text-xs uppercase tracking-wide text-slate-500">Nudges</span>
              {nudgeLeads.length > 0 && (
                <span className="flex items-center justify-center min-w-4 h-4 px-1 text-[10px] font-semibold text-white bg-red-500 rounded">
                  {nudgeLeads.length}
                </span>
              )}
            </div>
            <Link to="/admin/pipeline">
              <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-slate-100 rounded-md" title="View Pipeline">
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </Button>
            </Link>
          </div>
          
          <div className="px-3 pb-2 text-[10px] text-slate-400 uppercase tracking-wide">
            Waiting 7+ days
          </div>
          
          {nudgesLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          ) : nudgeLeads.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500">
              ✓ All caught up
            </div>
          ) : (
            <ScrollArea className="max-h-40">
              {nudgeLeads.slice(0, 8).map((lead) => {
                const daysSince = differenceInDays(new Date(), new Date(lead.updated_at));
                return (
                  <Tooltip key={lead.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onNudgeClick(lead)}
                        disabled={isNudgeLoading}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm text-slate-600 hover:bg-amber-50 transition-colors group disabled:opacity-50"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-500" />
                        <span className="flex-1 text-left truncate text-xs">
                          {lead.name.split(' ')[0]}
                        </span>
                        <span className="text-[10px] text-red-500 font-medium">{daysSince}d</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs rounded-md">
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-slate-400">{lead.email}</p>
                      <p className="text-amber-600 mt-1">Click to create follow-up</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {nudgeLeads.length > 8 && (
                <Link 
                  to="/admin/pipeline"
                  className="block px-3 py-2 text-xs text-primary hover:underline"
                >
                  +{nudgeLeads.length - 8} more
                </Link>
              )}
            </ScrollArea>
          )}
        </div>
      </nav>
      
      {/* Account actions */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-700 space-y-0.5">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={onDisconnect}
          className="w-full justify-start gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md h-8"
        >
          <Mail className="w-3.5 h-3.5" />
          Disconnect
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className="w-full justify-start gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md h-8"
        >
          <LogOut className="w-3.5 h-3.5" />
          Log out
        </Button>
      </div>
    </div>
  );
}
