'use strict';

const YAML = require('yaml');
const { isValidProvider } = require('./providers/providers');

const API_VERSION = 'puppets.dev/v1alpha1';
const DSL_VERSION = '1.0';
const STAGE_TYPES = new Set(['deterministic', 'agentic', 'gate', 'wait', 'terminal']);
const REQUIRED_HANDLERS = new Set([
  'triage',
  'wait-for-detail',
  'approval',
  'curation',
  'assignment',
  'pull-request',
  'human-handoff',
  'complete',
]);
const REQUIRED_STAGE_NAMES = new Set([
  'untracked',
  'needs-info',
  'approved',
  'curating',
  'ready',
  'claimed',
  'verifying',
  'needs-work',
  'in-review',
  'needs-human',
  'done',
]);

function parseWorkflow(source, sourceName) {
  try {
    return YAML.parse(source);
  } catch (error) {
    throw new Error(`Could not parse ${sourceName}: ${error.message}`);
  }
}

function mergeNamed(base, overlay, key) {
  const result = new Map((base || []).map(item => [item[key], structuredClone(item)]));
  for (const item of overlay || []) {
    const name = item?.[key];
    if (!name) throw new Error(`workflow overlay item is missing ${key}`);
    result.set(name, mergeWorkflow(result.get(name) || {}, item));
  }
  return [...result.values()];
}

function mergeWorkflow(base, overlay, path = '') {
  if (overlay === undefined) return structuredClone(base);
  if (Array.isArray(overlay)) {
    if (path === 'spec.stages' || path === 'spec.profiles') {
      return mergeNamed(base, overlay, 'name');
    }
    if (path === 'spec.labels.controls') {
      return mergeNamed(base, overlay, 'role');
    }
    if (path === 'spec.labels.helpers') {
      return mergeNamed(base, overlay, 'name');
    }
    return structuredClone(overlay);
  }
  if (!overlay || typeof overlay !== 'object') return overlay;

  const result = base && typeof base === 'object' && !Array.isArray(base)
    ? structuredClone(base)
    : {};
  for (const [key, value] of Object.entries(overlay)) {
    const childPath = path ? `${path}.${key}` : key;
    result[key] = mergeWorkflow(result[key], value, childPath);
  }
  return result;
}

function validateLabel(label, kind) {
  if (!label || typeof label.name !== 'string' || !label.name.trim() ||
      !/^[0-9A-Fa-f]{6}$/.test(String(label.color)) ||
      typeof label.description !== 'string') {
    throw new Error(`invalid ${kind} label metadata`);
  }
}

function validateProfile(profile) {
  if (!profile || typeof profile.name !== 'string' || !profile.name.trim() ||
      typeof profile.default !== 'boolean' || !Number.isInteger(profile.priority) ||
      !profile.routes || typeof profile.routes.approved !== 'string' ||
      !profile.implementation ||
      typeof profile.implementation.prompt !== 'string' ||
      !/^[a-z0-9-]+$/.test(profile.implementation.prompt) ||
      typeof profile.implementation.heading !== 'string' ||
      !profile.implementation.heading.trim() ||
      (profile.implementation.guidance !== null &&
       (typeof profile.implementation.guidance !== 'string' ||
        !/^[a-z0-9-]+$/.test(profile.implementation.guidance))) ||
      // The provider selects which agent performs the implementation step. It is validated
      // against a fixed, code-defined allowlist (src/providers/providers.js) rather than accepted as
      // free-form text, so a caller's `.puppets/workflow.yml` overlay can never name an
      // arbitrary GitHub Action to run.
      typeof profile.implementation.provider !== 'string' ||
      !isValidProvider(profile.implementation.provider)) {
    throw new Error(`invalid workflow profile "${profile?.name || '(unnamed)'}"`);
  }
  const selector = profile.selector || {};
  for (const key of ['allLabels', 'anyLabels', 'noneLabels']) {
    if (!Array.isArray(selector[key] || []) ||
        (selector[key] || []).some(label => typeof label !== 'string' || !label.trim())) {
      throw new Error(`invalid ${key} selector in workflow profile "${profile.name}"`);
    }
  }
}

function compileWorkflow(definition) {
  if (!definition || definition.apiVersion !== API_VERSION ||
      definition.kind !== 'Workflow' || definition.dslVersion !== DSL_VERSION ||
      typeof definition.metadata?.name !== 'string' || !definition.spec) {
    throw new Error(`workflow must use ${API_VERSION} Workflow DSL ${DSL_VERSION}`);
  }

  const stages = definition.spec.stages;
  if (!Array.isArray(stages) || stages.length === 0) {
    throw new Error('workflow must define stages');
  }
  const stageByName = new Map();
  const stageByHandler = new Map();
  const labels = [];
  for (const stage of stages) {
    if (!stage || typeof stage.name !== 'string' || !stage.name.trim() ||
        !STAGE_TYPES.has(stage.type) || typeof stage.handler !== 'string' ||
        stageByName.has(stage.name)) {
      throw new Error(`invalid or duplicate workflow stage "${stage?.name || '(unnamed)'}"`);
    }
    if (stageByHandler.has(stage.handler) && stage.handler !== 'pull-request') {
      throw new Error(`workflow handler "${stage.handler}" must be unique`);
    }
    stageByName.set(stage.name, stage);
    stageByHandler.set(stage.handler, stage);
    if (stage.label) {
      validateLabel(stage.label, `stage "${stage.name}"`);
      labels.push(stage.label.name);
    }
    if (!stage.branches || Object.values(stage.branches).some(
      target => typeof target !== 'string' || !target.trim()
    )) {
      throw new Error(`workflow stage "${stage.name}" must define branches`);
    }
  }

  for (const handler of REQUIRED_HANDLERS) {
    if (![...stageByName.values()].some(stage => stage.handler === handler)) {
      throw new Error(`workflow is missing required handler "${handler}"`);
    }
    for (const name of REQUIRED_STAGE_NAMES) {
      if (!stageByName.has(name)) {
        throw new Error(`workflow is missing required stage "${name}"`);
      }
    }
  }
  if (!stageByName.has(definition.spec.start)) {
    throw new Error(`workflow start stage "${definition.spec.start}" does not exist`);
  }
  for (const stage of stages) {
    for (const target of Object.values(stage.branches)) {
      if (!stageByName.has(target)) {
        throw new Error(`workflow stage "${stage.name}" targets unknown stage "${target}"`);
      }
    }
  }

  const controls = definition.spec.labels?.controls || [];
  const helpers = definition.spec.labels?.helpers || [];
  const roles = new Set();
  for (const label of controls) {
    validateLabel(label, 'control');
    if (typeof label.role !== 'string' || !label.role.trim() || roles.has(label.role)) {
      throw new Error('control labels must define unique roles');
    }
    roles.add(label.role);
    labels.push(label.name);
  }
  if (!roles.has('opt-out')) throw new Error('workflow must define an opt-out label role');
  for (const label of helpers) {
    validateLabel(label, 'helper');
    labels.push(label.name);
  }
  if (new Set(labels).size !== labels.length) {
    throw new Error('workflow contains duplicate label names');
  }

  const profiles = definition.spec.profiles || [];
  if (profiles.length === 0) throw new Error('workflow must define profiles');
  // `provider` defaults to `copilot` so existing profiles (and caller overlays written
  // before providers existed) keep behaving exactly as before without naming it explicitly.
  for (const profile of profiles) {
    if (profile?.implementation && profile.implementation.provider === undefined) {
      profile.implementation.provider = 'copilot';
    }
  }
  profiles.forEach(validateProfile);
  if (new Set(profiles.map(profile => profile.name)).size !== profiles.length) {
    throw new Error('workflow profile names must be unique');
  }
  if (profiles.filter(profile => profile.default).length !== 1) {
    throw new Error('workflow must define exactly one default profile');
  }
  const approvalStage = [...stageByName.values()].find(stage => stage.handler === 'approval');
  for (const profile of profiles) {
    const targetName = approvalStage.branches[profile.routes.approved];
    if (!targetName) {
      throw new Error(
        `profile "${profile.name}" selects unknown approval branch "${profile.routes.approved}"`
      );
    }
    const targetHandler = stageByName.get(targetName).handler;
    if (!['curation', 'assignment', 'pull-request'].includes(targetHandler)) {
      throw new Error(
        `profile "${profile.name}" approval branch targets unsupported handler "${targetHandler}"`
      );
    }
  }

  return {
    apiVersion: definition.apiVersion,
    dslVersion: definition.dslVersion,
    name: definition.metadata.name,
    start: definition.spec.start,
    stages,
    profiles,
    controlLabels: controls,
    helperLabels: helpers,
  };
}

function matchesProfile(profile, labels) {
  const selector = profile.selector || {};
  const all = selector.allLabels || [];
  const any = selector.anyLabels || [];
  const none = selector.noneLabels || [];
  return all.every(label => labels.has(label)) &&
    (any.length === 0 || any.some(label => labels.has(label))) &&
    none.every(label => !labels.has(label));
}

function resolveProfile(machine, labels) {
  const matched = machine.profiles
    .filter(profile => !profile.default && matchesProfile(profile, labels))
    .sort((left, right) => right.priority - left.priority)[0];
  return matched || machine.profiles.find(profile => profile.default);
}

function createMachineModel(machine) {
  const stateEntries = machine.stages
    .filter(stage => stage.label)
    .map(stage => [
      stage.name,
      {
        label: stage.label.name,
        color: String(stage.label.color),
        description: stage.label.description,
        mirrorToPr: stage.label.mirrorToPr === true,
        countsAsInFlight: stage.label.countsAsInFlight === true,
        terminal: stage.label.terminal === true || stage.type === 'terminal',
      },
    ]);
  const stateNames = new Set(stateEntries.map(([name]) => name));
  const stateMetadataByName = new Map(stateEntries);
  const stateLabels = stateEntries.map(([, metadata]) => metadata.label);
  const stateNameByLabel = new Map(
    stateEntries.map(([name, metadata]) => [metadata.label, name])
  );
  const stageByName = new Map(machine.stages.map(stage => [stage.name, stage]));
  const controlLabelsByRole = new Map(
    machine.controlLabels.map(label => [label.role, label.name])
  );
  const managedLabels = new Set([
    ...stateLabels,
    ...machine.controlLabels.map(label => label.name),
    ...machine.helperLabels.map(label => label.name),
  ]);

  return {
    machine,
    stateEntries,
    stateNames,
    stateMetadataByName,
    stateLabels,
    stateNameByLabel,
    managedLabels,
    approvalLabel: stateEntries.find(([name]) => name === 'approved')?.[1].label,
    optOutLabel: controlLabelsByRole.get('opt-out'),
    trackedPrLabels: stateEntries
      .filter(([, metadata]) => metadata.mirrorToPr && !metadata.terminal)
      .map(([, metadata]) => metadata.label),
    transitions: Object.fromEntries(machine.stages.map(stage => [
      stage.name,
      [...new Set(Object.values(stage.branches))],
    ])),
    stage: name => stageByName.get(name),
    resolveProfile: labels => resolveProfile(machine, labels),
  };
}

module.exports = {
  API_VERSION,
  DSL_VERSION,
  compileWorkflow,
  createMachineModel,
  mergeWorkflow,
  parseWorkflow,
  resolveProfile,
};
