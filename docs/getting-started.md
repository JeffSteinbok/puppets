---
layout: default
title: Getting started
---

# Getting started

Onboarding requires one lightweight workflow, one local configuration file, and optionally
one repository-scoped token. The lifecycle implementation remains in the public Puppets
framework.

## 1. Choose a framework revision

Use a release tag such as `v1` for simple upgrades, or a full 40-character commit SHA when
you want strict, reviewable pinning. Avoid `main`, because it changes without an explicit
caller update.

```console
gh api repos/JeffSteinbok/puppets/commits/main --jq .sha
```

The command above retrieves the current commit SHA if you choose strict pinning. Use the
exact same tag or SHA in both marked locations in the workflow below.

## 2. Add the caller workflow

Create `.github/workflows/puppets.yml`:

```yaml
name: Puppets

on:
  # Start with one inexpensive self-healing pass each day. Stagger repositories
  # by changing the minute field so they do not all run simultaneously.
  schedule:
    - cron: "10 16 * * *"

  # Manual runs are used for onboarding, dry runs, and immediate reconciliation.
  workflow_dispatch:
    inputs:
      dry_run:
        description: Report intended mutations without applying them
        required: false
        default: false
        type: boolean

# Never let two lifecycle passes race in the same repository.
concurrency:
  group: puppets-${{ github.repository }}
  cancel-in-progress: false

# These are the maximum permissions available to the reusable workflow.
# The called workflow cannot elevate beyond them.
permissions:
  actions: write
  contents: read
  # Allows Puppets to identify the exact commit behind its tag or SHA reference.
  id-token: write
  issues: write
  pull-requests: write
  copilot-requests: write

jobs:
  reconcile:
    # Use a release tag such as v1 for convenience, or a full commit SHA for strict pinning.
    uses: JeffSteinbok/puppets/.github/workflows/reconcile.yml@FRAMEWORK_REF
    with:
      dry_run: ${{ inputs.dry_run || false }}
      caller_workflow: puppets.yml
    secrets:
      # Optional. Leave the repository secret unset first; add it only if the
      # built-in GITHUB_TOKEN cannot assign the Copilot coding agent.
      token: ${{ secrets.PUPPETS_TOKEN }}
```

Puppets reads GitHub's signed OIDC `job_workflow_sha` claim to check out the exact commit
behind the single `uses` reference. This works for both release tags and commit SHAs.

### Why each permission exists

| Permission | Used for |
|---|---|
| `contents: read` | Read trusted caller configuration and prompts from the default branch. |
| `id-token: write` | Read GitHub's signed reusable-workflow commit claim. |
| `issues: write` | Reconcile labels, comments, assignments, and issue state. |
| `pull-requests: write` | Track linked PRs, update branches, and maintain projected state. |
| `actions: write` | Re-run Copilot-authored workflow runs left in `action_required`. |
| `copilot-requests: write` | Run tool-free curation and acceptance-review SDK sessions. |

Do not add broader permissions unless a specific enabled feature requires them.

## 3. Add repository policy

Create `.puppets/config.json`:

```json
{
  "version": 1,
  "approvalActors": [
    "YOUR_GITHUB_LOGIN"
  ],
  "maxNewIssues": 1,
  "maxInFlight": 2
}
```

`approvalActors` is an allowlist, not the whole authorization decision. At runtime Puppets
also confirms that the actor who applied `puppets:approved` still has write, maintain,
triage, or admin permission in the repository.

See the [configuration reference](configuration.html) for every setting, ignored labels,
lifecycle overlays, and trusted prompt replacements.

## 4. Decide whether a separate token is needed

Try the first dry run without creating `PUPPETS_TOKEN`. The caller's `GITHUB_TOKEN` is
preferred because it is short-lived and repository-scoped.

If GitHub permits lifecycle mutations but cannot assign the Copilot coding agent, add a
fine-grained token as the repository Actions secret `PUPPETS_TOKEN`. Scope it only to this
repository and only to the permissions the failed operation requires.

Never reuse one broad token across all managed repositories.

## 5. Run a dry run

```console
gh workflow run puppets.yml --repo OWNER/REPOSITORY -f dry_run=true
gh run watch --repo OWNER/REPOSITORY
```

The first run validates configuration, resolves framework defaults, inspects repository
state, and reports intended label or lifecycle mutations without applying them.

Review:

- the resolved approval actors and ignored labels;
- any invalid configuration error;
- issues that would enter `needs-info`;
- existing downstream labels rejected for missing approval provenance; and
- the workflow summary's attention list.

## 6. Enable live reconciliation

Run the workflow manually with `dry_run: false`. Confirm labels were created and no
unapproved issue invoked a model or coding agent. The checked-in schedule then becomes the
self-healing pass.

To start work on an issue:

1. Ensure the issue has enough concrete detail.
2. Apply `puppets:approved` as an allowlisted maintainer.
3. Run Puppets manually or wait for the next schedule.
4. Follow the issue and linked pull-request labels through the lifecycle.

Apply `puppets:no-auto` whenever an issue or linked PR must be entirely excluded.

## 7. Integrate repository-owned processes

Domain-specific automation should remain local. Add its stable label to `ignoreLabels`, and
apply `puppets:no-auto` to tracking issues when an absolute opt-out is appropriate.

```json
{
  "version": 1,
  "approvalActors": ["YOUR_GITHUB_LOGIN"],
  "ignoreLabels": ["postmortem"]
}
```

The `obsidian-onedrive` pilot uses this pattern for its merged-bug postmortem workflow. See
[postmortem integration](postmortem.html).

## 8. Upgrade safely

1. Review the target Puppets commit and release notes.
2. Change both SHA occurrences in the caller workflow.
3. Open a pull request in the managed repository.
4. Run `workflow_dispatch` with `dry_run: true` from the updated default branch after merge.
5. Keep rollback simple: restore the previous known-good SHA.

Because configuration and durable state remain in the caller repository and GitHub labels,
upgrading the shared runtime does not migrate an external database.

## Complete examples

- [Canonical caller template](https://github.com/JeffSteinbok/puppets/blob/main/caller-template.yml)
- [Live `obsidian-onedrive` caller](https://github.com/JeffSteinbok/obsidian-onedrive/blob/main/.github/workflows/puppets.yml)
- [Live pilot configuration](https://github.com/JeffSteinbok/obsidian-onedrive/blob/main/.puppets/config.json)
