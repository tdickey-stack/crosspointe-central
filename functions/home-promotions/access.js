/* eslint-disable require-jsdoc */

// Match Central's existing Homepage read and direct-publish permissions.
export function assertHomePromotionAccess(actor, write = false) {
  const user = actor && actor.userData || {};
  const access = user.pageAccess || {};
  const permission = access.hub || access.settings;
  const allowed = write ? ["edit", "approve", "admin"] :
    ["view", "propose", "edit", "approve", "admin"];
  if (!actor || !actor.uid || user.active !== true ||
      !allowed.includes(permission)) {
    const error = new Error(write ?
      "Homepage publishing access is required to save promotions." :
      "Homepage access is required to view promotions.");
    error.status = 403;
    error.code = "home-promotions-forbidden";
    throw error;
  }
  return actor;
}
