'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  mergeObjects,
  resolveConfiguration,
  validateLifecycle,
} = require('../lib/config');

const lifecycle = require('../config/lifecycle.json');

test('arrays replace while objects merge by key', () => {
  assert.deepEqual(
    mergeObjects({ nested: { keep: true, list: ['a'] } }, { nested: { list: ['b'] } }),
    { nested: { keep: true, list: ['b'] } }
  );
});

test('protected approval label cannot be overridden', () => {
  const changed = structuredClone(lifecycle);
  changed.states.approved.label = 'custom:approved';
  assert.throws(() => validateLifecycle(changed), /protected state "approved"/);
});

test('puppets:no-auto cannot be removed', () => {
  const changed = structuredClone(lifecycle);
  changed.controlLabels = [];
  assert.throws(() => validateLifecycle(changed), /puppets:no-auto/);
});

test('local configuration and lifecycle metadata are resolved', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'puppets-config-'));
  const frameworkRoot = path.join(root, 'framework');
  const callerRoot = path.join(root, 'caller');
  fs.mkdirSync(path.join(frameworkRoot, 'config'), { recursive: true });
  fs.mkdirSync(path.join(callerRoot, '.github', 'puppets'), { recursive: true });
  fs.writeFileSync(
    path.join(frameworkRoot, 'config', 'lifecycle.json'),
    JSON.stringify(lifecycle)
  );
  fs.writeFileSync(
    path.join(callerRoot, '.github', 'puppets', 'config.json'),
    JSON.stringify({
      version: 1,
      approvalActors: ['JeffSteinbok'],
      ignoreLabels: ['postmortem'],
    })
  );
  fs.writeFileSync(
    path.join(callerRoot, '.github', 'puppets', 'lifecycle.json'),
    JSON.stringify({ states: { ready: { color: '123456' } } })
  );

  const resolved = resolveConfiguration({ frameworkRoot, callerRoot });
  assert.deepEqual(resolved.config.ignoreLabels, ['postmortem']);
  assert.equal(resolved.lifecycle.states.ready.color, '123456');
  assert.equal(resolved.lifecycle.states.ready.label, 'puppets:ready');
});

test('unknown local configuration fails closed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'puppets-config-'));
  const frameworkRoot = path.join(root, 'framework');
  const callerRoot = path.join(root, 'caller');
  fs.mkdirSync(path.join(frameworkRoot, 'config'), { recursive: true });
  fs.mkdirSync(path.join(callerRoot, '.github', 'puppets'), { recursive: true });
  fs.writeFileSync(
    path.join(frameworkRoot, 'config', 'lifecycle.json'),
    JSON.stringify(lifecycle)
  );
  fs.writeFileSync(
    path.join(callerRoot, '.github', 'puppets', 'config.json'),
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
