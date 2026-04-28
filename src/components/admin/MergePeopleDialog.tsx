import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type PersonRow = Database['public']['Tables']['people']['Row'];

type FieldKind = 'short' | 'long' | 'array' | 'timestamp';

interface FieldConfig {
  key: keyof PersonRow;
  label: string;
  kind: FieldKind;
}

const MERGEABLE_FIELDS: FieldConfig[] = [
  { key: 'name',             label: 'Name',            kind: 'short' },
  { key: 'email',            label: 'Email',           kind: 'short' },
  { key: 'phone',            label: 'Phone',           kind: 'short' },
  { key: 'title',            label: 'Title',           kind: 'short' },
  { key: 'company_name',     label: 'Company',         kind: 'short' },
  { key: 'company_id',       label: 'Company link',    kind: 'short' },
  { key: 'contact_type',     label: 'Contact type',    kind: 'short' },
  { key: 'tags',             label: 'Tags',            kind: 'array' },
  { key: 'assigned_to',      label: 'Owner',           kind: 'short' },
  { key: 'linkedin',         label: 'LinkedIn',        kind: 'short' },
  { key: 'twitter',          label: 'Twitter',         kind: 'short' },
  { key: 'source',           label: 'Source',          kind: 'short' },
  { key: 'referral_source',  label: 'Referral source', kind: 'short' },
  { key: 'website',          label: 'Website',         kind: 'short' },
  { key: 'work_website',     label: 'Work website',    kind: 'short' },
  { key: 'known_as',         label: 'Known as',        kind: 'short' },
  { key: 'notes',            label: 'Notes',           kind: 'long' },
  { key: 'about',            label: 'About',           kind: 'long' },
  { key: 'description',      label: 'Description',     kind: 'long' },
  { key: 'history',          label: 'History',         kind: 'long' },
  { key: 'last_activity_at', label: 'Last activity',   kind: 'timestamp' },
  { key: 'last_contacted',   label: 'Last contacted',  kind: 'timestamp' },
];

function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function arraysEqualUnordered(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function formatValue(kind: FieldKind, v: unknown): string {
  if (isEmpty(v)) return '—';
  if (kind === 'array') return (v as string[]).join(', ');
  if (kind === 'timestamp') {
    try {
      return new Date(v as string).toLocaleString();
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export interface MergePeopleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personAId: string | null;
  personBId: string | null;
  onConfirm: (args: {
    winnerId: string;
    loserId: string;
    resolvedFields: Record<string, unknown>;
  }) => void;
  isPending: boolean;
}

export default function MergePeopleDialog({
  open,
  onOpenChange,
  personAId,
  personBId,
  onConfirm,
  isPending,
}: MergePeopleDialogProps) {
  const [winnerSide, setWinnerSide] = useState<'A' | 'B'>('A');
  const [choices, setChoices] = useState<Record<string, 'A' | 'B' | 'concat'>>({});

  // Reset local state whenever the dialog re-opens with a new pair
  useEffect(() => {
    if (open) {
      setWinnerSide('A');
      setChoices({});
    }
  }, [open, personAId, personBId]);

  const { data: pair, isLoading } = useQuery({
    queryKey: ['merge-people-pair', personAId, personBId],
    enabled: open && !!personAId && !!personBId,
    queryFn: async () => {
      const ids = [personAId, personBId].filter(Boolean) as string[];
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .in('id', ids);
      if (error) throw error;
      const a = data?.find((r) => r.id === personAId) ?? null;
      const b = data?.find((r) => r.id === personBId) ?? null;
      return { a, b };
    },
  });

  const personA = pair?.a ?? null;
  const personB = pair?.b ?? null;

  const winner = winnerSide === 'A' ? personA : personB;
  const loser  = winnerSide === 'A' ? personB : personA;

  const conflicts = useMemo<FieldConfig[]>(() => {
    if (!personA || !personB) return [];
    return MERGEABLE_FIELDS.filter(({ key, kind }) => {
      if (kind === 'timestamp' || kind === 'array') return false;
      const va = personA[key];
      const vb = personB[key];
      if (isEmpty(va) || isEmpty(vb)) return false;
      return va !== vb;
    });
  }, [personA, personB]);

  function buildResolvedFields(): Record<string, unknown> {
    if (!personA || !personB || !winner) return {};
    const out: Record<string, unknown> = {};

    for (const { key, kind } of MERGEABLE_FIELDS) {
      const va = personA[key];
      const vb = personB[key];
      const winnerVal = winner[key];

      // Identical (including both empty) → no-op
      if (kind === 'array') {
        const ta = (va ?? []) as string[];
        const tb = (vb ?? []) as string[];
        if (arraysEqualUnordered(ta, tb)) continue;
        const union = Array.from(new Set([...ta, ...tb]));
        if (!arraysEqualUnordered(union, (winnerVal ?? []) as string[])) {
          out[key as string] = union;
        }
        continue;
      }

      if (va === vb) continue;

      if (kind === 'timestamp') {
        const ta = !isEmpty(va) ? Date.parse(va as string) : -Infinity;
        const tb = !isEmpty(vb) ? Date.parse(vb as string) : -Infinity;
        const max = ta >= tb ? va : vb;
        if (max !== winnerVal) out[key as string] = max;
        continue;
      }

      // One side empty → take non-empty side
      if (isEmpty(va) || isEmpty(vb)) {
        const nonEmpty = isEmpty(va) ? vb : va;
        if (nonEmpty !== winnerVal) out[key as string] = nonEmpty;
        continue;
      }

      // Both non-empty and different → conflict
      const choice = choices[key as string] ?? winnerSide;
      if (choice === 'A') {
        if (va !== winnerVal) out[key as string] = va;
      } else if (choice === 'B') {
        if (vb !== winnerVal) out[key as string] = vb;
      } else if (choice === 'concat' && kind === 'long') {
        const concatenated = `${va as string}\n\n---\n\n${vb as string}`;
        out[key as string] = concatenated;
      }
    }

    return out;
  }

  const handleApply = () => {
    if (!winner || !loser) return;
    onConfirm({
      winnerId: winner.id,
      loserId: loser.id,
      resolvedFields: buildResolvedFields(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[860px] p-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="text-xl font-bold">Merge two people</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Choose which record to keep. Conflicting fields show side by side; pick a value for each.
          </p>
        </DialogHeader>

        {isLoading || !personA || !personB ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#3b2778]" />
          </div>
        ) : (
          <>
            {/* Winner picker */}
            <div className="px-6 pb-4 grid grid-cols-2 gap-3 shrink-0">
              {([
                { side: 'A' as const, person: personA, label: 'Person A' },
                { side: 'B' as const, person: personB, label: 'Person B' },
              ]).map(({ side, person, label }) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setWinnerSide(side)}
                  className={`text-left rounded-lg border-2 p-3 transition ${
                    winnerSide === side
                      ? 'border-[#3b2778] bg-[#f0ebf5] dark:bg-purple-950/40'
                      : 'border-border bg-background hover:border-[#8c7bab]'
                  }`}
                >
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                    {label} {winnerSide === side && '· Winner (kept)'}
                  </div>
                  <div className="font-semibold">{person.name}</div>
                  <div className="text-sm text-muted-foreground">{person.email ?? '—'}</div>
                  <div className="text-sm text-muted-foreground">{person.company_name ?? '—'}</div>
                </button>
              ))}
            </div>

            {/* Conflict table */}
            <div className="px-6 pb-4 overflow-y-auto flex-1 min-h-0">
              {conflicts.length === 0 ? (
                <div className="rounded-lg bg-[#f0ebf5] dark:bg-purple-950/30 px-4 py-3 text-sm text-[#3b2778] dark:text-purple-200">
                  No conflicts. All fields auto-merge: empty fields take the non-empty value, tags union, timestamps take the most recent.
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-[160px_1fr_1fr_220px] gap-2 bg-muted/50 text-[11px] font-semibold uppercase tracking-wide px-3 py-2 text-muted-foreground">
                    <div>Field</div>
                    <div>Person A</div>
                    <div>Person B</div>
                    <div>Pick</div>
                  </div>
                  {conflicts.map(({ key, label, kind }) => {
                    const va = personA[key];
                    const vb = personB[key];
                    const choice = choices[key as string] ?? winnerSide;
                    return (
                      <div
                        key={key as string}
                        className="grid grid-cols-[160px_1fr_1fr_220px] gap-2 px-3 py-2 border-t border-border text-sm"
                      >
                        <div className="font-medium text-foreground">{label}</div>
                        <div className="whitespace-pre-wrap break-words text-muted-foreground">
                          {formatValue(kind, va)}
                        </div>
                        <div className="whitespace-pre-wrap break-words text-muted-foreground">
                          {formatValue(kind, vb)}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => setChoices((c) => ({ ...c, [key as string]: 'A' }))}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                              choice === 'A'
                                ? 'bg-[#3b2778] text-white'
                                : 'bg-muted text-foreground hover:bg-muted/70'
                            }`}
                          >
                            A
                          </button>
                          <button
                            type="button"
                            onClick={() => setChoices((c) => ({ ...c, [key as string]: 'B' }))}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                              choice === 'B'
                                ? 'bg-[#3b2778] text-white'
                                : 'bg-muted text-foreground hover:bg-muted/70'
                            }`}
                          >
                            B
                          </button>
                          {kind === 'long' && (
                            <button
                              type="button"
                              onClick={() => setChoices((c) => ({ ...c, [key as string]: 'concat' }))}
                              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                choice === 'concat'
                                  ? 'bg-[#3b2778] text-white'
                                  : 'bg-muted text-foreground hover:bg-muted/70'
                              }`}
                            >
                              Concat
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-3 py-2 text-sm text-red-900 dark:text-red-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  <strong>{loser?.name}</strong> will be permanently deleted after merge. All deal,
                  company, lender, and underwriting links from both records survive on{' '}
                  <strong>{winner?.name}</strong>. This cannot be undone.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button
                disabled={isPending || !winner || !loser}
                onClick={handleApply}
                className="bg-[#3b2778] hover:bg-[#2d1d5e] text-white"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Merge into {winner?.name ?? 'winner'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
