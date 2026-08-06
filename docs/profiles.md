---
layout: default
title: Specialized profiles
---

# Specialized profiles

Postmortems are not a built-in Puppets feature. They are one example of a specialized
profile: repository-owned policy selects an issue, route, and prompt while the shared
runtime applies the same approval, assignment, verification, and review lifecycle.

## How specialized work fits

1. A repository-owned trigger or maintainer creates and labels an issue.
2. A workflow profile selects that label and declares its route and implementation prompt.
3. A trusted maintainer applies the configured approval label.
4. Puppets follows the selected route through the ordinary lifecycle.
5. Repository-owned checks validate any domain-specific output.

Profiles do not add executable handlers or weaken the trust gate. They only select declared
branches and trusted prompt files from the caller's default branch.

## Example: incident review

Declare the profile in `.puppets/workflow.yml`:

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
```

Then provide the repository prompt:

```text
.puppets/prompts/incident-review.md
```

The prompt is loaded only from the caller's trusted default branch. It can define local
build commands, required analysis format, branch naming, PR markers, and guard-workflow
expectations.

The `obsidian-onedrive` pilot uses this same mechanism for postmortem hardening. Nothing in
the runtime recognizes the word `postmortem`; another repository can define release-note,
dependency-update, incident-review, or other profiles in exactly the same way.
