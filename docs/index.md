---
layout: default
title: Puppets
---

# Puppets

Puppets is repository-owned, data-driven GitHub issue-to-PR automation.

Each managed repository contains a small workflow with local triggers and permissions. That
workflow calls this public framework at an immutable commit SHA. Shared runtime code,
lifecycle defaults, prompts, tests, and documentation remain centralized here without an
outside controller reaching into managed repositories.

## Why this architecture

- Public callers use free standard GitHub-hosted runner minutes.
- Repository-scoped credentials replace a broad cross-repository token.
- Local configuration is visible and reviewable beside the code it governs.
- Shared implementation is upgraded by changing one pinned framework SHA.
- GitHub labels and comments remain the durable, auditable state.

## Start here

- [Architecture](architecture.md)
- [Configuration and overrides](configuration.md)
- [Security model](security.md)
- [Postmortem and local process integration](postmortem.md)
- [Caller template](https://github.com/JeffSteinbok/puppets/blob/main/caller-template.yml)

The site initially uses GitHub's default Pages URL. A custom domain and `CNAME` will be
configured later.
