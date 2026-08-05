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
