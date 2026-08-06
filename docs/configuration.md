---
layout: default
title: Configuration
---

# Configuration and overrides

Puppets ships safe defaults. Each caller keeps its policy beside its code, and Puppets loads
that policy only from the repository's trusted default branch.

## Minimum configuration

Create `.puppets/config.json`:

```json
{
  "version": 1,
  "approvalActors": ["YOUR_GITHUB_LOGIN"]
}
```

That is enough to start with the framework defaults. Unknown keys and invalid values fail
before Puppets mutates an issue or pull request.

## Available settings

| Setting | Default | Purpose |
|---|---:|---|
| `version` | `1` | Configuration schema version. |
| `approvalActors` | required | GitHub logins allowed to apply the human trust gate. |
| `maxNewIssues` | `1` | Maximum new Copilot assignments in one run. |
| `maxInFlight` | `2` | Maximum issues in active implementation or review states. |
| `conflictRetries` | `2` | Merge-conflict remediation attempts before human escalation. |
| `reviewRetries` | `2` | Acceptance-review remediation cycles before escalation. |
| `copilotModel` | `"auto"` | Copilot SDK model used by curation and acceptance review. |
| `claudeModel` | `""` | Optional model override for the `claude` implementation provider. Empty uses that action's own default. |
| `codexModel` | `""` | Optional model override for the `codex` implementation provider. Empty uses that action's own default. |
| `staleHours` | `72` | Age at which untouched issues return to the attention summary. |
| `ignoreLabels` | `[]` | Repository-owned processes Puppets must leave alone. |

## A practical caller policy

```json
{
  "version": 1,
  "approvalActors": [
    "JeffSteinbok",
    "trusted-maintainer"
  ],
  "maxNewIssues": 1,
  "maxInFlight": 2,
  "reviewRetries": 2,
  "ignoreLabels": [
    "manual-only"
  ]
}
```

### Ignored processes

`ignoreLabels` supports repository-owned processes that should coexist with Puppets without
entering its generic lifecycle. Ignored issues are excluded from triage, inbox reporting,
assignment, and pull-request reconciliation.

## Workflow DSL

Puppets compiles a versioned workflow definition before it performs any mutation. The
built-in [`basic` workflow](https://github.com/JeffSteinbok/puppets/blob/main/config/workflow.yml)
declares named stages, handler kinds, outcome branches, labels, and profiles.

Create `.puppets/workflow.yml` to overlay it. Named stages, profiles, control-label roles,
and helper labels merge by identity, so callers do not copy the full workflow.

```yaml
spec:
  labels:
    controls:
      - role: opt-out
        name: automation:skip
        color: "111111"
        description: Exclude this item from automation.

  stages:
    - name: approved
      label:
        name: automation:approved
    - name: ready
      label:
        color: "7C3AED"

  profiles:
    - name: incident-review
      default: false
      priority: 100
      selector:
        allLabels: [incident-review]
      routes:
        approved: claim
      implementation:
        prompt: incident-review
        guidance: null
        heading: Incident review instructions
```

The compiler rejects duplicate labels, dangling branches, unsupported DSL versions,
unknown approval routes, missing security roles, and malformed profiles. Label names are
policy data rather than runtime constants. The opt-out label can be renamed, but an
`opt-out` role must always exist.

### Profiles

The default `basic` profile routes approved work through curation and then implementation.
Profiles select issues by labels and can choose an approval branch, implementation prompt,
trusted guidance file, and heading. Higher-priority matching profiles win; exactly one
profile must be the default.

### Implementation providers

`profile.implementation.provider` selects which agent performs the implementation step for
issues matching that profile. It defaults to `copilot` and is validated against a fixed,
code-defined allowlist — `copilot`, `claude`, or `codex` — so a caller overlay can never name
an arbitrary GitHub Action, only one of these three built-in behaviors:

```yaml
spec:
  profiles:
    - name: incident-review
      default: false
      priority: 100
      selector:
        allLabels: [incident-review]
      routes:
        approved: claim
      implementation:
        prompt: incident-review
        guidance: null
        heading: Incident review instructions
        provider: claude
```

**`copilot`** (the default) assigns the GitHub Copilot coding agent to the issue directly, as
Puppets has always done; it works out of band and Puppets later finds the pull request it
opens.

**`claude`** and **`codex`** run as GitHub Actions steps instead of an assignable bot.
Because a reusable workflow's `reconcile.js` step cannot itself invoke a `uses:` step, the
reconciler emits a small job descriptor (issue number, branch, provider, and prompt/directive
text — never raw issue or PR body content beyond what a human already sees) and a separate
`implement` job in `reconcile.yml` runs the pinned provider action, then deterministically
commits, pushes, and opens a **draft** pull request itself. Neither provider action is
trusted to create the pull request on its own; the draft state keeps claude/codex-authored
PRs subject to exactly the same CI and acceptance-review gates as a Copilot-authored one
before a maintainer sees them out of draft.

This job is entirely skipped — no checkout, no secrets used — for any caller where every
matching profile still uses `copilot`, so adopting providers is opt-in per profile and
existing callers are unaffected.

**Curation and acceptance review remain Copilot-only.** Selecting `claude` or `codex` only
changes who implements an approved issue; issue triage/curation and the acceptance-review
gate before merge still call the Copilot SDK (`copilotModel`) regardless of
`implementation.provider`. Puppets does not claim Copilot-free operation for a profile that
uses another implementation provider.

#### Secrets and permissions

`claude` needs `secrets.anthropic_api_key` or `secrets.claude_code_oauth_token` (the latter
from `claude setup-token`, for Claude Pro/Max plan users, as an alternative to a metered API
key); `codex` needs `secrets.openai_api_key`. Wire only the secret(s) your chosen provider(s)
need through the caller workflow's `secrets:` block (see `caller-template.yml`), and set the
caller's top-level `permissions.contents` to `write` — the `implement` job needs it to push
branches and open pull requests, and a reusable workflow can never be granted more than the
calling workflow allows. See [Getting started](getting-started.md) for the full setup and a
dry-run test procedure.

## Explore the files

The explorer shows the fully commented basic workflow and a minimal caller overlay. Select
a file to inspect it, then use **Copy** to place its contents on the clipboard.

<div class="file-explorer" data-file-explorer>
  <nav class="file-explorer-tree" aria-label="Puppets configuration files">
    <div class="file-tree-root">puppets/</div>
    <button type="button" class="file-tree-item is-active"
      data-file-name="config/workflow.yml"
      data-file-url="https://raw.githubusercontent.com/JeffSteinbok/puppets/main/config/workflow.yml">
      <span aria-hidden="true">◇</span> config/workflow.yml
    </button>
    <div class="file-tree-root">caller repository/</div>
    <button type="button" class="file-tree-item"
      data-file-name=".puppets/config.json"
      data-file-url="{{ '/examples/config.json' | relative_url }}">
      <span aria-hidden="true">{ }</span> .puppets/config.json
    </button>
    <button type="button" class="file-tree-item"
      data-file-name=".puppets/workflow.yml"
      data-file-url="{{ '/examples/postmortem-workflow.yml' | relative_url }}">
      <span aria-hidden="true">◇</span> .puppets/workflow.yml
    </button>
    <button type="button" class="file-tree-item"
      data-file-name=".puppets/prompts/postmortem.md"
      data-file-url="{{ '/examples/postmortem.md' | relative_url }}">
      <span aria-hidden="true">#</span> .puppets/prompts/postmortem.md
    </button>
  </nav>
  <section class="file-explorer-view" aria-live="polite">
    <header class="file-explorer-toolbar">
      <code data-file-explorer-name>config/workflow.yml</code>
      <div>
        <a data-file-explorer-open
          href="https://github.com/JeffSteinbok/puppets/blob/main/config/workflow.yml">
          Open
        </a>
        <button type="button" data-file-explorer-copy>Copy</button>
      </div>
    </header>
    <pre><code data-file-explorer-code>Loading workflow definition...</code></pre>
  </section>
</div>

## Prompt replacement

A Markdown file under `.puppets/prompts/` replaces the framework prompt with the same
name. Prompt files are capped at 20 KB and read only from the trusted default branch.

```text
.puppets/prompts/
  curation.md
  implementation.md
  postmortem.md
  acceptance-review.md
  remediation.md
```

Use prompt replacement for repository conventions, validation commands, generated files,
or domain-specific acceptance evidence. Security rules remain in runtime code and cannot be
replaced by a prompt.

Prompts referenced by a profile do not need to exist in the framework. A caller may add a
new `.puppets/prompts/<name>.md` file and select it from `.puppets/workflow.yml`.
