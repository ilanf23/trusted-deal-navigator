import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { usePipelines } from '@/hooks/usePipelines';
import {
  AddOpportunityDialog,
  type LinkContact,
} from '@/components/admin/AddOpportunityDialog';
import type { CrmTable } from '@/hooks/usePipelineMutations';

export interface PipelineRecord {
  id: string;
  pipeline_id: string;
  stage_id: string;
  added_at: string;
  pipeline: { id: string; name: string };
  stage: { id: string; name: string; color: string | null };
}

type DialogPrefill = React.ComponentProps<typeof AddOpportunityDialog>['prefill'];

export interface PipelineRecordsSectionProps {
  /** Pipeline records currently linked to this entity. Pass [] for the empty state. */
  records: PipelineRecord[];
  /** Optional handler for the per-record remove (X) button. */
  onRemoveRecord?: (recordId: string) => void;
  /** Optional handler for clicking a record (default: navigate via getRecordRoute, otherwise no-op). */
  onSelectRecord?: (record: PipelineRecord) => void;
  /** Builds a route for clicking a record. Used only if onSelectRecord is not provided. */
  getRecordRoute?: (pipelineName: string, recordId: string) => string;
  /** Form prefill applied once when the Add Opportunity dialog opens. */
  prefill?: DialogPrefill;
  /** Rows inserted into entity_contacts after the new deal is created. */
  linkContacts?: LinkContact[];
  /** Owner options for the dialog's Owner picker. */
  ownerOptions: { value: string; label: string }[];
  /** Initial pipeline picker selection. Defaults to 'potential'. */
  defaultPipeline?: CrmTable;
  /** Stub for the inline "Add Pipeline Record" dropdown — picks an existing pipeline to associate with. */
  onAddToPipeline?: (pipelineId: string) => void;
}

function formatRecordDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return '';
  }
}

/**
 * Reusable "Pipeline Records" Related-tab section.
 *
 * Used by PeopleDetailPanel and CompanyDetailPanel so both share one source of
 * truth — edit this component once and the change applies everywhere.
 *
 * Renders:
 *   - Collapsible header with count + "+" Add Opportunity button (opens AddOpportunityDialog)
 *   - A list of currently linked pipeline records (with a per-record remove affordance)
 *   - An inline "Add Pipeline Record" search input that filters existing pipelines
 *     and calls `onAddToPipeline` (currently a stub at the call sites — wire it up
 *     here when the linkage model is finalized)
 */
export function PipelineRecordsSection({
  records,
  onRemoveRecord,
  onSelectRecord,
  getRecordRoute,
  prefill,
  linkContacts,
  ownerOptions,
  defaultPipeline = 'potential',
  onAddToPipeline,
}: PipelineRecordsSectionProps) {
  const navigate = useNavigate();
  const [addOpportunityOpen, setAddOpportunityOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const { data: allPipelines = [] } = usePipelines();
  const filteredPipelines = useMemo(() => {
    if (!searchText.trim()) return allPipelines;
    const q = searchText.toLowerCase();
    return allPipelines.filter((p: { name?: string }) => p.name?.toLowerCase().includes(q));
  }, [allPipelines, searchText]);

  const handleRecordClick = (rec: PipelineRecord) => {
    if (onSelectRecord) {
      onSelectRecord(rec);
      return;
    }
    if (getRecordRoute) {
      navigate(getRecordRoute(rec.pipeline.name, rec.id));
    }
  };

  const handlePickPipeline = (pipelineId: string) => {
    if (onAddToPipeline) {
      onAddToPipeline(pipelineId);
    } else {
      // No handler wired — keep the UX honest and don't fake success.
      toast.info('Linking to existing pipelines isn’t wired up yet');
    }
    setSearchText('');
    setSearchFocused(false);
  };

  return (
    <>
      <Collapsible defaultOpen>
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-6 py-3">
            <CollapsibleTrigger className="flex items-center gap-1 hover:text-foreground transition-colors">
              <span className="text-[14px] font-semibold text-foreground">
                Opportunities ({records.length})
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </CollapsibleTrigger>
            <button
              onClick={() => setAddOpportunityOpen(true)}
              className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title="Add Opportunity"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <CollapsibleContent className="px-6 pb-3">
            <div className="space-y-1.5">
              {records.map((rec) => (
                <button
                  key={rec.id}
                  onClick={() => handleRecordClick(rec)}
                  className="flex items-center gap-2.5 text-[13px] p-2 rounded-lg hover:bg-muted/40 transition-colors w-full text-left group"
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: rec.stage?.color || '#6b7280' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{rec.pipeline.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {rec.stage?.name} · {formatRecordDate(rec.added_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {onRemoveRecord && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveRecord(rec.id);
                        }}
                        className="p-1 rounded hover:bg-muted"
                        title="Remove from pipeline"
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                      </button>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </button>
              ))}

              <div className="relative mt-1">
                <input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  placeholder="Add Pipeline Record"
                  className="w-full text-[13px] text-foreground bg-transparent border-0 border-b border-muted-foreground/20 focus:border-[#3b2778] px-0 py-1.5 outline-none placeholder:text-muted-foreground/50 transition-colors"
                />
                {searchFocused && filteredPipelines.length > 0 && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => {
                        setSearchFocused(false);
                        setSearchText('');
                      }}
                    />
                    <div className="absolute z-50 top-full left-0 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                      {filteredPipelines.map((p: { id: string; name: string }) => (
                        <button
                          key={p.id}
                          onClick={() => handlePickPipeline(p.id)}
                          className="w-full text-left px-3 py-2 text-[13px] text-foreground hover:bg-muted/50 transition-colors"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <AddOpportunityDialog
        open={addOpportunityOpen}
        onOpenChange={setAddOpportunityOpen}
        tableName={defaultPipeline}
        ownerOptions={ownerOptions}
        allowPipelineSwitch
        prefill={prefill}
        linkContacts={linkContacts}
      />
    </>
  );
}
