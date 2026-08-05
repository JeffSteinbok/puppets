'use strict';

const DEFAULT_ALLOWED_PERMISSIONS = new Set(['admin', 'maintain', 'push', 'write', 'triage']);

function findLatestApprovalEvent(events) {
  return [...events].reverse().find(event =>
    event.event === 'labeled' && event.label?.name === 'puppets:approved'
  );
}

function normalizePermissionLevels(data) {
  if (data.user?.permissions) {
    return Object.entries(data.user.permissions)
      .filter(([, allowed]) => allowed)
      .map(([name]) => name);
  }
  return data.permission ? [data.permission] : [];
}

function evaluateApproval({
  event,
  approvalActors,
  permissionLevels,
  allowedPermissions = DEFAULT_ALLOWED_PERMISSIONS,
}) {
  const actor = event?.actor?.login;
  if (!actor || !approvalActors.has(actor.toLowerCase())) {
    return {
      valid: false,
      actorAllowed: false,
      reason: `label was added by ${actor || 'an unknown actor'}`,
    };
  }
  if (!permissionLevels.some(level => allowedPermissions.has(level))) {
    return {
      valid: false,
      actorAllowed: true,
      reason: `${actor} lacks write/triage permission`,
    };
  }
  return { valid: true, actorAllowed: true, actor };
}

module.exports = {
  DEFAULT_ALLOWED_PERMISSIONS,
  evaluateApproval,
  findLatestApprovalEvent,
  normalizePermissionLevels,
};
