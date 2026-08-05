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
| `enableCuration` | `true` | Run read-only screening before implementation. |
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
    "postmortem",
    "manual-only"
  ]
}
```

### Ignored processes

`ignoreLabels` supports repository-owned processes that should coexist with Puppets without
entering its generic lifecycle. Ignored issues are excluded from triage, inbox reporting,
assignment, and pull-request reconciliation.

## Lifecycle overlay

`.puppets/lifecycle.json` overlays the framework lifecycle by object key. Arrays
replace the default array at that key. Protected state labels and `puppets:no-auto` cannot
be removed or renamed.

For example, a repository can change display metadata without copying the full lifecycle:

```json
{
  "states": {
    "ready": {
      "color": "7C3AED",
      "description": "Approved and queued for the next available implementation slot."
    }
  }
}
```

The resolver rejects duplicate labels, unknown transition targets, unsupported schema
versions, and changes to protected state labels.

## Prompt replacement

A Markdown file under `.puppets/prompts/` replaces the framework prompt with the same
name. Prompt files are capped at 20 KB and read only from the trusted default branch.

```text
.puppets/prompts/
  curation.md
  implementation.md
  acceptance-review.md
  remediation.md
```

Use prompt replacement for repository conventions, validation commands, generated files,
or domain-specific acceptance evidence. Security rules remain in runtime code and cannot be
replaced by a prompt.
