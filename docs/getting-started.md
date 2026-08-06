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

## Test and enable

Review and commit the generated files, then run:

```console
gh workflow run puppets.yml -f dry_run=true
gh run watch
```

When the summary looks correct, apply `puppets:approved` to one low-risk issue and run the
workflow with `dry_run: false`. The checked-in schedule handles later reconciliation.

You're done! To further configure and customize Puppets, see
[Configuration](configuration.html) for limits, labels, workflow overlays, prompts, and
provider model overrides.
