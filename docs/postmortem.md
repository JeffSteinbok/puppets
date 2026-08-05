---
layout: default
title: Postmortem integration
---

# Postmortem integration

Puppets can run postmortem hardening work through the same approved issue-to-PR lifecycle.
The repository keeps the domain-specific trigger; Puppets owns assignment and lifecycle
reconciliation.

## How it works

1. A merged bug-fix pull request creates a postmortem tracking issue.
2. The trigger labels the issue `postmortem` but does not assign Copilot.
3. A trusted maintainer applies `puppets:approved`.
4. Puppets bypasses generic curation and assigns Copilot with the postmortem prompt.
5. Copilot opens a hardening pull request.
6. Repository-owned guard and publishing workflows can validate the writeup and mirror it
   to the tracking issue.

Postmortems retain the normal Puppets trust gate: no model or coding-agent assignment
occurs before verified human approval.

## Optional repository prompt

Puppets provides a generic postmortem prompt. Replace it for a repository by creating:

```text
.puppets/prompts/postmortem.md
```

The prompt is loaded only from the caller's trusted default branch. It can define local
build commands, required analysis format, branch naming, PR markers, and guard-workflow
expectations.

Repositories that do not want Puppets to process a particular postmortem can still apply
`puppets:no-auto`.
