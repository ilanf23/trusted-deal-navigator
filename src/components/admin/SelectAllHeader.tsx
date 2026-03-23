import { Checkbox } from '@/components/ui/checkbox';

interface SelectAllHeaderProps {
  isAllSelected: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export function SelectAllHeader({ isAllSelected, onSelectAll, onClearSelection }: SelectAllHeaderProps) {
  return (
    <th
      className="w-12 pl-2 pr-4 py-3 text-center sticky top-0 left-0 z-30 bg-white"
      style={{ border: '1px solid #c8bdd6' }}
    >
      <Checkbox
        checked={isAllSelected}
        onCheckedChange={(checked) => checked ? onSelectAll() : onClearSelection()}
        className="h-5 w-5 rounded-none border-slate-300 dark:border-slate-300 data-[state=checked]:bg-[#3b2778] data-[state=checked]:border-[#3b2778]"
      />
    </th>
  );
}
