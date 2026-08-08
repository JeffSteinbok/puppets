'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const reconcile = require('../src/reconcile');
const { resolveConfiguration } = require('../src/config');
const { createMachineModel } = require('../src/workflow');

const repoRoot = path.join(__dirname, '..');
const { config, workflow } = resolveConfiguration({
  frameworkRoot: repoRoot,
  callerRoot: repoRoot,
});
const model = createMachineModel(workflow);
const workflowJson = `${JSON.stringify(workflow, null, 2)}\n`;
const workflowPath = path.join(repoRoot, 'test-support', '__resolved-workflow.json');
const promptsDir = path.join(repoRoot, 'prompts');
const mockNodeRoot = path.join(repoRoot, 'test-support', 'mock-node-root');
const runnerRoot = path.join(repoRoot, 'test-support', 'runner-root');
const approvalLabel = model.approvalLabel;
const optOutLabel = model.optOutLabel;
const stateLabelNames = new Set(model.stateLabels);
const implementationMarker = '<!-- puppets:implementation-instructions:v1 -->';
const curationMarker = '<!-- puppets:curation:v1 -->';
const acceptanceReviewMarker = '<!-- puppets:acceptance-review:v1 -->';

const workflowLabelSpecs = [
  ...workflow.stages
    .filter(stage => stage.label)
    .map(stage => ({
      name: stage.label.name,
      color: String(stage.label.color),
      description: stage.label.description,
    })),
  ...workflow.controlLabels.map(label => ({
    name: label.name,
    color: String(label.color),
    description: label.description,
  })),
  ...workflow.helperLabels.map(label => ({
    name: label.name,
    color: String(label.color),
    description: label.description,
  })),
];

const FUTURE_ISSUE_DATE = '2100-01-01T00:00:00Z';
const FUTURE_RUN_DATE = '2100-01-02T00:00:00Z';

function stateLabel(stateName) {
  const metadata = model.stateMetadataByName.get(stateName);
  if (!metadata) throw new Error(`Unknown workflow state "${stateName}"`);
  return metadata.label;
}

function labelObjects(labelNames = []) {
  return [...new Set(labelNames)].map(name => ({ name }));
}

function cloneNodeIds(logins, actorIdForLogin) {
  return logins.map(login => ({
    login,
    node_id: actorIdForLogin(login),
  }));
}

function issueStateFromLabels(labelNames) {
  const active = [...labelNames].filter(label => model.stateNameByLabel.has(label));
  const activeNames = new Set(active.map(label => model.stateNameByLabel.get(label)));
  if (activeNames.has('approved') && activeNames.has('needs-human')) return 'approved';
  if (activeNames.has('ready')) return 'ready';
  return [...model.stateNames].reverse().find(name => activeNames.has(name)) || workflow.start;
}

function buildIssue({
  number,
  title = `Issue ${number}`,
  body = 'This issue contains enough detail to satisfy the non-AI triage gate.',
  labels = [],
  state = 'open',
  createdAt = FUTURE_ISSUE_DATE,
  updatedAt = createdAt,
  user = { login: 'issue-author', type: 'User' },
  assignees = [],
  nodeId = `ISSUE_${number}`,
} = {}) {
  return {
    number,
    node_id: nodeId,
    title,
    body,
    labels: labelObjects(labels),
    state,
    created_at: createdAt,
    updated_at: updatedAt,
    user,
    assignees,
  };
}

function buildPr({
  number,
  issueNumbers,
  title = `PR ${number}`,
  body = 'Implements the linked issue.',
  labels = [],
  state = 'OPEN',
  merged = false,
  isDraft = true,
  mergeable = 'MERGEABLE',
  mergeStateStatus = 'CLEAN',
  headRefName = `puppets/issue-${issueNumbers?.[0] || number}`,
  headRefOid = `${String(number).padStart(4, '0')}${'a'.repeat(36)}`,
  assignees = [],
  rollupState = 'PENDING',
  contexts = [],
  files = [],
  createdAt = FUTURE_ISSUE_DATE,
  updatedAt = createdAt,
  nodeId = `PR_${number}`,
  issueNodeId = `PRISSUE_${number}`,
} = {}) {
  if (!Array.isArray(issueNumbers) || issueNumbers.length === 0) {
    throw new Error('PR fixtures must link at least one issue number');
  }
  return {
    number,
    id: nodeId,
    title,
    body,
    state,
    merged,
    isDraft,
    mergeable,
    mergeStateStatus,
    headRefName,
    headRefOid,
    issueNumbers: [...issueNumbers],
    assignees: assignees.map(login => ({
      id: `USER_${login.toLowerCase()}`,
      login,
    })),
    rollupState,
    contexts: structuredClone(contexts),
    files: structuredClone(files),
    issueView: {
      number,
      node_id: issueNodeId,
      title,
      body,
      labels: labelObjects(labels),
      state: merged || state !== 'OPEN' ? 'closed' : 'open',
      created_at: createdAt,
      updated_at: updatedAt,
      user: { login: 'copilot-swe-agent', type: 'Bot' },
      assignees: cloneNodeIds(assignees, login => `USER_${login.toLowerCase()}`),
      pull_request: { url: `https://example.test/pulls/${number}` },
    },
  };
}

function approvalEvent({
  actor,
  label = approvalLabel,
  event = 'labeled',
} = {}) {
  return {
    event,
    label: { name: label },
    actor: actor ? { login: actor } : null,
  };
}

function curationReady({
  reason = 'Actionable and within scope.',
  labels = ['type:bug'],
} = {}) {
  return {
    decision: 'ready',
    reason,
    labels,
  };
}

function curationNeedsHuman({
  reason = 'Ambiguous request.',
  forHuman = 'A maintainer should decide how to scope this request.',
} = {}) {
  return {
    decision: 'needs-human',
    reason,
    labels: [],
    for_human: forHuman,
  };
}

function acceptancePass({
  summary = 'All acceptance criteria passed.',
} = {}) {
  return {
    decision: 'pass',
    summary,
    criteria: [
      {
        criterion: 'Acceptance criteria are satisfied.',
        status: 'pass',
        evidence: 'The linked implementation meets the requested behavior.',
      },
    ],
    findings: [],
  };
}

function acceptanceNeedsChanges({
  summary = 'A blocking acceptance issue remains.',
  file = 'src/reconcile.js',
  line = 1,
  message = 'Add the missing regression coverage.',
} = {}) {
  return {
    decision: 'needs-changes',
    summary,
    criteria: [
      {
        criterion: 'Acceptance criteria are satisfied.',
        status: 'fail',
        evidence: 'The required behavior is not fully covered yet.',
      },
    ],
    findings: [
      {
        file,
        line,
        severity: 'blocking',
        message,
      },
    ],
  };
}

function acceptanceNeedsHuman({
  summary = 'The evidence is inconclusive.',
} = {}) {
  return {
    decision: 'needs-human',
    summary,
    criteria: [
      {
        criterion: 'Acceptance criteria are satisfied.',
        status: 'unclear',
        evidence: 'The available evidence is not sufficient for an automated verdict.',
      },
    ],
    findings: [],
  };
}

function acceptanceRecordComment({
  headSha,
  decision = 'needs-changes',
  reviewAttempt = 1,
  remediationCount = 1,
} = {}) {
  return [
    acceptanceReviewMarker,
    `<!-- puppets:acceptance-review:data head=${headSha} verdict=${decision} review=${reviewAttempt} remediation=${remediationCount} -->`,
    'Stored acceptance record.',
  ].join('\n');
}

class SummaryBuffer {
  constructor(store) {
    this.store = store;
  }

  addHeading(text) {
    this.store.summary.push({ type: 'heading', text });
    return this;
  }

  addRaw(text) {
    this.store.summary.push({ type: 'raw', text });
    return this;
  }

  async write() {
    this.store.summaryWrites += 1;
  }
}

class ReconcileHarness {
  constructor({
    owner = 'JeffSteinbok',
    repo = 'puppets',
    runId = 4242,
    issues = [],
    prs = [],
    approvalEvents = {},
    permissions = {},
    repoFiles = {},
    repoLabels = [],
    inboxWorkflowRuns = [{ id: 1, run_number: 1, run_started_at: FUTURE_RUN_DATE }],
    prWorkflowRuns = {},
    comments = {},
  } = {}) {
    this.owner = owner;
    this.repo = repo;
    this.workflowPath = workflowPath;
    this.context = {
      repo: { owner, repo },
      runId,
    };
    this.automationLogin = 'puppets-test[bot]';
    this.copilotBot = { id: 'BOT_copilot', login: 'copilot-swe-agent' };
    this.copilot = { calls: [], responses: [] };
    this.actorIds = new Map([[this.copilotBot.id, this.copilotBot.login]]);
    this.nodeToThread = new Map();
    this.nodeToAssignable = new Map();
    this.nextCommentId = 1000;
    this.store = {
      outputs: {},
      warnings: [],
      infos: [],
      errors: [],
      summary: [],
      summaryWrites: 0,
      issues: new Map(),
      prs: new Map(),
      comments: new Map(),
      approvalEvents: new Map(),
      permissions: new Map(),
      repoFiles: new Map(),
      repoLabels: new Map(),
      inboxWorkflowRuns: inboxWorkflowRuns.map(run => structuredClone(run)),
      prWorkflowRuns: new Map(),
      restCalls: [],
      graphqlCalls: [],
      labelOps: [],
      commentOps: [],
      assignments: [],
      workflowReruns: [],
      branchUpdates: [],
      prReadyCalls: [],
      permissionLookups: [],
      logs: [],
    };

    for (const spec of workflowLabelSpecs) {
      this.store.repoLabels.set(spec.name, { ...spec });
    }
    for (const label of repoLabels) {
      const normalized = typeof label === 'string'
        ? { name: label, color: 'cccccc', description: `${label} test label` }
        : {
            color: 'cccccc',
            description: `${label.name} test label`,
            ...label,
          };
      this.store.repoLabels.set(normalized.name, normalized);
    }

    for (const [sha, runs] of Object.entries(prWorkflowRuns)) {
      this.store.prWorkflowRuns.set(sha, runs.map(run => structuredClone(run)));
    }
    for (const [filePath, content] of Object.entries(repoFiles)) {
      this.store.repoFiles.set(filePath, String(content));
    }
    for (const actor of config.approvalActors) {
      this.store.permissions.set(actor.toLowerCase(), 'write');
    }
    for (const [actor, permission] of Object.entries(permissions)) {
      this.store.permissions.set(actor.toLowerCase(), permission);
    }
    for (const issue of issues) this.addIssue(issue);
    for (const pr of prs) this.addPr(pr);
    for (const [issueNumber, events] of Object.entries(approvalEvents)) {
      this.store.approvalEvents.set(Number(issueNumber), events.map(event => structuredClone(event)));
    }
    for (const [threadNumber, entries] of Object.entries(comments)) {
      for (const entry of entries) {
        if (typeof entry === 'string') {
          this.addComment(Number(threadNumber), entry);
          continue;
        }
        this.addComment(Number(threadNumber), entry.body, {
          userLogin: entry.userLogin,
          nodeId: entry.nodeId,
          id: entry.id,
        });
      }
    }

    this.github = this.createGithub();
    this.core = {
      info: message => this.store.infos.push(String(message)),
      warning: message => this.store.warnings.push(String(message)),
      error: message => this.store.errors.push(String(message)),
      setOutput: (name, value) => {
        this.store.outputs[name] = value;
      },
      summary: new SummaryBuffer(this.store),
    };
  }

  actorIdForLogin(login) {
    const id = `USER_${String(login).toLowerCase()}`;
    this.actorIds.set(id, login);
    return id;
  }

  addIssue(issue) {
    const normalized = {
      ...structuredClone(issue),
      labels: labelObjects((issue.labels || []).map(label => typeof label === 'string' ? label : label.name)),
      assignees: (issue.assignees || []).map(assignee => {
        const login = typeof assignee === 'string' ? assignee : assignee.login;
        const nodeId = typeof assignee === 'string'
          ? this.actorIdForLogin(login)
          : (assignee.node_id || this.actorIdForLogin(login));
        this.actorIds.set(nodeId, login);
        return { login, node_id: nodeId };
      }),
    };
    this.store.issues.set(normalized.number, normalized);
    this.nodeToThread.set(normalized.node_id, normalized.number);
    this.nodeToAssignable.set(normalized.node_id, { kind: 'issue', number: normalized.number });
    if (!this.store.comments.has(normalized.number)) this.store.comments.set(normalized.number, []);
  }

  addPr(pr) {
    const assignees = (pr.assignees || []).map(assignee => {
      const login = typeof assignee === 'string' ? assignee : assignee.login;
      const id = typeof assignee === 'string'
        ? this.actorIdForLogin(login)
        : (assignee.id || this.actorIdForLogin(login));
      this.actorIds.set(id, login);
      return { id, login };
    });
    const normalized = {
      ...structuredClone(pr),
      assignees,
      contexts: structuredClone(pr.contexts || []),
      files: structuredClone(pr.files || []),
      issueNumbers: [...pr.issueNumbers],
      issueView: {
        ...structuredClone(pr.issueView),
        labels: labelObjects((pr.issueView?.labels || pr.labels || []).map(label =>
          typeof label === 'string' ? label : label.name
        )),
        assignees: cloneNodeIds(assignees.map(assignee => assignee.login), login =>
          this.actorIdForLogin(login)
        ),
        state: pr.merged || pr.state !== 'OPEN' ? 'closed' : 'open',
        pull_request: { url: `https://example.test/pulls/${pr.number}` },
      },
    };
    this.store.prs.set(normalized.number, normalized);
    this.nodeToThread.set(normalized.issueView.node_id, normalized.number);
    this.nodeToThread.set(normalized.id, normalized.number);
    this.nodeToAssignable.set(normalized.id, { kind: 'pr', number: normalized.number });
    if (!this.store.comments.has(normalized.number)) this.store.comments.set(normalized.number, []);
  }

  addComment(threadNumber, body, { userLogin = this.automationLogin, nodeId, id } = {}) {
    if (!this.store.comments.has(threadNumber)) this.store.comments.set(threadNumber, []);
    const comment = {
      id: id ?? this.nextCommentId++,
      node_id: nodeId || `COMMENT_${this.nextCommentId++}`,
      body,
      user: { login: userLogin },
    };
    this.store.comments.get(threadNumber).push(comment);
    return comment;
  }

  issue(number) {
    return this.store.issues.get(number);
  }

  pr(number) {
    return this.store.prs.get(number);
  }

  comments(number) {
    return this.store.comments.get(number) || [];
  }

  issueLabelNames(number) {
    return (this.issue(number)?.labels || []).map(label => label.name);
  }

  prLabelNames(number) {
    return (this.pr(number)?.issueView.labels || []).map(label => label.name);
  }

  activeStateLabelsForIssue(number) {
    return this.issueLabelNames(number).filter(label => stateLabelNames.has(label)).sort();
  }

  activeStateLabelsForPr(number) {
    return this.prLabelNames(number).filter(label => stateLabelNames.has(label)).sort();
  }

  stateNameForIssue(number) {
    return issueStateFromLabels(this.issueLabelNames(number));
  }

  setPrHead(number, headRefOid) {
    const pr = this.pr(number);
    assert(pr, `Unknown PR #${number}`);
    pr.headRefOid = headRefOid;
  }

  queueCopilotResponses(...responses) {
    this.copilot.responses.push(...responses);
  }

  countCommentsWithMarker(number, marker) {
    return this.comments(number).filter(comment => comment.body.includes(marker)).length;
  }

  createGithub() {
    const issuesGet = async ({ issue_number }) => {
      const issue = this.store.issues.get(issue_number);
      if (issue) return { data: issue };
      const pr = this.store.prs.get(issue_number);
      if (pr) return { data: pr.issueView };
      throw Object.assign(new Error(`Unknown issue ${issue_number}`), { status: 404 });
    };

    const listForRepo = async ({ state = 'open', labels }) => {
      const requestedLabels = String(labels || '')
        .split(',')
        .map(label => label.trim())
        .filter(Boolean);
      const allItems = [
        ...this.store.issues.values(),
        ...[...this.store.prs.values()].map(pr => pr.issueView),
      ];
      const filtered = allItems
        .filter(item => {
          if (state === 'open' && item.state !== 'open') return false;
          if (state === 'closed' && item.state !== 'closed') return false;
          const itemLabelNames = new Set((item.labels || []).map(label => label.name));
          return requestedLabels.every(label => itemLabelNames.has(label));
        })
        .sort((left, right) => new Date(right.updated_at) - new Date(left.updated_at));
      return { data: filtered };
    };

    const listComments = async ({ issue_number }) => ({
      data: this.comments(issue_number),
    });

    const listEvents = async ({ issue_number }) => ({
      data: this.store.approvalEvents.get(issue_number) || [],
    });

    const addLabels = async ({ issue_number, labels }) => {
      const item = await issuesGet({ issue_number });
      for (const name of labels) {
        const labelName = typeof name === 'string' ? name : name.name;
        if (!(item.data.labels || []).some(label => label.name === labelName)) {
          item.data.labels.push({ name: labelName });
          this.store.labelOps.push({ op: 'add', issue_number, label: labelName });
        }
      }
      return { data: item.data };
    };

    const removeLabel = async ({ issue_number, name }) => {
      const item = await issuesGet({ issue_number });
      const before = item.data.labels.length;
      item.data.labels = item.data.labels.filter(label => label.name !== name);
      if (before !== item.data.labels.length) {
        this.store.labelOps.push({ op: 'remove', issue_number, label: name });
      }
      return { data: item.data };
    };

    const createComment = async ({ issue_number, body }) => {
      const comment = this.addComment(issue_number, body);
      this.store.commentOps.push({ op: 'create', issue_number, body });
      return { data: comment };
    };

    const updateComment = async ({ comment_id, body }) => {
      const comment = this.findCommentById(comment_id);
      comment.body = body;
      this.store.commentOps.push({ op: 'update', issue_number: this.findCommentThread(comment_id), body });
      return { data: comment };
    };

    const updateIssue = async ({ issue_number, state, state_reason }) => {
      const issue = this.issue(issue_number);
      if (!issue) throw new Error(`Unknown issue #${issue_number}`);
      issue.state = state;
      issue.state_reason = state_reason;
      return { data: issue };
    };

    const listLabelsForRepo = async () => ({
      data: [...this.store.repoLabels.values()],
    });

    const createLabel = async ({ name, color, description }) => {
      this.store.repoLabels.set(name, { name, color, description });
      return { data: this.store.repoLabels.get(name) };
    };

    const getCollaboratorPermissionLevel = async ({ username }) => {
      this.store.permissionLookups.push(username);
      const result = this.store.permissions.get(String(username).toLowerCase());
      if (result instanceof Error) throw result;
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        return { data: structuredClone(result) };
      }
      return { data: { permission: result || 'read' } };
    };

    const getRepoContent = async ({ path: filePath }) => {
      if (!this.store.repoFiles.has(filePath)) {
        throw Object.assign(new Error(`${filePath} not found`), { status: 404 });
      }
      const content = this.store.repoFiles.get(filePath);
      return {
        data: {
          type: 'file',
          size: Buffer.byteLength(content, 'utf8'),
          content: Buffer.from(content, 'utf8').toString('base64'),
        },
      };
    };

    const listWorkflowRunsForRepo = async ({ head_sha }) => ({
      data: {
        workflow_runs: this.store.prWorkflowRuns.get(head_sha) || [],
      },
    });

    const github = {
      rest: {
        users: {
          getAuthenticated: async () => ({ data: { login: this.automationLogin } }),
        },
        actions: {
          listWorkflowRuns: async () => ({
            data: { workflow_runs: this.store.inboxWorkflowRuns },
          }),
          listWorkflowRunsForRepo,
          reRunWorkflow: async ({ run_id }) => {
            this.store.workflowReruns.push(run_id);
            return { data: {} };
          },
        },
        repos: {
          get: async () => ({ data: { default_branch: 'main' } }),
          getContent: getRepoContent,
          getCollaboratorPermissionLevel,
        },
        issues: {
          listComments,
          listEvents,
          addLabels,
          removeLabel,
          get: issuesGet,
          listForRepo,
          listLabelsForRepo,
          createComment,
          updateComment,
          update: updateIssue,
          createLabel,
        },
        pulls: {
          listFiles: async ({ pull_number }) => ({
            data: structuredClone(this.pr(pull_number)?.files || []),
          }),
          updateBranch: async ({ pull_number }) => {
            this.store.branchUpdates.push(pull_number);
            return { data: {} };
          },
        },
      },
      graphql: async (query, variables) => this.graphql(query, variables),
      paginate: async (method, params) => {
        const response = await method(params);
        if (Array.isArray(response?.data)) return response.data.slice();
        if (Array.isArray(response?.data?.workflow_runs)) {
          return response.data.workflow_runs.slice();
        }
        throw new Error('Unexpected paginated response payload');
      },
    };

    return github;
  }

  findCommentById(commentId) {
    for (const comments of this.store.comments.values()) {
      const match = comments.find(comment => comment.id === commentId);
      if (match) return match;
    }
    throw new Error(`Unknown comment id ${commentId}`);
  }

  findCommentByNodeId(nodeId) {
    for (const comments of this.store.comments.values()) {
      const match = comments.find(comment => comment.node_id === nodeId);
      if (match) return match;
    }
    throw new Error(`Unknown comment node id ${nodeId}`);
  }

  findCommentThread(commentId) {
    for (const [thread, comments] of this.store.comments.entries()) {
      if (comments.some(comment => comment.id === commentId)) return thread;
    }
    return null;
  }

  linkedPrsForIssue(issueNumber) {
    return [...this.store.prs.values()]
      .filter(pr => pr.issueNumbers.includes(issueNumber))
      .map(pr => this.serializePr(pr));
  }

  serializePr(pr) {
    return {
      number: pr.number,
      id: pr.id,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      isDraft: pr.isDraft,
      merged: pr.merged,
      mergeable: pr.mergeable,
      mergeStateStatus: pr.mergeStateStatus,
      headRefName: pr.headRefName,
      headRefOid: pr.headRefOid,
      assignees: {
        nodes: structuredClone(pr.assignees),
      },
      commits: {
        nodes: [
          {
            commit: {
              statusCheckRollup: {
                state: pr.rollupState,
                contexts: {
                  nodes: structuredClone(pr.contexts),
                },
              },
            },
          },
        ],
      },
    };
  }

  async graphql(query, variables) {
    this.store.graphqlCalls.push({ query, variables: structuredClone(variables) });

    if (query.includes('suggestedActors(capabilities: [CAN_BE_ASSIGNED]')) {
      return {
        repository: {
          suggestedActors: {
            nodes: [
              {
                login: this.copilotBot.login,
                __typename: 'Bot',
                id: this.copilotBot.id,
              },
            ],
          },
        },
      };
    }

    if (query.includes('closedByPullRequestsReferences(first: 10, includeClosedPrs: true)')) {
      return {
        repository: {
          issue: {
            closedByPullRequestsReferences: {
              nodes: this.linkedPrsForIssue(variables.number),
            },
            timelineItems: { nodes: [] },
          },
        },
      };
    }

    if (query.includes('pullRequest(number: $number)')) {
      const pr = this.pr(variables.number);
      return {
        repository: {
          pullRequest: pr ? {
            id: pr.id,
            number: pr.number,
            state: pr.state,
            isDraft: pr.isDraft,
            headRefOid: pr.headRefOid,
            commits: {
              nodes: [
                {
                  commit: {
                    statusCheckRollup: {
                      state: pr.rollupState,
                    },
                  },
                },
              ],
            },
          } : null,
        },
      };
    }

    if (query.includes('updateIssueComment')) {
      const comment = this.findCommentByNodeId(variables.id);
      comment.body = variables.body;
      this.store.commentOps.push({ op: 'update', issue_number: this.findCommentThread(comment.id), body: variables.body });
      return { updateIssueComment: { issueComment: { id: variables.id } } };
    }

    if (query.includes('addComment(input: { subjectId: $id, body: $body })')) {
      const threadNumber = this.nodeToThread.get(variables.id);
      if (threadNumber === undefined) {
        throw new Error(`Unknown comment subject ${variables.id}`);
      }
      const comment = this.addComment(threadNumber, variables.body);
      this.store.commentOps.push({ op: 'create', issue_number: threadNumber, body: variables.body });
      return { addComment: { commentEdge: { node: { id: comment.node_id } } } };
    }

    if (query.includes('replaceActorsForAssignable')) {
      const target = this.nodeToAssignable.get(variables.assignableId);
      if (!target) throw new Error(`Unknown assignable ${variables.assignableId}`);
      const logins = [...new Set(variables.actorIds.map(id => this.actorIds.get(id) || id))];
      if (target.kind === 'issue') {
        const issue = this.issue(target.number);
        issue.assignees = cloneNodeIds(logins, login => this.actorIdForLogin(login));
      } else {
        const pr = this.pr(target.number);
        pr.assignees = logins.map(login => ({
          id: this.actorIdForLogin(login),
          login,
        }));
        pr.issueView.assignees = cloneNodeIds(logins, login => this.actorIdForLogin(login));
      }
      this.store.assignments.push({
        target: target.kind,
        number: target.number,
        actorIds: [...variables.actorIds],
        logins,
      });
      return {
        replaceActorsForAssignable: {
          assignable: {
            number: target.number,
            assignees: { nodes: logins.map(login => ({ login })) },
          },
        },
      };
    }

    if (query.includes('markPullRequestReadyForReview')) {
      const pr = [...this.store.prs.values()].find(candidate => candidate.id === variables.id);
      if (!pr) throw new Error(`Unknown PR id ${variables.id}`);
      pr.isDraft = false;
      this.store.prReadyCalls.push(pr.number);
      return {
        markPullRequestReadyForReview: {
          pullRequest: {
            number: pr.number,
            isDraft: false,
          },
        },
      };
    }

    throw new Error(`Unhandled GraphQL query in test harness: ${query}`);
  }

  async run() {
    const originalEnv = new Map();
    const env = {
      PUPPETS_OWNER: this.owner,
      PUPPETS_REPOSITORY: this.repo,
      PUPPETS_APPROVAL_ACTORS: config.approvalActors.join(','),
      MAX_ISSUES_PER_REPO: String(config.maxNewIssues),
      MAX_IN_FLIGHT_PER_REPO: String(config.maxInFlight),
      CONFLICT_RETRIES: String(config.conflictRetries),
      REVIEW_RETRIES: String(config.reviewRetries),
      COPILOT_MODEL: config.copilotModel,
      CLAUDE_MODEL: config.claudeModel,
      CODEX_MODEL: config.codexModel,
      PUPPETS_STALE_HOURS: String(config.staleHours),
      PUPPETS_IGNORE_LABELS: config.ignoreLabels.join(','),
      PUPPETS_WORKFLOW_PATH: this.workflowPath,
      PUPPETS_PROMPTS_DIR: promptsDir,
      PUPPETS_NODE_ROOT: mockNodeRoot,
      PUPPETS_INBOX_WORKFLOW_ID: 'puppets.yml',
      INBOX_FALLBACK_HOURS: '24',
      COPILOT_TOKEN: 'test-token',
      RUNNER_TEMP: runnerRoot,
      DRY_RUN: 'false',
    };

    for (const [name, value] of Object.entries(env)) {
      originalEnv.set(name, process.env[name]);
      process.env[name] = value;
    }

    const originalReadFileSync = fs.readFileSync;
    fs.readFileSync = (...args) => {
      const [filePath] = args;
      if (path.resolve(String(filePath)) === this.workflowPath) {
        return workflowJson;
      }
      return originalReadFileSync.apply(fs, args);
    };

    const originalLog = console.log;
    console.log = (...args) => {
      this.store.logs.push(args.map(arg => String(arg)).join(' '));
    };

    globalThis.__PUPPETS_COPILOT_MOCK__ = this.copilot;
    try {
      await reconcile({ github: this.github, context: this.context, core: this.core });
    } finally {
      fs.readFileSync = originalReadFileSync;
      console.log = originalLog;
      delete globalThis.__PUPPETS_COPILOT_MOCK__;
      for (const [name, value] of originalEnv.entries()) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  }
}

function createHarness(options) {
  return new ReconcileHarness(options);
}

module.exports = {
  acceptanceNeedsChanges,
  acceptanceNeedsHuman,
  acceptancePass,
  acceptanceRecordComment,
  approvalEvent,
  approvalLabel,
  buildIssue,
  buildPr,
  config,
  createHarness,
  curationMarker,
  curationNeedsHuman,
  curationReady,
  implementationMarker,
  issueStateFromLabels,
  model,
  optOutLabel,
  stateLabel,
  stateLabelNames,
  workflow,
};
