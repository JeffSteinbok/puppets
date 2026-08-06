'use strict';

// Closed allowlist of implementation providers. A workflow profile selects one of these
// names; because the set is fixed here (not sourced from repository-controlled YAML), a
// caller overlay can never smuggle in an arbitrary GitHub Action reference through
// `.puppets/workflow.yml`. Adding a provider requires a framework code change and review,
// not a caller-side configuration edit.
const PROVIDER_NAMES = Object.freeze(['copilot', 'claude', 'codex']);

// Providers driven by an official GitHub Action that runs inside the reusable workflow's
// own `implement` job, rather than by assigning a GitHub-hosted bot to the issue. The
// reconciler cannot invoke a `uses:` step itself (that can only be declared in workflow
// YAML), so for these providers it emits a job descriptor (see `implementationBranchName`
// and the reconciler's `implementationJobs` output) that `reconcile.yml` consumes to run the
// action against a checked-out branch and then deterministically commit, push, and open or
// update the linked pull request. This keeps the reconciler itself free of any dependency
// on a specific action's own (and possibly absent) branch/commit/PR behavior.
const ACTION_PROVIDERS = new Set(['claude', 'codex']);

function isValidProvider(name) {
  return PROVIDER_NAMES.includes(name);
}

// True for the one provider GitHub can assign directly as a collaborator/bot.
function usesAssignableBot(provider) {
  return provider === 'copilot';
}

// True for providers that require the follow-up `implement` job.
function usesActionRun(provider) {
  return ACTION_PROVIDERS.has(provider);
}

// Deterministic branch name derived only from the issue number, so an initial assignment
// and any later remediation/conflict-retry attempt reuse the same branch (and therefore the
// same pull request) instead of accumulating duplicate branches across reconciler runs.
function implementationBranchName(issueNumber) {
  return `puppets/issue-${issueNumber}`;
}

module.exports = {
  PROVIDER_NAMES,
  isValidProvider,
  usesAssignableBot,
  usesActionRun,
  implementationBranchName,
};
