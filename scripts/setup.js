#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROVIDERS = new Set(['copilot', 'claude', 'codex']);

function parseArgs(argv) {
  const options = {
    approver: '',
    force: false,
    provider: 'copilot',
    target: process.cwd(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--force') {
      options.force = true;
    } else if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (['--approver', '--provider', '--target'].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      options[argument.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`unknown option "${argument}"`);
    }
  }

  if (!PROVIDERS.has(options.provider)) {
    throw new Error('--provider must be copilot, claude, or codex');
  }
  return options;
}

function detectGitHubLogin() {
  const result = spawnSync('gh', ['api', 'user', '--jq', '.login'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  return result.status === 0 ? result.stdout.trim() : '';
}

function buildCallerWorkflow(provider, template) {
  if (provider === 'copilot') return template;

  let workflow = template.replace('  contents: read', '  contents: write');
  if (provider === 'claude') {
    workflow = workflow
      .replace('      # anthropic_api_key:', '      anthropic_api_key:')
      .replace('      # claude_code_oauth_token:', '      claude_code_oauth_token:');
  } else {
    workflow = workflow.replace('      # openai_api_key:', '      openai_api_key:');
  }
  return workflow;
}

function buildProviderOverlay(provider) {
  return `metadata:
  name: ${provider}

spec:
  profiles:
    - name: basic
      implementation:
        provider: ${provider}
`;
}

function writeSetup({ approver, force, provider, target }) {
  const login = approver || detectGitHubLogin();
  if (!login) {
    throw new Error('could not detect your GitHub login; pass --approver YOUR_GITHUB_LOGIN');
  }

  const root = path.resolve(target);
  const template = fs.readFileSync(path.join(__dirname, '..', 'caller-template.yml'), 'utf8');
  const files = new Map([
    [
      path.join(root, '.github', 'workflows', 'puppets.yml'),
      buildCallerWorkflow(provider, template),
    ],
    [
      path.join(root, '.puppets', 'config.json'),
      `${JSON.stringify({ version: 1, approvalActors: [login] }, null, 2)}\n`,
    ],
  ]);

  if (provider !== 'copilot') {
    files.set(
      path.join(root, '.puppets', 'workflow.yml'),
      buildProviderOverlay(provider)
    );
  }

  const existing = [...files.keys()].filter(filePath => fs.existsSync(filePath));
  if (existing.length > 0 && !force) {
    throw new Error(
      `refusing to overwrite existing files:\n${existing.map(filePath => `  ${filePath}`).join('\n')}\n` +
      'Run again with --force only if you intend to replace them.'
    );
  }

  for (const [filePath, content] of files) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }

  return { files: [...files.keys()], login, provider };
}

function printHelp() {
  console.log(`Usage: puppets-setup [options]

Options:
  --approver LOGIN    GitHub login allowed to approve work (auto-detected with gh)
  --provider NAME     copilot (default), claude, or codex
  --target PATH       Repository to configure (default: current directory)
  --force             Replace existing generated files
  -h, --help          Show this help`);
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      return;
    }

    const result = writeSetup(options);
    console.log(`Configured Puppets with the ${result.provider} provider for ${result.login}:`);
    for (const filePath of result.files) {
      console.log(`  ${path.relative(path.resolve(options.target), filePath)}`);
    }
    console.log('\nReview and commit these files, then run the Puppets workflow with dry_run=true.');
  } catch (error) {
    console.error(`Puppets setup failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  buildCallerWorkflow,
  buildProviderOverlay,
  parseArgs,
  writeSetup,
};
