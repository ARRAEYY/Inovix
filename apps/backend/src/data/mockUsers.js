/**
 * Mock users for development/testing.
 * These will be replaced by a PostgreSQL-backed User table in Phase 03.
 *
 * Roles:
 *   STUDENT       — campus student who orders food
 *   OUTLET_STAFF  — outlet employee who processes orders
 *   OUTLET_ADMIN  — outlet manager who manages menu, staff, settings
 *   SUPER_ADMIN   — platform administrator
 */
const mockUsers = [
  // ── Outlet 1 Staff ─────────────────────────────────────────────────────────
  {
    id: 'user-outlet-1',
    name: 'The Commons Staff',
    email: 'outlet1@rishihood.edu.in',
    role: 'OUTLET_ADMIN',
    outletId: 'outlet-1',
    onboardingCompleted: true,
    passwordHash: null,
    status: 'ACTIVE',
  },
  {
    id: 'user-outlet-1-staff',
    name: 'The Commons Crew',
    email: 'outlet1.staff@rishihood.edu.in',
    role: 'OUTLET_STAFF',
    outletId: 'outlet-1',
    onboardingCompleted: true,
    passwordHash: null,
    status: 'ACTIVE',
  },

  // ── Outlet 2 Staff ─────────────────────────────────────────────────────────
  {
    id: 'user-outlet-2',
    name: 'Brew & Bites Staff',
    email: 'outlet2@rishihood.edu.in',
    role: 'OUTLET_ADMIN',
    outletId: 'outlet-2',
    onboardingCompleted: true,
    passwordHash: null,
    status: 'ACTIVE',
  },
  {
    id: 'user-outlet-2-staff',
    name: 'Brew & Bites Crew',
    email: 'outlet2.staff@rishihood.edu.in',
    role: 'OUTLET_STAFF',
    outletId: 'outlet-2',
    onboardingCompleted: true,
    passwordHash: null,
    status: 'ACTIVE',
  },

  // ── Students ───────────────────────────────────────────────────────────────
  {
    id: 'user-student-1',
    name: 'Student One',
    email: 'maa',
    role: 'STUDENT',
    onboardingCompleted: true,
    passwordHash: null,
    status: 'ACTIVE',
  },

  // ── Platform Admin ─────────────────────────────────────────────────────────
  {
    id: 'user-admin-1',
    name: 'Platform Admin',
    email: 'admin@rishihood.edu.in',
    role: 'SUPER_ADMIN',
    onboardingCompleted: true,
    passwordHash: null,
    status: 'ACTIVE',
  },

  // ── Development Test Accounts (dev-login only, not in production) ──────────
  {
    id: 'dev-admin',
    name: 'Adilreyaz',
    email: 'adilreyaz.admin@nosh.local',
    role: 'SUPER_ADMIN',
    onboardingCompleted: true,
    passwordHash: '$2b$12$eNYg96kD8o7KcEyswm5QRel6xBf3DUCgQIu44b.rtafkMzJ4X8Dk2',
    status: 'ACTIVE',
  },
  {
    id: 'dev-outlet',
    name: 'Adilreyaz Outlet',
    email: 'adilreyaz.outlet@nosh.local',
    role: 'OUTLET_ADMIN',
    outletId: 'mock-outlet-adil',
    onboardingCompleted: true,
    passwordHash: '$2b$12$DyaJApDYK3Upa5eHWHtCcOvU9tSAwPCeDpF1K5/e.PvkmNIRvfuI.',
    status: 'ACTIVE',
  },
];

module.exports = mockUsers;