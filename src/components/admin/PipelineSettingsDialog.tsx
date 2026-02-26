import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
} from 'lucide-react';

interface PipelineSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PipelineSettingsDialog = ({ open, onOpenChange }: PipelineSettingsDialogProps) => {
  const [pipelineName, setPipelineName] = useState('Workflow');
  const [salesTracking, setSalesTracking] = useState(true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg font-semibold text-foreground">Pipeline Settings</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6">
          {/* ── General ── */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">General</h3>

            <div className="space-y-1.5">
              <Label htmlFor="pipeline-name" className="text-sm text-foreground">Name</Label>
              <Input
                id="pipeline-name"
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-sm text-foreground">Record type</Label>
              <p className="text-sm text-muted-foreground">Opportunity</p>
            </div>
          </section>

          <Separator />

          {/* ── Stages ── */}
          <section className="space-y-3">
            <SettingsRow
              icon={<Layers className="h-4 w-4 text-muted-foreground" />}
              title="Stages"
              description="Manage pipeline stages and win probability when sales tracking is enabled."
              badge="10 stages"
            />

            {/* Sales tracking */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Sales tracking</p>
                  <p className="text-xs text-muted-foreground">Use sales statuses and reports for pipeline.</p>
                </div>
              </div>
              <Switch checked={salesTracking} onCheckedChange={setSalesTracking} />
            </div>
          </section>

          <Separator />

          {/* ── Customization ── */}
          <section className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customization</h3>

            <SettingsRow
              icon={<LayoutGrid className="h-4 w-4 text-muted-foreground" />}
              title="Board view card fields"
              description="Choose fields to show on pipeline cards. Applies to all board views in your pipeline."
              badge="2 enabled"
            />
            <SettingsRow
              icon={<Flag className="h-4 w-4 text-muted-foreground" />}
              title="Pipeline card flags"
              description="Automatically flag pipeline cards that meet certain conditions."
              badge="2 active"
            />
            <SettingsRow
              icon={<ListChecks className="h-4 w-4 text-muted-foreground" />}
              title="List view columns"
              description="Choose columns to show in the list. Applies only to list views and will automatically be saved for the current saved filter."
              badge="14 enabled"
            />
            <SettingsRow
              icon={<PlusCircle className="h-4 w-4 text-muted-foreground" />}
              title="Create a pipeline field"
              description="Create custom pipeline fields."
            />
          </section>

          <Separator />

          {/* ── Automations ── */}
          <section className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Automations</h3>

            <SettingsRow
              icon={<Mail className="h-4 w-4 text-muted-foreground" />}
              title="Email automations"
              description="Manage email automations for this pipeline."
              badge="0"
            />
            <SettingsRow
              icon={<Workflow className="h-4 w-4 text-muted-foreground" />}
              title="Workflow automations"
              description="Manage workflow automations for this pipeline."
            />
            <SettingsRow
              icon={<CheckSquare className="h-4 w-4 text-muted-foreground" />}
              title="Task automations"
              description="Manage task automations for this pipeline."
            />
          </section>

          <Separator />

          {/* ── Automation suggestions ── */}
          <section className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
              <Zap className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Let us help with automations</p>
                <p className="text-xs text-muted-foreground">
                  Customize your pipeline workflow using automations. Trigger actions based on updates to specific fields, stages, and more.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <AutomationSuggestion label="Automatically send an email based on the stage" />
              <AutomationSuggestion label="Automatically create tasks for new records" />
              <AutomationSuggestion label="Create tasks based on stage" />
            </div>
          </section>

          <Separator />

          {/* ── Duplicate ── */}
          <Button variant="outline" className="w-full justify-start gap-2 text-sm h-9">
            <Copy className="h-4 w-4" />
            Duplicate this pipeline
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  <button className="flex items-center w-full gap-3 rounded-md px-2 py-2.5 text-left hover:bg-muted/60 transition-colors group">
    {icon}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground leading-snug">{description}</p>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {badge && <span className="text-xs text-muted-foreground">{badge}</span>}
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  </button>
);

const AutomationSuggestion = ({ label }: { label: string }) => (
  <button className="flex items-center w-full gap-3 rounded-md border border-dashed border-border px-3 py-2.5 text-left hover:bg-muted/40 transition-colors group">
    <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
    <span className="text-xs text-muted-foreground flex-1">{label}</span>
    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
  </button>
);

export default PipelineSettingsDialog;
