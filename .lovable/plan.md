

## Add Admin Sidebar to Feed Page

### Problem
The Feed page (`PipelineFeed`) is missing the `EvanLayout` wrapper that all other Evan portal pages use (like Dashboard, Tasks, Pipeline, etc.). Without it, the global admin sidebar with navigation to all portal pages never renders -- only the Feed's own filter panel (`FeedLeftPanel`) is visible.

### Solution
Wrap `PipelineFeed` content with the `EvanLayout` component, matching the pattern used by every other Evan page.

### File Change: `src/pages/admin/PipelineFeed.tsx`

1. Import `EvanLayout` from `@/components/evan/EvanLayout`
2. Wrap the entire return JSX with `<EvanLayout>...</EvanLayout>`

This is a one-line import and a two-line wrapper addition. The admin sidebar (with Dashboard, Pipeline, Tasks, Gmail, etc.) will then be accessible via the hamburger menu in the top header bar, just like on every other Evan portal page.

### Technical Details

The pattern matches exactly what other Evan pages do:

```text
EvansTasks:     EvanLayout > content
EvansPage:      EvanLayout > content
EvansPipeline:  EvanLayout > content
PipelineFeed:   (nothing) > content    <-- broken
```

After the fix:

```text
PipelineFeed:   EvanLayout > content   <-- fixed
```

`EvanLayout` delegates to `AdminLayout`, which provides the `SidebarProvider`, `AdminSidebar`, header bar with sidebar trigger, dark mode toggle, and undo button.

