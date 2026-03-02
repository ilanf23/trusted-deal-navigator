import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, ExternalLink, Trash2, Layers, Tag, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PipelineBulkToolbarProps {
  selectedCount: number;
  totalCount: number;
  onClearSelection: () => void;
  onEdit?: () => void;
  onExport?: () => void;
  onMoveBoxes?: () => void;
  onDeleteBoxes?: () => void;
  onAssignOwner?: (ownerId: string) => void;
  teamMembers?: { id: string; name: string }[];
  className?: string;
}

const PipelineBulkToolbar = ({
  selectedCount,
  totalCount,
  onClearSelection,
  onEdit,
  onExport,
  onMoveBoxes,
  onDeleteBoxes,
  onAssignOwner,
  teamMembers = [],
  className,
}: PipelineBulkToolbarProps) => {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700",
        className
      )}
    >
      {/* Count badge */}
      <span className="inline-flex items-center px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-sm font-semibold whitespace-nowrap">
        {selectedCount} out of {totalCount.toLocaleString()}
      </span>

      <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">selected</span>

      {/* Separator */}
      <div className="w-px h-5 bg-slate-200 dark:bg-slate-600" />

      {/* Edit */}
      {onEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="gap-1.5 h-8 rounded-full border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-sm"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      )}

      {/* Export */}
      {onExport && (
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          className="gap-1.5 h-8 rounded-full border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-sm"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Export
        </Button>
      )}

      {/* More Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 rounded-full border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 z-50">
          {onMoveBoxes && (
            <DropdownMenuItem onClick={onMoveBoxes} className="cursor-pointer">
              <Layers className="h-4 w-4 mr-2" />
              Move boxes
            </DropdownMenuItem>
          )}
          {onAssignOwner && teamMembers.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">Assign to</div>
              {teamMembers.map((member) => (
                <DropdownMenuItem
                  key={member.id}
                  onClick={() => onAssignOwner(member.id)}
                  className="cursor-pointer"
                >
                  <User className="h-4 w-4 mr-2" />
                  {member.name}
                </DropdownMenuItem>
              ))}
            </>
          )}
          <DropdownMenuItem className="cursor-pointer" disabled>
            <Tag className="h-4 w-4 mr-2" />
            Add tags
          </DropdownMenuItem>
          {onDeleteBoxes && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDeleteBoxes}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete boxes
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onClearSelection} className="cursor-pointer">
            Clear selection
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default PipelineBulkToolbar;
