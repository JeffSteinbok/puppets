# <img src="docs/assets/puppetslogo.png" alt="Puppets logo" width="48" align="absmiddle"> Puppets

[![CI](https://github.com/JeffSteinbok/puppets/actions/workflows/ci.yml/badge.svg)](https://github.com/JeffSteinbok/puppets/actions/workflows/ci.yml)
[![Deploy Pages](https://github.com/JeffSteinbok/puppets/actions/workflows/pages.yml/badge.svg)](https://github.com/JeffSteinbok/puppets/actions/workflows/pages.yml)
[![Website](https://img.shields.io/badge/website-puppets-2ea44f?logo=githubpages)](https://JeffSteinbok.github.io/puppets/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Puppets is a pure cloud-based GitHub issue-to-PR automation harness. Each repository runs a
small caller workflow using GitHub Actions compute and keeps its policy, credentials, state,
issues, and pull requests in GitHub. There is no controller service, server, database, or
inbound webhook to deploy.

Standard GitHub-hosted runners are generally
[free for public repositories](https://docs.github.com/en/billing/reference/actions-runner-pricing).
Larger runners and model-provider usage may have separate costs.

## Supported providers

Puppets supports three implementation providers. Curation and acceptance review continue
to use Copilot regardless of which implementation provider a profile selects.

| Provider | `implementation.provider` | Repository settings |
|---|---|---|
| GitHub Copilot | `copilot` | No secret is normally required. Optionally add `PUPPETS_TOKEN` if `GITHUB_TOKEN` cannot assign Copilot. |
| Claude Code | `claude` | Add either `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`. |
| OpenAI Codex | `codex` | Add `OPENAI_API_KEY`. |

See [Select Provider](https://JeffSteinbok.github.io/puppets/getting-started.html#8-select-provider)
for workflow secret mappings, permissions, model overrides, and testing instructions.

## Principles

- The caller repository owns triggers, permissions, credentials, and local policy.
- This repository owns reusable orchestration, runtime code, defaults, schemas, tests, and
  documentation.
- Standard GitHub-hosted runner usage runs in the caller repository and is free for public
  repositories.
- No central controller, inbound webhook, or cross-repository mutation token is required.
- Approval provenance, the configured opt-out role, trusted-branch loading, and fork
  isolation fail closed and cannot be disabled by configuration.

## Install

From the root of the repository you want Puppets to manage, run:

```console
npx --yes github:JeffSteinbok/puppets#main
```

No clone or permanent installation is required. See [Getting Started](https://JeffSteinbok.github.io/puppets/getting-started.html)
for provider selection and a safe rollout.

## Development

```console
npm ci
npm run check
```

The runtime uses the locked GitHub Copilot SDK dependency. Tests use Node's built-in test
runner.
