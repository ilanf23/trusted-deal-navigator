import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as SelectPrimitive from '@radix-ui/react-select';
import { DollarSign } from 'lucide-react';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUndo } from '@/contexts/UndoContext';
import { cn } from '@/lib/utils';
import {
  moveDealBetweenPipelines,
  PIPELINE_LABELS,
  QUERY_KEY_MAP,
  type CrmTable,
} from '@/hooks/usePipelineMutations';

function PipelineMenuItem({ value, label }: { value: CrmTable; label: string }) {
  return (
    <SelectPrimitive.Item
      value={value}
      className={cn(
        'group relative flex w-full cursor-pointer select-none items-center gap-4 rounded-md px-4 py-3 outline-none transition-colors',
        'focus:bg-muted',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      )}
    >
      <DollarSign className="h-5 w-5 shrink-0 text-muted-foreground" />
      <SelectPrimitive.ItemText asChild>
        <span className="text-[15px] text-foreground group-data-[state=checked]:font-medium group-data-[state=checked]:text-blue-700">
          {label}
        </span>
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

const ROUTE_FOR: Record<CrmTable, (id: string) => string> = {
  potential: (id) => `/admin/pipeline/potential/expanded-view/${id}`,
  underwriting: (id) => `/admin/pipeline/underwriting/expanded-view/${id}`,
  lender_management: (id) => `/admin/pipeline/lender-management/expanded-view/${id}`,
};

const EXPANDED_QUERY_KEY: Record<CrmTable, string> = {
  potential: 'potential-expanded',
  underwriting: 'underwriting-expanded',
  lender_management: 'lender-management-expanded',
};

interface PipelineSelectFieldProps {
  dealId: string;
  currentPipeline: CrmTable;
}

export function PipelineSelectField({ dealId, currentPipeline }: PipelineSelectFieldProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { registerUndo } = useUndo();

  const invalidate = useCallback((pipeline: CrmTable) => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY_MAP[pipeline]] });
    queryClient.invalidateQueries({ queryKey: [EXPANDED_QUERY_KEY[pipeline], dealId] });
  }, [queryClient, dealId]);

  const handleChange = useCallback(async (next: CrmTable) => {
    if (next === currentPipeline) return;
    try {
      await moveDealBetweenPipelines(dealId, currentPipeline, next);
      invalidate(currentPipeline);
      invalidate(next);
      navigate(ROUTE_FOR[next](dealId));
      toast.success(`Moved to ${PIPELINE_LABELS[next]}`);
      registerUndo({
        label: `Moved to ${PIPELINE_LABELS[next]}`,
        execute: async () => {
          await moveDealBetweenPipelines(dealId, next, currentPipeline);
          invalidate(next);
          invalidate(currentPipeline);
          navigate(ROUTE_FOR[currentPipeline](dealId));
        },
      });
    } catch (err) {
      console.error('Failed to move deal between pipelines', err);
      toast.error('Failed to move deal');
    }
  }, [dealId, currentPipeline, invalidate, navigate, registerUndo]);

  return (
    <div>
      <label className="text-sm text-muted-foreground block mb-2">Pipeline</label>
      <div className="border-b border-border pb-1">
        <Select value={currentPipeline} onValueChange={(v) => handleChange(v as CrmTable)}>
          <SelectTrigger className="h-10 w-full text-base text-foreground border-0 bg-transparent shadow-none px-1 rounded-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent
            position="popper"
            sideOffset={4}
            className="w-[var(--radix-select-trigger-width)]"
          >
            <PipelineMenuItem value="underwriting" label="Underwriting" />
            <PipelineMenuItem value="lender_management" label="Lender Management" />
            <PipelineMenuItem value="potential" label="Potential" />
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
