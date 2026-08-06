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
| `contents: read` | Read trusted caller configuration and prompts from the default branch. Change to `write` only if a profile uses the `claude` or `codex` implementation provider — see step 9. |
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
also confirms that the actor who applied the workflow's approval label still has write,
maintain, triage, or admin permission in the repository.

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

With the built-in `basic` profile, start work on an issue by:

1. Ensure the issue has enough concrete detail.
2. Apply `puppets:approved` as an allowlisted maintainer.
3. Run Puppets manually or wait for the next schedule.
4. Follow the issue and linked pull-request labels through the lifecycle.

Apply the workflow's configured opt-out label whenever an issue or linked PR must be
entirely excluded.

## 7. Add specialized profiles

Domain-specific routing belongs in `.puppets/workflow.yml`. For example, a postmortem
profile can match a repository label, bypass curation through the declared `claim` branch,
and select a custom prompt:

```yaml
spec:
  profiles:
    - name: postmortem
      default: false
      priority: 100
      selector:
        allLabels: [postmortem]
      routes:
        approved: claim
      implementation:
        prompt: postmortem
        guidance: null
        heading: Postmortem instructions
```

Repository-owned triggers still decide when to create and label the tracking issue. Puppets
owns the approved assignment and lifecycle after that.

## 8. Upgrade safely

1. Review the target Puppets commit and release notes.
2. Change the single framework reference in the caller workflow.
3. Open a pull request in the managed repository.
4. Run `workflow_dispatch` with `dry_run: true` from the updated default branch after merge.
5. Keep rollback simple: restore the previous known-good SHA.

Because configuration and durable state remain in the caller repository and GitHub labels,
upgrading the shared runtime does not migrate an external database.

## 9. Use Claude Code or Codex for implementation (optional)

By default every profile implements approved issues with the GitHub Copilot coding agent.
A profile can instead set `implementation.provider: claude` or `implementation.provider:
codex` (see [Configuration → Implementation providers](configuration.html)). Curation and
acceptance review always stay on Copilot regardless of this setting — only the
implementation step changes.

1. **Grant write access.** Set `permissions.contents: write` in the caller workflow. The
   reusable workflow's `implement` job needs it to push a branch and open a pull request;
   it can never be granted more than the caller allows here.
2. **Add the provider secret(s)** as repository Actions secrets, and pass them through in
   `secrets:`:
   - `claude`: either `ANTHROPIC_API_KEY` (a metered Anthropic API key) **or**
     `CLAUDE_CODE_OAUTH_TOKEN`. Claude Pro/Max subscribers can mint the latter by running
     `claude setup-token` locally and pasting the result into the repository secret — this
     avoids a separate metered API key. Do not attempt to copy a local `~/.claude` or
     ChatGPT browser session into CI; that login is local-only and out of scope for a
     GitHub Actions runner.
   - `codex`: `OPENAI_API_KEY`. Codex CLI's ChatGPT-subscription browser login is likewise
     local-only; OpenAI's own guidance for CI/CD is to use an API key, which is what
     `openai/codex-action` accepts.
3. **Uncomment the matching secret line(s)** in your caller workflow (see
   `caller-template.yml`):

   ```yaml
   secrets:
     token: ${{ secrets.PUPPETS_TOKEN }}
     anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
     # claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
     # openai_api_key: ${{ secrets.OPENAI_API_KEY }}
   ```

4. **Test with a dry run first.** `dry_run: true` never queues a claude/codex job and never
   invokes either provider action or spends a token/credit — `reconcile.js` only decides
   what it *would* do. Confirm the dry-run summary shows the issue would be claimed under
   the expected profile before running live.
5. **Run live and watch the `implement` job.** Approve one low-risk issue under the
   claude/codex profile, run `workflow_dispatch` with `dry_run: false`, and use
   `gh run watch` to confirm the `implement` job runs, the provider action completes, and a
   **draft** pull request appears linked to the issue. It goes through the same CI and
   acceptance-review gates as a Copilot-authored PR before a maintainer takes it out of
   draft.

See [Security → Implementation providers](security.html) for the trust boundaries and
residual risks of this feature.

## Complete examples

- [Canonical caller template](https://github.com/JeffSteinbok/puppets/blob/main/caller-template.yml)
- [Live `obsidian-onedrive` caller](https://github.com/JeffSteinbok/obsidian-onedrive/blob/main/.github/workflows/puppets.yml)
- [Live pilot configuration](https://github.com/JeffSteinbok/obsidian-onedrive/blob/main/.puppets/config.json)
