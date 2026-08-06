'use strict';

const fs = require('fs');
const path = require('path');
const { resolveConfiguration } = require('../src/config');

const frameworkRoot = path.resolve(process.env.PUPPETS_FRAMEWORK_ROOT || '.');
const callerRoot = path.resolve(process.env.PUPPETS_CALLER_ROOT || '.puppets-caller');
const outputRoot = path.resolve(process.env.PUPPETS_RESOLVED_ROOT || '.puppets-resolved');
const { config, workflow } = resolveConfiguration({ frameworkRoot, callerRoot });

fs.mkdirSync(path.join(outputRoot, 'prompts'), { recursive: true });
fs.writeFileSync(
  path.join(outputRoot, 'workflow.json'),
  `${JSON.stringify(workflow, null, 2)}\n`
);
fs.writeFileSync(
  path.join(outputRoot, 'config.json'),
  `${JSON.stringify(config, null, 2)}\n`
);

const frameworkPrompts = path.join(frameworkRoot, 'prompts');
const localPrompts = path.join(callerRoot, '.puppets', 'prompts');
const promptEntries = new Set(fs.readdirSync(frameworkPrompts));
if (fs.existsSync(localPrompts)) {
  for (const entry of fs.readdirSync(localPrompts)) promptEntries.add(entry);
}

for (const entry of promptEntries) {
  if (!entry.endsWith('.md')) continue;
  const local = path.join(localPrompts, entry);
  const source = fs.existsSync(local) ? local : path.join(frameworkPrompts, entry);
  const content = fs.readFileSync(source, 'utf8');
  if (Buffer.byteLength(content, 'utf8') > 20000) {
    throw new Error(`prompt ${entry} exceeds the 20 KB limit`);
  }
  fs.writeFileSync(path.join(outputRoot, 'prompts', entry), content);
}

const envFile = process.env.GITHUB_ENV;
if (envFile) {
  const lines = [
    `PUPPETS_APPROVAL_ACTORS=${config.approvalActors.join(',')}`,
    `MAX_ISSUES_PER_REPO=${config.maxNewIssues}`,
    `MAX_IN_FLIGHT_PER_REPO=${config.maxInFlight}`,
    `CONFLICT_RETRIES=${config.conflictRetries}`,
    `REVIEW_RETRIES=${config.reviewRetries}`,
    `COPILOT_MODEL=${config.copilotModel}`,
    `CLAUDE_MODEL=${config.claudeModel}`,
    `CODEX_MODEL=${config.codexModel}`,
    `PUPPETS_STALE_HOURS=${config.staleHours}`,
    `PUPPETS_IGNORE_LABELS=${config.ignoreLabels.join(',')}`,
    `PUPPETS_WORKFLOW_PATH=${path.join(outputRoot, 'workflow.json')}`,
    `PUPPETS_PROMPTS_DIR=${path.join(outputRoot, 'prompts')}`,
  ];
  fs.appendFileSync(envFile, `${lines.join('\n')}\n`);
}

console.log(`Resolved Puppets configuration for ${config.approvalActors.join(', ')}`);
