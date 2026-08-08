'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  acceptanceNeedsChanges,
  acceptancePass,
  acceptanceRecordComment,
  approvalEvent,
  approvalLabel,
  buildIssue,
  buildPr,
  config,
  createHarness,
  curationMarker,
  curationNeedsHuman,
  curationReady,
  implementationMarker,
  model,
  optOutLabel,
  stateLabel,
} = require('../test-support/reconcile-harness');

const primaryApprover = config.approvalActors[0];
const activeStateLabels = labelNames => labelNames.filter(label => model.stateNameByLabel.has(label)).sort();

function assertIssueState(harness, issueNumber, stateName) {
  assert.deepEqual(harness.activeStateLabelsForIssue(issueNumber), [stateLabel(stateName)]);
}

function assertPrState(harness, prNumber, stateName) {
  assert.deepEqual(harness.activeStateLabelsForPr(prNumber), [stateLabel(stateName)]);
}

test('unlabelled issue never invokes Models or assigns Copilot', async () => {
  const harness = createHarness({
    issues: [buildIssue({ number: 1 })],
  });

  await harness.run();

  assert.equal(harness.copilot.calls.length, 0);
  assert.deepEqual(harness.store.assignments, []);
  assert.deepEqual(harness.activeStateLabelsForIssue(1), []);
  assert.deepEqual(harness.store.labelOps, []);
});

test('allowlisted writer approval advances approved work through curation and claim', async () => {
  const harness = createHarness({
    issues: [buildIssue({ number: 2, labels: [approvalLabel] })],
    approvalEvents: {
      2: [approvalEvent({ actor: primaryApprover })],
    },
  });
  harness.queueCopilotResponses(curationReady());

  await harness.run();

  assert.equal(
    harness.copilot.calls.filter(call => call.type === 'sendAndWait').length,
    1
  );
  assert.equal(harness.store.assignments.length, 1);
  assertIssueState(harness, 2, 'claimed');
  assert(harness.issueLabelNames(2).includes('type:bug'));
  assert.equal(harness.countCommentsWithMarker(2, implementationMarker), 1);
  assert.equal(harness.countCommentsWithMarker(2, curationMarker), 1);
  assert.deepEqual(
    harness.store.labelOps.map(op => `${op.op}:${op.issue_number}:${op.label}`),
    [
      `add:2:${stateLabel('curating')}`,
      `remove:2:${approvalLabel}`,
      'add:2:type:bug',
      `add:2:${stateLabel('ready')}`,
      `remove:2:${stateLabel('curating')}`,
      `add:2:${stateLabel('claimed')}`,
      `remove:2:${stateLabel('ready')}`,
    ]
  );
});

test('invalid approval cases fail closed before any privileged action', async t => {
  const cases = [
    {
      name: 'non-allowlisted actor',
      issueNumber: 3,
      approvalEvents: [approvalEvent({ actor: 'attacker' })],
      permissions: { attacker: 'admin' },
      reason: /label was added by attacker/,
      expectedLookups: [],
    },
    {
      name: 'allowlisted actor without write permission',
      issueNumber: 4,
      approvalEvents: [approvalEvent({ actor: primaryApprover })],
      permissions: { [primaryApprover]: 'read' },
      reason: /lacks write\/triage permission/,
      expectedLookups: [primaryApprover],
    },
    {
      name: 'permission lookup failure',
      issueNumber: 5,
      approvalEvents: [approvalEvent({ actor: primaryApprover })],
      permissions: {
        [primaryApprover]: Object.assign(new Error('boom'), { status: 503 }),
      },
      reason: /could not verify .*boom/,
      expectedLookups: [primaryApprover],
    },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const harness = createHarness({
        issues: [buildIssue({ number: scenario.issueNumber, labels: [approvalLabel] })],
        approvalEvents: {
          [scenario.issueNumber]: scenario.approvalEvents,
        },
        permissions: scenario.permissions,
      });

      await harness.run();

      assert.deepEqual(harness.activeStateLabelsForIssue(scenario.issueNumber), []);
      assert.equal(harness.copilot.calls.length, 0);
      assert.equal(harness.store.assignments.length, 0);
      assert.deepEqual(harness.store.permissionLookups, scenario.expectedLookups);
      assert.equal(harness.comments(scenario.issueNumber).length, 1);
      assert.match(harness.comments(scenario.issueNumber)[0].body, scenario.reason);
    });
  }
});

test('manually applied downstream states cannot bypass trusted approval', async t => {
  const issueOnlyStates = ['curating', 'ready'];
  const prStates = ['claimed', 'verifying', 'needs-work', 'in-review'];

  for (const [offset, stateName] of issueOnlyStates.entries()) {
    await t.test(stateName, async () => {
      const issueNumber = 10 + offset;
      const harness = createHarness({
        issues: [buildIssue({ number: issueNumber, labels: [stateLabel(stateName)] })],
      });

      await harness.run();

      assert.deepEqual(harness.activeStateLabelsForIssue(issueNumber), []);
      assert.equal(harness.copilot.calls.length, 0);
      assert.equal(harness.store.assignments.length, 0);
      assert.equal(harness.store.workflowReruns.length, 0);
    });
  }

  for (const [offset, stateName] of prStates.entries()) {
    await t.test(stateName, async () => {
      const issueNumber = 20 + offset;
      const prNumber = 120 + offset;
      const pr = buildPr({
        number: prNumber,
        issueNumbers: [issueNumber],
        labels: [stateLabel(stateName)],
        isDraft: false,
        rollupState: 'SUCCESS',
        headRefOid: `${offset + 1}`.repeat(40),
      });
      const harness = createHarness({
        issues: [buildIssue({ number: issueNumber, labels: [stateLabel(stateName)] })],
        prs: [pr],
        prWorkflowRuns: {
          [pr.headRefOid]: [
            { id: 900 + offset, name: 'CI', conclusion: 'action_required' },
          ],
        },
      });

      await harness.run();

      assert.deepEqual(harness.activeStateLabelsForIssue(issueNumber), []);
      assert.deepEqual(harness.activeStateLabelsForPr(prNumber), []);
      assert.equal(harness.copilot.calls.length, 0);
      assert.equal(harness.store.assignments.length, 0);
      assert.equal(harness.store.workflowReruns.length, 0);
    });
  }
});

test('label combinations and ordering cannot bypass approval validation', async t => {
  const scenarios = [
    {
      name: 'approved plus ready',
      issueNumber: 30,
      labels: [stateLabel('ready'), approvalLabel],
    },
    {
      name: 'approved plus claimed',
      issueNumber: 31,
      labels: [stateLabel('claimed'), approvalLabel],
      prNumber: 131,
    },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      const harness = createHarness({
        issues: [buildIssue({ number: scenario.issueNumber, labels: scenario.labels })],
        approvalEvents: {
          [scenario.issueNumber]: [approvalEvent({ actor: 'attacker' })],
        },
        permissions: { attacker: 'admin' },
        prs: scenario.prNumber ? [
          buildPr({
            number: scenario.prNumber,
            issueNumbers: [scenario.issueNumber],
            labels: [stateLabel('claimed')],
            isDraft: false,
            rollupState: 'SUCCESS',
            headRefOid: '3'.repeat(40),
          }),
        ] : [],
      });

      await harness.run();

      assert.deepEqual(harness.activeStateLabelsForIssue(scenario.issueNumber), []);
      if (scenario.prNumber) {
        assert.deepEqual(harness.activeStateLabelsForPr(scenario.prNumber), []);
      }
      assert.equal(harness.copilot.calls.length, 0);
      assert.equal(harness.store.assignments.length, 0);
    });
  }
});

test('puppets:no-auto suppresses issue and linked-PR activity', async () => {
  const claimedPr = buildPr({
    number: 141,
    issueNumbers: [41],
    labels: [stateLabel('claimed'), optOutLabel],
    isDraft: false,
    mergeable: 'CONFLICTING',
    rollupState: 'SUCCESS',
    headRefOid: '4'.repeat(40),
  });
  const harness = createHarness({
    issues: [
      buildIssue({ number: 40, labels: [approvalLabel, optOutLabel] }),
      buildIssue({ number: 41, labels: [stateLabel('claimed')] }),
    ],
    prs: [claimedPr],
    approvalEvents: {
      40: [approvalEvent({ actor: primaryApprover })],
      41: [approvalEvent({ actor: primaryApprover })],
    },
    prWorkflowRuns: {
      [claimedPr.headRefOid]: [{ id: 941, name: 'CI', conclusion: 'action_required' }],
    },
  });
  harness.queueCopilotResponses(curationReady());

  await harness.run();

  assert.equal(harness.copilot.calls.length, 0);
  assert.equal(harness.store.assignments.length, 0);
  assert.equal(harness.store.workflowReruns.length, 0);
  assert.deepEqual(harness.store.labelOps, []);
  assert.deepEqual(harness.issueLabelNames(40).sort(), [approvalLabel, optOutLabel].sort());
  assertIssueState(harness, 41, 'claimed');
  assertPrState(harness, 141, 'claimed');
});

test('partial label recovery remains tracked by restoring missing PR state labels', async () => {
  const harness = createHarness({
    issues: [buildIssue({ number: 50, labels: [stateLabel('claimed')] })],
    prs: [
      buildPr({
        number: 150,
        issueNumbers: [50],
        labels: [],
        isDraft: true,
        rollupState: 'PENDING',
        headRefOid: '5'.repeat(40),
      }),
    ],
    approvalEvents: {
      50: [approvalEvent({ actor: primaryApprover })],
    },
  });

  await harness.run();

  assertIssueState(harness, 50, 'claimed');
  assertPrState(harness, 150, 'claimed');
  assert.equal(harness.copilot.calls.length, 0);
  assert.equal(harness.store.assignments.length, 0);
});

test('green PR path progresses claimed work through verifying to in-review', async () => {
  const harness = createHarness({
    issues: [buildIssue({ number: 60, labels: [stateLabel('claimed')] })],
    prs: [
      buildPr({
        number: 160,
        issueNumbers: [60],
        labels: [stateLabel('claimed')],
        isDraft: true,
        rollupState: 'SUCCESS',
        headRefOid: '6'.repeat(40),
        files: [
          {
            filename: 'src/reconcile.js',
            status: 'modified',
            additions: 1,
            deletions: 0,
            patch: '@@ -1 +1 @@\n-old\n+new',
          },
        ],
      }),
    ],
    approvalEvents: {
      60: [approvalEvent({ actor: primaryApprover })],
    },
  });
  harness.queueCopilotResponses(acceptancePass());

  await harness.run();

  assert.equal(
    harness.copilot.calls.filter(call => call.type === 'sendAndWait').length,
    1
  );
  assert.deepEqual(harness.store.prReadyCalls, [160]);
  assertIssueState(harness, 60, 'in-review');
  assertPrState(harness, 160, 'in-review');
  assert.equal(harness.countCommentsWithMarker(160, '<!-- puppets:acceptance-review:v1 -->'), 1);
  assert.equal(harness.pr(160).isDraft, false);
});

test('acceptance failure path returns to verifying on a new head after needs-work', async () => {
  const harness = createHarness({
    issues: [buildIssue({ number: 70, labels: [stateLabel('verifying')] })],
    prs: [
      buildPr({
        number: 170,
        issueNumbers: [70],
        labels: [stateLabel('verifying')],
        isDraft: false,
        rollupState: 'SUCCESS',
        headRefOid: '7'.repeat(40),
        files: [
          {
            filename: 'src/reconcile.js',
            status: 'modified',
            additions: 2,
            deletions: 1,
            patch: '@@ -1 +1 @@\n-old\n+new',
          },
        ],
      }),
    ],
    approvalEvents: {
      70: [approvalEvent({ actor: primaryApprover })],
    },
  });
  harness.queueCopilotResponses(acceptanceNeedsChanges());

  await harness.run();

  assertIssueState(harness, 70, 'needs-work');
  assertPrState(harness, 170, 'needs-work');
  assert.equal(
    harness.store.assignments.filter(assignment => assignment.target === 'pr').length,
    1
  );

  const firstRunLabelOps = harness.store.labelOps.length;
  harness.setPrHead(170, '8'.repeat(40));
  harness.queueCopilotResponses(acceptancePass({ summary: 'The remediation fixed the blockers.' }));

  await harness.run();

  assertIssueState(harness, 70, 'in-review');
  assertPrState(harness, 170, 'in-review');
  const secondRunOps = harness.store.labelOps.slice(firstRunLabelOps).map(op => `${op.op}:${op.label}`);
  assert(secondRunOps.includes(`add:${stateLabel('verifying')}`));
});

test('explicit model uncertainty escalates curation to needs-human', async () => {
  const harness = createHarness({
    issues: [buildIssue({ number: 80, labels: [approvalLabel] })],
    approvalEvents: {
      80: [approvalEvent({ actor: primaryApprover })],
    },
  });
  harness.queueCopilotResponses(curationNeedsHuman());

  await harness.run();

  assertIssueState(harness, 80, 'needs-human');
  assert.equal(
    harness.copilot.calls.filter(call => call.type === 'sendAndWait').length,
    1
  );
  assert.equal(harness.store.outputs.waiting_count, '1');
});

test('acceptance retry exhaustion escalates to needs-human without reprompting', async () => {
  const oldHead = '8'.repeat(40);
  const newHead = '9'.repeat(40);
  const harness = createHarness({
    issues: [buildIssue({ number: 81, labels: [stateLabel('needs-work')] })],
    prs: [
      buildPr({
        number: 181,
        issueNumbers: [81],
        labels: [stateLabel('needs-work')],
        isDraft: false,
        rollupState: 'SUCCESS',
        headRefOid: newHead,
        files: [
          {
            filename: 'src/reconcile.js',
            status: 'modified',
            additions: 1,
            deletions: 1,
            patch: '@@ -1 +1 @@\n-old\n+new',
          },
        ],
      }),
    ],
    approvalEvents: {
      81: [approvalEvent({ actor: primaryApprover })],
    },
    comments: {
      181: [
        acceptanceRecordComment({
          headSha: oldHead,
          decision: 'needs-changes',
          reviewAttempt: 2,
          remediationCount: 2,
        }),
      ],
    },
  });
  harness.queueCopilotResponses(
    acceptanceNeedsChanges({ summary: 'The final automated remediation still failed.' })
  );

  await harness.run();

  assertIssueState(harness, 81, 'needs-human');
  assertPrState(harness, 181, 'needs-human');
  assert.equal(
    harness.store.assignments.filter(assignment => assignment.number === 181).length,
    0
  );
  assert.equal(harness.store.outputs.waiting_count, '1');
});

test('merged linked PRs move every active tracked state to done', async t => {
  const trackedStates = ['claimed', 'verifying', 'needs-work', 'in-review', 'needs-human'];

  for (const [offset, stateName] of trackedStates.entries()) {
    await t.test(stateName, async () => {
      const issueNumber = 90 + offset;
      const prNumber = 190 + offset;
      const harness = createHarness({
        issues: [buildIssue({ number: issueNumber, labels: [stateLabel(stateName)] })],
        prs: [
          buildPr({
            number: prNumber,
            issueNumbers: [issueNumber],
            labels: [stateLabel(stateName)],
            state: 'CLOSED',
            merged: true,
            isDraft: false,
            rollupState: 'SUCCESS',
            headRefOid: `${offset}`.repeat(40) || 'a'.repeat(40),
          }),
        ],
        approvalEvents: {
          [issueNumber]: [approvalEvent({ actor: primaryApprover })],
        },
      });

      await harness.run();

      assertIssueState(harness, issueNumber, 'done');
      assertPrState(harness, prNumber, 'done');
      assert.equal(harness.copilot.calls.length, 0);
    });
  }
});

test('mirrored PR labels cannot drive issue progression without issue state', async () => {
  const harness = createHarness({
    issues: [buildIssue({ number: 100 })],
    prs: [
      buildPr({
        number: 200,
        issueNumbers: [100],
        labels: [stateLabel('claimed')],
        isDraft: false,
        rollupState: 'SUCCESS',
        headRefOid: 'a'.repeat(40),
      }),
    ],
  });

  await harness.run();

  assert.deepEqual(activeStateLabels(harness.issueLabelNames(100)), []);
  assert.deepEqual(activeStateLabels(harness.prLabelNames(200)), [stateLabel('claimed')]);
  assert.equal(harness.copilot.calls.length, 0);
  assert.equal(harness.store.assignments.length, 0);
});

test('re-running the same claimed fixture is idempotent for comments and prompts', async () => {
  const harness = createHarness({
    issues: [buildIssue({ number: 110, labels: [approvalLabel] })],
    approvalEvents: {
      110: [approvalEvent({ actor: primaryApprover })],
    },
  });
  harness.queueCopilotResponses(curationReady());

  await harness.run();

  const firstCommentCount = harness.comments(110).length;
  const firstPromptCalls = harness.copilot.calls.filter(call => call.type === 'sendAndWait').length;
  const firstAssignments = harness.store.assignments.length;

  await harness.run();

  assertIssueState(harness, 110, 'claimed');
  assert.equal(harness.comments(110).length, firstCommentCount);
  assert.equal(
    harness.copilot.calls.filter(call => call.type === 'sendAndWait').length,
    firstPromptCalls
  );
  assert.equal(harness.store.assignments.length, firstAssignments);
});
