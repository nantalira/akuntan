---
description: "Generate standardized git commit messages conforming to Conventional Commits 1.0.0"
---

Generate a standardized git commit message based on current staged or unstaged changes.

## Steps

1. **Inspect Git Status & Diff**
   Run:
   ```bash
   git status --short
   ```
   If changes are staged:
   ```bash
   git diff --staged
   ```
   If changes are not staged:
   ```bash
   git diff
   ```
   If untracked files exist, review untracked file list:
   ```bash
   git status -u
   ```

2. **Evaluate Scope & Atomic Changes**
   - Determine if the changes should be committed together or split into atomic commits.
   - If changes span unrelated components (e.g., database migration + UI redesign), advise splitting into logical commits.

3. **Select Conventional Commit Type**
   - `feat`: New user-facing feature
   - `fix`: Bug fix
   - `refactor`: Refactoring without functional changes
   - `perf`: Performance improvement
   - `docs`: Documentation changes
   - `style`: Formatting, semicolons, whitespace
   - `test`: Test cases added or fixed
   - `build`: Build system or dependencies (bun, vite, package.json)
   - `ci`: CI configuration files
   - `chore`: Maintenance tasks, config tweaks, internal tools

4. **Draft Commit Message**
   - **Header:** `<type>(<scope>): <subject>` (imperative mood, lowercase, no period, ≤ 72 chars).
   - **Body (optional):** Explain the motivation ("why") and high-level architectural details.
   - **Footer (optional):** Breaking changes or issue links.

5. **Present Recommendations to User**
   Display:
   - Primary recommended commit message (with full body if non-trivial).
   - One-liner alternative.
   - Exact `git add` and `git commit` commands.
   - Ask for confirmation if the user wants to execute the commit directly.

## Guardrails
- Never run `git commit` without explicit confirmation.
- Always follow imperative mood in subject line (e.g. `add`, not `added`).
- Keep subject line concise (under 72 characters, ideally ≤ 50).
