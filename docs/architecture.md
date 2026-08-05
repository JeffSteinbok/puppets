---
layout: default
title: Architecture
---

# Architecture

Puppets reverses the usual central-controller model: each managed repository initiates its
own run, grants its own permissions, and calls shared public code at an immutable revision.

<div class="architecture-flow" aria-label="Puppets execution architecture">
  <section class="architecture-node caller-node">
    <span class="architecture-eyebrow">Managed repository</span>
    <strong>Caller owns authority</strong>
    <ul>
      <li>Triggers and concurrency</li>
      <li>Explicit job permissions</li>
      <li>Repository-scoped secrets</li>
      <li>Local configuration and prompts</li>
    </ul>
  </section>

  <div class="architecture-arrow">
    <span>workflow_call</span>
    <strong>Immutable SHA →</strong>
  </div>

  <section class="architecture-node framework-node">
    <span class="architecture-eyebrow">Public framework</span>
    <strong>Shared implementation</strong>
    <ul>
      <li>Reusable workflow</li>
      <li>Reconciler runtime</li>
      <li>Lifecycle and prompt defaults</li>
      <li>Resolver, validation, and tests</li>
    </ul>
  </section>
</div>

<div class="architecture-rule">
  <strong>No inbound controller.</strong>
  The caller invokes Puppets; Puppets does not scan a repository list or reach into callers
  with a broad cross-repository token.
</div>

## Responsibility split

| Concern | Managed repository | Public framework |
|---|---|---|
| Schedule and event triggers | Owns | Receives the invocation |
| Permissions | Declares the maximum | Cannot elevate them |
| Repository mutations | Uses local token | Executes through caller context |
| Lifecycle defaults | May safely overlay | Owns canonical model |
| Prompts | May replace trusted files | Owns canonical prompts |
| Runtime code | None copied locally | Versioned and tested centrally |
| Upgrade | Changes one pinned SHA | Publishes compatible revisions |

## What happens during a run

<ol class="architecture-steps">
  <li>
    <strong>Resolve the framework revision.</strong>
    Puppets reads GitHub's signed reusable-workflow claim to resolve the exact commit
    behind the caller's tag or SHA.
  </li>
  <li>
    <strong>Check out trusted sources separately.</strong>
    The framework and caller default branch are placed in isolated directories with
    persisted Git credentials disabled.
  </li>
  <li>
    <strong>Resolve policy before mutation.</strong>
    The versioned basic workflow merges with the caller's workflow overlay and prompts,
    then compiles into a validated state machine.
  </li>
  <li>
    <strong>Reconcile labels and state.</strong>
    The runtime derives current state from GitHub, verifies approval provenance, and takes
    at most the next allowed step.
  </li>
  <li>
    <strong>Publish an auditable summary.</strong>
    Outputs and the workflow summary report assignments, waiting items, and the resolved
    policy sources.
  </li>
</ol>

## Pinning and packaging

The caller supplies one framework tag or commit SHA in its `uses` reference. GitHub's
signed OIDC token includes `job_workflow_sha`, the exact commit selected for the reusable
workflow. Puppets uses that claim to check out the matching framework runtime.

The reusable workflow never assumes framework files exist in the caller checkout. It checks
out the public framework into an isolated directory, installs the locked runtime, and loads
the reconciler from that revision.

```yaml
jobs:
  reconcile:
    uses: JeffSteinbok/puppets/.github/workflows/reconcile.yml@FRAMEWORK_REF
    with:
      dry_run: ${{ inputs.dry_run || false }}
```

## Trigger strategy

Version 1 uses a daily schedule and manual dry runs. Repository-local event triggers may be
added later, while the schedule remains the self-healing reconciliation pass.

Schedules should be staggered across repositories to spread API and model traffic. Event
triggers, when added, remain local and invoke the same reusable workflow—never an inbound
webhook or cross-repository dispatch.

## State ownership

The issue is the authoritative state record. Pull-request labels are projections and cannot
advance the linked issue.

This makes reconciliation repeatable: every run derives state from labels and managed
comments rather than trusting an external database or a previous runner process. Overlapping
runs are serialized by the caller's repository-scoped concurrency group.

## State machine

The basic workflow compiles to this graph. Branch names are declared outcomes, not model
choices; trusted handlers emit an outcome and the compiled machine selects its target.

<pre class="mermaid">
stateDiagram-v2
    state "needs-info" as needs_info
    state "needs-work" as needs_work
    state "in-review" as in_review
    state "needs-human" as needs_human

    [*] --> untracked
    untracked --> needs_info: needs-info
    untracked --> approved: approved label
    needs_info --> approved: approved label
    approved --> curating: curate profile route
    approved --> claimed: claim profile route
    curating --> approved: retry
    curating --> ready: pass
    curating --> needs_human: escalate
    ready --> claimed: claim
    claimed --> verifying: verify
    claimed --> needs_work: remediate
    claimed --> needs_human: escalate
    verifying --> verifying: retry
    verifying --> needs_work: remediate
    verifying --> in_review: pass
    verifying --> needs_human: escalate
    needs_work --> verifying: verify
    needs_work --> needs_work: retry
    needs_work --> needs_human: escalate
    in_review --> verifying: verify
    in_review --> needs_work: remediate
    in_review --> in_review: wait
    in_review --> needs_human: escalate
    needs_human --> approved: approve
    needs_human --> ready: queue
    claimed --> done: complete
    verifying --> done: complete
    needs_work --> done: complete
    in_review --> done: complete
    needs_human --> done: complete
    done --> [*]
</pre>

## Trust boundary

The runtime, not editable workflow data, enforces approval provenance, current actor
permission, the configured opt-out role, trusted-default-branch configuration, fork
isolation, and transition validation. See the [security model](security.html) for the
complete set of protected invariants.
