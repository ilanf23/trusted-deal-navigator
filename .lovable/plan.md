

## Pull Real Profile Images into Feed Activity Cards & Right Panel

### Problem
All avatars in the feed are colored circles with initials. The user wants real profile photos pulled from:
1. **Team members** -- `avatar_url` from the `team_members` table (Evan and Ilan already have uploaded avatars)
2. **Right panel** -- same `avatar_url` for team member circles in "Invite Team Members" and "Suggestions" sections

### Changes

**1. `src/hooks/useFeedData.ts`**
- Expand the `team_members` query to also fetch `avatar_url`
- Add `actorAvatarUrl: string | null` field to the `FeedActivity` interface
- Populate `actorAvatarUrl` from the team member map when building each activity item (notes, communications, tasks)

**2. `src/components/feed/ActivityCard.tsx`**
- Import the `Avatar`, `AvatarImage`, `AvatarFallback` components from `src/components/ui/avatar.tsx`
- When `activity.actorAvatarUrl` exists, render the real image inside the avatar circle
- Fall back to the current initial-based colored circle when no image is available

**3. `src/components/feed/FeedRightPanel.tsx`**
- Expand the `team_members` query to also select `avatar_url`
- In the "Invite Team Members" section, render `Avatar`/`AvatarImage`/`AvatarFallback` using `avatar_url` when available
- Keep initial fallback for members without an avatar

**4. `src/components/feed/FeedLeftPanel.tsx`**
- Accept `avatar_url` in the `TeamMember` interface prop
- Render real avatar images in the overlapping team avatar row when available
- Fall back to initial circles when no image exists

**5. `src/pages/admin/PipelineFeed.tsx`**
- Update the `team_members` query to also select `avatar_url` so it passes through to `FeedLeftPanel`

### Technical Details
- Uses the existing `Avatar`, `AvatarImage`, `AvatarFallback` shadcn/ui components
- Only team members with uploaded avatars (currently Evan and Ilan) will show real photos; others keep the colored initial fallback
- No new database tables or columns needed -- `avatar_url` already exists on `team_members`
