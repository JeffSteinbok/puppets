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

<aside class="puppets-note">
  <strong>Public repository compute is generally free.</strong>
  GitHub documents standard GitHub-hosted runner usage as
  <a href="https://docs.github.com/en/billing/reference/actions-runner-pricing">free for public repositories</a>.
  Larger runners and external model-provider usage may still incur their own charges.
</aside>

## From issue to reviewed pull request

Puppets is a gated lifecycle, not a fire-and-forget agent assignment. GitHub labels carry
the durable state, while a small scheduled workflow repeatedly reconciles immediate safe
steps (bounded per run).

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

<aside class="puppets-note">
  <strong>This workflow is a starting point, not a fixed process.</strong>
  Repositories can override label names, colors, descriptions, stages, routes, profiles,
  prompts, and provider selection in <code>.puppets/workflow.yml</code>. Puppets preserves
  the configured workflow while continuing to enforce its non-overridable security
  boundaries.
</aside>

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

<pre class="no-copy"><code>
.github/workflows/puppets.yml
.puppets/
  config.json
  workflow.yml        # optional versioned DSL overlay
  prompts/            # optional replacements
</code></pre>

The caller workflow owns triggers, concurrency, explicit permissions, and local secrets. It
calls a published version of this public framework. The framework owns
the reusable workflow, runtime, default lifecycle, prompts, configuration validation, and
regression tests.

Deterministic filtering, human approval, admission limits, and sticky verdict comments
avoid unnecessary model calls. Copilot and external provider requests remain separately
metered.

## Ready to start?

<a class="puppets-button" href="getting-started.html">Get started with Puppets</a>
