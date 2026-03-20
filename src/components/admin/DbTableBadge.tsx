import { Database } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

interface DbTableBadgeProps {
  tables: string[];
}

export const DbTableBadge = ({ tables }: DbTableBadgeProps) => {
  const { isAdmin } = useAuth();
  if (!isAdmin) return null;

  return (
    <Badge
      className="font-mono text-[10px] gap-1 bg-yellow-200 text-yellow-900 border-yellow-400 hover:bg-yellow-300 shrink-0"
    >
      <Database className="h-3 w-3" />
      {tables.join(', ')}
    </Badge>
  );
};
