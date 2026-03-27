# Contexts

Eight React contexts managing global application state. All follow the provider + `useX()` hook pattern.

## Contexts

### AuthContext
- **State**: user, session, userRole, loading
- **Queries**: `user_roles` table via RPC (super_admin > admin priority)
- **Methods**: signIn, signUp, signOut
- **Key details**: Ref-based role caching to prevent stale closures. Distinguishes user-initiated sign-out from server-triggered via `signOutIntentRef`. Visibility change listener for session recovery.
- **Consumer**: `useAuth()`

### CallContext (~920 lines)
- **State**: incomingCall, activeCall, isConnected, isMuted, callDuration, healthStatus, isEvan
- **Tables**: `active_calls`, `call_events`, `communications`
- **Critical**: Mounted at App level for global Twilio Device persistence. **Never move inside Evan's route tree.**
- **Features**: Twilio Device init (ashburn/dublin/singapore edges), 30s keep-warm, ring synthesizer (480/440 Hz), conference bridge fallback, stale call cleanup (2-min threshold), auto-navigate to /admin/calls on incoming
- **Consumer**: `useCall()`

### AIAssistantContext
- **State**: isOpen, messages, currentConversationId, conversations
- **Tables**: `ai_conversations`, `ai_conversation_messages`
- **Methods**: createConversation, loadConversation, saveMessages, deleteConversation, startNewConversation
- **Consumer**: `useAIAssistant()`

### DraftContext
- **State**: composeOpen, composeTo/Subject/Body/LeadId/RecipientName, replyThreadId, savedDrafts
- **Features**: Tracks originating task ID for auto-completion on send. In-memory drafts (no persistence).
- **Consumer**: `useDraft()`

### UndoContext
- **State**: lastAction (id, label, execute, timestamp), isUndoing
- **Methods**: registerUndo, executeUndo, clearUndo
- **Features**: Auto-clear after 30 seconds. Prevents concurrent undo.
- **Consumer**: `useUndo()`

### EvanUIStateContext
- **Methods**: `getPageState<T>(page, defaults)`, `setPageState<T>(page, state)`
- **Features**: Ref-based storage (no re-renders on set). Merged defaults on get. Survives route changes.
- **Consumer**: `useEvanUIState()`

### SplitViewContext
- **State**: isActive, leftPage, rightPage, panelSizes
- **Methods**: toggleSplitView, setLeftPage, setRightPage, swapPanels, exitSplitView
- **Features**: SessionStorage persistence. Auto-disable below 1024px. Exits if URL changes outside split view.
- **Consumer**: `useSplitView()`

### AdminTopBarContext
- **State**: pageTitle, searchComponent, actionsComponent (all ReactNode | null)
- **Purpose**: Pages set their own top bar title, search UI, and action buttons dynamically.
- **Consumer**: `useAdminTopBar()`

## Provider Hierarchy

Providers are nested in `App.tsx`. Order matters:
1. `AuthProvider` (outermost — everything needs auth)
2. `CallProvider` (global for Twilio device persistence)
3. `UndoProvider`, `DraftProvider` (used by admin features)
4. Layout-level: `SplitViewProvider`, `AdminTopBarProvider`, `EvanUIStateProvider`, `AIAssistantProvider`
