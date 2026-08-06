---
layout: default
title: Architecture
---

# Architecture

Puppets is a cloud-only harness: each managed repository initiates its own run, grants its
own permissions, and calls shared public code using GitHub Actions compute. There is no
inbound controller, external state store, or broad cross-repository token.

<pre class="mermaid">
flowchart LR
    subgraph github["GitHub cloud"]
        subgraph repo["Managed repository"]
            trigger["Schedule or manual trigger"]
            caller["Caller workflow"]
            policy["Trusted .puppets config and prompts"]
            secrets["Repository permissions and secrets"]
            state["Issues, labels, comments, and pull requests"]
            checks["Repository CI and checks"]
        end

        subgraph actions["GitHub Actions compute"]
            reusable["Puppets reusable workflow"]
            resolve["Resolve and validate policy"]
            reconcile["Reconcile next lifecycle step"]
            implement["Provider implementation job"]
            review["Acceptance review"]
        end

        subgraph providers["Implementation providers"]
            copilot["GitHub Copilot"]
            claude["Claude Code"]
            codex["OpenAI Codex"]
        end
    end

    framework["Public Puppets framework"] -->|"selected ref"| reusable
    trigger --> caller
    secrets --> caller
    caller -->|"workflow_call"| reusable
    reusable --> resolve
    policy --> resolve
    resolve --> reconcile
    state -->|"current lifecycle state"| reconcile
    reconcile -->|"labels and comments"| state
    reconcile -->|"assign"| copilot
    reconcile -->|"implementation_jobs"| implement
    implement --> claude
    implement --> codex
    copilot -->|"branch and draft PR"| state
    claude -->|"workspace changes"| implement
    codex -->|"workspace changes"| implement
    implement -->|"branch and draft PR"| state
    state --> checks
    checks --> review
    review -->|"pass, remediate, or escalate"| reconcile
</pre>

## Responsibility split

| Concern | Managed repository | Public framework |
|---|---|---|
| Schedule and event triggers | Owns | Receives the invocation |
| Permissions | Declares the maximum | Cannot elevate them |
| Repository mutations | Uses local token | Executes through caller context |
| Lifecycle defaults | May safely overlay | Owns canonical model |
| Prompts | May replace trusted files | Owns canonical prompts |
| Runtime code | None copied locally | Versioned and tested centrally |
| Upgrade | Changes one framework version | Publishes compatible versions |

## What happens during a run

<ol class="architecture-steps">
  <li>
    <strong>Resolve the framework revision.</strong>
    Puppets reads GitHub's signed reusable-workflow claim to identify the selected framework
    version.
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

## Framework packaging

The caller selects a published framework version in its `uses` reference. Puppets uses
GitHub's signed reusable-workflow identity to load the matching framework runtime.

The reusable workflow never assumes framework files exist in the caller checkout. It checks
out the public framework into an isolated directory, installs the locked runtime, and loads
the reconciler from that revision.

```yaml
jobs:
  reconcile:
    uses: JeffSteinbok/puppets/.github/workflows/reconcile.yml@v1
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

## Implementation providers

A profile's `implementation.provider` (`copilot` by default, or `claude`/`codex`) selects
who performs the implementation step. Copilot is assigned directly; Claude and Codex run in
the provider job shown above and hand their workspace changes back to Puppets, which opens a
draft pull request. The rest of the lifecycle remains provider-agnostic and inspects the
resulting pull request.

See [Configuration → Implementation providers](configuration.html#implementation-providers)
for setup.

## State machine

The primary lifecycle is intentionally linear. A profile can skip curation and claim an
approved issue directly; issues needing more detail wait before approval.

<pre class="mermaid">
stateDiagram-v2
    direction LR
    state "needs-info" as needs_info
    state "in-review" as in_review

    [*] --> untracked
    untracked --> needs_info: needs-info
    untracked --> approved: approved label
    needs_info --> approved: approved label
    approved --> curating: curate
    curating --> ready: pass
    ready --> claimed: claim
    approved --> claimed: direct claim
    claimed --> verifying: verify
    verifying --> in_review: pass
    in_review --> done: complete
    done --> [*]
</pre>

Recovery paths are shown separately so they do not obscure the main flow. Retry outcomes
remain in the current stage; actionable failures enter `needs-work`; policy decisions or
exhausted retries enter `needs-human`.

<pre class="mermaid">
stateDiagram-v2
    direction LR
    state "active stage" as active
    state "needs-work" as needs_work
    state "needs-human" as needs_human

    active --> active: retry or wait
    active --> needs_work: remediate
    needs_work --> needs_work: retry
    needs_work --> active: verify again
    active --> needs_human: escalate
    needs_work --> needs_human: escalate
    needs_human --> active: approve or queue
    active --> done: complete
    needs_human --> done: complete
</pre>

Branch names are declared outcomes, not model choices: trusted handlers emit an outcome and
the compiled machine selects its target.

## Trust boundary

The runtime, not editable workflow data, enforces approval provenance, current actor
permission, the configured opt-out role, trusted-default-branch configuration, fork
isolation, and transition validation. Issue, pull-request, diff, and check text remains
untrusted data, and provider selection cannot replace framework-controlled actions or
weaken these invariants.
