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

Puppets compiles a versioned, Goobers-style workflow definition before it performs any
mutation. The built-in [`basic` workflow](https://github.com/JeffSteinbok/puppets/blob/main/config/workflow.yml)
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
