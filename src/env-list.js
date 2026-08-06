'use strict';

// Parses a delimited environment variable into a trimmed, non-empty list of strings.
// Accepts both comma and newline as separators (and any mix of the two): resolve-config.js
// emits array-valued config (e.g. approvalActors, ignoreLabels) as a single comma-joined
// GITHUB_ENV line, so a parser that only recognized newlines would silently treat the whole
// value as one item whenever a caller configured more than one entry.
function parseEnvList(raw) {
  return (raw || '')
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean);
}

module.exports = { parseEnvList };
