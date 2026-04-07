# Hooks

35 custom hooks organized by feature domain. All use TanStack React Query for server state.

## Authentication & Authorization
- `useTeamMember` — current user's team member record via `get_current_team_member()` RPC. Returns role, `isOwner`, avatar. 5-min cache.
- `useTeamMemberByName` — lookup team member by name. Queries `team_members` with ilike filter. 10-min cache.

## Pipeline & Deal Management
- `usePipelines` — all pipelines, ordered by `is_main` then name. Also exports `useSystemPipelines()`.
- `usePipelineStages` — stages for a specific pipeline, ordered by position.
- `usePipelineLeads` — leads in a pipeline with nested lead/stage info. Returns `leadsByStage` grouping.
- `useAllPipelineLeads` — all leads across all pipelines. Deduplicates people, aggregates companies.
- `usePipelineMutations` — move/add/remove/bulk-remove leads. Logs to `lead_activities`.
- `useSystemPipelineByName` — system pipeline lookup. Cache: `staleTime: Infinity`.
- `usePipelineColumns` — localStorage-backed column config (visibility, freezing, resizing, reordering).

## Dashboard Hooks (Per Team Member)
- `useSuperAdminDashboard` — revenue targets, pipeline metrics, team performance, referral analytics. Real-time subscriptions.
- `useAdamsDashboard` — Adam's metrics, lender activity, pending term sheets, goals.
- `useBradsDashboard` — Brad's metrics, high-value deals, meetings, referral partners.
- `useMaurasDashboard` — Maura's processing queue, daily progress.
- `useWendysDashboard` — Wendy's follow-ups, daily targets, communication log.

## Gmail & Email
- `useGmail` — low-level Gmail API access via `gmail-api` edge function. Operations: fetchMessages, send, archive, trash, markAsRead.
- `useGmailConnection` — higher-level Gmail connection. OAuth flow, folder queries, send, disconnect.
- `useGmailPeopleSync` — auto-creates leads from unknown Gmail senders. Backfills `pipeline_leads`.
- `useHiddenThreads` — hide/unhide email threads. Queries `hidden_email_threads`.
- `useEvansGmailLogic` — comprehensive Gmail logic for Evan (~900 lines). CRM config, thread selection, lead matching, draft composition.

## Dropbox
- `useDropbox` — file operations via `dropbox-api` edge function: list, upload, delete, move, search, sync, linkToLead.
- `useDropboxConnection` — OAuth popup flow, connection status, connect/disconnect.
- `useDropboxAutoUpload` — auto-upload files to lead-specific Dropbox folders.

## Google Sheets
- `useGoogleSheets` — connection + operations via `google-sheets-auth`/`google-sheets-api` edge functions: list, getData, updateCell, appendRow.

## Data & Tasks
- `useFeedData` — activity stream from 7 sources: lead_activities, notes, communications, tasks, outbound_emails, people activities/notes.
- `useTasksData` — task CRUD with undo support via `UndoContext`. Logs task activities.
- `useLoanVolumeLog` — loan tracking with derived signals: stale_deal, missing_lender, no_clx_agreement, revenue_at_risk, overdue_closing.

## AI & Automation
- `useActionParser` — parses `<action>` XML tags from AI responses. Returns `cleanText` + `actions[]`.
- `useActionExecutor` — executes AI-proposed actions via `evan-ai-assistant` edge function. Supports undo batches.
- `useAIChanges` — AI change history with undo/redo. Queries `ai_agent_changes`/`ai_agent_batches`. Filters by date, user, mode, status, table.

## System
- `useEdgeFunctionWarmup` — pings `twilio-inbound` every 5 minutes (admin users only) to keep function warm.
## Patterns
- All data hooks use `useQuery` with explicit `queryKey` arrays for cache management
- Mutations use `useMutation` with `onSuccess` cache invalidation via `queryClient.invalidateQueries`
- Dashboard hooks set up Supabase real-time subscriptions for live updates
- OAuth hooks (Gmail, Dropbox, Sheets) use popup window flow with `message`/`storage` event listeners
