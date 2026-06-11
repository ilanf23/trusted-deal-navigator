export type EntityKind = 'people' | 'companies' | 'deal' | 'lender_programs';

export interface EntityBackedRecord {
  id: string;
  entity_id: string;
}

export interface EntityRef {
  recordId: string;
  entityId: string;
  entityType: EntityKind;
}

export function entityRef(record: EntityBackedRecord, entityType: EntityKind): EntityRef {
  return {
    recordId: record.id,
    entityId: record.entity_id,
    entityType,
  };
}

export function requireEntityId(record: Partial<EntityBackedRecord>, label: string): string {
  if (!record.entity_id) {
    throw new Error(`${label} is missing entity_id`);
  }
  return record.entity_id;
}
