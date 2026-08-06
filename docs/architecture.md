---
layout: default
title: Architecture
---

# Architecture

Puppets is a cloud-only harness: each managed repository initiates its own run, grants its
own permissions, and calls shared public code using GitHub Actions compute. There is no
inbound controller, external state store, or broad cross-repository token.

<div class="architecture-map-frame">
<svg class="architecture-map" viewBox="0 0 1100 620" role="img"
  aria-labelledby="architecture-map-title architecture-map-description">
  <title id="architecture-map-title">Puppets repository ownership and control flow</title>
  <desc id="architecture-map-description">
    The managed repository owns its caller workflow, policy, secrets, issues, pull requests,
    and checks. The public Puppets repository owns the reusable workflow, runtime, defaults,
    and prompts. GitHub Actions runs that shared code in the managed repository context and
    sends approved implementation work to Copilot, Claude Code, or Codex.
  </desc>
  <defs>
    <marker id="architecture-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4"
      orient="auto" markerUnits="strokeWidth">
      <path class="map-arrowhead" d="M0,0 L8,4 L0,8 Z"/>
    </marker>
    <filter id="architecture-glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <path id="flow-invoke" class="map-flow" marker-end="url(#architecture-arrow)"
    d="M315 130 C355 130 345 375 390 375"/>
  <path id="flow-framework" class="map-flow" marker-end="url(#architecture-arrow)"
    d="M535 255 L535 325"/>
  <path id="flow-policy" class="map-flow map-flow-secondary"
    marker-end="url(#architecture-arrow)" d="M315 245 C355 245 345 430 390 430"/>
  <path id="flow-provider" class="map-flow" marker-end="url(#architecture-arrow)"
    d="M680 410 C725 410 715 300 760 300"/>
  <path id="flow-pr" class="map-flow" marker-end="url(#architecture-arrow)"
    d="M760 390 C690 570 390 595 250 520"/>
  <path id="flow-feedback" class="map-flow map-flow-secondary"
    marker-end="url(#architecture-arrow)" d="M315 465 C350 465 355 500 390 500"/>

  <rect class="map-zone" x="20" y="20" width="295" height="560" rx="22"/>
  <text class="map-zone-kicker" x="45" y="55">YOUR REPOSITORY</text>
  <text class="map-zone-title" x="45" y="79">Managed repository</text>

  <rect class="map-item" x="45" y="100" width="245" height="78" rx="12"/>
  <text class="map-item-title" x="65" y="129">Caller workflow</text>
  <text class="map-item-code" x="65" y="153">.github/workflows/puppets.yml</text>

  <rect class="map-item" x="45" y="200" width="245" height="105" rx="12"/>
  <text class="map-item-title" x="65" y="229">Repository policy</text>
  <text class="map-item-code" x="65" y="253">.puppets/config.json</text>
  <text class="map-item-code" x="65" y="277">workflow.yml + prompts/</text>

  <rect class="map-item map-item-state" x="45" y="335" width="245" height="190" rx="12"/>
  <text class="map-item-title" x="65" y="364">GitHub state and output</text>
  <text class="map-item-line" x="65" y="394">Issues + approval labels</text>
  <text class="map-item-line" x="65" y="422">Repository secrets</text>
  <text class="map-item-line" x="65" y="450">Implementation branches</text>
  <text class="map-item-line" x="65" y="478">Draft pull requests</text>
  <text class="map-item-line" x="65" y="506">CI checks + review state</text>

  <rect class="map-zone" x="370" y="20" width="330" height="235" rx="22"/>
  <text class="map-zone-kicker" x="395" y="55">PUBLIC REPOSITORY</text>
  <text class="map-zone-title" x="395" y="79">JeffSteinbok/puppets</text>

  <rect class="map-item" x="395" y="100" width="280" height="58" rx="12"/>
  <text class="map-item-title" x="415" y="126">Reusable workflow</text>
  <text class="map-item-code" x="415" y="147">.github/workflows/reconcile.yml</text>

  <rect class="map-item" x="395" y="174" width="280" height="58" rx="12"/>
  <text class="map-item-title" x="415" y="199">Shared framework</text>
  <text class="map-item-code" x="415" y="220">runtime + defaults + prompts</text>

  <rect class="map-zone map-zone-runtime" x="370" y="325" width="330" height="255" rx="22"/>
  <text class="map-zone-kicker" x="395" y="360">EPHEMERAL COMPUTE</text>
  <text class="map-zone-title" x="395" y="384">GitHub Actions run</text>
  <text class="map-zone-note" x="395" y="407">Runs with your repository's token and permissions</text>

  <rect class="map-runtime-step" x="395" y="430" width="82" height="68" rx="11"/>
  <text class="map-runtime-number" x="436" y="455">1</text>
  <text class="map-runtime-label" x="436" y="480">Load policy</text>
  <rect class="map-runtime-step" x="493" y="430" width="82" height="68" rx="11"/>
  <text class="map-runtime-number" x="534" y="455">2</text>
  <text class="map-runtime-label" x="534" y="480">Advance work</text>
  <rect class="map-runtime-step" x="591" y="430" width="84" height="68" rx="11"/>
  <text class="map-runtime-number" x="633" y="455">3</text>
  <text class="map-runtime-label" x="633" y="480">Check result</text>
  <text class="map-zone-note" x="535" y="535" text-anchor="middle">
    Reads state, takes one safe step, writes the result back
  </text>

  <rect class="map-zone" x="760" y="150" width="320" height="300" rx="22"/>
  <text class="map-zone-kicker" x="785" y="185">SELECTED PER PROFILE</text>
  <text class="map-zone-title" x="785" y="209">Implementation provider</text>

  <rect class="map-provider" x="785" y="235" width="270" height="52" rx="12"/>
  <text class="map-provider-name" x="810" y="267">GitHub Copilot</text>
  <rect class="map-provider" x="785" y="303" width="270" height="52" rx="12"/>
  <text class="map-provider-name" x="810" y="335">Claude Code</text>
  <rect class="map-provider" x="785" y="371" width="270" height="52" rx="12"/>
  <text class="map-provider-name" x="810" y="403">OpenAI Codex</text>

  <g class="map-callout" transform="translate(330 105)">
    <circle r="13"/><text y="4">1</text>
  </g>
  <g class="map-callout" transform="translate(560 287)">
    <circle r="13"/><text y="4">2</text>
  </g>
  <g class="map-callout" transform="translate(725 385)">
    <circle r="13"/><text y="4">3</text>
  </g>
  <g class="map-callout" transform="translate(590 567)">
    <circle r="13"/><text y="4">4</text>
  </g>
  <g class="map-callout" transform="translate(345 487)">
    <circle r="13"/><text y="4">5</text>
  </g>

  <g class="map-particle">
    <circle r="5"><animateMotion dur="3s" repeatCount="indefinite"><mpath href="#flow-invoke"/></animateMotion></circle>
    <circle r="5"><animateMotion dur="2.4s" begin=".6s" repeatCount="indefinite"><mpath href="#flow-framework"/></animateMotion></circle>
    <circle r="5"><animateMotion dur="3s" begin="1.2s" repeatCount="indefinite"><mpath href="#flow-policy"/></animateMotion></circle>
    <circle r="5"><animateMotion dur="2.8s" begin="1.8s" repeatCount="indefinite"><mpath href="#flow-provider"/></animateMotion></circle>
    <circle r="5"><animateMotion dur="4s" begin="2.4s" repeatCount="indefinite"><mpath href="#flow-pr"/></animateMotion></circle>
    <circle r="5"><animateMotion dur="2.4s" begin="3s" repeatCount="indefinite"><mpath href="#flow-feedback"/></animateMotion></circle>
  </g>
</svg>
</div>

<ol class="architecture-map-legend">
  <li>The caller invokes the shared workflow.</li>
  <li>Actions loads framework code and trusted local policy.</li>
  <li>Puppets sends approved work to the selected provider.</li>
  <li>The provider's changes return as a branch and draft PR.</li>
  <li>CI and review results feed the next reconciliation pass.</li>
</ol>

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
