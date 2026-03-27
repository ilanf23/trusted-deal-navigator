---
paths:
  - "src/components/**/*.tsx"
  - "src/components/**/*.ts"
---

# Component Conventions

- UI primitives in `src/components/ui/` are shadcn/ui — do not heavily modify these
- Use `cva` (class-variance-authority) for variant management on custom components
- Use `React.forwardRef` when the component wraps a native HTML element
- Always handle both `expanded` and `collapsed` sidebar states when rendering sidebar-aware components
- Detail pages follow the ExpandedView + DetailPanel pair pattern with routes at `/expanded-view/:id`
- Widgets (especially in `evan/`) should be self-contained: own React Query data fetching, internal state, action dialogs
- Use `cn()` from `src/lib/utils` for conditional Tailwind class merging
- Sanitize user-generated HTML with `sanitizeHtml()` from `src/lib/sanitize.ts` before rendering
