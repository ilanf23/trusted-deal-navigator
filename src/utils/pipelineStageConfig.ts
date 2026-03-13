/**
 * Builds a dynamic stageConfig from DB pipeline_stages records.
 * Maps each stage to Tailwind color classes for use in kanban columns, pills, dots, etc.
 */

const COLOR_PALETTE = [
  { name: 'blue', dot: 'bg-blue-500', color: 'bg-blue-600', pill: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800', bg: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800', textColor: 'text-blue-700 dark:text-blue-400' },
  { name: 'cyan', dot: 'bg-cyan-500', color: 'bg-cyan-600', pill: 'bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800', bg: 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800', textColor: 'text-cyan-700 dark:text-cyan-400' },
  { name: 'amber', dot: 'bg-amber-500', color: 'bg-amber-600', pill: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800', bg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800', textColor: 'text-amber-700 dark:text-amber-400' },
  { name: 'orange', dot: 'bg-orange-500', color: 'bg-orange-600', pill: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800', bg: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800', textColor: 'text-orange-700 dark:text-orange-400' },
  { name: 'red', dot: 'bg-red-500', color: 'bg-red-600', pill: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800', bg: 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800', textColor: 'text-red-700 dark:text-red-400' },
  { name: 'violet', dot: 'bg-violet-500', color: 'bg-violet-600', pill: 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800', bg: 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800', textColor: 'text-violet-700 dark:text-violet-400' },
  { name: 'purple', dot: 'bg-purple-500', color: 'bg-purple-600', pill: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800', bg: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800', textColor: 'text-purple-700 dark:text-purple-400' },
  { name: 'emerald', dot: 'bg-emerald-500', color: 'bg-emerald-600', pill: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', bg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800', textColor: 'text-emerald-700 dark:text-emerald-400' },
  { name: 'sky', dot: 'bg-sky-500', color: 'bg-sky-600', pill: 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800', bg: 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800', textColor: 'text-sky-700 dark:text-sky-400' },
  { name: 'indigo', dot: 'bg-indigo-500', color: 'bg-indigo-600', pill: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800', bg: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800', textColor: 'text-indigo-700 dark:text-indigo-400' },
  { name: 'pink', dot: 'bg-pink-500', color: 'bg-pink-600', pill: 'bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800', bg: 'bg-pink-50 dark:bg-pink-950/50 border-pink-200 dark:border-pink-800', textColor: 'text-pink-700 dark:text-pink-400' },
  { name: 'teal', dot: 'bg-teal-500', color: 'bg-teal-600', pill: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800', bg: 'bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800', textColor: 'text-teal-700 dark:text-teal-400' },
  { name: 'slate', dot: 'bg-slate-400', color: 'bg-slate-500', pill: 'bg-slate-200 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600', bg: 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700', textColor: 'text-slate-600 dark:text-slate-400' },
  { name: 'rose', dot: 'bg-rose-500', color: 'bg-rose-600', pill: 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800', bg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800', textColor: 'text-rose-700 dark:text-rose-400' },
];

export interface StageConfig {
  title: string;
  label: string;
  color: string;
  dot: string;
  pill: string;
  bg: string;
  textColor: string;
}

interface PipelineStage {
  id: string;
  name: string;
  position: number;
  color: string | null;
}

/**
 * Builds a stageConfig record keyed by stage ID.
 * Colors are assigned from the palette based on position order.
 */
export function buildStageConfig(stages: PipelineStage[]): Record<string, StageConfig> {
  const config: Record<string, StageConfig> = {};
  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const palette = COLOR_PALETTE[i % COLOR_PALETTE.length];
    config[stage.id] = {
      title: stage.name,
      label: stage.name,
      color: palette.color,
      dot: palette.dot,
      pill: palette.pill,
      bg: palette.bg,
      textColor: palette.textColor,
    };
  }
  return config;
}
