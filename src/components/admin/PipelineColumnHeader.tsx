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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import HelpTooltip from '@/components/ui/help-tooltip';

export type ColumnType = 'free_form' | 'date' | 'checkbox' | 'dropdown' | 'tag' | 'formula' | 'assigned_to' | 'contact';
export type MagicColumnType = 'days_in_stage' | 'last_email_date' | 'last_call_date' | 'email_count' | 'call_count' | 'tasks_due' | 'days_since_contact';

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

const magicColumnTypes: { type: MagicColumnType; icon: React.ElementType; label: string; description: string }[] = [
  { type: 'days_in_stage', icon: Clock, label: 'Days in Stage', description: 'Auto-tracks how long the lead has been in current stage' },
  { type: 'last_email_date', icon: Mail, label: 'Last Email Date', description: 'Date of most recent email sent or received' },
  { type: 'last_call_date', icon: Phone, label: 'Last Call Date', description: 'Date of most recent phone call' },
  { type: 'email_count', icon: Mail, label: 'Email Count', description: 'Total number of emails exchanged' },
  { type: 'call_count', icon: Phone, label: 'Call Count', description: 'Total number of calls made' },
  { type: 'tasks_due', icon: ListChecks, label: 'Tasks Due', description: 'Number of overdue or due today tasks' },
  { type: 'days_since_contact', icon: MessageSquare, label: 'Days Since Contact', description: 'Days since last any communication' },
];

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
      const magicType = magicColumnTypes.find(m => m.type === column.magicType);
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
    <div className="flex items-center gap-1 group">
      {getColumnIcon()}
      <span className={cn(
        column.type === 'magic' && 'text-purple-600',
        column.isFrozen && 'font-bold'
      )}>
        {column.name}
      </span>
      {column.isFrozen && <Lock className="h-2.5 w-2.5 text-slate-400" />}
      {helpText && <HelpTooltip content={helpText} side="bottom" iconClassName="h-3 w-3" />}
      
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
                {magicColumnTypes.map((magic) => (
                  <DropdownMenuItem 
                    key={magic.type}
                    onClick={() => onInsertColumn?.('left', magic.type, true)}
                    className="cursor-pointer"
                  >
                    <magic.icon className="h-4 w-4 mr-2 text-purple-500" />
                    {magic.label}
                  </DropdownMenuItem>
                ))}
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
                {magicColumnTypes.map((magic) => (
                  <DropdownMenuItem 
                    key={magic.type}
                    onClick={() => onInsertColumn?.('right', magic.type, true)}
                    className="cursor-pointer"
                  >
                    <magic.icon className="h-4 w-4 mr-2 text-purple-500" />
                    {magic.label}
                  </DropdownMenuItem>
                ))}
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
export { customColumnTypes, magicColumnTypes };
