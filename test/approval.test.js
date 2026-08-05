'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateApproval,
  findLatestApprovalEvent,
  normalizePermissionLevels,
} = require('../lib/approval');

const actors = new Set(['jeffsteinbok']);

test('latest approval provenance is selected without mutating events', () => {
  const events = [
    { event: 'labeled', label: { name: 'puppets:approved' }, actor: { login: 'old' } },
    { event: 'unlabeled', label: { name: 'puppets:approved' }, actor: { login: 'old' } },
    { event: 'labeled', label: { name: 'puppets:approved' }, actor: { login: 'JeffSteinbok' } },
  ];
  const before = structuredClone(events);
  assert.equal(
    findLatestApprovalEvent(events, 'puppets:approved').actor.login,
    'JeffSteinbok'
  );
  assert.deepEqual(events, before);
});

test('allowlisted writer is accepted', () => {
  const result = evaluateApproval({
    event: { actor: { login: 'JeffSteinbok' } },
    approvalActors: actors,
    permissionLevels: ['write'],
  });
  assert.equal(result.valid, true);
});

test('non-allowlisted actor is rejected even with admin permission', () => {
  const result = evaluateApproval({
    event: { actor: { login: 'attacker' } },
    approvalActors: actors,
    permissionLevels: ['admin'],
  });
  assert.equal(result.valid, false);
  assert.equal(result.actorAllowed, false);
});

test('allowlisted actor without current permission is rejected', () => {
  const result = evaluateApproval({
    event: { actor: { login: 'JeffSteinbok' } },
    approvalActors: actors,
    permissionLevels: ['read'],
  });
  assert.equal(result.valid, false);
  assert.match(result.reason, /lacks write\/triage/);
});

test('missing approval provenance is rejected', () => {
  const result = evaluateApproval({
    event: null,
    approvalActors: actors,
    permissionLevels: ['write'],
  });
  assert.equal(result.valid, false);
});

test('fine-grained permission payload is normalized', () => {
  assert.deepEqual(
    normalizePermissionLevels({
      user: { permissions: { admin: false, maintain: true, push: true } },
    }),
    ['maintain', 'push']
  );
  assert.deepEqual(normalizePermissionLevels({ permission: 'triage' }), ['triage']);
});
