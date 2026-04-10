import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUndo } from '@/contexts/UndoContext';

type RegisterUndoFn = ReturnType<typeof useUndo>['registerUndo'];

interface PersistInlineFieldOpts {
  leadId: string;
  field: string;
  nextValue: string;
  previousValue: string;
  onSaved: (field: string, newValue: string) => void;
  registerUndo: RegisterUndoFn;
  transform?: (val: string) => unknown;
  tableName?: string;
}

/**
 * Low-level helper: writes a single field change to Supabase, shows an error toast
 * on failure, and registers an undo entry on success.
 *
 * Returns true on success (including the "no change" short-circuit), false on error.
 * Both `useInlineSave` and wrapper components that render `EditableTextBox` call this
 * so there is exactly one copy of the persist + undo logic.
 */
export async function persistInlineFieldChange({
  leadId,
  field,
  nextValue,
  previousValue,
  onSaved,
  registerUndo,
  transform,
  tableName = 'potential',
}: PersistInlineFieldOpts): Promise<boolean> {
  const trimmed = nextValue.trim();
  if (trimmed === previousValue) return true;
  const saveValue = transform ? transform(trimmed) : (trimmed || null);
  const { error } = await supabase
    .from(tableName as any)
    .update({ [field]: saveValue })
    .eq('id', leadId);
  if (error) {
    console.error('persistInlineFieldChange error:', { field, leadId, saveValue, error });
    toast.error('Failed to save');
    return false;
  }
  registerUndo({
    label: `Updated ${field}`,
    execute: async () => {
      const restoreValue = transform ? transform(previousValue) : (previousValue || null);
      const { error: e } = await supabase.from(tableName as any).update({ [field]: restoreValue }).eq('id', leadId);
      if (e) throw e;
      onSaved(field, previousValue);
    },
  });
  onSaved(field, trimmed);
  return true;
}

/**
 * Generic inline-save helper for click-to-edit text fields backed by Supabase.
 * Handles edit state, draft buffer, save + error toast, and undo registration.
 *
 * Shared across InlineEditableFields, detail panels, and the EditableTextBox primitive.
 */
export function useInlineSave(
  leadId: string,
  field: string,
  currentValue: string,
  onSaved: (field: string, newValue: string) => void,
  transform?: (val: string) => unknown,
  tableName: string = 'potential',
) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);
  const [saving, setSaving] = useState(false);
  const { registerUndo } = useUndo();

  useEffect(() => {
    if (editing) setDraft(currentValue);
  }, [editing, currentValue]);

  const save = useCallback(async () => {
    if (draft.trim() === currentValue) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await persistInlineFieldChange({
      leadId,
      field,
      nextValue: draft,
      previousValue: currentValue,
      onSaved,
      registerUndo,
      transform,
      tableName,
    });
    setSaving(false);
    setEditing(false);
  }, [draft, currentValue, field, leadId, onSaved, transform, registerUndo, tableName]);

  const cancel = useCallback(() => {
    setDraft(currentValue);
    setEditing(false);
  }, [currentValue]);

  return { editing, setEditing, draft, setDraft, saving, save, cancel };
}
