'use strict';

const fs = require('fs');
const path = require('path');
const {
  compileWorkflow,
  mergeWorkflow,
  parseWorkflow,
} = require('./workflow');

const DEFAULT_CONFIG = {
  version: 1,
  approvalActors: [],
  maxNewIssues: 1,
  maxInFlight: 2,
  conflictRetries: 2,
  reviewRetries: 2,
  copilotModel: 'auto',
  staleHours: 72,
  ignoreLabels: [],
};

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readWorkflowIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return parseWorkflow(fs.readFileSync(filePath, 'utf8'), filePath);
}

function mergeObjects(base, overlay) {
  if (overlay === undefined) return structuredClone(base);
  if (Array.isArray(overlay)) return structuredClone(overlay);
  if (!overlay || typeof overlay !== 'object') return overlay;

  const result = base && typeof base === 'object' && !Array.isArray(base)
    ? structuredClone(base)
    : {};
  for (const [key, value] of Object.entries(overlay)) {
    result[key] = mergeObjects(result[key], value);
  }
  return result;
}

function validateConfig(config) {
  const allowed = new Set(Object.keys(DEFAULT_CONFIG));
  for (const key of Object.keys(config)) {
    if (!allowed.has(key)) throw new Error(`unknown config key "${key}"`);
  }
  if (config.version !== 1) throw new Error('config must use schema version 1');
  if (!Array.isArray(config.approvalActors) ||
      config.approvalActors.some(actor => typeof actor !== 'string' || !actor.trim())) {
    throw new Error('approvalActors must contain non-empty GitHub logins');
  }
  if (config.approvalActors.length === 0) {
    throw new Error('approvalActors must not be empty');
  }
  for (const key of ['maxNewIssues', 'maxInFlight', 'conflictRetries', 'reviewRetries', 'staleHours']) {
    if (!Number.isInteger(config[key]) || config[key] < 1) {
      throw new Error(`${key} must be a positive integer`);
    }
  }
  if (typeof config.copilotModel !== 'string' || !config.copilotModel.trim()) {
    throw new Error('copilotModel must be a non-empty string');
  }
  if (!Array.isArray(config.ignoreLabels) ||
      config.ignoreLabels.some(label => typeof label !== 'string' || !label.trim())) {
    throw new Error('ignoreLabels must contain non-empty label names');
  }
  return config;
}

function resolveConfiguration({ frameworkRoot, callerRoot }) {
  const baseWorkflow = readWorkflowIfPresent(path.join(frameworkRoot, 'config', 'workflow.yml'));
  const workflowOverlay = readWorkflowIfPresent(
    path.join(callerRoot, '.puppets', 'workflow.yml')
  );
  const localConfig = readJsonIfPresent(
    path.join(callerRoot, '.puppets', 'config.json')
  );

  const workflow = compileWorkflow(mergeWorkflow(baseWorkflow, workflowOverlay || {}));
  const config = validateConfig(mergeObjects(DEFAULT_CONFIG, localConfig || {}));
  return { config, workflow };
}

module.exports = {
  DEFAULT_CONFIG,
  mergeObjects,
  resolveConfiguration,
  validateConfig,
};
