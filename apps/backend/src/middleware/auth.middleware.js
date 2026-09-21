/**
 * Auth + RBAC middleware.
 *
 * Spec ref: §3.2 Layer 2 — three composable guards:
 *   protect(req, res, next)              — verifies JWT, attaches req.user
 *   authorizeRole(...roles)              — checks req.user.role ∈ roles
 *   requireOutletScope                    — for outlet-scoped routes, ensures
 *                                            req.user.outletId matches the
 *                                            resource's outletId (queried
 *                                            from DB); Super Admin bypasses.
 *
 * Layer 3 (Prisma row-level filters) is enforced in the repository layer,
 * not here. Every outlet-scoped Prisma query includes where: { outletId }.
 */

const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { ROLES, USER_STATUS, ERROR_CODES } = require('../lib/constants');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    '[auth.middleware] JWT_SECRET environment variable is required. ' +
    'Set it in your .env file. See .env.example for reference.'
  );
}

/**
 * protect — verifies the Bearer access token, looks up the current user
 * record (so role/status changes take effect immediately, never trusting
 * the JWT-embedded role), and attaches req.user.
 */
async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new Error('Authentication required');
      error.statusCode = 401;
      error.code = ERROR_CODES.UNAUTHORIZED;
      return next(error);
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      const error = new Error('Invalid or expired authentication token');
      error.statusCode = 401;
      error.code = ERROR_CODES.UNAUTHORIZED;
      return next(error);
    }

    // Always look up the current user record — never trust JWT-embedded role/status
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      include: { outletStaff: true, studentProfile: true },
    });

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 401;
      error.code = ERROR_CODES.UNAUTHORIZED;
      return next(error);
    }

    if (user.status === USER_STATUS.SUSPENDED) {
      const error = new Error('Your account has been suspended');
      error.statusCode = 401;
      error.code = ERROR_CODES.ACCOUNT_SUSPENDED;
      return next(error);
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      // Pull outletId from OutletStaff row (1-1 in V1 per spec §4.2)
      outletId: user.outletStaff?.outletId || null,
      outletRole: user.outletStaff?.role || null, // STAFF | ADMIN
      studentProfileId: user.studentProfile?.id || null,
      onboardingCompleted: user.onboardingCompleted,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * authorizeRole(...roles) — RBAC check. Returns 403 FORBIDDEN if the user's
 * role is not in the allowed list.
 */
function authorizeRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      const error = new Error('You do not have permission to access this area.');
      error.statusCode = 403;
      error.code = ERROR_CODES.FORBIDDEN;
      return next(error);
    }
    next();
  };
}

/**
 * requireOutletScope — for outlet-scoped routes. Ensures req.user.outletId
 * is set (i.e. the user is staff/admin of an outlet). Super Admin bypasses.
 *
 * For resource-level checks (e.g.Outlet A staff fetching Outlet B's order),
 * the repository layer enforces outletId match per call. This middleware
 * just verifies the user is outlet-scoped at all.
 */
function requireOutletScope(req, res, next) {
  if (!req.user) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    error.code = ERROR_CODES.UNAUTHORIZED;
    return next(error);
  }
  if (req.user.role === ROLES.SUPER_ADMIN) return next();
  if (!req.user.outletId) {
    const error = new Error('User is not assigned to an outlet');
    error.statusCode = 403;
    error.code = ERROR_CODES.FORBIDDEN;
    return next(error);
  }
  next();
}

module.exports = { protect, authorizeRole, requireOutletScope };
