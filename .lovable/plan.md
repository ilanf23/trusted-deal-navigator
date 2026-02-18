
# Seed CLX Operating System Business Requirements

## Overview

The `modules` and `business_requirements` tables are currently empty. This plan inserts all the data from the provided BRD document in a single SQL migration — no frontend changes needed. The existing Module Tracker page will automatically display everything once the data is seeded.

## Data Structure

### Modules to Create (11 modules)

The BRD has a hierarchy: sections → pages → requirements. I'll create one module per named page/section:

| # | Module Name | Icon | Status |
|---|-------------|------|--------|
| 1 | Core OS Rules | Shield | planned |
| 2 | Dashboard | LayoutDashboard | planned |
| 3 | Scorecard | BarChart3 | planned |
| 4 | To Do's | CheckSquare | planned |
| 5 | Calendar | Calendar | planned |
| 6 | Calls | Phone | planned |
| 7 | Gmail | Mail | planned |
| 8 | Pipeline | Kanban | planned |
| 9 | Rate Watch / LP / Messages | MessageSquare | planned |
| 10 | AI Assistant | Zap | planned |
| 11 | System Integrity | Database | planned |

### Requirements to Create (17 BRs)

All 17 BRs will be inserted with full descriptions and acceptance criteria pulled from the document:

| BR ID | Module | Title |
|-------|--------|-------|
| BR-001 | Core OS Rules | No Work Without Ownership |
| BR-002 | Core OS Rules | No Deal Without Next Action |
| BR-003 | Core OS Rules | No Silent Failure |
| BR-004 | Core OS Rules | No Memory Dependency |
| BR-005 | Dashboard | Show Business Reality |
| BR-006 | Scorecard | Leading Indicators Only |
| BR-007 | To Do's | Task = Commitment |
| BR-008 | Calendar | Deal-Centric Time |
| BR-009 | Calls | First Ring Reliability |
| BR-010 | Gmail | Email = Work Unit |
| BR-011 | Gmail | No Broken Navigation |
| BR-012 | Pipeline | Pipeline = Truth Source |
| BR-013 | Rate Watch / LP / Messages | Context First |
| BR-014 | AI Assistant | AI Is Operator, Not Writer |
| BR-015 | System Integrity | One Source of Truth |
| BR-016 | System Integrity | Real-Time Enforcement |
| BR-017 | System Integrity | No Cosmetic Features |

## SQL Approach

Using a CTE (`WITH`) to insert modules first and capture their generated UUIDs, then insert all BRs in the same statement by joining on module name. This guarantees foreign key integrity without needing hardcoded UUIDs.

```sql
WITH inserted_modules AS (
  INSERT INTO public.modules (name, description, business_owner, status, icon)
  VALUES
    ('Core OS Rules', 'Non-negotiable global OS rules...', 'Ilan', 'planned', 'Shield'),
    ('Dashboard', '...', 'Ilan', 'planned', 'LayoutDashboard'),
    ...
  RETURNING id, name
)
INSERT INTO public.business_requirements 
  (module_id, requirement_id, title, description, acceptance_criteria, status, priority)
SELECT m.id, 'BR-001', 'No Work Without Ownership', 
  'Every object (deal, task, email, call) must have an assigned owner...', 
  'All deals, tasks, emails, and calls display an assigned owner. System alerts when owner is missing.',
  'approved', 'medium'
FROM inserted_modules m WHERE m.name = 'Core OS Rules'
UNION ALL
SELECT m.id, 'BR-002', ...
...
```

## What You'll See After

**Modules Board tab**: 11 module cards appear with correct icons and "planned" status.

**Requirements tab**: All 17 BRs listed in order (BR-001 through BR-017), each linked to its parent module, filterable and searchable immediately. Descriptions will match the BRD text exactly.

**Dev Pipeline tab**: All 11 modules appear in the "Planned" Kanban column, ready to be dragged to "In Progress" as work begins.

## Files to Change

| Action | File |
|--------|------|
| **Create** | `supabase/migrations/[timestamp]_seed_clx_requirements.sql` |

No frontend changes required — existing components already read and display this data.
