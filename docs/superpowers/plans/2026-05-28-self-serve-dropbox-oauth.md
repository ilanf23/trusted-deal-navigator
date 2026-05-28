# Self-Serve Dropbox OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each logged-in team member connect their own Dropbox account through OAuth, browse/link their own Dropbox files to People and other CRM records, and prevent Dropbox cache metadata from leaking across users.

**Architecture:** Keep the existing provider-specific Dropbox OAuth table and edge functions, but make `dropbox_files` a user-scoped cache. Frontend entry points all use `useDropboxConnection`, and every Dropbox edge function reads/writes cached metadata through the authenticated Supabase `authUserId`.

**Tech Stack:** React 18, TypeScript, TanStack Query, Supabase Postgres/RLS, Supabase Edge Functions on Deno, Dropbox OAuth/API.

---

## File Structure

- Create `supabase/migrations/20260528183000_scope_dropbox_files_by_user.sql`
  - Adds `dropbox_files.user_id`, backfills/cleans existing cache data, replaces global uniqueness, adds user-scoped indexes, and updates RLS.
- Modify `src/integrations/supabase/types.ts`
  - Adds `user_id` to generated `dropbox_files` types so TypeScript builds before schema regeneration.
- Modify `src/hooks/useDropboxConnection.ts`
  - Makes popup opening browser-safe, supports `/admin` and `/superadmin` callback paths, invalidates Dropbox queries after connect/disconnect.
- Modify `src/pages/admin/DropboxCallback.tsx`
  - Uses stored return path/callback URL so `/superadmin/dropbox` returns correctly.
- Modify `src/pages/admin/Dropbox.tsx`
  - Removes the direct table precheck and lets `DropboxBrowser` render the Connect Dropbox empty state.
- Modify `src/components/admin/DropboxBrowser.tsx`
  - Resets local navigation/search state on disconnect and relies on user-scoped query keys.
- Modify `src/hooks/useDropbox.ts`
  - Adds the current user id to query keys and filters direct `dropbox_files` reads by `user_id`.
- Modify `src/hooks/useDropboxAutoUpload.ts`
  - Sends entity-neutral upload metadata while preserving existing behavior.
- Modify `src/components/admin/files/AddFileDialog.tsx`
  - Adds a Connect Dropbox CTA in the Dropbox tab, scopes Dropbox query keys by current user, and sends entity-neutral auto-upload metadata.
- Modify `src/components/admin/settings/IntegrationsSection.tsx`
  - Replaces the mislabeled Google Drive/Dropbox card with a real Dropbox integration card.
- Modify `supabase/functions/dropbox-auth/index.ts`
  - Clears only the current user's cache on connect/disconnect.
- Modify `supabase/functions/dropbox-mutations/index.ts`
  - Writes `user_id` into cache rows and filters cache mutations by `user_id`.
- Modify `supabase/functions/dropbox-search/index.ts`
  - Filters all DB search/update paths by `authUserId`.
- Modify `supabase/functions/dropbox-sync/index.ts`
  - Syncs the authenticated user's connection for manual sync and all active connections for webhook-triggered sync.
- Modify `supabase/functions/dropbox-webhook/index.ts`
  - Triggers user-safe all-connection incremental sync.
- Update docs if behavior text references manual Dropbox setup:
  - `docs/business-requirements/sales-rep/dropbox.md`
  - `docs/business-requirements/sales-rep/expanded-view-files.md`

---

### Task 1: Add User-Scoped Dropbox Cache Schema

**Files:**
- Create: `supabase/migrations/20260528183000_scope_dropbox_files_by_user.sql`
- Modify: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260528183000_scope_dropbox_files_by_user.sql` with this exact content:

```sql
-- Scope Dropbox metadata cache rows to the Supabase auth user whose Dropbox
-- account produced them. Existing rows are only cache data, not canonical CRM
-- attachments, so ambiguous unscoped rows are removed.

ALTER TABLE public.dropbox_files
  ADD COLUMN IF NOT EXISTS user_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dropbox_files_user_id_fkey'
      AND conrelid = 'public.dropbox_files'::regclass
  ) THEN
    ALTER TABLE public.dropbox_files
      ADD CONSTRAINT dropbox_files_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

WITH connection_owner AS (
  SELECT count(*) AS connection_count, min(user_id) AS only_user_id
  FROM public.dropbox_connections
)
UPDATE public.dropbox_files AS f
SET user_id = c.only_user_id
FROM connection_owner AS c
WHERE f.user_id IS NULL
  AND c.connection_count = 1
  AND c.only_user_id IS NOT NULL;

DELETE FROM public.dropbox_files
WHERE user_id IS NULL;

ALTER TABLE public.dropbox_files
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.dropbox_files
  VALIDATE CONSTRAINT dropbox_files_user_id_fkey;

ALTER TABLE public.dropbox_files
  DROP CONSTRAINT IF EXISTS dropbox_files_dropbox_id_key;

DROP INDEX IF EXISTS public.idx_dropbox_files_path;
DROP INDEX IF EXISTS public.idx_dropbox_files_lead;
DROP INDEX IF EXISTS public.idx_dropbox_files_extraction;

CREATE UNIQUE INDEX IF NOT EXISTS dropbox_files_user_dropbox_id_key
  ON public.dropbox_files (user_id, dropbox_id);

CREATE INDEX IF NOT EXISTS idx_dropbox_files_user_id
  ON public.dropbox_files (user_id);

CREATE INDEX IF NOT EXISTS idx_dropbox_files_user_path
  ON public.dropbox_files (user_id, dropbox_path);

CREATE INDEX IF NOT EXISTS idx_dropbox_files_user_lead
  ON public.dropbox_files (user_id, lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dropbox_files_user_extraction
  ON public.dropbox_files (user_id, extraction_status)
  WHERE extraction_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_dropbox_files_fts
  ON public.dropbox_files
  USING gin(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(extracted_text,'')));

DROP POLICY IF EXISTS "Authenticated users can view own dropbox files" ON public.dropbox_files;
DROP POLICY IF EXISTS "Authenticated users can insert own dropbox files" ON public.dropbox_files;
DROP POLICY IF EXISTS "Authenticated users can update own dropbox files" ON public.dropbox_files;
DROP POLICY IF EXISTS "Authenticated users can delete own dropbox files" ON public.dropbox_files;
DROP POLICY IF EXISTS "Admins can view dropbox files" ON public.dropbox_files;
DROP POLICY IF EXISTS "Admins can manage dropbox files" ON public.dropbox_files;

CREATE POLICY "Authenticated users can view own dropbox files"
  ON public.dropbox_files
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Authenticated users can insert own dropbox files"
  ON public.dropbox_files
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Authenticated users can update own dropbox files"
  ON public.dropbox_files
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Authenticated users can delete own dropbox files"
  ON public.dropbox_files
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admins can view dropbox files"
  ON public.dropbox_files
  FOR SELECT
  TO authenticated
  USING (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'super_admin'::app_role)
  );

CREATE POLICY "Admins can manage dropbox files"
  ON public.dropbox_files
  FOR ALL
  TO authenticated
  USING (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'super_admin'::app_role)
  )
  WITH CHECK (
    has_role((SELECT auth.uid()), 'admin'::app_role)
    OR has_role((SELECT auth.uid()), 'super_admin'::app_role)
  );
```

- [ ] **Step 2: Update generated TypeScript shape for `dropbox_files`**

In `src/integrations/supabase/types.ts`, locate `dropbox_files` and add `user_id` to Row, Insert, and Update. The final `dropbox_files` type block must include these fields:

```ts
      dropbox_files: {
        Row: {
          content_hash: string | null
          created_at: string | null
          dropbox_id: string
          dropbox_path: string
          dropbox_path_display: string
          dropbox_rev: string | null
          extracted_at: string | null
          extracted_text: string | null
          extraction_error: string | null
          extraction_status: string | null
          id: string
          is_folder: boolean
          lead_id: string | null
          lead_name: string | null
          mime_type: string | null
          modified_at: string | null
          name: string
          size: number | null
          synced_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string | null
          dropbox_id: string
          dropbox_path: string
          dropbox_path_display: string
          dropbox_rev?: string | null
          extracted_at?: string | null
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          id?: string
          is_folder?: boolean
          lead_id?: string | null
          lead_name?: string | null
          mime_type?: string | null
          modified_at?: string | null
          name: string
          size?: number | null
          synced_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string | null
          dropbox_id?: string
          dropbox_path?: string
          dropbox_path_display?: string
          dropbox_rev?: string | null
          extracted_at?: string | null
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_status?: string | null
          id?: string
          is_folder?: boolean
          lead_id?: string | null
          lead_name?: string | null
          mime_type?: string | null
          modified_at?: string | null
          name?: string
          size?: number | null
          synced_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dropbox_files_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dropbox_files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["user_id"]
          },
        ]
      }
```

If the surrounding generated file has the same columns in a different order, preserve the existing order and add `user_id` consistently.

- [ ] **Step 3: Run a build check**

Run: `npm run build`

Expected: TypeScript compiles. A failure mentioning `dropbox_files.user_id` means the type block was not updated consistently.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260528183000_scope_dropbox_files_by_user.sql src/integrations/supabase/types.ts
git commit -m "feat(dropbox): scope cached files by user"
```

---

### Task 2: Fix Dropbox OAuth Hook And Callback Routing

**Files:**
- Modify: `src/hooks/useDropboxConnection.ts`
- Modify: `src/pages/admin/DropboxCallback.tsx`

- [ ] **Step 1: Update `useDropboxConnection` imports**

Change the imports at the top of `src/hooks/useDropboxConnection.ts` to include React Query and auth:

```ts
import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMember } from '@/hooks/useTeamMember';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
```

- [ ] **Step 2: Add query invalidation and path helpers**

Inside `useDropboxConnection`, directly after `const { teamMember } = useTeamMember();`, add:

```ts
  const { user } = useAuth();
  const queryClient = useQueryClient();
```

Then add these callbacks before `checkStatus`:

```ts
  const invalidateDropboxQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dropbox-connection-status'] });
    queryClient.invalidateQueries({ queryKey: ['dropbox-setup-check'] });
    queryClient.invalidateQueries({ queryKey: ['dropbox-files'] });
    queryClient.invalidateQueries({ queryKey: ['dropbox-files-recursive'] });
    queryClient.invalidateQueries({ queryKey: ['dropbox-photos-db'] });
    queryClient.invalidateQueries({ queryKey: ['dropbox-shared'] });
    queryClient.invalidateQueries({ queryKey: ['add-file-dropbox-list-recursive'] });
  }, [queryClient]);

  const getDropboxPaths = useCallback(() => {
    const prefix = window.location.pathname.startsWith('/superadmin') ? '/superadmin' : '/admin';
    return {
      callbackUrl: `${window.location.origin}${prefix}/dropbox/callback`,
      returnPath: `${prefix}/dropbox`,
    };
  }, []);
```

- [ ] **Step 3: Invalidate queries after status changes**

In both `DROPBOX_CONNECTED` handlers, after `checkStatus();`, add:

```ts
            invalidateDropboxQueries();
```

For the `postMessage` handler, the block becomes:

```ts
      if (event.data?.type === 'DROPBOX_CONNECTED') {
        setIsConnected(true);
        setConnectedEmail(event.data.email);
        setConnectedBy(teamMember?.name || null);
        toast.success('Dropbox connected successfully');
        checkStatus();
        invalidateDropboxQueries();
      } else if (event.data?.type === 'DROPBOX_ERROR') {
        toast.error(event.data.error || 'Dropbox connection failed');
      }
```

Update the effect dependency list to:

```ts
  }, [teamMember, checkStatus, invalidateDropboxQueries]);
```

- [ ] **Step 4: Replace `connect` to open a popup synchronously**

Replace the current `connect` callback with:

```ts
  const connect = useCallback(async () => {
    const { callbackUrl, returnPath } = getDropboxPaths();
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      'about:blank',
      'dropbox-oauth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    if (!popup) {
      toast.error('Popup blocked. Please allow popups for this site.');
      return;
    }

    try {
      popup.document.write(
        '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui"><p>Connecting to Dropbox...</p></body></html>'
      );

      localStorage.setItem('dropboxCallbackUrl', callbackUrl);
      localStorage.setItem('dropboxReturnPath', returnPath);
      if (teamMember?.name) {
        localStorage.setItem('dropboxTeamMember', teamMember.name);
      }

      const { data, error } = await supabase.functions.invoke('dropbox-auth', {
        body: {
          action: 'getAuthUrl',
          redirectUri: callbackUrl,
          teamMemberName: teamMember?.name,
        },
      });

      if (error) throw error;
      if (!data?.authUrl) throw new Error('Missing Dropbox auth URL');

      popup.location.href = data.authUrl;
    } catch (err) {
      popup.close();
      console.error('Failed to start Dropbox OAuth:', err);
      toast.error('Failed to start Dropbox connection');
    }
  }, [getDropboxPaths, teamMember]);
```

- [ ] **Step 5: Invalidate after disconnect**

Inside `disconnect`, after `toast.success('Dropbox disconnected');`, add:

```ts
      invalidateDropboxQueries();
```

Update the dependency array to:

```ts
  }, [invalidateDropboxQueries]);
```

- [ ] **Step 6: Use `user?.id` in `checkStatus` dependencies**

Change the `checkStatus` dependency array to:

```ts
  }, [user?.id]);
```

This forces a fresh status check when auth users switch.

- [ ] **Step 7: Update Dropbox callback return routing**

In `src/pages/admin/DropboxCallback.tsx`, add:

```ts
const getReturnPath = () => {
  const storedPath = localStorage.getItem('dropboxReturnPath');
  if (storedPath) return storedPath;
  return window.location.pathname.startsWith('/superadmin')
    ? '/superadmin/dropbox'
    : '/admin/dropbox';
};
```

Replace each `navigate('/admin/dropbox')` call in `closeOrRedirect` with:

```ts
            if (!window.closed) navigate(getReturnPath());
```

and:

```ts
          navigate(getReturnPath());
```

After the existing `localStorage.removeItem('dropboxTeamMember');`, add:

```ts
        localStorage.removeItem('dropboxReturnPath');
```

- [ ] **Step 8: Run build**

Run: `npm run build`

Expected: TypeScript compiles. A failure mentioning a stale hook dependency means the dependency arrays do not match the new callbacks.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useDropboxConnection.ts src/pages/admin/DropboxCallback.tsx
git commit -m "fix(dropbox): make oauth callback self serve"
```

---

### Task 3: Expose Connect Dropbox In The UI

**Files:**
- Modify: `src/pages/admin/Dropbox.tsx`
- Modify: `src/components/admin/files/AddFileDialog.tsx`
- Modify: `src/components/admin/settings/IntegrationsSection.tsx`
- Modify: `src/components/admin/DropboxBrowser.tsx`

- [ ] **Step 1: Simplify `Dropbox.tsx`**

Replace `src/pages/admin/Dropbox.tsx` with:

```tsx
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import { DropboxBrowser } from '@/components/admin/DropboxBrowser';
import { usePageDatabases } from '@/hooks/usePageDatabases';

const Dropbox = () => {
  usePageDatabases([
    { table: 'dropbox_connections', access: 'read', usage: 'Checks whether the current user has linked a personal Dropbox account.', via: 'dropbox-auth getStatus via useDropboxConnection' },
    { table: 'dropbox_files', access: 'readwrite', usage: 'Per-user file metadata cache used by DropboxBrowser to list/search/move/delete.', via: 'src/hooks/useDropbox.ts via DropboxBrowser' },
    { table: 'dropbox-files / dropbox-mutations / dropbox-search', access: 'rpc', usage: 'Edge functions proxy to Dropbox API and DB search (routed by src/lib/dropboxRouter.ts).', via: 'src/hooks/useDropbox.ts' },
    { table: 'dropbox-auth', access: 'rpc', usage: 'Edge function handling Dropbox OAuth connect flow.', via: 'src/hooks/useDropboxConnection.ts' },
  ]);

  return (
    <EmployeeLayout>
      <div className="h-[calc(100vh-4rem)] -mr-4 -mb-4 sm:-mr-6 sm:-mb-6 md:-mr-8 md:-mb-8">
        <DropboxBrowser />
      </div>
    </EmployeeLayout>
  );
};

export default Dropbox;
```

- [ ] **Step 2: Reset browser state after disconnect**

In `src/components/admin/DropboxBrowser.tsx`, import `useEffect`:

```ts
import { useState, useRef, useCallback, useEffect } from 'react';
```

After dialog state declarations and before `const fileInputRef`, add:

```ts
  useEffect(() => {
    if (isConnected) return;
    setCurrentPath('');
    setActiveSection('home');
    setSelectedEntry(null);
    setSearchQuery('');
  }, [isConnected]);
```

- [ ] **Step 3: Add Dropbox connection hook to `AddFileDialog`**

In `src/components/admin/files/AddFileDialog.tsx`, add imports:

```ts
import { useAuth } from '@/contexts/AuthContext';
import { useDropboxConnection } from '@/hooks/useDropboxConnection';
```

Inside the component, after `const { teamMember } = useTeamMember();`, add:

```ts
  const { user } = useAuth();
  const {
    isConnected: dropboxHookConnected,
    loading: dropboxConnectionLoading,
    connect: connectDropbox,
    refreshStatus: refreshDropboxStatus,
  } = useDropboxConnection();
```

- [ ] **Step 4: Scope AddFileDialog Dropbox query keys**

Replace the Dropbox status query with:

```ts
  const { data: dropboxStatus } = useQuery({
    queryKey: ['dropbox-connection-status', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('dropbox-auth', {
        body: { action: 'getStatus' },
      });
      if (error) return { connected: false };
      return { connected: data?.connected ?? false };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
  const dropboxConnected = dropboxHookConnected || !!dropboxStatus?.connected;
```

Replace the Dropbox files query key with:

```ts
    queryKey: ['add-file-dropbox-list-recursive', user?.id],
```

- [ ] **Step 5: Add the Connect Dropbox CTA in the Dropbox tab**

Replace the disconnected Dropbox tab block with:

```tsx
            {!dropboxConnected ? (
              <div className="rounded-md border border-border p-6 text-center text-sm text-muted-foreground space-y-3">
                <p>Connect Dropbox to pick files from your account.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    connectDropbox();
                    setTimeout(() => {
                      refreshDropboxStatus();
                    }, 1500);
                  }}
                  disabled={dropboxConnectionLoading}
                >
                  {dropboxConnectionLoading ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Cloud className="mr-2 h-3.5 w-3.5" />
                  )}
                  Connect Dropbox
                </Button>
              </div>
```

Keep the connected `else` branch unchanged.

- [ ] **Step 6: Update Settings integration card types**

In `src/components/admin/settings/IntegrationsSection.tsx`, change `IntegrationCard` to:

```ts
interface IntegrationCard {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  status: 'connected' | 'available' | 'coming-soon' | 'managed';
  connectAction?: () => void;
  configureAction?: () => void;
  disconnectAction?: () => void;
}
```

In `Card`, replace the connected button block with:

```tsx
        {status === 'connected' ? (
          <>
            <Button size="sm" variant="outline" className="flex-1" onClick={card.configureAction}>
              Configure
            </Button>
            {card.disconnectAction && (
              <Button size="sm" variant="ghost" onClick={card.disconnectAction}>
                Disconnect
              </Button>
            )}
          </>
```

- [ ] **Step 7: Use `useDropboxConnection` in Settings**

In `IntegrationsSection`, add this after `const { teamMember, isOwner } = useTeamMember();`:

```ts
  const dropboxConnection = useDropboxConnection();
```

Add the import:

```ts
import { useDropboxConnection } from '@/hooks/useDropboxConnection';
```

Replace the card currently using `id: 'drive'` and `name: 'Google Drive'` with:

```ts
    {
      id: 'dropbox',
      name: 'Dropbox',
      description: 'Connect your Dropbox account to browse files and link documents to CRM records.',
      icon: HardDrive,
      color: '#0061ff',
      status: dropboxConnection.isConnected ? 'connected' : 'available',
      connectAction: dropboxConnection.connect,
      configureAction: () => navigate('/admin/dropbox'),
      disconnectAction: dropboxConnection.disconnect,
    },
```

- [ ] **Step 8: Run build**

Run: `npm run build`

Expected: TypeScript compiles.

- [ ] **Step 9: Commit**

```bash
git add src/pages/admin/Dropbox.tsx src/components/admin/DropboxBrowser.tsx src/components/admin/files/AddFileDialog.tsx src/components/admin/settings/IntegrationsSection.tsx
git commit -m "feat(dropbox): expose self serve connection UI"
```

---

### Task 4: Scope Frontend Dropbox Hooks By User

**Files:**
- Modify: `src/hooks/useDropbox.ts`
- Modify: `src/hooks/useDropboxAutoUpload.ts`
- Modify: `src/components/admin/files/AddFileDialog.tsx`

- [ ] **Step 1: Import `useAuth` in `useDropbox.ts`**

Add:

```ts
import { useAuth } from '@/contexts/AuthContext';
```

- [ ] **Step 2: Add user id to Dropbox list query keys**

Update `useDropboxList`:

```ts
export function useDropboxList(path: string, enabled = true) {
  const { user } = useAuth();
  return useQuery<ListResult>({
    queryKey: ['dropbox-files', user?.id, path],
    queryFn: () => invokeDropboxApi('list', { path: path || '' }),
    staleTime: 30_000,
    enabled: enabled && !!user?.id,
  });
}
```

Update `useDropboxListRecursive`:

```ts
export function useDropboxListRecursive(enabled = false, includeDeleted = false, fileExtensions?: string[]) {
  const { user } = useAuth();
  return useQuery<{ entries: DropboxEntry[] }>({
    queryKey: ['dropbox-files-recursive', user?.id, includeDeleted, fileExtensions ?? null],
    queryFn: () => invokeDropboxApi('list-recursive', {
      path: '',
      include_deleted: includeDeleted,
      ...(fileExtensions?.length ? { file_extensions: fileExtensions } : {}),
    }),
    staleTime: 300_000,
    enabled: enabled && !!user?.id,
  });
}
```

- [ ] **Step 3: Filter direct DB photo reads by user**

Replace `useDropboxPhotosFromDB` with:

```ts
export function useDropboxPhotosFromDB(enabled = false) {
  const { user } = useAuth();
  return useQuery<{ entries: DropboxEntry[] }>({
    queryKey: ['dropbox-photos-db', user?.id],
    queryFn: async () => {
      if (!user?.id) return { entries: [] };
      const orFilter = PHOTO_EXTENSIONS.map(ext => `name.ilike.%.${ext}`).join(',');
      const { data, error } = await supabase
        .from('dropbox_files')
        .select('*, lead:pipeline(name)')
        .eq('user_id', user.id)
        .eq('is_folder', false)
        .or(orFilter)
        .order('modified_at', { ascending: false })
        .limit(1000);
      if (error) throw new Error(error.message);
      const entries: DropboxEntry[] = (data || []).map(row => ({
        '.tag': 'file' as const,
        id: row.dropbox_id,
        name: row.name,
        path_lower: row.dropbox_path,
        path_display: row.dropbox_path_display,
        size: row.size ?? undefined,
        server_modified: row.modified_at ?? undefined,
        rev: row.dropbox_rev ?? undefined,
        content_hash: row.content_hash ?? undefined,
        lead_id: row.lead_id ?? undefined,
        lead_name: (row as any).lead?.name ?? undefined,
        extraction_status: row.extraction_status ?? undefined,
      }));
      return { entries };
    },
    staleTime: 300_000,
    gcTime: 600_000,
    enabled: enabled && !!user?.id,
  });
}
```

- [ ] **Step 4: Add user id to shared and search query keys**

Replace `useDropboxShared` with:

```ts
export function useDropboxShared(enabled = false) {
  const { user } = useAuth();
  return useQuery<{ entries: DropboxEntry[] }>({
    queryKey: ['dropbox-shared', user?.id],
    queryFn: () => invokeDropboxApi('list-shared'),
    staleTime: 300_000,
    enabled: enabled && !!user?.id,
  });
}
```

Replace `useDropboxSearch` with:

```ts
export function useDropboxSearch(query: string, leadId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dropbox-search', user?.id, query, leadId],
    queryFn: () => invokeDropboxApi('search-content', { query, leadId }),
    enabled: !!user?.id && query.length >= 2,
    staleTime: 10_000,
  });
}
```

- [ ] **Step 5: Update auto-upload hook signature**

Replace `src/hooks/useDropboxAutoUpload.ts` with:

```ts
import { useCallback } from 'react';
import { invokeDropboxApi } from './useDropbox';
import type { EntityType } from '@/components/admin/files/types';

interface DropboxAutoUploadTarget {
  entityId: string;
  entityName: string;
  entityType: EntityType;
  companyName?: string;
}

export function useDropboxAutoUpload(enabled: boolean) {
  const syncToDropbox = useCallback(async (
    file: File,
    target: DropboxAutoUploadTarget,
  ) => {
    if (!enabled) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const content = btoa(binary);

      await invokeDropboxApi('upload-to-lead-folder', {
        entityId: target.entityId,
        entityName: target.entityName,
        entityType: target.entityType,
        companyName: target.companyName || '',
        fileName: file.name,
        content,
      });
    } catch (err) {
      console.warn('Dropbox auto-sync failed:', err);
      throw err;
    }
  }, [enabled]);

  return { syncToDropbox };
}
```

- [ ] **Step 6: Pass entity-neutral data to Dropbox auto-upload**

In `src/components/admin/files/AddFileDialog.tsx`, replace:

```ts
          syncPromises.push(syncToDropbox(file, entityName, companyName || '', entityId));
```

with:

```ts
          syncPromises.push(syncToDropbox(file, {
            entityId,
            entityName,
            entityType,
            companyName: companyName || '',
          }));
```

- [ ] **Step 7: Run build**

Run: `npm run build`

Expected: TypeScript compiles. A failure in `AddFileDialog` means the call signature and the hook signature do not match.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useDropbox.ts src/hooks/useDropboxAutoUpload.ts src/components/admin/files/AddFileDialog.tsx
git commit -m "fix(dropbox): scope frontend queries by user"
```

---

### Task 5: Scope Dropbox Auth, Mutations, And Search Edge Functions

**Files:**
- Modify: `supabase/functions/dropbox-auth/index.ts`
- Modify: `supabase/functions/dropbox-mutations/index.ts`
- Modify: `supabase/functions/dropbox-search/index.ts`

- [ ] **Step 1: Clear only the current user's cache on connect**

In `dropbox-auth/index.ts`, after deleting the current user's existing connection and before inserting the new row, add:

```ts
      await supabaseAdmin
        .from('dropbox_files')
        .delete()
        .eq('user_id', userId);
```

- [ ] **Step 2: Clear only the current user's cache on disconnect**

In `dropbox-auth/index.ts`, after the successful `dropbox_connections` delete and before returning success, add:

```ts
      await supabaseAdmin
        .from('dropbox_files')
        .delete()
        .eq('user_id', userId);
```

- [ ] **Step 3: Pass `authUserId` into mutation handlers**

In `dropbox-mutations/index.ts`, change handler signatures:

```ts
async function handleUpload(accessToken: string, body: any, supabase: any, userId: string) {
```

```ts
async function handleMove(accessToken: string, body: any, supabase: any, userId: string) {
```

```ts
async function handleDelete(accessToken: string, body: any, supabase: any, userId: string) {
```

```ts
async function handleUploadToLeadFolder(accessToken: string, body: any, supabase: any, userId: string) {
```

Then, before the switch, add:

```ts
    const userId = authResult.auth.authUserId;
```

Update switch calls:

```ts
      case 'upload':
        result = await handleUpload(accessToken, body, supabaseAdmin, userId);
        break;
      case 'upload-to-lead-folder':
        result = await handleUploadToLeadFolder(accessToken, body, supabaseAdmin, userId);
        break;
      case 'move':
      case 'rename':
        result = await handleMove(accessToken, body, supabaseAdmin, userId);
        break;
      case 'delete':
        result = await handleDelete(accessToken, body, supabaseAdmin, userId);
        break;
```

- [ ] **Step 4: Add `user_id` to mutation cache writes**

In `handleUpload`, include `user_id: userId` in the upsert object and change the conflict target:

```ts
        user_id: userId,
        dropbox_id: metadata.id,
```

```ts
      { onConflict: 'user_id,dropbox_id' }
```

In `handleMove`, add `.eq('user_id', userId)` before `.eq('dropbox_path', from_path.toLowerCase())`.

In `handleDelete`, add `.eq('user_id', userId)` before `.eq('dropbox_path', path.toLowerCase())`.

- [ ] **Step 5: Make auto-upload entity neutral**

At the top of `dropbox-mutations/index.ts`, after constants, add:

```ts
const ENTITY_FOLDER_ROOTS: Record<string, string> = {
  people: 'People',
  companies: 'Companies',
  lender_programs: 'Lender Programs',
  potential: 'Leads',
  underwriting: 'Leads',
  lender_management: 'Leads',
  pipeline: 'Leads',
};
```

Replace the first lines of `handleUploadToLeadFolder` with:

```ts
  const entityId = body.entityId || body.leadId;
  const entityName = body.entityName || body.leadName;
  const entityType = body.entityType || 'potential';
  const { companyName, fileName, content } = body;

  if (!entityName || !entityId || !fileName || !content) {
    throw new Error('Missing required fields: entityName, entityId, fileName, content');
  }

  const sanitizedCompany = companyName ? sanitizeDropboxPath(companyName) : '';
  const sanitizedEntity = sanitizeDropboxPath(entityName);
  const folderName = sanitizedCompany
    ? `${sanitizedCompany} - ${sanitizedEntity}`
    : sanitizedEntity;
  const rootFolder = ENTITY_FOLDER_ROOTS[entityType] || 'Records';
  const folderPath = `/${rootFolder}/${folderName}`;
```

In the final upsert object, include:

```ts
        user_id: userId,
```

and replace the legacy lead fields with:

```ts
        ...(entityType === 'potential' || entityType === 'underwriting' || entityType === 'lender_management' || body.leadId
          ? { lead_id: entityId, lead_name: entityName }
          : {}),
```

Change the conflict target to:

```ts
      { onConflict: 'user_id,dropbox_id' }
```

- [ ] **Step 6: Filter `dropbox-search` by current user**

In `dropbox-search/index.ts`, change:

```ts
async function handleLinkToLead(body: any, supabase: any) {
```

to:

```ts
async function handleLinkToLead(body: any, supabase: any, userId: string) {
```

Add `.eq('user_id', userId)` before `.eq('id', fileId)` in the update chain.

Change:

```ts
async function handleSearchContent(body: any, supabase: any) {
```

to:

```ts
async function handleSearchContent(body: any, supabase: any, userId: string) {
```

In the search query chain, add `.eq('user_id', userId)` immediately after `.from('dropbox_files')...select(...)`:

```ts
    .eq('user_id', userId)
```

Before the switch, add:

```ts
    const userId = authResult.auth.authUserId;
```

Update switch calls:

```ts
      case 'link-to-lead':
        result = await handleLinkToLead(body, supabaseAdmin, userId);
        break;
      case 'search-content':
        result = await handleSearchContent(body, supabaseAdmin, userId);
        break;
```

- [ ] **Step 7: Run build**

Run: `npm run build`

Expected: Vite build passes. Edge function TypeScript is not fully checked by Vite, so syntax errors in Deno files are caught in deploy or by manual review.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/dropbox-auth/index.ts supabase/functions/dropbox-mutations/index.ts supabase/functions/dropbox-search/index.ts
git commit -m "fix(dropbox): scope edge cache mutations by user"
```

---

### Task 6: Make Dropbox Sync And Webhook User-Safe

**Files:**
- Modify: `supabase/functions/dropbox-sync/index.ts`
- Modify: `supabase/functions/dropbox-webhook/index.ts`

- [ ] **Step 1: Add `user_id` to the connection type**

In `dropbox-sync/index.ts`, update `DropboxConnection`:

```ts
interface DropboxConnection {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  cursor: string | null;
}
```

- [ ] **Step 2: Replace arbitrary connection lookup**

Replace `getConnection` with:

```ts
async function getConnectionForUser(supabaseAdmin: any, userId: string): Promise<DropboxConnection> {
  const { data, error } = await supabaseAdmin
    .from('dropbox_connections')
    .select('id, user_id, access_token, refresh_token, token_expiry, cursor')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('No Dropbox connection found');
  }

  return data as DropboxConnection;
}

async function getAllConnections(supabaseAdmin: any): Promise<DropboxConnection[]> {
  const { data, error } = await supabaseAdmin
    .from('dropbox_connections')
    .select('id, user_id, access_token, refresh_token, token_expiry, cursor')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error('Failed to fetch Dropbox connections');
  }

  return (data || []) as DropboxConnection[];
}
```

- [ ] **Step 3: Add `userId` to cache processing**

Change `processEntries` signature:

```ts
async function processEntries(
  entries: DropboxEntry[],
  supabaseAdmin: any,
  userId: string,
): Promise<number> {
```

In both file and folder upsert objects, include:

```ts
            user_id: userId,
```

In both upsert calls, change conflict target to:

```ts
          { onConflict: 'user_id,dropbox_id' },
```

In the deleted branch, add `.eq('user_id', userId)` before `.eq('dropbox_path', entry.path_lower)`.

- [ ] **Step 4: Split full sync into connection-specific logic**

Change the handler signature:

```ts
async function handleFullSync(connection: DropboxConnection, supabaseAdmin: any): Promise<{ synced: number; cursor: string | null; has_more: boolean }> {
```

Inside the function, remove `const connection = await getConnection(supabaseAdmin);`.

Change both `processEntries` calls:

```ts
  totalSynced += await processEntries(result.entries, supabaseAdmin, connection.user_id);
```

Return a plain object instead of `Response`:

```ts
  return { synced: totalSynced, cursor, has_more: false };
```

- [ ] **Step 5: Split incremental sync into connection-specific logic**

Change the handler signature:

```ts
async function handleIncrementalSync(connection: DropboxConnection, supabaseAdmin: any): Promise<{ changes: number; cursor: string | null; has_more: boolean; skipped?: boolean }> {
```

Inside the function, remove `const connection = await getConnection(supabaseAdmin);`.

Replace the no-cursor response with:

```ts
    return { changes: 0, cursor: null, has_more: false, skipped: true };
```

Change `processEntries`:

```ts
  const changes = await processEntries(result.entries, supabaseAdmin, connection.user_id);
```

Return a plain object:

```ts
  return { changes, cursor: result.cursor, has_more: result.has_more };
```

- [ ] **Step 6: Scope text extraction to one connection**

Change the handler signature:

```ts
async function handleExtractText(connection: DropboxConnection, supabaseAdmin: any): Promise<Response> {
```

Remove `const connection = await getConnection(supabaseAdmin);`.

Add the user filter to the pending files query:

```ts
    .eq('user_id', connection.user_id)
```

- [ ] **Step 7: Support service-role webhook sync safely**

In the main `Deno.serve` body, replace:

```ts
    const authResult = await requireAdmin(req, supabaseAdmin, { corsHeaders });
    if (!authResult.ok) return authResult.response;

    const { action } = await req.json();
```

with:

```ts
    const { action } = await req.json();
    const authHeader = req.headers.get('Authorization') || '';
    const bearer = authHeader.replace('Bearer ', '');
    const isServiceRole = bearer === SUPABASE_SERVICE_ROLE_KEY;

    let authUserId: string | null = null;
    if (!isServiceRole) {
      const authResult = await requireAdmin(req, supabaseAdmin, { corsHeaders });
      if (!authResult.ok) return authResult.response;
      authUserId = authResult.auth.authUserId;
    }
```

Replace the action handling with:

```ts
    if (action === 'full-sync') {
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'full-sync requires a user session' }), {
          status: 401,
          headers: corsHeaders,
        });
      }
      const connection = await getConnectionForUser(supabaseAdmin, authUserId);
      const result = await handleFullSync(connection, supabaseAdmin);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }

    if (action === 'incremental-sync') {
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'incremental-sync requires a user session' }), {
          status: 401,
          headers: corsHeaders,
        });
      }
      const connection = await getConnectionForUser(supabaseAdmin, authUserId);
      const result = await handleIncrementalSync(connection, supabaseAdmin);
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }

    if (action === 'incremental-sync-all') {
      if (!isServiceRole) {
        return new Response(JSON.stringify({ error: 'incremental-sync-all requires service role' }), {
          status: 403,
          headers: corsHeaders,
        });
      }
      const connections = await getAllConnections(supabaseAdmin);
      const results = [];
      for (const connection of connections) {
        try {
          const result = await handleIncrementalSync(connection, supabaseAdmin);
          results.push({ userId: connection.user_id, success: true, ...result });
        } catch (error) {
          results.push({
            userId: connection.user_id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      return new Response(JSON.stringify({ processed: results.length, results }), { headers: corsHeaders });
    }

    if (action === 'extract-text') {
      if (!authUserId) {
        return new Response(JSON.stringify({ error: 'extract-text requires a user session' }), {
          status: 401,
          headers: corsHeaders,
        });
      }
      const connection = await getConnectionForUser(supabaseAdmin, authUserId);
      return await handleExtractText(connection, supabaseAdmin);
    }
```

Change the invalid action response text to:

```ts
      JSON.stringify({ error: 'Invalid action. Use: full-sync, incremental-sync, incremental-sync-all, extract-text' }),
```

- [ ] **Step 8: Update webhook action**

In `supabase/functions/dropbox-webhook/index.ts`, replace:

```ts
        body: JSON.stringify({ action: 'incremental-sync' }),
```

with:

```ts
        body: JSON.stringify({ action: 'incremental-sync-all' }),
```

- [ ] **Step 9: Run build**

Run: `npm run build`

Expected: Frontend build passes. Deno function syntax is validated during deploy.

- [ ] **Step 10: Commit**

```bash
git add supabase/functions/dropbox-sync/index.ts supabase/functions/dropbox-webhook/index.ts
git commit -m "fix(dropbox): sync cached files per user"
```

---

### Task 7: Documentation And Verification

**Files:**
- Modify: `docs/business-requirements/sales-rep/dropbox.md`
- Modify: `docs/business-requirements/sales-rep/expanded-view-files.md`

- [ ] **Step 1: Update Dropbox business docs**

In `docs/business-requirements/sales-rep/dropbox.md`, replace the known gap:

```md
- New reps require manual OAuth setup by the dev — there's no self-serve config currently
```

with:

```md
- New reps connect Dropbox through self-serve OAuth from Dropbox, Settings, or the Add file dialog.
```

Replace:

```md
- If no connection exists, the page shows a *Manual Setup Required* card asking to contact the dev
```

with:

```md
- If no connection exists, the page shows a Connect Dropbox empty state.
```

Add this rule under key business rules:

```md
- `dropbox_files` is a per-user cache. Every cached Dropbox metadata row is scoped by the connecting rep's Supabase auth `user_id`.
```

- [ ] **Step 2: Update expanded files docs**

In `docs/business-requirements/sales-rep/expanded-view-files.md`, replace:

```md
2. If not connected, sees **Connect Google Sheets** CTA → OAuth popup → callback at `/admin/sheets-callback` saves tokens
```

with:

```md
2. If not connected to Dropbox or Google, sees the relevant Connect CTA → OAuth popup → unified callback saves tokens
```

Add this sentence to the Dropbox bullet under "Add a file":

```md
    The picker and local cache are scoped to the current connected rep.
```

- [ ] **Step 3: Run static verification**

Run:

```bash
npm run build
npm run lint
```

Expected:

- `npm run build` exits 0.
- `npm run lint` exits 0 or reports only pre-existing lint issues unrelated to changed files.

- [ ] **Step 4: Deploy database and edge functions**

Run:

```bash
npm run deploy
```

Expected:

- Supabase applies `20260528183000_scope_dropbox_files_by_user.sql`.
- Supabase deploys `dropbox-auth`, `dropbox-files`, `dropbox-mutations`, `dropbox-search`, `dropbox-sync`, and `dropbox-webhook` as part of the existing deployment script.

- [ ] **Step 5: Regenerate schema after deploy**

Run:

```bash
npm run generate-schema
```

Expected:

- `schema.md` reflects `dropbox_files.user_id`.
- If `src/integrations/supabase/types.ts` changes after regeneration, inspect the diff and keep the generated version.

- [ ] **Step 6: Manual smoke checks**

Use an account with no Dropbox connection:

1. Open `/admin/dropbox`.
2. Confirm the page shows Connect Dropbox.
3. Click Connect Dropbox and confirm the popup opens.
4. Complete OAuth in Dropbox.
5. Confirm `/admin/dropbox/callback` closes or redirects back.
6. Confirm Dropbox Browser lists files.
7. Open a People expanded view.
8. Open Files -> Add file -> Dropbox.
9. Confirm the Dropbox tab lists files from the connected account.
10. Select one file.
11. Confirm an `entity_files` row appears on the People record.
12. Disconnect Dropbox from the browser header.
13. Confirm Dropbox Browser returns to the Connect Dropbox state and the Add file Dropbox tab shows Connect Dropbox.

- [ ] **Step 7: Commit docs and generated schema**

```bash
git add docs/business-requirements/sales-rep/dropbox.md docs/business-requirements/sales-rep/expanded-view-files.md schema.md src/integrations/supabase/types.ts
git commit -m "docs(dropbox): document self serve per user oauth"
```

If `schema.md` and `src/integrations/supabase/types.ts` do not change during regeneration, commit only the two docs files.

---

## Review Checklist

- [ ] `dropbox_files` rows always have `user_id`.
- [ ] No edge function upserts `dropbox_files` without `user_id`.
- [ ] No DB query in frontend reads `dropbox_files` without `.eq('user_id', user.id)` unless it goes through a user-scoped edge function.
- [ ] `dropbox-sync` never uses `.limit(1).single()` against `dropbox_connections`.
- [ ] `/superadmin/dropbox` OAuth returns to `/superadmin/dropbox`.
- [ ] People Add file -> Dropbox uses the same shared `EntityFilesSection` path and does not introduce a People-only picker.
- [ ] Existing Dropbox file links in `entity_files` remain untouched.
