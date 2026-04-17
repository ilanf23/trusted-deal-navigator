export type TableAccess = 'read' | 'write' | 'readwrite' | 'rpc' | 'realtime';

export interface PageDatabaseDeclaration {
  table: string;
  access: TableAccess;
  usage: string;
  via?: string;
  notes?: string;
}
