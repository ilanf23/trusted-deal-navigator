---
allowed-tools: Bash(git *), Read, Glob, Grep, Write, Edit
argument-hint: [commit hash, range, or "current" for session analysis]
description: Analyze session or commits to extract learnings and create Claude Code tools
---

# Learn from Changes

Analyze a commit, commit range, or current session to extract **actionable learnings** and suggest new Claude Code tools (skills, commands, agents, hooks) that prevent repeating mistakes and accelerate future work.

## Arguments: $ARGUMENTS

- **Commit hash** (e.g., `ab4e69ff`) — analyze that commit
- **Range** (e.g., `HEAD~5..HEAD`) — analyze commit range
- **`current`** or empty — analyze current session (uncommitted changes + branch diff from develop/main)

---

## Phase 1: Gather Context

### If commit hash or range:

```bash
git log $ARGUMENTS --oneline --stat
git diff $ARGUMENTS
```

### If current session (no args or "current"):

```bash
git status
git diff HEAD
git diff --cached
git log develop..HEAD --oneline --stat 2>/dev/null || git log main..HEAD --oneline --stat
git diff develop..HEAD 2>/dev/null || git diff main..HEAD
```

### Always: inventory existing tooling

```bash
ls .claude/skills/ 2>/dev/null
ls .claude/commands/ 2>/dev/null
ls .claude/agents/ 2>/dev/null
```

Read `CLAUDE.md` to understand existing standards.

---

## Phase 2: Extract Learnings

Analyze the changes and conversation history. For each learning, classify it:

### A. Bug Fix Patterns

Look for bug fixes and ask:

- **What was the root cause?** (missing guard, wrong logic, missing validation)
- **How was it investigated?** (which files read, what searches run)
- **Could a tool have caught this automatically?** (lint rule, hook, pre-commit check)
- **Is this a recurring bug category?** (RBAC gaps, missing null checks, race conditions)

### B. Feature Implementation Patterns

Look for new features and ask:

- **What boilerplate was written?** (action + service + repository, new page + client component)
- **What decisions were made?** (where to put code, which pattern to follow)
- **What existing code was referenced as a template?** (copied from another file)
- **Could a generator/skill automate the scaffolding?**

### C. Workflow Friction

Look at the session flow and ask:

- **What took multiple attempts?** (wrong file, wrong approach, backtracking)
- **What context was gathered repeatedly?** (reading same files, searching same patterns)
- **What manual steps could be automated?** (branch creation, commit format, push)
- **What domain knowledge was needed that wasn't in CLAUDE.md?**

### D. Codebase Knowledge Gaps

Look for things that surprised or required investigation:

- **Undocumented patterns** — code conventions not in CLAUDE.md
- **Hidden dependencies** — files that must change together
- **Business rules** — domain logic that affects implementation
- **Architecture constraints** — why things are structured a certain way

---

## Phase 3: Generate Recommendations

For each learning, propose ONE of these concrete outputs:

### 1. CLAUDE.md Update

New standard, pattern, or rule to add. Write the exact section to add/update.

```
LEARNING: Sender role restrictions need both UI guard AND server action guard
ACTION: Add to CLAUDE.md RBAC section: "All role-restricted actions must have both UI-level and server-action-level guards"
```

### 2. New Skill

A reusable capability for complex multi-step workflows. Include draft `SKILL.md`.

```
LEARNING: Every RBAC bug fix follows the same pattern — find UI, find action, add isSenderRole guard
ACTION: Create skill "rbac-audit" that scans for missing role guards across UI + actions
```

### 3. New Command

A quick slash command for recurring tasks. Include draft `cmd-*.md`.

```
LEARNING: Branch creation + commit + push for BugHerd tasks follows a fixed pattern
ACTION: Create /cmd-bugherd-fix command that automates branch naming and commit format
```

### 4. New Agent

An autonomous agent for complex tasks. Include draft agent markdown.

```
LEARNING: Investigating RBAC bugs requires checking 4+ files across UI/action/service/permission layers
ACTION: Create "rbac-checker" agent that audits all role-restricted features
```

### 5. New Hook

A pre/post tool hook that prevents mistakes. Include hook config.

```
LEARNING: Forgot to add server-side guard — only fixed UI
ACTION: Add pre-commit hook that warns if isSenderRole is used in a Client component but not in the corresponding action file
```

### 6. Documentation Update

Update `docs/` files with discovered knowledge.

```
LEARNING: sender-role-permissions.md was missing leads page ICP creation restriction
ACTION: Update docs/sender-role-permissions.md with new restriction details
```

---

## Phase 4: Present Findings

Output a concise report:

```
## Session Learnings

### What happened
[1-3 sentence summary of the work done]

### Learnings

| # | Category | Learning | Proposed Tool |
|---|----------|----------|---------------|
| 1 | Bug Fix  | ...      | Skill: ...    |
| 2 | Workflow | ...      | Command: ...  |
| 3 | Knowledge| ...      | CLAUDE.md: ...|

### Recommended Actions (by priority)

**Implement now:**
- [Highest-value, lowest-effort items]

**Implement later:**
- [Good ideas that need more thought]

**Skip:**
- [Things that aren't worth the effort — explain why]
```

---

## Phase 5: Implement

Ask the user:

> Which recommendations should I implement now?

Then create the files:

- Skills → `.claude/skills/[name]/SKILL.md`
- Commands → `.claude/commands/cmd-[name].md`
- Agents → `.claude/agents/[name].md`
- CLAUDE.md → edit in place
- Docs → edit or create in `docs/`

Use proper frontmatter for commands (see `command-writer` skill). Use existing files as reference for format.

---

## Guidelines

1. **Be concrete** — every recommendation must reference specific code from the changes
2. **Prefer small tools** — a focused command beats a complex skill
3. **Don't duplicate** — check existing tools before recommending new ones
4. **Prioritize prevention** — tools that prevent bugs > tools that fix bugs
5. **Think reusability** — will this help more than once? If not, skip it
6. **Capture domain knowledge** — if you learned something about the codebase that isn't documented, that's always worth adding to CLAUDE.md or docs/
