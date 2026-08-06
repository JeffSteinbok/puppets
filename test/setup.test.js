'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildCallerWorkflow,
  parseArgs,
  writeSetup,
} = require('../scripts/setup');

const callerTemplate = fs.readFileSync(
  path.join(__dirname, '..', 'caller-template.yml'),
  'utf8'
);

test('setup arguments default to Copilot', () => {
  assert.deepEqual(
    parseArgs(['--approver', 'octocat']),
    {
      approver: 'octocat',
      force: false,
      provider: 'copilot',
      target: process.cwd(),
    }
  );
});

test('Claude setup grants write access and maps both authentication options', () => {
  const workflow = buildCallerWorkflow('claude', callerTemplate);
  assert.match(workflow, /  contents: write/);
  assert.match(workflow, /^      anthropic_api_key:/m);
  assert.match(workflow, /^      claude_code_oauth_token:/m);
  assert.doesNotMatch(workflow, /^      openai_api_key:/m);
});

test('setup writes minimal repository configuration and refuses overwrites', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'puppets-setup-'));
  const result = writeSetup({
    approver: 'octocat',
    force: false,
    provider: 'codex',
    target,
  });

  assert.equal(result.files.length, 3);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(target, '.puppets', 'config.json'), 'utf8')),
    { version: 1, approvalActors: ['octocat'] }
  );
  assert.match(
    fs.readFileSync(path.join(target, '.puppets', 'workflow.yml'), 'utf8'),
    /provider: codex/
  );
  assert.throws(
    () => writeSetup({
      approver: 'octocat',
      force: false,
      provider: 'codex',
      target,
    }),
    /refusing to overwrite/
  );
});
