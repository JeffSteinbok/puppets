'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_CONFIG,
  mergeObjects,
  resolveConfiguration,
  validateConfig,
} = require('../src/config');
const {
  compileWorkflow,
  createMachineModel,
  mergeWorkflow,
  parseWorkflow,
  resolveProfile,
} = require('../src/workflow');

const workflowSource = fs.readFileSync(
  path.join(__dirname, '..', 'config', 'workflow.yml'),
  'utf8'
);
const workflowDefinition = parseWorkflow(workflowSource, 'config/workflow.yml');

test('arrays replace while ordinary objects merge by key', () => {
  assert.deepEqual(
    mergeObjects({ nested: { keep: true, list: ['a'] } }, { nested: { list: ['b'] } }),
    { nested: { keep: true, list: ['b'] } }
  );
});

test('workflow overlays merge stages, labels, and profiles by identity', () => {
  const overlay = parseWorkflow(`
spec:
  labels:
    controls:
      - role: opt-out
        name: automation:skip
        color: "111111"
        description: Skip automation.
  profiles:
    - name: postmortem
      default: false
      priority: 100
      selector:
        allLabels: [incident-review]
      routes:
        approved: claim
      implementation:
        prompt: postmortem
        guidance: null
        heading: Incident review instructions
  stages:
    - name: approved
      label:
        name: automation:approved
`, 'overlay');

  const machine = compileWorkflow(mergeWorkflow(workflowDefinition, overlay));
  const model = createMachineModel(machine);
  assert.equal(model.approvalLabel, 'automation:approved');
  assert.equal(model.optOutLabel, 'automation:skip');
  assert.equal(
    resolveProfile(machine, new Set(['incident-review'])).implementation.prompt,
    'postmortem'
  );
  assert.equal(resolveProfile(machine, new Set()).name, 'basic');
});

test('workflow rejects a missing opt-out role', () => {
  const changed = structuredClone(workflowDefinition);
  changed.spec.labels.controls = [];
  assert.throws(() => compileWorkflow(changed), /opt-out/);
});

test('workflow rejects dangling branches', () => {
  const changed = structuredClone(workflowDefinition);
  changed.spec.stages.find(stage => stage.name === 'approved').branches.curate = 'missing';
  assert.throws(() => compileWorkflow(changed), /unknown stage "missing"/);
});

test('implementation.provider defaults to copilot when omitted', () => {
  const changed = structuredClone(workflowDefinition);
  delete changed.spec.profiles.find(p => p.name === 'basic').implementation.provider;
  const machine = compileWorkflow(changed);
  assert.equal(
    resolveProfile(machine, new Set()).implementation.provider,
    'copilot'
  );
});

test('implementation.provider accepts claude and codex', () => {
  for (const provider of ['claude', 'codex']) {
    const changed = structuredClone(workflowDefinition);
    changed.spec.profiles.find(p => p.name === 'basic').implementation.provider = provider;
    const machine = compileWorkflow(changed);
    assert.equal(resolveProfile(machine, new Set()).implementation.provider, provider);
  }
});

test('implementation.provider rejects a name outside the closed allowlist', () => {
  const changed = structuredClone(workflowDefinition);
  changed.spec.profiles.find(p => p.name === 'basic').implementation.provider = 'gemini';
  assert.throws(() => compileWorkflow(changed), /invalid workflow profile/);
});

test('implementation.provider rejects an arbitrary action reference', () => {
  const changed = structuredClone(workflowDefinition);
  changed.spec.profiles.find(p => p.name === 'basic').implementation.provider =
    'some-org/some-action@v1';
  assert.throws(() => compileWorkflow(changed), /invalid workflow profile/);
});

test('local configuration and workflow overlay are resolved', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'puppets-config-'));
  const frameworkRoot = path.join(root, 'framework');
  const callerRoot = path.join(root, 'caller');
  fs.mkdirSync(path.join(frameworkRoot, 'config'), { recursive: true });
  fs.mkdirSync(path.join(callerRoot, '.puppets'), { recursive: true });
  fs.writeFileSync(
    path.join(frameworkRoot, 'config', 'workflow.yml'),
    workflowSource
  );
  fs.writeFileSync(
    path.join(callerRoot, '.puppets', 'config.json'),
    JSON.stringify({
      version: 1,
      approvalActors: ['JeffSteinbok'],
      ignoreLabels: ['external-process'],
    })
  );
  fs.writeFileSync(
    path.join(callerRoot, '.puppets', 'workflow.yml'),
    `spec:
  stages:
    - name: ready
      label:
        color: "123456"
`
  );

  const resolved = resolveConfiguration({ frameworkRoot, callerRoot });
  const ready = resolved.workflow.stages.find(stage => stage.name === 'ready');
  assert.deepEqual(resolved.config.ignoreLabels, ['external-process']);
  assert.equal(String(ready.label.color), '123456');
  assert.equal(ready.label.name, 'puppets:ready');
});

test('unknown local configuration fails closed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'puppets-config-'));
  const frameworkRoot = path.join(root, 'framework');
  const callerRoot = path.join(root, 'caller');
  fs.mkdirSync(path.join(frameworkRoot, 'config'), { recursive: true });
  fs.mkdirSync(path.join(callerRoot, '.puppets'), { recursive: true });
  fs.writeFileSync(
    path.join(frameworkRoot, 'config', 'workflow.yml'),
    workflowSource
  );
  fs.writeFileSync(
    path.join(callerRoot, '.puppets', 'config.json'),
    JSON.stringify({
      version: 1,
      approvalActors: ['JeffSteinbok'],
      unsupported: true,
    })
  );

  assert.throws(
    () => resolveConfiguration({ frameworkRoot, callerRoot }),
    /unknown config key "unsupported"/
  );
});

test('claudeModel and codexModel default to empty strings and may be overridden', () => {
  assert.equal(DEFAULT_CONFIG.claudeModel, '');
  assert.equal(DEFAULT_CONFIG.codexModel, '');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'puppets-config-'));
  const frameworkRoot = path.join(root, 'framework');
  const callerRoot = path.join(root, 'caller');
  fs.mkdirSync(path.join(frameworkRoot, 'config'), { recursive: true });
  fs.mkdirSync(path.join(callerRoot, '.puppets'), { recursive: true });
  fs.writeFileSync(path.join(frameworkRoot, 'config', 'workflow.yml'), workflowSource);
  fs.writeFileSync(
    path.join(callerRoot, '.puppets', 'config.json'),
    JSON.stringify({
      version: 1,
      approvalActors: ['JeffSteinbok'],
      claudeModel: 'claude-opus-4',
      codexModel: 'o4-mini',
    })
  );

  const resolved = resolveConfiguration({ frameworkRoot, callerRoot });
  assert.equal(resolved.config.claudeModel, 'claude-opus-4');
  assert.equal(resolved.config.codexModel, 'o4-mini');
});

test('claudeModel and codexModel must be strings', () => {
  const base = { ...DEFAULT_CONFIG, approvalActors: ['JeffSteinbok'] };
  assert.throws(
    () => validateConfig(mergeObjects(base, { claudeModel: 123 })),
    /claudeModel must be a string/
  );
  assert.throws(
    () => validateConfig(mergeObjects(base, { codexModel: null })),
    /codexModel must be a string/
  );
});
