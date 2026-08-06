---
layout: default
title: Puppets
---

<section class="puppets-hero">
  <div>
    <h1>Puppets</h1>
    <p>
      A pure cloud-based automation harness that turns approved GitHub issues into reviewed
      pull requests using GitHub Actions compute and repository-owned policy.
    </p>
    <div class="puppets-actions">
      <a class="puppets-button" href="getting-started.html">Install Puppets</a>
      <a class="puppets-button secondary" href="https://github.com/JeffSteinbok/puppets">View on GitHub</a>
    </div>
  </div>
  <img class="puppets-logo" src="{{ '/assets/puppetslogo.png' | relative_url }}" alt="Puppets logo">
</section>

## Pure cloud automation on GitHub

Puppets has no controller service, server, database, or inbound webhook to deploy. Each
repository runs a small caller workflow on GitHub-hosted runners, while issues, labels,
workflow runs, and pull requests hold the complete lifecycle state. The repository owns its
triggers, permissions, credentials, provider selection, and local policy.

GitHub documents standard GitHub-hosted runner usage as
[free for public repositories](https://docs.github.com/en/billing/reference/actions-runner-pricing).
Larger runners and external model-provider usage may still incur their own charges.

## From issue to reviewed pull request

Puppets is a gated lifecycle, not a fire-and-forget agent assignment. GitHub labels carry
the durable state, while a small scheduled workflow repeatedly reconciles the next safe
step.

1. **An issue is filed.** A deterministic check asks for more information when the report
   is too thin. No model runs yet.
2. **A maintainer approves it.** Applying `puppets:approved` is the human trust gate.
   Puppets verifies who applied the label and checks their current repository permission.
3. **Curation screens the work.** A read-only agent checks for abuse, duplicates,
   feasibility, and useful classification without changing code.
4. **The selected provider implements it.** A ready issue is admitted under repository
   limits, implemented by Copilot, Claude Code, or Codex, and linked to the resulting pull
   request.
5. **Evidence is verified.** Normal CI must pass, then an acceptance-review gate judges the
   diff against the issue and available check evidence.
6. **Failures loop or escalate.** Actionable findings return to Copilot for bounded
   remediation. Ambiguity, exhausted retries, or product decisions move to
   `puppets:needs-human`.
7. **A maintainer merges.** Puppets observes the merge and closes the lifecycle as
   `puppets:done`. Version 1 never auto-merges.

## The default `basic` workflow labels

| State | Meaning |
|---|---|
| `puppets:needs-info` | The issue needs enough concrete detail to enter the approval queue. |
| `puppets:approved` | A trusted maintainer approved spending automation and model resources. |
| `puppets:curating` | Read-only curation is screening and classifying the issue. |
| `puppets:ready` | The issue passed curation and is waiting for an available work slot. |
| `puppets:claimed` | Copilot has been assigned and implementation is in progress. |
| `puppets:verifying` | CI is green and acceptance evidence is being reviewed. |
| `puppets:needs-work` | The linked PR needs bounded remediation. |
| `puppets:in-review` | Automated gates passed; the PR awaits maintainer review or merge. |
| `puppets:needs-human` | A decision or intervention cannot be made safely by automation. |
| `puppets:done` | The linked PR merged and the lifecycle is complete. |
| `puppets:no-auto` | Absolute opt-out; Puppets must not touch the issue or linked PR. |

The issue is authoritative. Labels mirrored onto a linked pull request are visibility
projections and cannot advance the issue. Callers may rename these labels in
`.puppets/workflow.yml`; the runtime follows stage and control roles rather than fixed
label strings.

## Small in every repository, shared in one place

Each managed repository checks in:

```text
.github/workflows/puppets.yml
.puppets/
  config.json
  workflow.yml        # optional versioned DSL overlay
  prompts/             # optional replacements
```

The caller workflow owns triggers, concurrency, explicit permissions, and local secrets. It
calls this public framework at an explicit release tag or commit SHA. The framework owns
the reusable workflow, runtime, default lifecycle, prompts, configuration validation, and
regression tests.

There is no central repository list, no inbound webhook, and no broad token reaching into a
troupe of repositories.

## Why it is inexpensive

- [Standard GitHub-hosted runners are free for public repositories](https://docs.github.com/en/billing/reference/actions-runner-pricing).
- Actions usage is attributed to the public caller repository, not a private controller.
- Deterministic filtering happens before model calls.
- No model runs before a maintainer approves the issue.
- The default schedule admits at most one new issue and two in-flight issues per repository.
- State and sticky verdict comments prevent unnecessary repeated inference.
- Event-driven triggers remain optional; a staggered daily reconciliation is the initial
  self-healing safety net.

Copilot and model requests remain separately metered. Moving execution to public callers
does not make those requests free.

## Data-driven, but not security-configurable

The default `workflow.yml` declares named stages, handler types, outcome branches, labels,
profiles, in-flight accounting, pull-request projection, and terminal behavior. A caller
may overlay that machine or add prompts from its trusted default branch.

Configuration cannot weaken these runtime invariants:

- no privileged work before verified approval provenance;
- permission lookup failures fail closed;
- the configured opt-out label suppresses all processing;
- fork or pull-request-head code never executes with write credentials;
- issue, PR, diff, and check text is untrusted data, never instruction;
- unknown transitions and invalid configuration are rejected before mutation; and
- uncertain output or retry exhaustion escalates to a human.

## Specialized profiles

Repository policy can add profiles for work such as incident reviews, release notes, or
dependency updates without adding new runtime behavior. A profile selects labels, routing,
and a trusted prompt while retaining the ordinary Puppets trust and review gates.

The `obsidian-onedrive` pilot happens to use this mechanism for postmortem hardening; the
runtime has no postmortem-specific code.

## Install in a repository

1. Copy the
   [caller template](https://github.com/JeffSteinbok/puppets/blob/main/caller-template.yml)
   to `.github/workflows/puppets.yml`.
2. Replace `FRAMEWORK_REF` with a release tag such as `v1`, or a full commit SHA for
   strict pinning.
3. Add `.puppets/config.json`:

   ```json
   {
     "version": 1,
     "approvalActors": ["YOUR_GITHUB_LOGIN"]
   }
   ```

4. Add a repository-scoped `PUPPETS_TOKEN` only if the caller's `GITHUB_TOKEN` cannot
   perform Copilot assignment.
5. Run **Puppets** manually with `dry_run: true`.
6. Review the workflow summary, then enable the staggered schedule.

## Go deeper

<div class="puppets-grid">
  <a class="puppets-card puppets-link-card" href="getting-started.html">
    <strong>Getting started</strong>
    <span>Complete caller workflow, permissions, credentials, dry run, and upgrade process.</span>
  </a>
  <a class="puppets-card puppets-link-card" href="architecture.html">
    <strong>Architecture</strong>
    <span>Caller context, reusable workflow packaging, credentials, and state ownership.</span>
  </a>
  <a class="puppets-card puppets-link-card" href="configuration.html">
    <strong>Configuration</strong>
    <span>Limits, ignored labels, lifecycle overlays, and trusted prompt replacement.</span>
  </a>
  <a class="puppets-card puppets-link-card" href="security.html">
    <strong>Security</strong>
    <span>Approval provenance, untrusted input, fork isolation, and protected invariants.</span>
  </a>
  <a class="puppets-card puppets-link-card" href="profiles.html">
    <strong>Specialized profiles</strong>
    <span>Customize routing and prompts without creating special-case runtime behavior.</span>
  </a>
</div>
