---
description: Analyze code changes and update or create related documentation in docs/
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(git diff:*), Bash(git status:*), Bash(git log:*)
---

## Context

Current git status:
!`git status --short`

Recent changes (staged and unstaged):
!`git diff HEAD --name-only 2>/dev/null || git diff --name-only`

## Task

Analyze the code changes and update related documentation:

1. **Identify changed files**: Review the git diff to understand what code has changed
2. **Find related docs**: Search `docs/` directory for existing documentation related to the changed code
3. **Update or create documentation**:
   - If related documentation exists in `docs/`, update it to reflect the code changes
   - If no related documentation exists, create a new markdown file in `docs/` with appropriate documentation

## Documentation Requirements

Each documentation file MUST include details about:

### UI Layer

- **UI Components**: Which React/Vue/etc components are used or affected
- **Pages/Routes**: Which pages or routes are involved

### Backend Layer

- **Server Actions**: Any server actions used (Next.js server actions, etc.)
- **API Endpoints**: REST/GraphQL endpoints involved (method, path, request/response)
- **Services**: Business logic services and their methods

### Data Layer

- **Database Tables**: Which tables are read from or written to
- **Columns**: Specific columns used, their types and purposes
- **Relationships**: Foreign keys and table relationships
- **Queries**: Important queries or ORM operations

### Integration Points

- **External APIs**: Third-party services called
- **Events/Webhooks**: Any events emitted or consumed
- **Caching**: Cache keys and strategies used

## Documentation Guidelines

When updating or creating documentation:

- Use clear, concise language
- Include code examples where helpful
- Document public APIs, configuration options, and important behaviors
- Follow existing documentation style in the project
- Name new files descriptively (e.g., `docs/authentication.md`, `docs/api-endpoints.md`)
- Use tables or lists to organize component/service/table references

## Output

After completing the documentation updates:

1. List which documentation files were updated or created
2. Provide a brief summary of the changes made
