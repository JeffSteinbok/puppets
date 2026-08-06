'use strict';

const { isValidProvider } = require('./providers');

// Validate and normalize one entry from the reconciler's `implementation_jobs` output before
// any git or GitHub API action is taken on it. This data crosses a job boundary (through
// `fromJSON()` in reconcile.yml's `implement` job), so it is re-validated here just as
// strictly as any other boundary input — even though it is produced by this framework's own
// trusted runtime, not by repository-controlled content.
function parseJob(raw) {
  const job = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!job || typeof job !== 'object') {
    throw new Error('implementation job is not an object');
  }
  if (!Number.isInteger(job.issueNumber) || job.issueNumber < 1) {
    throw new Error('implementation job has an invalid issueNumber');
  }
  const prNumber = job.prNumber === undefined || job.prNumber === null || job.prNumber === ''
    ? null
    : Number(job.prNumber);
  if (prNumber !== null && (!Number.isInteger(prNumber) || prNumber < 1)) {
    throw new Error('implementation job has an invalid prNumber');
  }
  // `copilot` never reaches this path (it is assigned directly, never queued as a job), so
  // it is deliberately excluded here in addition to the general allowlist check.
  if (!isValidProvider(job.provider) || job.provider === 'copilot') {
    throw new Error(`implementation job has an unsupported provider "${job.provider}"`);
  }
  if (!['assign', 'remediate'].includes(job.mode)) {
    throw new Error(`implementation job has an unsupported mode "${job.mode}"`);
  }
  if (typeof job.branch !== 'string' || !/^puppets\/issue-\d+$/.test(job.branch)) {
    throw new Error('implementation job has an invalid branch name');
  }
  if (job.mode === 'remediate' && prNumber === null) {
    throw new Error('a remediate implementation job must include a prNumber');
  }
  return {
    repo: job.repo ? String(job.repo) : '',
    issueNumber: job.issueNumber,
    prNumber,
    provider: job.provider,
    mode: job.mode,
    branch: job.branch,
    directive: job.directive ? String(job.directive) : null,
    model: job.model ? String(job.model) : '',
  };
}

// Build the prompt handed to the provider action for a fresh ("assign") implementation
// attempt: the issue's own title/body plus the already-posted, trusted implementation
// instructions comment (the resolved base prompt plus any repo-owned per-repo guidance).
// Everything here is exactly what a human already sees on the issue — no separate prompt
// text is invented for these providers.
function buildAssignPrompt({ issueNumber, issueTitle, issueBody, instructions }) {
  return [
    `Issue #${issueNumber}: ${issueTitle && issueTitle.trim() ? issueTitle.trim() : '(untitled)'}`,
    '',
    issueBody && issueBody.trim() ? issueBody.trim() : '(empty)',
    '',
    instructions && instructions.trim() ? instructions.trim() : '',
  ].join('\n').trim();
}

function commitMessage(job) {
  return job.mode === 'assign'
    ? `Puppets: implement #${job.issueNumber} via ${job.provider}`
    : `Puppets: address remediation on #${job.issueNumber} via ${job.provider}`;
}

function pullRequestTitle(job, issueTitle) {
  return issueTitle && issueTitle.trim() ? issueTitle.trim() : `Implement #${job.issueNumber}`;
}

function pullRequestBody(job) {
  return [
    `Closes #${job.issueNumber}.`,
    '',
    `Implemented by the \`${job.provider}\` provider via Puppets. Left as a draft until CI ` +
      'and acceptance review pass, same as a Copilot-authored pull request.',
  ].join('\n');
}

module.exports = {
  parseJob,
  buildAssignPrompt,
  commitMessage,
  pullRequestTitle,
  pullRequestBody,
};
