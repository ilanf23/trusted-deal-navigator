export type RelatedType =
  | 'pipeline'
  | 'underwriting'
  | 'lender_management'
  | 'people'
  | 'companies'
  | 'potential'
  | 'deal'
  | 'lender_programs';

export type FileSourceSystem = 'native' | 'dropbox' | 'google_sheets';

export interface RelatedFile {
  id: string;
  related_id: string;
  related_type: RelatedType | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  /** users.id of the uploader (FK to users) */
  uploaded_by: string | null;
  source_system: string;
  created_at: string;
}
