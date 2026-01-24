import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Filter, ArrowUpDown, Search, RefreshCw, Loader2 } from 'lucide-react';

interface InboxHeaderProps {
  title: string;
  subtitle?: string;
  dealCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: 'urgency' | 'date' | 'amount';
  onSortChange: (sort: 'urgency' | 'date' | 'amount') => void;
  isRefreshing?: boolean;
  onRefresh: () => void;
}

export function InboxHeader({
  title,
  subtitle,
  dealCount,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  isRefreshing,
  onRefresh,
}: InboxHeaderProps) {
  const sortLabels = {
    urgency: 'needs action soonest',
    date: 'most recent',
    amount: 'highest amount',
  };

  return (
    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      {/* Title row */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {dealCount} deals · Sorted by {sortLabels[sortBy]}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <Filter className="w-3.5 h-3.5" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem>All Deals</DropdownMenuItem>
              <DropdownMenuItem>High Urgency</DropdownMenuItem>
              <DropdownMenuItem>Waiting on Borrower</DropdownMenuItem>
              <DropdownMenuItem>Waiting on Lender</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>SBA Loans</DropdownMenuItem>
              <DropdownMenuItem>CRE Loans</DropdownMenuItem>
              <DropdownMenuItem>Equipment</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <ArrowUpDown className="w-3.5 h-3.5" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onSortChange('urgency')}>
                Needs action soonest
                {sortBy === 'urgency' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortChange('date')}>
                Most recent
                {sortBy === 'date' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortChange('amount')}>
                Highest amount
                {sortBy === 'amount' && <span className="ml-auto">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
      
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search deals..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
        />
      </div>
    </div>
  );
}
