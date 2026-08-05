'use strict';

const fs = require('fs');
const path = require('path');

const REQUIRED_STATE_LABELS = {
  'needs-info': 'puppets:needs-info',
  approved: 'puppets:approved',
  curating: 'puppets:curating',
  ready: 'puppets:ready',
  claimed: 'puppets:claimed',
  verifying: 'puppets:verifying',
  'needs-work': 'puppets:needs-work',
  'in-review': 'puppets:in-review',
  'needs-human': 'puppets:needs-human',
  done: 'puppets:done',
};

const DEFAULT_CONFIG = {
  version: 1,
  approvalActors: [],
  maxNewIssues: 1,
  maxInFlight: 2,
  conflictRetries: 2,
  reviewRetries: 2,
  copilotModel: 'auto',
  enableCuration: true,
  staleHours: 72,
  ignoreLabels: [],
};

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function validateLifecycle(lifecycle) {
  if (!lifecycle || lifecycle.version !== 1 || !lifecycle.states ||
      !lifecycle.transitions || !Array.isArray(lifecycle.controlLabels) ||
      !Array.isArray(lifecycle.helperLabels)) {
    throw new Error('lifecycle must match schema version 1');
  }

  for (const [state, label] of Object.entries(REQUIRED_STATE_LABELS)) {
    if (lifecycle.states[state]?.label !== label) {
      throw new Error(`protected state "${state}" must use label "${label}"`);
    }
  }

  const stateNames = new Set(Object.keys(lifecycle.states));
  const labels = [];
  for (const [state, metadata] of Object.entries(lifecycle.states)) {
    if (!metadata || typeof metadata.label !== 'string' ||
        !/^[0-9A-Fa-f]{6}$/.test(metadata.color) ||
        typeof metadata.description !== 'string' ||
        typeof metadata.mirrorToPr !== 'boolean' ||
        typeof metadata.countsAsInFlight !== 'boolean') {
      throw new Error(`invalid lifecycle metadata for state "${state}"`);
    }
    labels.push(metadata.label);
  }

  for (const item of [...lifecycle.controlLabels, ...lifecycle.helperLabels]) {
    if (!item || typeof item.name !== 'string' ||
        !/^[0-9A-Fa-f]{6}$/.test(item.color) ||
        typeof item.description !== 'string') {
      throw new Error('invalid control or helper label metadata');
    }
    labels.push(item.name);
  }
  if (new Set(labels).size !== labels.length) {
    throw new Error('lifecycle contains duplicate labels');
  }
  if (!lifecycle.controlLabels.some(label => label.name === 'puppets:no-auto')) {
    throw new Error('lifecycle must retain the protected puppets:no-auto control label');
  }

  const sources = new Set(Object.keys(lifecycle.transitions));
  if (!sources.has('untracked')) throw new Error('lifecycle must define untracked transitions');
  for (const state of stateNames) {
    if (!sources.has(state)) throw new Error(`state "${state}" has no transition list`);
  }
  for (const [source, targets] of Object.entries(lifecycle.transitions)) {
    if (source !== 'untracked' && !stateNames.has(source)) {
      throw new Error(`unknown transition source "${source}"`);
    }
    if (!Array.isArray(targets) || targets.some(target => !stateNames.has(target))) {
      throw new Error(`invalid transition target from "${source}"`);
    }
  }

  return lifecycle;
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
  if (typeof config.enableCuration !== 'boolean') {
    throw new Error('enableCuration must be boolean');
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
  const baseLifecycle = readJsonIfPresent(path.join(frameworkRoot, 'config', 'lifecycle.json'));
  const lifecycleOverlay = readJsonIfPresent(
    path.join(callerRoot, '.puppets', 'lifecycle.json')
  );
  const localConfig = readJsonIfPresent(
    path.join(callerRoot, '.puppets', 'config.json')
  );

  const lifecycle = validateLifecycle(mergeObjects(baseLifecycle, lifecycleOverlay || {}));
  const config = validateConfig(mergeObjects(DEFAULT_CONFIG, localConfig || {}));
  return { config, lifecycle };
}

module.exports = {
  DEFAULT_CONFIG,
  REQUIRED_STATE_LABELS,
  mergeObjects,
  resolveConfiguration,
  validateConfig,
  validateLifecycle,
};
