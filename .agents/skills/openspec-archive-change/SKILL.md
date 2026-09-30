---
name: openspec-archive-change
description: Finalize and sync a change to main specs. Deletes the change directly if all tasks are complete, or retains it in changes/ if tasks remain incomplete.
allowed-tools: Bash(openspec:*)
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.12.0"
---

Finalize and sync a change to main specs, then delete directly if complete or retain in changes/ if incomplete.

**Store selection:** If the user names a store (a store is a standalone OpenSpec repo registered on this machine) or the work lives in one, run `openspec store list --json` to discover registered store ids, then pass `--store <id>` on the commands that read or write specs and changes (`new change`, `status`, `instructions`, `list`, `show`, `validate`, `archive`, `doctor`, `context`, `schemas`, `view`). Once selected, treat `--store <id>` as sticky for the rest of the workflow. Every unscoped example of those commands below is shorthand: before running it, append the flag. For example, run `openspec status --change "<name>" --json --store "<id>"`, not the unscoped form shown below. Other commands do not take the flag. Hints printed by commands already carry the flag; keep it on follow-ups. Without a store, commands act on the nearest local `openspec/` root.

`<capability-path>` is the spec directory relative to `specs/` (for example, `user-auth` or `identity/user-auth`). Preserve the full path from each delta spec when resolving its main spec.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` to get available changes and ask the user to select one

   When prompting, show only active changes (not already archived).
   Include the schema used for each change if available.

   Always announce: "Using change: <name>" and how to override (e.g., `/opsx-archive <other>`).

   **Load current archive inputs before the existing archive checks:**

   After resolving the selected change and planning root, run:
   ```bash
   openspec instructions archive --change "<name>" --json
   ```
   Keep the same selected-root flags on this command. This lookup is advisory and
   optional: it only supplies extra prompt inputs, so it must never block archiving.
   If it exits non-zero or returns invalid JSON — for example on an older CLI that
   does not support this command yet — continue the archive workflow with no
   context and no operation guidance. Do not report an error and do not stop.

   A successful response may omit both optional fields. Treat `context` as a
   required prompt-level input: read and consider it, and apply relevant project
   facts, conventions, and constraints. Treat `operationGuidance` as optional
   additive advice: read and consider every entry, and follow entries that are
   applicable and compatible with the built-in archive workflow.

   Keep both fields separate from built-in steps, explicit user choices, resolved
   paths, CLI checks, and command contracts. If context conflicts with one of those
   controlling inputs, report the conflict and preserve the controlling value. If
   guidance is inapplicable or conflicts with a controlling input, do not follow it
   and explain why. Do not infer replacement paths, skipped prompts, or flags from
   either field, and do not copy their text verbatim into specs, change artifacts,
   or archive summaries unless the user separately asks for it. These are
   prompt-level behavior contracts, not enforceable checks.

2. **Check artifact completion status**

   Run `openspec status --change "<name>" --json` to check artifact completion.

   Parse the JSON to understand:
   - `schemaName`: The workflow being used
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context
   - `artifacts`: List of artifacts with their status (`done`, `skipped`, or other)

   **If any artifacts are neither `done` nor `skipped`** (skipped artifacts satisfy the requirement - the change declares skip_specs):
   - Display warning listing incomplete artifacts
   - Ask the user to confirm they want to proceed
   - Proceed if user confirms

3. **Check task completion status**

   Read the tasks file (typically `tasks.md`) to check for incomplete tasks.

   Count tasks marked with `- [ ]` (incomplete) vs `- [x]` (complete).

   Task completion directly governs step 5:
   - **All tasks complete (`- [ ]` count is 0):** The change directory will be deleted directly after specs are synced (no archive folder used).
   - **Incomplete tasks found (`- [ ]` count > 0):** The change directory will be **retained** in `<planningHome.changesDir>/<name>` so unfinished work can continue. Delta specs will still be synced to main specs.
     - Display notice showing count of incomplete tasks: "Found <N> incomplete tasks. Delta specs will be synced, but the change directory will be retained in `openspec/changes/<name>`."
     - Ask the user to confirm they want to proceed with syncing and retaining.
     - Proceed if user confirms.

   **If no tasks file exists:** Treat as complete if all artifacts are done/skipped.

4. **Assess delta spec sync state**

   Use `artifactPaths.specs.existingOutputPaths` from status JSON as the only
   delta-spec source. If the `specs` entry is missing or
   `existingOutputPaths` is empty, proceed without a sync prompt and do not infer
   delta specs from other artifacts.

   **If delta specs exist:**
   - Compare each delta spec with its corresponding main spec at `<planningHome.root>/openspec/specs/<capability-path>/spec.md` (use the store-aware `planningHome.root` from step 2, not a hardcoded repo path)
   - Determine what changes would be applied (adds, modifications, removals, renames)
   - Show a combined summary before prompting

   **Prompt options:**
   - If changes needed: "Sync now (recommended)", "Skip sync"
   - If already synced: "Proceed", "Sync anyway", "Cancel"

   Route on the answer:
   - "Cancel" — stop, do not proceed
   - "Skip sync" or "Proceed" — proceed to step 5
   - "Sync now" or "Sync anyway" — sync, then verify (below)
   - Anything else — ask again rather than proceeding

   Before a selected sync writes any main spec, run
   `openspec instructions specs --change "<name>" --json` once with the same
   selected-root flags. Require a zero exit status and valid artifact-instruction
   JSON. If the lookup fails or returns invalid JSON, report the error and stop
   before writing any main spec or deleting the change. A valid response with omitted
   `rules` is the no-rules case. Apply returned `rules` only to the content and
   form of main specs produced by this merge; do not use them as archive guidance,
   change CLI behavior, or copy the rule text into any output file.

   Then run the `openspec-sync-specs` workflow inline (agent-driven intelligent merge) for change '<name>', passing the delta spec analysis and the fetched specs-rule snapshot from above, and wait for it to finish. The inline sync must reuse that snapshot without fetching `specs` instructions again. Do not delegate it to a background task — step 5 would delete `changeRoot` out from under a sync that is still reading it, leaving the change removed and the main specs never updated. If your agent can only run it by delegation, delegate synchronously and wait for the result.

   Then re-run the comparison from the top of this step against every capability that has a delta spec in `artifactPaths.specs.existingOutputPaths` — not only the ones the sync reports it touched. A successful sync leaves nothing left to apply, so each capability must now read as already synced:
   - ADDED requirements present
   - MODIFIED requirements carrying the scenario and description changes named in the delta, with their other scenarios intact
   - REMOVED requirements gone — and where this sync retired a capability (removed its last requirement, leaving `## Requirements` empty), its main spec deleted rather than left empty; a spec the sync deliberately kept and reported is also a match
   - RENAMED requirements present under the new name and absent under the old one

   If the sync failed, or any capability does not match, report what differs and stop — do not clean up or delete. Nothing has moved and `changeRoot` is intact, so the user can fix the mismatch or re-run the sync and start again.

5. **Perform cleanup or retention**

   Check task and artifact completion status:

   - **If all tasks are complete (`- [ ]` count is 0) and artifacts are done or skipped:**
     Delete the change directory directly without creating or using an archive directory:
     ```bash
     rm -rf "<changeRoot>"
     ```
     (On Windows PowerShell: `Remove-Item -Recurse -Force "<changeRoot>"`)

   - **If incomplete tasks exist (`- [ ]` count > 0) or artifacts are incomplete:**
     Do NOT delete or archive the change directory. Keep it intact in `<planningHome.changesDir>/<name>` so the remaining work can continue.

6. **Display summary**

   Show completion summary including:
   - Change name
   - Schema that was used
   - Status (Deleted or Retained)
   - Whether specs were synced (if applicable)
   - Remaining tasks count (if retained)

**Output On Success (All Tasks Complete - Deleted)**

```markdown
## Change Complete & Deleted

**Change:** <change-name>
**Schema:** <schema-name>
**Status:** Deleted (all tasks complete, specs synced)
**Specs:** <"✓ Synced to main specs" only if the step 4 verification passed; otherwise "No delta specs" or "Sync skipped">

All artifacts complete. All tasks complete. Change directory removed.
```

**Output When Incomplete (Specs Synced - Retained)**

```markdown
## Specs Synced (Change Retained)

**Change:** <change-name>
**Schema:** <schema-name>
**Status:** Retained in changes/ (<N> tasks remaining)
**Specs:** <"✓ Synced to main specs" only if the step 4 verification passed; otherwise "No delta specs" or "Sync skipped">

**Remaining Tasks:** <N> tasks left incomplete.
Change directory kept at `<planningHome.changesDir>/<name>` to continue work.
```

**Guardrails**
- Announce the selected change; prompt for selection when it is ambiguous
- Use artifact graph (openspec status --json) for completion checking
- Do NOT use an archive directory: complete changes are deleted directly, incomplete changes are retained in changes/
- Never delete a change that still has incomplete tasks
- Show clear summary of what happened
- If sync is requested, run the `openspec-sync-specs` workflow inline (agent-driven)
- Never delete `changeRoot` while a spec sync is still in flight — run the sync inline and verify the main specs before removing `changeRoot`
- If delta specs exist, always run the sync assessment and show the combined summary before prompting
- Apply relevant runtime context and report conflicts; operation guidance remains advisory
- Consider every guidance entry and explain any inapplicable or conflicting advice
- Existing CLI checks, resolved paths, prompts, and command contracts are unchanged
- Artifact rules constrain only the specs being written and are never operation guidance
- Never copy runtime context, operation guidance, or artifact-rule text verbatim into output files
