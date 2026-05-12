export type EntityType =
  | 'pipeline'
  | 'underwriting'
  | 'lender_management'
  | 'people'
  | 'companies'
  | 'potential'
  | 'lender_programs';

export type FileSourceSystem = 'native' | 'dropbox' | 'google_sheets';

export interface EntityFile {
  id: string;
  entity_id: string;
  entity_type: EntityType | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  source_system: string;
  created_at: string;
}
