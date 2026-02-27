/**
 * Centralized application configuration constants.
 * 
 * Keeps hardcoded identifiers out of component/service code.
 * For secrets (API keys, private emails used in edge functions),
 * use Lovable Cloud secrets instead — these are only for
 * frontend-safe, non-secret configuration values.
 */

/** Team member email addresses used for frontend queries/filters */
export const TEAM_EMAILS = {
  EVAN: "evan@test.com",
} as const;

/** Human-readable labels for all lead_status enum values */
export const STAGE_LABELS: Record<string, string> = {
  discovery: "Discovery",
  questionnaire: "Questionnaire",
  pre_qualification: "Pre-Qualification",
  document_collection: "Document Collection",
  underwriting: "Underwriting",
  approval: "Approval",
  funded: "Funded",
  lost: "Lost",
  initial_review: "Initial Review",
  moving_to_underwriting: "Moving to UW",
  onboarding: "Onboarding",
  ready_for_wu_approval: "Ready for WU Approval",
  pre_approval_issued: "Pre-Approval Issued",
  won: "Won",
} as const;

/** Copper CRM pipeline names */
export const PIPELINE_NAMES = {
  POTENTIAL: 'Potential',
  UNDERWRITING: 'Underwriting',
  LENDER_MANAGEMENT: 'Lender Management',
} as const;

/**
 * Maps old lead_status enum values to Copper pipeline + stage.
 * Used during the transition period while both models coexist.
 */
export const STATUS_TO_PIPELINE_MAPPING: Record<string, { pipeline: string; stage: string } | null> = {
  discovery:              { pipeline: PIPELINE_NAMES.POTENTIAL, stage: 'Initial Contact' },
  questionnaire:          { pipeline: PIPELINE_NAMES.POTENTIAL, stage: 'Initial Contact' },
  initial_review:         { pipeline: PIPELINE_NAMES.POTENTIAL, stage: 'Initial Contact' },
  pre_qualification:      { pipeline: PIPELINE_NAMES.POTENTIAL, stage: 'In Process - On Hold' },
  onboarding:             { pipeline: PIPELINE_NAMES.POTENTIAL, stage: 'Incoming - On Hold' },
  document_collection:    { pipeline: PIPELINE_NAMES.UNDERWRITING, stage: 'Waiting Needs List Items' },
  moving_to_underwriting: { pipeline: PIPELINE_NAMES.UNDERWRITING, stage: 'Review Kill / Keep' },
  underwriting:           { pipeline: PIPELINE_NAMES.UNDERWRITING, stage: 'Initial Review' },
  ready_for_wu_approval:  { pipeline: PIPELINE_NAMES.UNDERWRITING, stage: 'Waiting Needs List Items' },
  pre_approval_issued:    { pipeline: PIPELINE_NAMES.LENDER_MANAGEMENT, stage: 'Out for Review' },
  approval:               { pipeline: PIPELINE_NAMES.LENDER_MANAGEMENT, stage: 'Out for Approval' },
  funded:                 { pipeline: PIPELINE_NAMES.LENDER_MANAGEMENT, stage: 'Loan Closed' },
  won:                    { pipeline: PIPELINE_NAMES.LENDER_MANAGEMENT, stage: 'Loan Closed' },
  lost:                   null, // Not placed in any pipeline
} as const;
