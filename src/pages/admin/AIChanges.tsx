import { useState } from 'react';
import { useAIChanges, type AIChange } from '@/hooks/useAIChanges';
import AIChangesTable from '@/components/admin/ai-changes/AIChangesTable';
import AIChangesFilters from '@/components/admin/ai-changes/AIChangesFilters';
import AIChangeDetailPanel from '@/components/admin/ai-changes/AIChangeDetailPanel';
import { useSearchParams } from 'react-router-dom';

const AIChanges = () => {
  const [searchParams] = useSearchParams();
  const batchFilter = searchParams.get('batch');

  const [filters, setFilters] = useState<{
    mode?: 'assist' | 'agent';
    status?: 'applied' | 'undone' | 'redone' | 'failed';
    targetTable?: string;
  }>({});

  const [selectedChange, setSelectedChange] = useState<AIChange | null>(null);

  const { changes, batches, isLoading, undoChange, redoChange, undoBatch, refetch } = useAIChanges(filters);

  // Filter by batch if URL param present
  const displayedChanges = batchFilter
    ? changes.filter(c => c.batch_id === batchFilter)
    : changes;

  const handleUndo = async (changeId: string) => {
    try {
      await undoChange(changeId);
      refetch();
      if (selectedChange?.id === changeId) {
        setSelectedChange(prev => prev ? { ...prev, status: 'undone' } : null);
      }
    } catch (err: any) {
      console.error('Undo error:', err);
    }
  };

  const handleRedo = async (changeId: string) => {
    try {
      await redoChange(changeId);
      refetch();
      if (selectedChange?.id === changeId) {
        setSelectedChange(prev => prev ? { ...prev, status: 'redone' } : null);
      }
    } catch (err: any) {
      console.error('Redo error:', err);
    }
  };

  const handleUndoBatch = async (batchId: string) => {
    try {
      await undoBatch(batchId);
      refetch();
    } catch (err: any) {
      console.error('Batch undo error:', err);
    }
  };

  return (
    <div className="flex-1 p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">AI Changes</h1>
        <p className="text-sm text-muted-foreground">
          Review and manage all changes made by the AI assistant
        </p>
      </div>

      <AIChangesFilters
        filters={filters}
        onFiltersChange={setFilters}
        batchFilter={batchFilter}
      />

      <div className="flex gap-4">
        <div className={selectedChange ? 'flex-1' : 'w-full'}>
          <AIChangesTable
            changes={displayedChanges}
            batches={batches}
            isLoading={isLoading}
            selectedChangeId={selectedChange?.id || null}
            onSelectChange={setSelectedChange}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onUndoBatch={handleUndoBatch}
          />
        </div>

        {selectedChange && (
          <AIChangeDetailPanel
            change={selectedChange}
            onClose={() => setSelectedChange(null)}
            onUndo={() => handleUndo(selectedChange.id)}
            onRedo={() => handleRedo(selectedChange.id)}
          />
        )}
      </div>
    </div>
  );
};

export default AIChanges;
