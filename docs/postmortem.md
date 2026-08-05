---
layout: default
title: Postmortem integration
---

# Postmortem and repository-owned process integration

Puppets supports repository-specific automation without absorbing every process into the
generic lifecycle.

For `obsidian-onedrive`, the existing postmortem process remains repository-owned:

1. A merged bug-fix pull request creates a postmortem tracking issue.
2. The repository assigns Copilot using its local postmortem skill.
3. Copilot opens a hardening pull request.
4. Local guard and publish workflows validate the writeup and mirror it to the issue.

The local Puppets configuration includes `"ignoreLabels": ["postmortem"]`, and newly
created postmortem issues also receive `puppets:no-auto`. This prevents Puppets from
triaging, assigning, or reconciling the same work while preserving the existing process,
markers, branch naming, and security controls.

This is the extension contract for similar repository-owned processes:

- detection and domain-specific triggers stay in the managed repository;
- the local process labels its tracking issue with `puppets:no-auto`, or declares a stable
  label in `ignoreLabels`;
- `pull_request_target` workflows remain metadata-only and never check out untrusted head
  code with write credentials; and
- idempotency markers remain owned by the local process.

Future shared postmortem helpers may live in this public repository, but callers must opt in
explicitly and remain the source of triggers and permissions.
