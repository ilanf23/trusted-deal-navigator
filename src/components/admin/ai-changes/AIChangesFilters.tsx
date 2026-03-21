import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface AIChangesFiltersProps {
  filters: {
    mode?: 'assist' | 'agent';
    status?: 'applied' | 'undone' | 'redone' | 'failed';
    targetTable?: string;
  };
  onFiltersChange: (filters: any) => void;
  batchFilter: string | null;
}

const AIChangesFilters = ({ filters, onFiltersChange, batchFilter }: AIChangesFiltersProps) => {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {batchFilter && (
        <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-md px-3 py-1.5 text-sm">
          <span>Batch: {batchFilter.slice(0, 8)}...</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0"
            onClick={() => window.history.replaceState(null, '', '/superadmin/ai-changes')}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <Select
        value={filters.mode || 'all'}
        onValueChange={(v) => onFiltersChange({ ...filters, mode: v === 'all' ? undefined : v })}
      >
        <SelectTrigger className="w-[130px] h-9 text-sm">
          <SelectValue placeholder="Mode" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Modes</SelectItem>
          <SelectItem value="assist">Assist</SelectItem>
          <SelectItem value="agent">Agent</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.status || 'all'}
        onValueChange={(v) => onFiltersChange({ ...filters, status: v === 'all' ? undefined : v })}
      >
        <SelectTrigger className="w-[130px] h-9 text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="applied">Applied</SelectItem>
          <SelectItem value="undone">Undone</SelectItem>
          <SelectItem value="redone">Redone</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.targetTable || 'all'}
        onValueChange={(v) => onFiltersChange({ ...filters, targetTable: v === 'all' ? undefined : v })}
      >
        <SelectTrigger className="w-[150px] h-9 text-sm">
          <SelectValue placeholder="Table" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Tables</SelectItem>
          <SelectItem value="leads">Leads</SelectItem>
          <SelectItem value="tasks">Tasks</SelectItem>
          <SelectItem value="notes">Notes</SelectItem>
          <SelectItem value="communications">Activities</SelectItem>
        </SelectContent>
      </Select>

      {(filters.mode || filters.status || filters.targetTable) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-xs"
          onClick={() => onFiltersChange({})}
        >
          Clear filters
        </Button>
      )}
    </div>
  );
};

export default AIChangesFilters;
