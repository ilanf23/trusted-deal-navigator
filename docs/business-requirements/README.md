# Business Requirements

One markdown file per page, per portal. The goal is a living spec that:

- A new team member can read to understand what a page does and why
- Claude can read for context when working on that page
- The product team can edit without touching code

## Structure

```
business-requirements/
├── README.md                 (this file)
├── _template.md              (copy this when adding a new page)
└── <portal>/
    ├── index.md              (page list for the portal)
    └── <page-slug>.md        (one file per page)
```

## Portals

| Portal | Folder | Audience |
|--------|--------|----------|
| Sales Rep | [`sales-rep/`](./sales-rep/index.md) | Admin users (Evan, Maura, Wendy, future hires) — `/admin/*` routes |
| Super Admin | _todo_ | Founders (Ilan, Brad, Adam) — `/superadmin/*` routes |
| Partner | _todo_ | Referral partners — `/partner/*` routes |
| Public | _todo_ | Unauthenticated visitors |

## Conventions

- **File names**: lowercase kebab-case matching the URL slug (e.g. `pipeline-potential.md` for `/admin/pipeline/potential`)
- **Page slug**: matches the last meaningful URL segment, prefixed with the section if ambiguous
- **Status**: every page MD has a `Status:` field — `live`, `in-progress`, `planned`, `deprecated`
- **Cross-links**: use relative paths, e.g. `[Calls](./sales-rep/calls.md)`

## When to update

- Adding a new page → copy `_template.md`, fill it in, add a line to the portal `index.md`
- Changing page behavior → update the MD in the same PR as the code change
- Deprecating → set `Status: deprecated` and add a *Replaced by* link; do not delete

## Audience note

These are hybrid docs: **business intent at the top, technical anchors at the bottom.** Stakeholders read the first half; engineers and Claude lean on the second half.
