---
layout: default
title: Configuration
---

# Configuration and overrides

Configuration is loaded only from the caller repository's default branch.

## `.github/puppets/config.json`

```json
{
  "version": 1,
  "approvalActors": ["JeffSteinbok"],
  "maxNewIssues": 1,
  "maxInFlight": 2,
  "conflictRetries": 2,
  "reviewRetries": 2,
  "copilotModel": "auto",
  "enableCuration": true,
  "staleHours": 72,
  "ignoreLabels": []
}
```

Unknown keys and invalid values fail before mutation.

`ignoreLabels` supports repository-owned processes that should coexist with Puppets without
entering its generic lifecycle. Ignored issues are excluded from triage, inbox reporting,
assignment, and pull-request reconciliation.

## Lifecycle overlay

`.github/puppets/lifecycle.json` overlays the framework lifecycle by object key. Arrays
replace the default array at that key. Protected state labels and `puppets:no-auto` cannot
be removed or renamed.

## Prompt replacement

A Markdown file under `.github/puppets/prompts/` replaces the framework prompt with the same
name. Prompt files are capped at 20 KB and read only from the trusted default branch.
