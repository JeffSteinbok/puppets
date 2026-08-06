'use strict';

// Hidden HTML markers shared between the reconciler (which posts and updates these managed
// comments) and the `implement` job's prompt-building step (which reads the implementation
// instructions comment back out to build a claude/codex provider prompt). Keeping the
// marker in one place means the two can never drift out of sync.
const IMPLEMENTATION_MARKER = '<!-- puppets:implementation-instructions:v1 -->';

module.exports = { IMPLEMENTATION_MARKER };
