

## Plan: Create Checklist Database Tables for Leads

The frontend code already references four tables that don't exist yet. I need to create all four with proper RLS policies.

### Tables to Create

**1. `lead_checklists`** — one row per checklist attached to a lead
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default `gen_random_uuid()` |
| lead_id | uuid NOT NULL | references leads(id) on delete cascade |
| title | text | default `'Checklist'` |
| created_by | text | nullable |
| activity_id | uuid | nullable (links to lead_activities) |
| created_at | timestamptz | default `now()` |

**2. `lead_checklist_items`** — individual checklist line items
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default `gen_random_uuid()` |
| checklist_id | uuid NOT NULL | references lead_checklists(id) on delete cascade |
| text | text NOT NULL | |
| is_checked | boolean | default `false` |
| position | integer | default `0` |
| created_at | timestamptz | default `now()` |

**3. `checklist_templates`** — reusable templates
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default `gen_random_uuid()` |
| name | text NOT NULL | |
| created_by | text | nullable |
| created_at | timestamptz | default `now()` |

**4. `checklist_template_items`** — items within a template
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default `gen_random_uuid()` |
| template_id | uuid NOT NULL | references checklist_templates(id) on delete cascade |
| text | text NOT NULL | |
| position | integer | default `0` |

### RLS Policies

All four tables get admin-only access via `has_role(auth.uid(), 'admin')`, matching the existing pattern used throughout the project.

### No Frontend Changes Needed

The code in `UnderwritingExpandedView.tsx` and `ChecklistBuilder.tsx` already queries these exact table/column names — once the tables exist, everything will work.

