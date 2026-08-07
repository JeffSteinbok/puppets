'use strict';

function createStateController({ github, core, owner, dryRun, model }) {
  const {
    machine,
    stateNames,
    stateLabels,
    stateNameByLabel,
    stateMetadataByName,
    transitions,
  } = model;
  const trackedStates = new Map();
  const trackedLabels = new Map();
  const labelName = label => typeof label === 'string' ? label : label.name;
  const issueLabels = issue => new Set((issue.labels || []).map(labelName));
  const itemKey = (repo, issue) => `${repo}:${issue.node_id || issue.number}`;

  const currentLabels = (repo, issue) => {
    const key = itemKey(repo, issue);
    if (!trackedLabels.has(key)) trackedLabels.set(key, issueLabels(issue));
    return trackedLabels.get(key);
  };

  const currentStateName = (repo, issue) => {
    const key = itemKey(repo, issue);
    if (trackedStates.has(key)) return trackedStates.get(key);
    const active = [...currentLabels(repo, issue)].filter(label => stateNameByLabel.has(label));
    if (active.length > 1) {
      core.warning(
        `${repo}#${issue.number} has multiple workflow states (${active.join(', ')}); ` +
        'the next transition will reconcile them.'
      );
    }
    const activeNames = new Set(active.map(label => stateNameByLabel.get(label)));
    let stateName;
    if (activeNames.has('approved') && activeNames.has('needs-human')) {
      stateName = 'approved';
    } else if (activeNames.has('ready')) {
      stateName = 'ready';
    } else {
      stateName =
        [...stateNames].reverse().find(name => activeNames.has(name)) || machine.start;
    }
    trackedStates.set(key, stateName);
    return stateName;
  };

  const stateLabel = stateName => {
    const metadata = stateMetadataByName.get(stateName);
    if (!metadata) throw new Error(`Unknown Puppets state "${stateName}"`);
    return metadata.label;
  };

  const assertTransition = (from, to) => {
    if (!stateNames.has(to)) throw new Error(`Unknown Puppets state "${to}"`);
    if (from === to) return;
    if (!transitions[from]?.includes(to)) {
      throw new Error(`Workflow transition ${from} -> ${to} is not allowed`);
    }
  };

  const describeItem = (repo, issue) => `${repo}#${issue.number}`;

  const stateChangeBody = ({ currentState, nextState, reason }) => [
    '**Puppets state change**',
    '',
    `- from: \`${currentState}\``,
    `- to: \`${nextState}\``,
    `- why: ${reason || 'Puppets reconciled this item to the next workflow state.'}`,
  ].join('\n');

  async function commentStateChange(repo, issue, currentState, nextState, reason) {
    const body = stateChangeBody({ currentState, nextState, reason });
    console.log(
      `  state ${describeItem(repo, issue)} ${currentState} -> ${nextState}: ` +
      (reason || 'no reason provided')
    );
    if (!dryRun) {
      await github.rest.issues.createComment({
        owner,
        repo,
        issue_number: issue.number,
        body,
      });
    }
  }

  async function addLabel(repo, issueNumber, label) {
    console.log(`  + ${label}`);
    if (!dryRun) {
      await github.rest.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels: [label],
      });
    }
  }

  async function removeLabel(repo, issueNumber, label, labels) {
    if (!labels.has(label)) return;
    console.log(`  - ${label}`);
    if (!dryRun) {
      await github.rest.issues.removeLabel({
        owner,
        repo,
        issue_number: issueNumber,
        name: label,
      });
    }
  }

  async function setState(repo, issue, nextState, options = {}) {
    const nextLabel = stateLabel(nextState);
    const currentState = currentStateName(repo, issue);
    if (options.validateTransition !== false) assertTransition(currentState, nextState);
    const labels = currentLabels(repo, issue);
    if (!labels.has(nextLabel)) {
      await addLabel(repo, issue.number, nextLabel);
      labels.add(nextLabel);
    }
    for (const label of stateLabels) {
      if (label !== nextLabel) {
        await removeLabel(repo, issue.number, label, labels);
        labels.delete(label);
      }
    }
    trackedStates.set(itemKey(repo, issue), nextState);
    if (currentState !== nextState) {
      await commentStateChange(repo, issue, currentState, nextState, options.reason);
    } else {
      console.log(`  state ${describeItem(repo, issue)} remains ${nextState}`);
    }
  }

  async function clearState(repo, issue, options = {}) {
    const currentState = currentStateName(repo, issue);
    const labels = currentLabels(repo, issue);
    const hadStateLabel = [...labels].some(label => stateLabels.has(label));
    for (const label of stateLabels) {
      await removeLabel(repo, issue.number, label, labels);
      labels.delete(label);
    }
    trackedStates.set(itemKey(repo, issue), machine.start);
    if (hadStateLabel || currentState !== machine.start) {
      await commentStateChange(repo, issue, currentState, machine.start, options.reason);
    } else {
      console.log(`  state ${describeItem(repo, issue)} remains ${machine.start}`);
    }
  }

  async function setPrState(repo, prNumber, nextState, options = {}) {
    if (!stateNames.has(nextState)) throw new Error(`Unknown Puppets state "${nextState}"`);
    if (!stateMetadataByName.get(nextState).mirrorToPr) return;
    const { data: prAsIssue } = await github.rest.issues.get({
      owner,
      repo,
      issue_number: prNumber,
    });
    await setState(repo, prAsIssue, nextState, {
      validateTransition: false,
      reason: options.reason || `Mirroring the linked issue state to PR #${prNumber}.`,
    });
  }

  async function clearPrState(repo, prNumber, options = {}) {
    const { data: prAsIssue } = await github.rest.issues.get({
      owner,
      repo,
      issue_number: prNumber,
    });
    await clearState(repo, prAsIssue, options);
  }

  async function setLinkedState(repo, issue, pr, nextState, options = {}) {
    await setPrState(repo, pr.number, nextState, {
      reason: options.prReason || `Mirroring issue #${issue.number} state on this linked PR.`,
    });
    await setState(repo, issue, nextState, options);
  }

  return {
    addLabel,
    clearPrState,
    clearState,
    currentLabels,
    currentStateName,
    issueLabels,
    removeLabel,
    setLinkedState,
    setPrState,
    setState,
    stateLabel,
  };
}

module.exports = { createStateController };
