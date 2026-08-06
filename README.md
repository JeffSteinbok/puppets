# <img src="docs/assets/puppetslogo.png" alt="Puppets logo" width="48" align="absmiddle"> Puppets

[![CI](https://github.com/JeffSteinbok/puppets/actions/workflows/ci.yml/badge.svg)](https://github.com/JeffSteinbok/puppets/actions/workflows/ci.yml)
[![Deploy Pages](https://github.com/JeffSteinbok/puppets/actions/workflows/pages.yml/badge.svg)](https://github.com/JeffSteinbok/puppets/actions/workflows/pages.yml)
[![Website](https://img.shields.io/badge/website-puppets-2ea44f?logo=githubpages)](https://JeffSteinbok.github.io/puppets/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Puppets is repository-owned, data-driven GitHub issue-to-PR automation. Each managed
repository checks in a small caller workflow that invokes this public framework at an
explicit release tag or commit SHA.

## Supported providers

Puppets supports three implementation providers. Curation and acceptance review continue
to use Copilot regardless of which implementation provider a profile selects.

| Provider | `implementation.provider` | Repository settings |
|---|---|---|
| GitHub Copilot | `copilot` | No secret is normally required. Optionally add `PUPPETS_TOKEN` if `GITHUB_TOKEN` cannot assign Copilot. |
| Claude Code | `claude` | Add either `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`. |
| OpenAI Codex | `codex` | Add `OPENAI_API_KEY`. |

See [Select Provider](https://JeffSteinbok.github.io/puppets/getting-started.html#9-select-provider)
for workflow secret mappings, permissions, model overrides, and testing instructions.

## Principles

- The caller repository owns triggers, permissions, credentials, and local policy.
- This repository owns reusable orchestration, runtime code, defaults, schemas, tests, and
  documentation.
- Standard GitHub-hosted runner usage is billed to the caller repository and is free for
  public repositories.
- No central controller, inbound webhook, or cross-repository mutation token is required.
- Approval provenance, the configured opt-out role, trusted-branch loading, and fork
  isolation fail closed and cannot be disabled by configuration.

## Install

1. Copy [`caller-template.yml`](caller-template.yml) to
   `.github/workflows/puppets.yml` in a public repository.
2. Replace `FRAMEWORK_REF` with a release tag such as `v1`, or use a full commit SHA for
   strict pinning. Puppets derives the exact GitHub-resolved commit automatically.
3. Add `.puppets/config.json`:

   ```json
   {
     "version": 1,
     "approvalActors": ["YOUR_GITHUB_LOGIN"]
   }
   ```

4. Optionally add `.puppets/workflow.yml` to overlay the versioned `basic` workflow DSL.
5. Add a repository-scoped `PUPPETS_TOKEN` only if the caller's `GITHUB_TOKEN` cannot
   perform Copilot assignment.
6. Run the workflow manually with `dry_run: true`.

See the [complete getting-started guide](https://JeffSteinbok.github.io/puppets/getting-started.html)
for the documented caller workflow, permissions, credentials, dry-run rollout, upgrades,
configuration, and repository-owned process integration.

## Development

```console
npm ci
npm run check
```

The runtime uses the locked GitHub Copilot SDK dependency. Tests use Node's built-in test
runner.

Provider implementations, including this one, run through the same CI and review gates before
merging.
