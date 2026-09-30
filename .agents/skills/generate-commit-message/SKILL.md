---
name: generate-commit-message
description: Generate standardized git commit messages following Conventional Commits 1.0.0 and industry best practices. Use when the user asks to generate, draft, suggest, or write a commit message based on staged or working directory changes.
allowed-tools: Bash(git:*)
license: MIT
compatibility: Requires git CLI.
metadata:
  author: ant-agent
  version: "1.0"
---

# Generate Conventional Commit Message

This skill analyzes git changes (staged or unstaged) and generates structured, clear, and high-quality commit messages conforming to the **Conventional Commits 1.0.0** specification and industry standards.

## Conventional Commits Format

```text
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### 1. Types
- `feat`: A new feature or capability for the user
- `fix`: A bug fix or error correction
- `refactor`: Code change that neither fixes a bug nor adds a feature (restructuring, renaming, cleanup)
- `perf`: A code change that improves performance or optimizes memory/runtime
- `docs`: Documentation-only changes (README, specs, guides, comments)
- `style`: Changes that do not affect code meaning (formatting, linting, whitespace, missing semicolons)
- `test`: Adding missing tests or correcting existing tests
- `build`: Changes that affect the build system or external dependencies (package.json, vite.config, bun.lock, docker)
- `ci`: Changes to CI/CD configuration files and scripts (GitHub Actions, pipelines)
- `chore`: Maintenance tasks, config tweaks, or repo housekeeping not modifying src or test code
- `revert`: Reverts a previous commit

### 2. Scope Guidelines
- Scopes should be short noun phrases in kebab-case or single words representing the module, layer, or domain affected.
- Examples: `auth`, `qris`, `chat`, `db`, `routes`, `analytics`, `ui`, `server`, `client`, `spec`.
- Omit scope if the change is project-wide or cross-cutting.

### 3. Subject / Header Rules
- Use the **imperative, present-tense mood**: "add", "fix", "change", "refactor" (NOT "added", "fixes", "changing").
- Start with lowercase (after the colon and space).
- Do NOT put a period (`.`) at the end of the subject.
- Keep the header under 72 characters (ideally <= 50 characters).

### 4. Body Rules (When Needed)
- Use a body when the change requires context, explanation of the *motivation* ("why"), or trade-offs.
- Separate header and body with a single blank line.
- Wrap lines at ~72 characters.
- Focus on **why** the change was made and what was changed conceptually, not restating the line-by-line diff.

### 5. Breaking Changes & Footers
- Indicate breaking changes with `!` before `:` in the header (e.g., `feat(api)!: change payload schema`) or with `BREAKING CHANGE: <explanation>` in the footer.
- Reference issues or PRs if known: `Closes #123`, `Fixes #45`, `Refs #67`.

---

## Workflow Steps

### Step 1: Inspect Repository State
Run git commands to check current state:
```bash
git status --short
```
If changes are already staged, check:
```bash
git diff --staged
```
If no changes are staged, inspect unstaged changes:
```bash
git diff
```
If untracked files are relevant, inspect their names or contents:
```bash
git status -u
```

### Step 2: Check for Atomic Commits
Analyze whether the diff represents a single logical change:
- **Single logical concern (Atomic):** Proceed to generate commit message.
- **Multiple unrelated concerns (e.g. auth bugfix + UI redesign + package upgrade):**
  Point this out clearly to the user. Recommend splitting into separate atomic commits and provide staged groups with specific commit messages for each.

### Step 3: Draft Commit Message Options
Formulate:
1. **Primary Recommendation (Detailed):** Full Conventional Commit message with header, body (if non-trivial), and footers.
2. **One-Liner Alternative:** Concise single-line header suitable for quick commits.
3. **Execution Command:** The ready-to-run `git commit` command (and `git add` if changes are unstaged).

### Step 4: Output Presentation
Format the output clearly:

```markdown
### 📝 Recommended Commit Message

```gitcommit
<type>(<scope>): <subject>

[body if applicable]
```

#### One-Liner Alternative:
`<type>(<scope>): <subject>`

#### Command to execute:
```bash
git add <files>
git commit -m "<type>(<scope>): <subject>" -m "[body]"
```
```

### Guardrails
- Never execute `git commit` automatically without explicit user confirmation.
- Always verify what is staged vs unstaged before drafting the message.
- Never use vague summaries like `update code`, `fix bugs`, or `misc changes`.
- Adhere strictly to the imperative mood ("add", "implement", "resolve", "update").
