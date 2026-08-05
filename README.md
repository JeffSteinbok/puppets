# Puppets

Puppets is repository-owned, data-driven GitHub issue-to-PR automation. Each managed
repository checks in a small caller workflow that invokes this public framework at an
immutable commit SHA.

## Principles

- The caller repository owns triggers, permissions, credentials, and local policy.
- This repository owns reusable orchestration, runtime code, defaults, schemas, tests, and
  documentation.
- Standard GitHub-hosted runner usage is billed to the caller repository and is free for
  public repositories.
- No central controller, inbound webhook, or cross-repository mutation token is required.
- Approval provenance, `puppets:no-auto`, trusted-branch loading, and fork isolation fail
  closed and cannot be disabled by configuration.

## Install

1. Copy [`caller-template.yml`](caller-template.yml) to
   `.github/workflows/puppets.yml` in a public repository.
2. Replace `FRAMEWORK_COMMIT_SHA` with an immutable commit from this repository.
   The same SHA appears in both the workflow `uses` reference and its `framework_ref`
   input so the called workflow can securely check out its packaged runtime.
3. Add `.github/puppets/config.json`:

   ```json
   {
     "version": 1,
     "approvalActors": ["YOUR_GITHUB_LOGIN"]
   }
   ```

4. Add a repository-scoped `PUPPETS_TOKEN` only if the caller's `GITHUB_TOKEN` cannot
   perform Copilot assignment.
5. Run the workflow manually with `dry_run: true`.

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
