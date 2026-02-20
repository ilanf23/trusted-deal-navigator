

## Rename Current Pipeline to "Pipeline Test" and Create New Pipeline Page

### Overview

The current pipeline page (`EvansPipeline.tsx`) will be renamed to "Pipeline Test" and hidden from the employee (admin) sidebar. A brand-new, clean "Pipeline" page will be created to replace it in the admin view and will also appear in the superadmin sidebar above "Pipeline Test."

### Changes

#### 1. Create new Pipeline page: `src/pages/admin/Pipeline.tsx`

A new page component that serves as the replacement pipeline view for employees. It will:
- Use `EvanLayout` (same as the current pipeline page)
- Fetch leads from the database grouped by pipeline stage
- Use a clean kanban-style board layout
- Follow existing patterns from `EvansPipeline.tsx` but start fresh as a simpler, cleaner implementation

#### 2. Update `src/pages/admin/EvansPipeline.tsx`

- Rename the page title/header displayed in the UI from "Pipeline" to "Pipeline Test"
- No other functional changes -- it stays as-is for testing purposes

#### 3. Update `src/components/admin/AdminSidebar.tsx`

**Employee sidebar (Evan and other employees, lines ~262-271):**
- Change the Pipeline item to point to the new page: `{ title: 'Pipeline', url: '/admin/{name}/pipeline', icon: Kanban }`
- This replaces the current link; "Pipeline Test" is NOT shown here

**Superadmin sidebar (Ilan, lines ~138-150):**
- Add "Pipeline" linking to `/superadmin/pipeline` (new route) above the existing CRM Board
- Add "Pipeline Test" linking to `/superadmin/crm` (existing `EvansPipeline` route) or a new `/superadmin/pipeline-test` route below "Pipeline"

#### 4. Update `src/App.tsx` routes

- Add new route `/superadmin/pipeline` rendering the new `Pipeline` page inside `AdminRouteLayout`
- Add new route `/superadmin/pipeline-test` rendering `EvansPipeline` (the old pipeline, now called "Pipeline Test")
- Change `/admin/evan/pipeline` to render the new `Pipeline` page instead of `EvansPipeline`

### Technical Details

| File | Change |
|------|--------|
| `src/pages/admin/Pipeline.tsx` | New file -- clean pipeline page with DB-driven kanban board |
| `src/pages/admin/EvansPipeline.tsx` | Rename displayed title to "Pipeline Test" |
| `src/components/admin/AdminSidebar.tsx` | Employee sidebar: link to new Pipeline page. Superadmin sidebar: add "Pipeline" above "Pipeline Test" |
| `src/App.tsx` | Add routes for `/superadmin/pipeline`, `/superadmin/pipeline-test`; update `/admin/evan/pipeline` to use new page |

### Sidebar Result

**Employee (Evan) sidebar -- Pipeline section:**
- Pipeline (links to new page)
- Lender Programs

**Superadmin (Ilan) sidebar -- Pipeline section:**
- Pipeline (new page)
- Pipeline Test (old EvansPipeline)
- CRM Board
- Leads
- Lender Programs
- Rate Watch

