---
layout: default
title: Architecture
---

# Architecture

```text
managed public repository
  .github/workflows/puppets.yml
  .github/puppets/config.json
  .github/puppets/lifecycle.json       optional overlay
  .github/puppets/prompts/*.md         optional replacements
                  |
                  | workflow_call pinned to a commit SHA
                  v
JeffSteinbok/puppets
  reusable workflow
  reconciler runtime
  default lifecycle and prompts
  configuration resolver and tests
```

The managed repository starts every run. The reusable workflow executes in the caller's
context and cannot elevate permissions beyond those declared by the caller.

The caller supplies the same immutable framework SHA in its `uses` reference and
`framework_ref` input. GitHub exposes the caller workflow ref inside a reusable workflow,
so the explicit input is required to check out the matching framework runtime.

Version 1 uses a daily schedule and manual dry runs. Repository-local event triggers may be
added later, while the schedule remains the self-healing reconciliation pass.

The issue is the authoritative state record. Pull-request labels are projections and cannot
advance the linked issue.
