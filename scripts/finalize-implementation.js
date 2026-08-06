'use strict';

/**
 * Puppets — implementation job finalizer.
 *
 * Runs at the end of the `implement` job in reconcile.yml, after the claude/codex action has
 * had a chance to edit the checked-out working tree. Turns whatever it produced into a
 * deterministic outcome: commit + push + (for a fresh assignment) open a draft pull request
 * that references the issue, or (for a remediation retry) just push the follow-up commits to
 * the existing pull request's branch. Neither provider action is trusted to create the
 * commit, branch, or pull request itself — this file is the single place that does, so
 * behavior is identical regardless of which provider produced the edits.
 *
 * If the provider made no file changes at all, nothing is committed; the run fails loudly
 * (`core.setFailed`) and posts a comment on the issue so a human notices instead of the item
 * silently sitting in its current state forever.
 *
 * Expects to run via `actions/github-script` (so `github`/`context`/`core` are injected) with
 * the job descriptor supplied through environment variables (never interpolated into a
 * script or shell command, to avoid injecting matrix/job values into executable text):
 *   PUPPETS_JOB_REPO          — caller repository name.
 *   PUPPETS_JOB_ISSUE_NUMBER  — issue this implementation job is for.
 *   PUPPETS_JOB_PR_NUMBER     — linked PR number (remediate mode only).
 *   PUPPETS_JOB_PROVIDER      — `claude` or `codex`.
 *   PUPPETS_JOB_MODE          — `assign` or `remediate`.
 *   PUPPETS_JOB_BRANCH        — deterministic branch name (puppets/issue-<n>).
 *   PUPPETS_JOB_START_SHA     — commit checked out before the provider action ran.
 *   PUPPETS_CALLER_ROOT       — working directory containing the caller repository checkout.
 */
module.exports = async ({ github, context, core }) => {
  const { execFileSync } = require('child_process');
  const {
    parseJob,
    commitMessage,
    pullRequestTitle,
    pullRequestBody,
    hasImplementationChanges,
  } = require('../src/providers/implementation-job');

  const job = parseJob({
    repo: process.env.PUPPETS_JOB_REPO,
    issueNumber: Number.parseInt(process.env.PUPPETS_JOB_ISSUE_NUMBER, 10),
    prNumber: process.env.PUPPETS_JOB_PR_NUMBER
      ? Number.parseInt(process.env.PUPPETS_JOB_PR_NUMBER, 10)
      : null,
    provider: process.env.PUPPETS_JOB_PROVIDER,
    mode: process.env.PUPPETS_JOB_MODE,
    branch: process.env.PUPPETS_JOB_BRANCH,
  });

  const owner = context.repo.owner;
  const repo = job.repo || context.repo.repo;
  const cwd = process.env.PUPPETS_CALLER_ROOT || '.';
  const startSha = process.env.PUPPETS_JOB_START_SHA || '';
  if (!/^[0-9a-f]{40}$/i.test(startSha)) {
    throw new Error('PUPPETS_JOB_START_SHA must be a full commit SHA');
  }

  const git = (...args) =>
    execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

  const currentBranch = git('branch', '--show-current').trim();
  if (currentBranch !== job.branch) {
    throw new Error(
      `implementation provider left the checkout on "${currentBranch}", expected "${job.branch}"`
    );
  }

  const headSha = git('rev-parse', 'HEAD').trim();
  const status = git('status', '--porcelain').trim();
  if (!hasImplementationChanges({ startSha, headSha, status })) {
    const message = job.mode === 'assign'
      ? `Puppets asked the \`${job.provider}\` implementation provider to work on this issue, ` +
        'but it made no file changes. Escalating for a human to review the prompt or issue scope.'
      : `Puppets asked the \`${job.provider}\` implementation provider to address the ` +
        `remediation directive on PR #${job.prNumber}, but it made no additional file changes.`;
    // This job only ever runs for entries the reconciler queued while NOT in dry-run mode
    // (see queueImplementationJob in src/reconcile.js), so posting here is always live.
    await github.rest.issues.createComment({ owner, repo, issue_number: job.issueNumber, body: message });
    core.setFailed(
      `${job.provider} produced no workspace changes for ${repo}#${job.issueNumber}; see the issue comment.`
    );
    return;
  }

  if (status) {
    git('config', 'user.name', 'github-actions[bot]');
    git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
    git('add', '-A');
    git('commit', '-m', commitMessage(job));
  }
  git('push', 'origin', `HEAD:refs/heads/${job.branch}`);

  if (job.mode === 'remediate') {
    core.info(`Pushed remediation commits to ${job.branch} for ${repo}#${job.issueNumber}.`);
    return;
  }

  // Idempotent: a retried "assign" run (e.g. after a transient failure downstream of an
  // earlier successful push) must not open a second pull request for the same branch.
  const existing = await github.paginate(github.rest.pulls.list, {
    owner, repo, head: `${owner}:${job.branch}`, state: 'open', per_page: 10,
  });
  if (existing.length > 0) {
    core.info(`PR #${existing[0].number} is already open for ${job.branch}; nothing further to do.`);
    return;
  }

  let issueTitle = '';
  try {
    const { data: issue } = await github.rest.issues.get({
      owner, repo, issue_number: job.issueNumber,
    });
    issueTitle = issue.title;
  } catch (error) {
    core.warning(`Could not read ${repo}#${job.issueNumber} title: ${error.message}`);
  }

  const { data: repository } = await github.rest.repos.get({ owner, repo });
  const pr = await github.rest.pulls.create({
    owner,
    repo,
    title: pullRequestTitle(job, issueTitle),
    body: pullRequestBody(job),
    head: job.branch,
    base: repository.default_branch,
    // Mirrors the Copilot coding agent's own behavior: stay draft until CI and acceptance
    // review both pass, so reconcileInFlight gates every provider identically.
    draft: true,
  });
  core.info(`Opened PR #${pr.data.number} for ${repo}#${job.issueNumber} via ${job.provider}.`);
};
