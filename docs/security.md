---
layout: default
title: Security
---

# Security model

- No Models, Copilot, or privileged mutation occurs before verified provenance for the
  workflow's configured approval label.
- The approving actor must be allowlisted and currently hold repository write, maintain,
  triage, or admin permission.
- Permission lookup failures fail closed.
- The label assigned the workflow's `opt-out` role suppresses all issue and linked-PR
  processing.
- Issue, pull-request, diff, and check text is untrusted data, never instruction.
- Configuration and prompts are loaded from the caller's default branch.
- Fork or pull-request-head code is never checked out with write credentials.
- Local lifecycle data cannot remove protected states or bypass approval checks.
- Callers use an explicit release tag or commit SHA; full SHAs provide the strongest
  supply-chain pinning.
- The framework never requires a token that can mutate other managed repositories.

## Implementation providers

`implementation.provider` (`copilot` default, or `claude`/`codex`) selects who performs the
implementation step; it does not change any of the trust boundaries above.

- **Closed allowlist, not arbitrary Actions.** The provider name is validated against a
  fixed set defined in `src/providers/providers.js` (`copilot`, `claude`, `codex`). A caller's
  `.puppets/workflow.yml` overlay can select among these three built-in behaviors but can
  never name or pin an arbitrary `uses:` reference — that would require a framework code
  change and review, not a caller-side configuration edit.
- **Official actions, pinned to a commit SHA.** `anthropics/claude-code-action` and
  `openai/codex-action` are referenced in `reconcile.yml` by immutable 40-character commit
  SHA (annotated with the release tag they correspond to), the same supply-chain pinning
  discipline used for the framework reference itself.
- **Credentials are scoped to the provider that needs them and never touch issue/PR
  content.** `anthropic_api_key`/`claude_code_oauth_token`/`openai_api_key` are ordinary
  optional `workflow_call` secrets, wired only into the `implement` job and only into the
  one provider step that uses them. The prompt handed to a provider is the issue's own
  title/body plus the already-posted, trusted implementation-instructions comment — the
  same content a human collaborator would read — never raw, unreviewed repository code
  beyond what the provider action itself checks out and edits by design.
- **Curation and acceptance review remain Copilot-only.** Selecting `claude` or `codex`
  changes only who implements approved work. Issue triage/curation and the pre-merge
  acceptance-review gate always call the Copilot SDK. Puppets does not claim Copilot-free
  operation for a profile that uses another implementation provider; this is stated
  explicitly rather than left implicit.
- **Neither provider action is trusted to create the pull request itself.**
  `openai/codex-action` only edits the checked-out workspace (`codex exec`); it does not
  open a pull request. Whether `anthropics/claude-code-action` would auto-create one when
  invoked from a `schedule`/`workflow_dispatch` event (rather than its native issue/PR
  comment trigger) is not confirmed from its documentation, so Puppets does not depend on
  it either way. `scripts/finalize-implementation.js` is the single place that commits,
  pushes, and opens a **draft** pull request for both providers, deterministically and
  idempotently. The draft state keeps a claude/codex-authored PR behind the exact same CI
  and acceptance-review gate (`reconcileInFlight`) as a Copilot-authored one.
- **The `implement` job is fully skipped when unused.** It only runs when the reconciler's
  `implementation_jobs` output is non-empty, i.e. only for callers where a matching profile
  actually selects `claude` or `codex`. Existing callers that only use the default
  `copilot` provider see no new job, no new checkout, and no new secret usage.
- **Least privilege.** The `implement` job's own permissions are limited to
  `contents: write`, `id-token: write`, `issues: write`, and `pull-requests: write` — no
  broader than the `reconcile` job already required, and still capped by whatever the
  calling workflow's top-level `permissions:` block allows.
- **Residual/known limitations for maintainers to weigh:**
  - `openai/codex-action`'s `allow-bots` gate is set to `true` for this invocation because
    the triggering "actor" is Puppets' own already-approved automation step, not a
    human PR/issue comment; this is a deliberate compensating control, not a bypass of
    Puppets' own approval gate, which still runs first.
  - A remediation ("retry") job reuses the existing pull request's head branch. If that
    branch was not created by `finalize-implementation.js` (for example, a mid-flight
    provider switch on an issue Copilot already has a PR open for), the branch name will
    not match the framework's deterministic `puppets/issue-<n>` pattern and the job fails
    closed with a validation error rather than silently operating on an unexpected branch.
  - If a provider action makes no workspace changes at all, Puppets does not retry
    automatically; it fails the job and comments on the issue so a human notices, rather
    than leaving the item silently stuck.
