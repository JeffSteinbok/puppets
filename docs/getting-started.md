---
layout: default
title: Getting started
---

# Getting started

From the root of the repository you want Puppets to manage:

```console
npx --yes github:JeffSteinbok/puppets#main
```

The installer detects your GitHub login with `gh` and creates the caller workflow and
`.puppets/config.json`. Choose another implementation provider when needed:

```console
npx --yes github:JeffSteinbok/puppets#main --provider claude
npx --yes github:JeffSteinbok/puppets#main --provider codex
```

Use `--approver LOGIN` when `gh` is unavailable. Existing files are never replaced unless
you explicitly pass `--force`.

## Add the provider secret

Copilot normally needs no additional secret. For another provider, set only the credential
you use:

```console
gh secret set CLAUDE_CODE_OAUTH_TOKEN
# or: gh secret set ANTHROPIC_API_KEY
# or: gh secret set OPENAI_API_KEY
```

The generated workflow already maps the selected provider's secrets and grants its required
permissions.

## Test and enable

Review and commit the generated files, then run:

```console
gh workflow run puppets.yml -f dry_run=true
gh run watch
```

When the summary looks correct, apply `puppets:approved` to one low-risk issue and run the
workflow with `dry_run: false`. The checked-in schedule handles later reconciliation.

See [Configuration](configuration.html) for limits, labels, workflow overlays, prompts, and
provider model overrides.
