export type RelatedKind = 'people' | 'companies' | 'deal' | 'lender_programs';

export interface RelatedBackedRecord {
  id: string;
  related_id: string;
}

export interface RelatedRef {
  recordId: string;
  relatedId: string;
  relatedType: RelatedKind;
}

export function relatedRef(record: RelatedBackedRecord, relatedType: RelatedKind): RelatedRef {
  return {
    recordId: record.id,
    relatedId: record.related_id,
    relatedType,
  };
}

export function requireEntityId(record: Partial<RelatedBackedRecord>, label: string): string {
  if (!record.related_id) {
    throw new Error(`${label} is missing related_id`);
  }
  return record.related_id;
}
