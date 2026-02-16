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
