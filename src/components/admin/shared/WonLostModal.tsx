import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Trophy, XCircle } from 'lucide-react';
import { LOSS_REASONS, WON_REASONS } from './dealOutcomeReasons';

export interface WonLostModalPayload {
  /** The outcome the user is recording. */
  outcome: 'won' | 'lost';
  /** Canonical reason chosen from the dropdown (required). */
  reason: string;
  /** Optional free-form notes the user can add alongside the reason. */
  notes: string;
  /** Optional final deal value override. Null leaves the existing value in place. */
  finalDealValue: number | null;
  /** Close date to write to the deal. Defaults to today. ISO yyyy-mm-dd. */
  closeDate: string;
}

export interface WonLostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outcome: 'won' | 'lost';
  /** Optional: pre-fill the final value input with the current deal value. */
  currentDealValue?: number | null;
  /** Submit handler — resolves when the parent has persisted the change. */
  onSubmit: (payload: WonLostModalPayload) => Promise<void> | void;
}

/**
 * Shared Won/Lost capture modal used by all three pipeline expanded views.
 *
 * Captures structured data (reason + notes + final value + close date) so the
 * migration off Copper doesn't lose the "why" behind closed deals. The caller
 * is responsible for writing the payload to the correct table.
 */
export function WonLostModal({
  open,
  onOpenChange,
  outcome,
  currentDealValue,
  onSubmit,
}: WonLostModalProps) {
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [finalValue, setFinalValue] = useState<string>(
    currentDealValue != null ? String(currentDealValue) : '',
  );
  const [closeDate, setCloseDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  // Reset the form every time the modal is re-opened so the previous session's
  // values don't leak into a new deal-outcome capture.
  useEffect(() => {
    if (open) {
      setReason('');
      setNotes('');
      setFinalValue(currentDealValue != null ? String(currentDealValue) : '');
      setCloseDate(new Date().toISOString().slice(0, 10));
      setSaving(false);
    }
  }, [open, currentDealValue]);

  const reasons = outcome === 'won' ? WON_REASONS : LOSS_REASONS;
  const isWon = outcome === 'won';

  const handleSubmit = async () => {
    if (!reason) return;
    setSaving(true);
    try {
      const parsedValue = finalValue.trim()
        ? Number(finalValue.replace(/[^0-9.]/g, ''))
        : null;
      await onSubmit({
        outcome,
        reason,
        notes: notes.trim(),
        finalDealValue: Number.isFinite(parsedValue as number) ? (parsedValue as number) : null,
        closeDate,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isWon ? (
              <Trophy className="h-5 w-5 text-emerald-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            Mark deal as {isWon ? 'Won' : 'Lost'}
          </DialogTitle>
          <DialogDescription>
            Capture the {isWon ? 'win' : 'loss'} details so we can track pipeline velocity and
            common {isWon ? 'win drivers' : 'loss reasons'} across deals.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="wl-reason">
              {isWon ? 'Win reason' : 'Loss reason'} <span className="text-red-600">*</span>
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="wl-reason">
                <SelectValue placeholder={`Select a ${isWon ? 'win' : 'loss'} reason`} />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wl-notes">Notes</Label>
            <Textarea
              id="wl-notes"
              placeholder={
                isWon
                  ? 'What did we do right? Who else was involved? Any context for future reference.'
                  : 'What happened? What would we do differently?'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wl-final-value">Final deal value</Label>
              <Input
                id="wl-final-value"
                type="text"
                inputMode="decimal"
                placeholder="$0"
                value={finalValue}
                onChange={(e) => setFinalValue(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wl-close-date">Close date</Label>
              <Input
                id="wl-close-date"
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason || saving}
            className={
              isWon
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              `Mark as ${isWon ? 'Won' : 'Lost'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WonLostModal;
