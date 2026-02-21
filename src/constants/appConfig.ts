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
