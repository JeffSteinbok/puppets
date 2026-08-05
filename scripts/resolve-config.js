'use strict';

const fs = require('fs');
const path = require('path');
const { resolveConfiguration } = require('../lib/config');

const frameworkRoot = path.resolve(process.env.PUPPETS_FRAMEWORK_ROOT || '.');
const callerRoot = path.resolve(process.env.PUPPETS_CALLER_ROOT || '.puppets-caller');
const outputRoot = path.resolve(process.env.PUPPETS_RESOLVED_ROOT || '.puppets-resolved');
const { config, lifecycle } = resolveConfiguration({ frameworkRoot, callerRoot });

fs.mkdirSync(path.join(outputRoot, 'prompts'), { recursive: true });
fs.writeFileSync(
  path.join(outputRoot, 'lifecycle.json'),
  `${JSON.stringify(lifecycle, null, 2)}\n`
);
fs.writeFileSync(
  path.join(outputRoot, 'config.json'),
  `${JSON.stringify(config, null, 2)}\n`
);

for (const entry of fs.readdirSync(path.join(frameworkRoot, 'prompts'))) {
  if (!entry.endsWith('.md')) continue;
  const local = path.join(callerRoot, '.github', 'puppets', 'prompts', entry);
  const source = fs.existsSync(local) ? local : path.join(frameworkRoot, 'prompts', entry);
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
    `ENABLE_CURATION=${config.enableCuration}`,
    `PUPPETS_STALE_HOURS=${config.staleHours}`,
    `PUPPETS_IGNORE_LABELS=${config.ignoreLabels.join(',')}`,
    `PUPPETS_LIFECYCLE_PATH=${path.join(outputRoot, 'lifecycle.json')}`,
    `PUPPETS_PROMPTS_DIR=${path.join(outputRoot, 'prompts')}`,
  ];
  fs.appendFileSync(envFile, `${lines.join('\n')}\n`);
}

console.log(`Resolved Puppets configuration for ${config.approvalActors.join(', ')}`);
