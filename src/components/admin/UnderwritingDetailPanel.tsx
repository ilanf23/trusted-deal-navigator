import { X, Star, DollarSign, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

interface StageConfigEntry {
  label: string;
  color: string;
  bg: string;
  dot: string;
  pill: string;
}

interface UnderwritingDetailPanelProps {
  lead: Lead;
  stageConfig: Record<string, StageConfigEntry>;
  teamMemberMap: Record<string, string>;
  formatValue: (v: number) => string;
  fakeValue: (id: string) => number;
  onClose: () => void;
  onStageChange?: (leadId: string, newStatus: LeadStatus) => void;
}

const UNDERWRITING_STATUSES: LeadStatus[] = [
  'moving_to_underwriting',
  'underwriting',
  'ready_for_wu_approval',
  'pre_approval_issued',
];

export default function UnderwritingDetailPanel({
  lead,
  stageConfig,
  teamMemberMap,
  formatValue,
  fakeValue,
  onClose,
  onStageChange,
}: UnderwritingDetailPanelProps) {
  const stageCfg = stageConfig[lead.status];
  const assignedName = lead.assigned_to ? (teamMemberMap[lead.assigned_to] ?? '—') : '—';
  const dealValue = fakeValue(lead.id);

  const initial = lead.name[0]?.toUpperCase() ?? '?';

  const DetailRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start justify-between py-2.5 gap-4">
      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">{label}</span>
      <div className="text-sm text-foreground text-right">{children}</div>
    </div>
  );

  return (
    <aside className="shrink-0 w-[380px] border-l border-border bg-background flex flex-col h-full animate-in slide-in-from-right-5 duration-200">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-sm font-bold shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground truncate">{lead.name}</h2>
              {lead.company_name && (
                <p className="text-xs text-muted-foreground truncate">{lead.company_name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Follow">
              <Star className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 border-emerald-200">
            <DollarSign className="h-3 w-3" />
            Opportunity
          </Badge>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {formatValue(dealValue)}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0 w-full justify-start rounded-none border-b border-border bg-transparent h-9 px-4 gap-4">
          <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 text-xs font-semibold uppercase tracking-wider">
            Details
          </TabsTrigger>
          <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 text-xs font-semibold uppercase tracking-wider">
            Activity
          </TabsTrigger>
          <TabsTrigger value="related" className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-2 text-xs font-semibold uppercase tracking-wider">
            Related
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-4 py-3 divide-y divide-border/50">
              <DetailRow label="Name">
                <span className="font-medium">{lead.name}</span>
              </DetailRow>

              <DetailRow label="Pipeline">
                <span>Underwriting</span>
              </DetailRow>

              <DetailRow label="Stage">
                {onStageChange ? (
                  <Select
                    value={lead.status}
                    onValueChange={(v) => onStageChange(lead.id, v as LeadStatus)}
                  >
                    <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNDERWRITING_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {stageConfig[s]?.label ?? s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className={stageCfg ? stageCfg.color : ''}>
                    {stageCfg?.label ?? lead.status}
                  </span>
                )}
              </DetailRow>

              <DetailRow label="CLX File Name">
                <span>{lead.company_name ?? lead.name}</span>
              </DetailRow>

              <DetailRow label="Owned By">
                <span>{assignedName}</span>
              </DetailRow>

              <DetailRow label="Value">
                <span className="font-medium tabular-nums">{formatValue(dealValue)}</span>
              </DetailRow>

              <DetailRow label="Tags">
                {lead.tags && lead.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1 justify-end">
                    {lead.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[11px] px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </DetailRow>

              <DetailRow label="Source">
                <span>{lead.source ?? '—'}</span>
              </DetailRow>

              <DetailRow label="Notes">
                <span className="text-xs text-muted-foreground line-clamp-3">{lead.notes ?? '—'}</span>
              </DetailRow>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="activity" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">Activity timeline coming soon</p>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="related" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">Related records coming soon</p>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
