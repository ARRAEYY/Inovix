/**
 * Nosh platform constants
 * Single source of truth for roles, statuses, and error codes.
 * These are JS constants — Prisma enums will mirror them in Phase 03.
 */

const ROLES = Object.freeze({
  STUDENT: 'STUDENT',
  OUTLET_STAFF: 'OUTLET_STAFF',
  OUTLET_ADMIN: 'OUTLET_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
});

/** Roles that can operate an outlet (view orders, process orders) */
const OUTLET_ROLES = Object.freeze([ROLES.OUTLET_STAFF, ROLES.OUTLET_ADMIN]);

/** Roles that can manage an outlet's menu, staff, and settings */
const OUTLET_ADMIN_ROLES = Object.freeze([ROLES.OUTLET_ADMIN]);

const ORDER_STATUS = Object.freeze({
  PLACED: 'PLACED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

const OUTLET_STATUS = Object.freeze({
  OPEN: 'OPEN',
  BUSY: 'BUSY',
  CLOSED: 'CLOSED',
});

const USER_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
});

const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
});

const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
});

module.exports = {
  ROLES,
  OUTLET_ROLES,
  OUTLET_ADMIN_ROLES,
  ORDER_STATUS,
  OUTLET_STATUS,
  USER_STATUS,
  PAYMENT_STATUS,
  ERROR_CODES,
};
