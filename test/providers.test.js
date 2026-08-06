'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PROVIDER_NAMES,
  isValidProvider,
  usesAssignableBot,
  usesActionRun,
  implementationBranchName,
} = require('../src/providers/providers');

test('provider allowlist is exactly copilot, claude, and codex', () => {
  assert.deepEqual([...PROVIDER_NAMES].sort(), ['claude', 'codex', 'copilot']);
});

test('isValidProvider accepts only allowlisted names', () => {
  assert.equal(isValidProvider('copilot'), true);
  assert.equal(isValidProvider('claude'), true);
  assert.equal(isValidProvider('codex'), true);
  assert.equal(isValidProvider('gemini'), false);
  assert.equal(isValidProvider('actions/checkout@v4'), false);
  assert.equal(isValidProvider(''), false);
  assert.equal(isValidProvider(undefined), false);
});

test('usesAssignableBot is true only for copilot', () => {
  assert.equal(usesAssignableBot('copilot'), true);
  assert.equal(usesAssignableBot('claude'), false);
  assert.equal(usesAssignableBot('codex'), false);
});

test('usesActionRun is true only for claude and codex', () => {
  assert.equal(usesActionRun('claude'), true);
  assert.equal(usesActionRun('codex'), true);
  assert.equal(usesActionRun('copilot'), false);
});

test('implementationBranchName is deterministic per issue number', () => {
  assert.equal(implementationBranchName(42), 'puppets/issue-42');
  assert.equal(implementationBranchName(42), implementationBranchName(42));
  assert.notEqual(implementationBranchName(1), implementationBranchName(2));
});
