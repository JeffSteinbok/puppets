---
layout: default
title: Puppets
---

<section class="puppets-hero">
  <div>
    <h1>Puppets</h1>
    <p>
      Repository-owned, data-driven automation that turns approved GitHub issues into
      reviewed pull requests without a central controller reaching into your repositories.
    </p>
    <div class="puppets-actions">
      <a class="puppets-button" href="architecture.html">Explore the architecture</a>
      <a class="puppets-button secondary" href="https://github.com/JeffSteinbok/puppets">View on GitHub</a>
    </div>
  </div>
  <img class="puppets-logo" src="{{ '/assets/puppetslogo.png' | relative_url }}" alt="Puppets logo">
</section>

<div class="puppets-grid">
  <div class="puppets-card">
    <strong>Caller owned</strong>
    <span>Each repository owns its triggers, permissions, secrets, and local policy.</span>
  </div>
  <div class="puppets-card">
    <strong>Shared and pinned</strong>
    <span>Reusable runtime and defaults come from an immutable public framework commit.</span>
  </div>
  <div class="puppets-card">
    <strong>Cheap for public repos</strong>
    <span>Standard hosted-runner usage is attributed to the public caller repository.</span>
  </div>
  <div class="puppets-card">
    <strong>Fail closed</strong>
    <span>Approval provenance and repository trust boundaries cannot be overridden.</span>
  </div>
</div>

## Start here

- [Architecture](architecture.md)
- [Configuration and overrides](configuration.md)
- [Security model](security.md)
- [Postmortem and local process integration](postmortem.md)
- [Caller template](https://github.com/JeffSteinbok/puppets/blob/main/caller-template.yml)

This site currently uses GitHub's default Pages URL. A custom domain and `CNAME` will be
configured later.
