import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ChevronRight,
  Layers,
  BarChart3,
  LayoutGrid,
  Flag,
  ListChecks,
  PlusCircle,
  Mail,
  Workflow,
  CheckSquare,
  Copy,
  Zap,
  Settings2,
} from 'lucide-react';

interface PipelineSettingsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PipelineSettingsPopover = ({ open, onOpenChange }: PipelineSettingsPopoverProps) => {
  const [pipelineName, setPipelineName] = useState('Workflow');
  const [salesTracking, setSalesTracking] = useState(true);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          title="Pipeline settings"
          className="flex items-center justify-center h-full px-2 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-all"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] max-h-[70vh] overflow-y-auto p-0 shadow-xl"
      >
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-foreground">Pipeline Settings</h3>
        </div>

        <div className="px-4 pb-4 space-y-4">
          {/* ── General ── */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">General</h4>

            <div className="space-y-1">
              <Label htmlFor="pipeline-name" className="text-xs text-foreground">Name</Label>
              <Input
                id="pipeline-name"
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-0.5">
              <Label className="text-xs text-foreground">Record type</Label>
              <p className="text-xs text-muted-foreground">Opportunity</p>
            </div>
          </section>

          <Separator />

          {/* ── Stages ── */}
          <section className="space-y-2">
            <SettingsRow
              icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" />}
              title="Stages"
              description="Manage pipeline stages and win probability."
              badge="10 stages"
            />

            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium text-foreground">Sales tracking</p>
                  <p className="text-[10px] text-muted-foreground">Use sales statuses and reports.</p>
                </div>
              </div>
              <Switch checked={salesTracking} onCheckedChange={setSalesTracking} className="scale-90" />
            </div>
          </section>

          <Separator />

          {/* ── Customization ── */}
          <section className="space-y-1">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Customization</h4>

            <SettingsRow
              icon={<LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />}
              title="Board view card fields"
              description="Choose fields to show on pipeline cards."
              badge="2 enabled"
            />
            <SettingsRow
              icon={<Flag className="h-3.5 w-3.5 text-muted-foreground" />}
              title="Pipeline card flags"
              description="Automatically flag cards meeting conditions."
              badge="2 active"
            />
            <SettingsRow
              icon={<ListChecks className="h-3.5 w-3.5 text-muted-foreground" />}
              title="List view columns"
              description="Choose columns for list views."
              badge="14 enabled"
            />
            <SettingsRow
              icon={<PlusCircle className="h-3.5 w-3.5 text-muted-foreground" />}
              title="Create a pipeline field"
              description="Create custom pipeline fields."
            />
          </section>

          <Separator />

          {/* ── Automations ── */}
          <section className="space-y-1">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Automations</h4>

            <SettingsRow
              icon={<Mail className="h-3.5 w-3.5 text-muted-foreground" />}
              title="Email automations"
              description="Manage email automations."
              badge="0"
            />
            <SettingsRow
              icon={<Workflow className="h-3.5 w-3.5 text-muted-foreground" />}
              title="Workflow automations"
              description="Manage workflow automations."
            />
            <SettingsRow
              icon={<CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />}
              title="Task automations"
              description="Manage task automations."
            />
          </section>

          <Separator />

          {/* ── Automation suggestions ── */}
          <section className="space-y-2">
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
              <Zap className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-foreground">Let us help with automations</p>
                <p className="text-[10px] text-muted-foreground">
                  Trigger actions based on field updates, stages, and more.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <AutomationSuggestion label="Send email based on stage" />
              <AutomationSuggestion label="Create tasks for new records" />
              <AutomationSuggestion label="Create tasks based on stage" />
            </div>
          </section>

          <Separator />

          {/* ── Duplicate ── */}
          <Button variant="outline" className="w-full justify-start gap-2 text-xs h-8">
            <Copy className="h-3.5 w-3.5" />
            Duplicate this pipeline
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

/* ── Sub-components ── */

interface SettingsRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}

const SettingsRow = ({ icon, title, description, badge }: SettingsRowProps) => (
  <button className="flex items-center w-full gap-2 rounded-md px-1.5 py-2 text-left hover:bg-muted/60 transition-colors group">
    {icon}
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <p className="text-[10px] text-muted-foreground leading-snug">{description}</p>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      {badge && <span className="text-[10px] text-muted-foreground">{badge}</span>}
      <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  </button>
);

const AutomationSuggestion = ({ label }: { label: string }) => (
  <button className="flex items-center w-full gap-2 rounded-md border border-dashed border-border px-2.5 py-2 text-left hover:bg-muted/40 transition-colors group">
    <Zap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    <span className="text-[10px] text-muted-foreground flex-1">{label}</span>
    <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
  </button>
);

export default PipelineSettingsPopover;
