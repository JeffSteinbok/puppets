'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseJob,
  buildAssignPrompt,
  commitMessage,
  pullRequestTitle,
  pullRequestBody,
  hasImplementationChanges,
} = require('../src/providers/implementation-job');

const assignJob = {
  repo: 'widgets',
  issueNumber: 7,
  provider: 'claude',
  mode: 'assign',
  branch: 'puppets/issue-7',
};

const remediateJob = {
  repo: 'widgets',
  issueNumber: 7,
  prNumber: 21,
  provider: 'codex',
  mode: 'remediate',
  branch: 'puppets/issue-7',
  directive: 'Fix the failing lint check.',
};

test('parseJob accepts a well-formed assign job and normalizes optional fields', () => {
  const job = parseJob(assignJob);
  assert.equal(job.repo, 'widgets');
  assert.equal(job.issueNumber, 7);
  assert.equal(job.prNumber, null);
  assert.equal(job.provider, 'claude');
  assert.equal(job.mode, 'assign');
  assert.equal(job.branch, 'puppets/issue-7');
  assert.equal(job.directive, null);
  assert.equal(job.model, '');
});

test('parseJob accepts a well-formed remediate job', () => {
  const job = parseJob(remediateJob);
  assert.equal(job.prNumber, 21);
  assert.equal(job.mode, 'remediate');
  assert.equal(job.directive, 'Fix the failing lint check.');
});

test('parseJob accepts a JSON string as produced by fromJSON() in the matrix', () => {
  const job = parseJob(JSON.stringify(assignJob));
  assert.equal(job.provider, 'claude');
});

test('parseJob rejects a non-object payload', () => {
  assert.throws(() => parseJob(null), /not an object/);
  assert.throws(() => parseJob(42), /not an object/);
});

test('parseJob rejects an invalid issue number', () => {
  assert.throws(() => parseJob({ ...assignJob, issueNumber: 0 }), /issueNumber/);
  assert.throws(() => parseJob({ ...assignJob, issueNumber: 'seven' }), /issueNumber/);
});

test('parseJob rejects an invalid pull request number', () => {
  assert.throws(() => parseJob({ ...remediateJob, prNumber: -1 }), /prNumber/);
});

test('parseJob rejects copilot and any provider outside the allowlist', () => {
  assert.throws(() => parseJob({ ...assignJob, provider: 'copilot' }), /unsupported provider/);
  assert.throws(() => parseJob({ ...assignJob, provider: 'gemini' }), /unsupported provider/);
});

test('parseJob rejects an unsupported mode', () => {
  assert.throws(() => parseJob({ ...assignJob, mode: 'destroy' }), /unsupported mode/);
});

test('parseJob rejects a branch name outside the deterministic pattern', () => {
  assert.throws(
    () => parseJob({ ...assignJob, branch: 'feature/anything' }),
    /invalid branch name/
  );
});

test('parseJob rejects a remediate job with no linked pull request', () => {
  assert.throws(
    () => parseJob({ ...remediateJob, prNumber: null }),
    /must include a prNumber/
  );
});

test('buildAssignPrompt composes issue title, body, and instructions', () => {
  const prompt = buildAssignPrompt({
    issueNumber: 7,
    issueTitle: 'Add a widget',
    issueBody: 'We need a new widget.',
    instructions: 'Follow the repo style guide.',
  });
  assert.match(prompt, /Issue #7: Add a widget/);
  assert.match(prompt, /We need a new widget\./);
  assert.match(prompt, /Follow the repo style guide\./);
});

test('buildAssignPrompt tolerates missing title, body, and instructions', () => {
  const prompt = buildAssignPrompt({ issueNumber: 3, issueTitle: '', issueBody: null, instructions: '' });
  assert.match(prompt, /Issue #3: \(untitled\)/);
  assert.match(prompt, /\(empty\)/);
});

test('commitMessage differs between assign and remediate modes', () => {
  assert.equal(commitMessage(parseJob(assignJob)), 'Puppets: implement #7 via claude');
  assert.equal(
    commitMessage(parseJob(remediateJob)),
    'Puppets: address remediation on #7 via codex'
  );
});

test('pullRequestTitle prefers the issue title and falls back to the issue number', () => {
  const job = parseJob(assignJob);
  assert.equal(pullRequestTitle(job, 'Add a widget'), 'Add a widget');
  assert.equal(pullRequestTitle(job, ''), 'Implement #7');
  assert.equal(pullRequestTitle(job, null), 'Implement #7');
});

test('pullRequestBody links the issue and names the provider', () => {
  const body = pullRequestBody(parseJob(assignJob));
  assert.match(body, /Closes #7\./);
  assert.match(body, /`claude` provider/);
});

test('hasImplementationChanges accepts workspace edits or provider commits', () => {
  const startSha = 'a'.repeat(40);
  assert.equal(hasImplementationChanges({
    startSha,
    headSha: startSha,
    status: ' M src/index.js',
  }), true);
  assert.equal(hasImplementationChanges({
    startSha,
    headSha: 'b'.repeat(40),
    status: '',
  }), true);
  assert.equal(hasImplementationChanges({
    startSha,
    headSha: startSha,
    status: '',
  }), false);
});
