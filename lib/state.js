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
  }

  async function clearState(repo, issue) {
    const labels = currentLabels(repo, issue);
    for (const label of stateLabels) {
      await removeLabel(repo, issue.number, label, labels);
      labels.delete(label);
    }
    trackedStates.set(itemKey(repo, issue), machine.start);
  }

  async function setPrState(repo, prNumber, nextState) {
    if (!stateNames.has(nextState)) throw new Error(`Unknown Puppets state "${nextState}"`);
    if (!stateMetadataByName.get(nextState).mirrorToPr) return;
    const { data: prAsIssue } = await github.rest.issues.get({
      owner,
      repo,
      issue_number: prNumber,
    });
    await setState(repo, prAsIssue, nextState, { validateTransition: false });
  }

  async function clearPrState(repo, prNumber) {
    const { data: prAsIssue } = await github.rest.issues.get({
      owner,
      repo,
      issue_number: prNumber,
    });
    await clearState(repo, prAsIssue);
  }

  async function setLinkedState(repo, issue, pr, nextState) {
    await setPrState(repo, pr.number, nextState);
    await setState(repo, issue, nextState);
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
