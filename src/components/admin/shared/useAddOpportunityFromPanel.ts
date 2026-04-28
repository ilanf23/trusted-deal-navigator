import { useState } from 'react';

import type {
  AddOpportunityDialogProps,
  LinkContact,
} from '@/components/admin/AddOpportunityDialog';
import type { CrmTable } from '@/hooks/usePipelineMutations';

/** Subset of an `entity_contacts` row that the dialog needs to recreate the link on the new deal. */
export type SourceContact = {
  name: string;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  is_primary?: boolean | null;
};

/**
 * Wires the "Add Opportunity from a deal's Related tab" flow used by
 * UnderwritingDetailPanel and PipelineDetailPanel. The panel already has the
 * source deal's contacts in hand — pass them in and we'll forward to the
 * dialog so the new deal gets the same `entity_contacts` rows.
 */
export function useAddOpportunityFromPanel(args: {
  defaultPipeline: CrmTable;
  sourceContacts: SourceContact[] | undefined;
  ownerOptions: AddOpportunityDialogProps['ownerOptions'];
  onCreated?: AddOpportunityDialogProps['onCreated'];
}) {
  const { defaultPipeline, sourceContacts, ownerOptions, onCreated } = args;
  const [open, setOpen] = useState(false);

  const linkContacts: LinkContact[] | undefined = sourceContacts?.map((c) => ({
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    title: c.title ?? null,
    is_primary: c.is_primary ?? false,
  }));

  const dialogProps: AddOpportunityDialogProps = {
    open,
    onOpenChange: setOpen,
    tableName: defaultPipeline,
    ownerOptions,
    allowPipelineSwitch: true,
    linkContacts,
    onCreated,
  };

  return { open, setOpen, dialogProps };
}
