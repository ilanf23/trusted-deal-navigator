import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  ArrowLeft,
  ArrowRight,
  Type,
  Calendar,
  CheckSquare,
  Tag,
  Code,
  UserCircle,
  Contact,
  Sparkles,
  Clock,
  Mail,
  Phone,
  MessageSquare,
  ListChecks,
  TrendingUp,
  User,
  RefreshCw,
  Activity,
  FileText,
  Users,
  Hash,
  Eye as EyeIcon,
  Video,
  Mic,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import HelpTooltip from '@/components/ui/help-tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';

export type ColumnType = 'free_form' | 'date' | 'checkbox' | 'dropdown' | 'tag' | 'formula' | 'assigned_to' | 'contact';

// Comprehensive Magic Column types organized by category
export type MagicColumnType = 
  // Creation Data
  | 'created_by' | 'created_date' | 'days_in_pipeline' | 'last_updated' | 'last_updated_by'
  // Freshness
  | 'freshness'
  // Summary
  | 'email_count' | 'file_count' | 'comment_count' | 'task_count' | 'call_count' | 'meeting_count'
  // Email Data
  | 'last_email_date' | 'last_email_sent' | 'last_email_received' | 'email_thread_count' | 'unique_email_addresses'
  // Email Tracking
  | 'total_email_views' | 'last_email_view_date'
  // Stage Data
  | 'days_in_stage' | 'stage_entered_date' | 'stage_changes_count' | 'time_to_current_stage'
  // Task Data
  | 'tasks_due' | 'tasks_overdue' | 'tasks_completed' | 'next_task_due' | 'task_assignees'
  // Contact Data
  | 'last_contact_type' | 'days_since_contact' | 'total_interactions'
  // Call/Meeting Data
  | 'total_call_duration' | 'last_call_date' | 'meeting_notes_count'
  // Other
  | 'follower_count' | 'lead_id';

export interface MagicColumnConfig {
  type: MagicColumnType;
  icon: React.ElementType;
  label: string;
  description: string;
  category: string;
}

export interface PipelineColumn {
  id: string;
  name: string;
  type: 'foundational' | 'custom' | 'magic';
  columnType?: ColumnType;
  magicType?: MagicColumnType;
  isVisible: boolean;
  isFrozen: boolean;
  canDelete: boolean;
  canRename: boolean;
  width?: string;
}

interface PipelineColumnHeaderProps {
  column: PipelineColumn;
  onInsertColumn?: (position: 'left' | 'right', type: ColumnType | MagicColumnType, isMagic?: boolean) => void;
  onDeleteColumn?: () => void;
  onHideColumn?: () => void;
  onFreezeColumn?: () => void;
  onMoveColumn?: (direction: 'left' | 'right') => void;
  onRenameColumn?: (name: string) => void;
  showDropdown?: boolean;
  helpText?: string;
}

const customColumnTypes: { type: ColumnType; icon: React.ElementType; label: string; color: string }[] = [
  { type: 'free_form', icon: Type, label: 'Free Form', color: '#64748b' },
  { type: 'date', icon: Calendar, label: 'Date', color: '#0066FF' },
  { type: 'checkbox', icon: CheckSquare, label: 'Checkbox', color: '#10b981' },
  { type: 'dropdown', icon: ChevronDown, label: 'Dropdown', color: '#8b5cf6' },
  { type: 'tag', icon: Tag, label: 'Tag', color: '#f59e0b' },
  { type: 'formula', icon: Code, label: 'Formula', color: '#ec4899' },
  { type: 'assigned_to', icon: UserCircle, label: 'Assigned To', color: '#06b6d4' },
  { type: 'contact', icon: Contact, label: 'Contact', color: '#FF8000' },
];

// Magic Columns organized by category (Streak-style)
const magicColumnCategories: { category: string; icon: React.ElementType; columns: MagicColumnConfig[] }[] = [
  {
    category: 'Creation Data',
    icon: User,
    columns: [
      { type: 'created_by', icon: User, label: 'Created By', description: 'Who created this lead', category: 'Creation Data' },
      { type: 'created_date', icon: Calendar, label: 'Created Date', description: 'When this lead was created', category: 'Creation Data' },
      { type: 'days_in_pipeline', icon: Clock, label: 'Days in Pipeline', description: 'Total time in the pipeline', category: 'Creation Data' },
      { type: 'last_updated', icon: RefreshCw, label: 'Last Updated', description: 'When this lead was last modified', category: 'Creation Data' },
      { type: 'last_updated_by', icon: User, label: 'Last Updated By', description: 'Who last modified this lead', category: 'Creation Data' },
    ]
  },
  {
    category: 'Freshness',
    icon: Zap,
    columns: [
      { type: 'freshness', icon: Activity, label: 'Freshness', description: 'How recently updated vs other leads', category: 'Freshness' },
    ]
  },
  {
    category: 'Summary',
    icon: Activity,
    columns: [
      { type: 'email_count', icon: Mail, label: 'Email Count', description: 'Total emails exchanged', category: 'Summary' },
      { type: 'file_count', icon: FileText, label: 'File Count', description: 'Files attached to this lead', category: 'Summary' },
      { type: 'comment_count', icon: MessageSquare, label: 'Comment Count', description: 'Internal comments on this lead', category: 'Summary' },
      { type: 'task_count', icon: ListChecks, label: 'Task Count', description: 'Total tasks for this lead', category: 'Summary' },
      { type: 'call_count', icon: Phone, label: 'Call Count', description: 'Total calls made', category: 'Summary' },
      { type: 'meeting_count', icon: Video, label: 'Meeting Count', description: 'Total meetings scheduled', category: 'Summary' },
    ]
  },
  {
    category: 'Email Data',
    icon: Mail,
    columns: [
      { type: 'last_email_date', icon: Mail, label: 'Last Email Date', description: 'Date of most recent email', category: 'Email Data' },
      { type: 'last_email_sent', icon: Mail, label: 'Last Email Sent', description: 'When you last emailed them', category: 'Email Data' },
      { type: 'last_email_received', icon: Mail, label: 'Last Email Received', description: 'When they last emailed you', category: 'Email Data' },
      { type: 'email_thread_count', icon: MessageSquare, label: 'Email Threads', description: 'Number of email conversations', category: 'Email Data' },
      { type: 'unique_email_addresses', icon: Users, label: 'Unique Emails', description: 'Distinct email addresses involved', category: 'Email Data' },
    ]
  },
  {
    category: 'Email Tracking',
    icon: EyeIcon,
    columns: [
      { type: 'total_email_views', icon: EyeIcon, label: 'Total Email Views', description: 'How many times emails were opened', category: 'Email Tracking' },
      { type: 'last_email_view_date', icon: EyeIcon, label: 'Last View Date', description: 'When email was last viewed', category: 'Email Tracking' },
    ]
  },
  {
    category: 'Stage Data',
    icon: TrendingUp,
    columns: [
      { type: 'days_in_stage', icon: Clock, label: 'Days in Stage', description: 'Time in current stage', category: 'Stage Data' },
      { type: 'stage_entered_date', icon: Calendar, label: 'Stage Entered', description: 'When entered current stage', category: 'Stage Data' },
      { type: 'stage_changes_count', icon: TrendingUp, label: 'Stage Changes', description: 'Number of stage transitions', category: 'Stage Data' },
      { type: 'time_to_current_stage', icon: Clock, label: 'Time to Stage', description: 'Days from creation to current stage', category: 'Stage Data' },
    ]
  },
  {
    category: 'Task Data',
    icon: ListChecks,
    columns: [
      { type: 'tasks_due', icon: ListChecks, label: 'Tasks Due', description: 'Tasks due today or soon', category: 'Task Data' },
      { type: 'tasks_overdue', icon: ListChecks, label: 'Tasks Overdue', description: 'Overdue tasks count', category: 'Task Data' },
      { type: 'tasks_completed', icon: CheckSquare, label: 'Tasks Completed', description: 'Completed tasks count', category: 'Task Data' },
      { type: 'next_task_due', icon: Calendar, label: 'Next Task Due', description: 'Date of next due task', category: 'Task Data' },
      { type: 'task_assignees', icon: Users, label: 'Task Assignees', description: 'Who has tasks assigned', category: 'Task Data' },
    ]
  },
  {
    category: 'Contact Data',
    icon: Phone,
    columns: [
      { type: 'last_contact_type', icon: MessageSquare, label: 'Last Contact Type', description: 'Email, Call, or Meeting', category: 'Contact Data' },
      { type: 'days_since_contact', icon: Clock, label: 'Days Since Contact', description: 'Days since last interaction', category: 'Contact Data' },
      { type: 'total_interactions', icon: Activity, label: 'Total Interactions', description: 'All communications combined', category: 'Contact Data' },
    ]
  },
  {
    category: 'Call/Meeting Data',
    icon: Mic,
    columns: [
      { type: 'total_call_duration', icon: Clock, label: 'Total Call Time', description: 'Combined call duration', category: 'Call/Meeting Data' },
      { type: 'last_call_date', icon: Phone, label: 'Last Call Date', description: 'When last call occurred', category: 'Call/Meeting Data' },
      { type: 'meeting_notes_count', icon: FileText, label: 'Meeting Notes', description: 'Number of meeting notes', category: 'Call/Meeting Data' },
    ]
  },
  {
    category: 'Other',
    icon: Hash,
    columns: [
      { type: 'follower_count', icon: Users, label: 'Follower Count', description: 'Team members following this lead', category: 'Other' },
      { type: 'lead_id', icon: Hash, label: 'Lead ID', description: 'Unique identifier for this lead', category: 'Other' },
    ]
  },
];

// Flatten for easy lookup
const allMagicColumns = magicColumnCategories.flatMap(cat => cat.columns);

const PipelineColumnHeader = ({
  column,
  onInsertColumn,
  onDeleteColumn,
  onHideColumn,
  onFreezeColumn,
  onMoveColumn,
  showDropdown = true,
  helpText,
}: PipelineColumnHeaderProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const getColumnIcon = () => {
    if (column.type === 'magic') {
      const magicType = allMagicColumns.find(m => m.type === column.magicType);
      return magicType ? <magicType.icon className="h-3 w-3 text-purple-500" /> : <Sparkles className="h-3 w-3 text-purple-500" />;
    }
    if (column.type === 'custom' && column.columnType) {
      const customType = customColumnTypes.find(c => c.type === column.columnType);
      if (customType) {
        const Icon = customType.icon;
        return <Icon className="h-3 w-3" style={{ color: customType.color }} />;
      }
    }
    return null;
  };

  return (
    <div className="flex items-center gap-1.5 group relative">
      {getColumnIcon()}
      <span className={cn(
        "text-sm whitespace-nowrap",
        column.type === 'magic' && 'text-purple-600',
        column.isFrozen && 'font-bold'
      )}>
        {column.name}
      </span>
      {column.isFrozen && <Lock className="h-3 w-3 text-slate-400" />}
      {helpText && <HelpTooltip content={helpText} side="bottom" iconClassName="h-4 w-4" />}
      
      {showDropdown && (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <button className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-slate-200 rounded">
              <ChevronDown className="h-3 w-3 text-slate-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {/* Insert Column Submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Plus className="h-4 w-4 mr-2" />
                Insert column left
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">Custom Columns</div>
                {customColumnTypes.map((colType) => (
                  <DropdownMenuItem 
                    key={colType.type}
                    onClick={() => onInsertColumn?.('left', colType.type)}
                    className="cursor-pointer"
                  >
                    <colType.icon className="h-4 w-4 mr-2" style={{ color: colType.color }} />
                    {colType.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-purple-500" />
                  Magic Columns
                </div>
                <ScrollArea className="h-[200px]">
                  {magicColumnCategories.map((cat) => (
                    <div key={cat.category}>
                      <div className="px-2 py-1 text-[10px] font-medium text-purple-400 uppercase tracking-wider flex items-center gap-1">
                        <cat.icon className="h-3 w-3" />
                        {cat.category}
                      </div>
                      {cat.columns.map((magic) => (
                        <DropdownMenuItem 
                          key={magic.type}
                          onClick={() => onInsertColumn?.('left', magic.type, true)}
                          className="cursor-pointer pl-4"
                        >
                          <magic.icon className="h-4 w-4 mr-2 text-purple-500" />
                          {magic.label}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ))}
                </ScrollArea>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Plus className="h-4 w-4 mr-2" />
                Insert column right
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">Custom Columns</div>
                {customColumnTypes.map((colType) => (
                  <DropdownMenuItem 
                    key={colType.type}
                    onClick={() => onInsertColumn?.('right', colType.type)}
                    className="cursor-pointer"
                  >
                    <colType.icon className="h-4 w-4 mr-2" style={{ color: colType.color }} />
                    {colType.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-purple-500" />
                  Magic Columns
                </div>
                <ScrollArea className="h-[200px]">
                  {magicColumnCategories.map((cat) => (
                    <div key={cat.category}>
                      <div className="px-2 py-1 text-[10px] font-medium text-purple-400 uppercase tracking-wider flex items-center gap-1">
                        <cat.icon className="h-3 w-3" />
                        {cat.category}
                      </div>
                      {cat.columns.map((magic) => (
                        <DropdownMenuItem 
                          key={magic.type}
                          onClick={() => onInsertColumn?.('right', magic.type, true)}
                          className="cursor-pointer pl-4"
                        >
                          <magic.icon className="h-4 w-4 mr-2 text-purple-500" />
                          {magic.label}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ))}
                </ScrollArea>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => onMoveColumn?.('left')} className="cursor-pointer">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Move left
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMoveColumn?.('right')} className="cursor-pointer">
              <ArrowRight className="h-4 w-4 mr-2" />
              Move right
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={onFreezeColumn} className="cursor-pointer">
              <Lock className="h-4 w-4 mr-2" />
              {column.isFrozen ? 'Unfreeze column' : 'Freeze column'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onHideColumn} className="cursor-pointer">
              {column.isVisible ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide column
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Show column
                </>
              )}
            </DropdownMenuItem>

            {column.canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={onDeleteColumn} 
                  className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete column
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export default PipelineColumnHeader;
export { customColumnTypes, magicColumnCategories, allMagicColumns };
