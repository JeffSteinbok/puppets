'use strict';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStateController } = require('../src/state');
const {
  compileWorkflow,
  createMachineModel,
  parseWorkflow,
} = require('../src/workflow');

const definition = parseWorkflow(
  fs.readFileSync(path.join(__dirname, '..', 'config', 'workflow.yml'), 'utf8'),
  'config/workflow.yml'
);

test('state controller follows compiled custom labels and branches', async () => {
  const customized = structuredClone(definition);
  customized.spec.stages.find(stage => stage.name === 'approved').label.name =
    'automation:approved';
  customized.spec.stages.find(stage => stage.name === 'curating').label.name =
    'automation:curating';
  const model = createMachineModel(compileWorkflow(customized));
  const mutations = [];
  const controller = createStateController({
    model,
    owner: 'owner',
    dryRun: false,
    core: { warning: () => {} },
    github: {
      rest: {
        issues: {
          addLabels: async input => mutations.push(['add', input.labels[0]]),
          removeLabel: async input => mutations.push(['remove', input.name]),
          createComment: async input => mutations.push(['comment', input.body]),
        },
      },
    },
  });
  const issue = {
    number: 1,
    node_id: 'issue-1',
    labels: [{ name: 'automation:approved' }],
  };

  assert.equal(controller.currentStateName('repo', issue), 'approved');
  await controller.setState('repo', issue, 'curating');
  assert.deepEqual(mutations, [
    ['add', 'automation:curating'],
    ['remove', 'automation:approved'],
    [
      'comment',
      [
        '**Puppets state change**',
        '',
        '- from: `approved`',
        '- to: `curating`',
        '- why: Puppets reconciled this item to the next workflow state.',
      ].join('\n'),
    ],
  ]);
  assert.equal(controller.currentStateName('repo', issue), 'curating');
});

test('state controller explains state changes in item comments and logs', async () => {
  const model = createMachineModel(compileWorkflow(definition));
  const comments = [];
  const logs = [];
  const controller = createStateController({
    model,
    owner: 'owner',
    dryRun: false,
    core: { warning: () => {} },
    github: {
      rest: {
        issues: {
          addLabels: async () => {},
          removeLabel: async () => {},
          createComment: async input => comments.push(input),
        },
      },
    },
  });
  const originalLog = console.log;
  console.log = message => logs.push(message);
  try {
    await controller.setState(
      'repo',
      { number: 3, node_id: 'issue-3', labels: [] },
      'needs-info',
      { reason: 'The issue is missing acceptance criteria.' }
    );
  } finally {
    console.log = originalLog;
  }

  assert.equal(comments.length, 1);
  assert.equal(comments[0].issue_number, 3);
  assert.match(comments[0].body, /from: `untracked`/);
  assert.match(comments[0].body, /to: `needs-info`/);
  assert.match(comments[0].body, /why: The issue is missing acceptance criteria\./);
  assert.ok(logs.some(line =>
    line.includes('state repo#3 untracked -> needs-info: The issue is missing acceptance criteria.')
  ));
});

test('state controller rejects undeclared transitions', async () => {
  const model = createMachineModel(compileWorkflow(definition));
  const controller = createStateController({
    model,
    owner: 'owner',
    dryRun: true,
    core: { warning: () => {} },
    github: { rest: { issues: {} } },
  });
  const issue = {
    number: 2,
    node_id: 'issue-2',
    labels: [{ name: 'puppets:approved' }],
  };

  await assert.rejects(
    controller.setState('repo', issue, 'done'),
    /Workflow transition approved -> done is not allowed/
  );
});
