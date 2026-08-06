'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseEnvList } = require('../src/env-list');

test('parseEnvList splits on commas, as emitted by scripts/resolve-config.js', () => {
  assert.deepEqual(parseEnvList('JeffSteinbok,trusted-maintainer'), [
    'JeffSteinbok',
    'trusted-maintainer',
  ]);
});

test('parseEnvList splits on newlines', () => {
  assert.deepEqual(parseEnvList('JeffSteinbok\ntrusted-maintainer'), [
    'JeffSteinbok',
    'trusted-maintainer',
  ]);
});

test('parseEnvList accepts a mix of commas and newlines and trims whitespace', () => {
  assert.deepEqual(parseEnvList(' JeffSteinbok ,\ntrusted-maintainer,\n other-actor '), [
    'JeffSteinbok',
    'trusted-maintainer',
    'other-actor',
  ]);
});

test('parseEnvList drops empty entries from repeated or trailing separators', () => {
  assert.deepEqual(parseEnvList('a,,b,\n,c,'), ['a', 'b', 'c']);
});

test('parseEnvList returns an empty array for undefined, null, or blank input', () => {
  assert.deepEqual(parseEnvList(undefined), []);
  assert.deepEqual(parseEnvList(null), []);
  assert.deepEqual(parseEnvList(''), []);
  assert.deepEqual(parseEnvList('   '), []);
});

test('parseEnvList handles a single entry with no separators', () => {
  assert.deepEqual(parseEnvList('JeffSteinbok'), ['JeffSteinbok']);
});

// Regression test for the canary bug: scripts/resolve-config.js writes
// `PUPPETS_APPROVAL_ACTORS=${config.approvalActors.join(',')}` to GITHUB_ENV, so with more
// than one configured approver the raw env value is comma-joined, not newline-joined. Before
// this fix, reconcile.js only split on '\n' and treated the whole joined string as a single
// (never-matching) actor, silently rejecting every configured approver.
test('round-trips a multi-actor approvalActors config through the comma-joined env pipeline', () => {
  const approvalActors = ['JeffSteinbok', 'trusted-maintainer'];
  const envValue = approvalActors.join(','); // mirrors scripts/resolve-config.js
  const parsed = parseEnvList(envValue).map(actor => actor.toLowerCase()); // mirrors reconcile.js
  assert.deepEqual(parsed, ['jeffsteinbok', 'trusted-maintainer']);
  assert.ok(new Set(parsed).has('jeffsteinbok'));
});
