/**
 * Nosh — Shared validation schemas (Zod)
 *
 * Used by:
 *   - apps/backend  → validateBody() / validateQuery() middleware
 *   - apps/frontend → form validation (planned, M2)
 *
 * Conventions:
 *   - All schemas use z.object() with strict() where extra keys are a client error.
 *   - String fields are trimmed + lowercased only where the backend normalizes (email).
 *   - Prices are coerced to number; NaN/<=0 rejected with explicit message.
 *   - Enums mirror src/lib/constants.js — if you change one, change the other.
 */

const { z } = require('zod');

// ─── Reusable primitives ────────────────────────────────────────────────────

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'Invalid email format' })
  .max(254, { message: 'Email too long' });

const passwordField = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters' })
  .max(128, { message: 'Password too long' })
  .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  .regex(/[0-9]/, { message: 'Password must contain at least one digit' });

// INO-AUDIT4-D17 + D18 fix: reject Infinity + enforce a sane upper bound.
// The previous check `!Number.isNaN(n) && n > 0` let Infinity through
// (Infinity > 0 is true). An attacker could submit absurdly large values
// that travel through Zod → JS Number → paise → Prisma Decimal → Razorpay.
// Even if Razorpay ultimately rejects, application-level validation should
// reject first. The upper bound is 1 crore paise = ₹10,00,000 — well
// above any realistic campus food order, well below Infinity.
const MAX_MONEY_RUPEES = 10_00_000; // ₹10 lakh = 1 million rupees
const priceField = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? Number(v) : v))
  .refine((n) => Number.isFinite(n) && n > 0 && n <= MAX_MONEY_RUPEES, {
    message: `Price must be a finite number greater than 0 and at most ₹${MAX_MONEY_RUPEES}`,
  });

const positiveIntField = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? Number(v) : v))
  .refine((n) => Number.isInteger(n) && n > 0, { message: 'Must be a positive integer' });

const nonNegativeIntField = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? Number(v) : v))
  .refine((n) => Number.isInteger(n) && n >= 0, { message: 'Must be a non-negative integer' });

// ─── Enum mirrors of src/lib/constants.js ───────────────────────────────────

const orderStatusEnum = z.enum([
  'PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED', 'CANCELLED',
]);

// INO-adj-23 fix: the previous enum only accepted OPEN/BUSY/CLOSED, but
// constants.js defines 5 outlet statuses (OPEN/BUSY/CLOSED/PENDING/
// SUSPENDED). Super-admins can change an outlet to PENDING or SUSPENDED
// via the admin UI, but the validation layer rejected those values,
// producing a confusing frontend/backend contract mismatch
// (admin clicks SUSPENDED → backend returns 400).
const outletStatusEnum = z.enum(['OPEN', 'BUSY', 'CLOSED', 'PENDING', 'SUSPENDED']);

const userStatusEnum = z.enum(['ACTIVE', 'SUSPENDED']);

const paymentStatusEnum = z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']);

const paymentMethodEnum = z.enum(['ONLINE', 'WALLET']);

const roleEnum = z.enum(['STUDENT', 'OUTLET_STAFF', 'OUTLET_ADMIN', 'SUPER_ADMIN']);

const outletStaffRoleEnum = z.enum(['STAFF', 'ADMIN']);

// INO-AUDIT3-8 fix: CUSTOMER_CANCEL was missing from the canonical enum.
// The transition service + admin controller pass `triggerOverride: 'CUSTOMER_CANCEL'`
// when a student cancels their PENDING order, but the validation package
// didn't list it — so the shared schema didn't reflect the actual refund
// trigger space. Drift like this causes bugs later when someone adds
// validation against the enum and forgets the CUSTOMER_CANCEL case.
const refundTriggerEnum = z.enum([
  'OUTLET_REJECT',
  'OUTLET_CANCEL',
  'CUSTOMER_CANCEL',
  'SUPER_ADMIN_MANUAL',
]);

// ─── 1. Dev login (M1) ──────────────────────────────────────────────────────

const devLoginSchema = z.object({
  email: emailField,
  password: z.string().optional(),
}).strict();

// ─── 2. Google login (M1) ───────────────────────────────────────────────────

const googleLoginSchema = z.object({
  credential: z.string().min(10, { message: 'Google credential is required' }),
}).strict();

// ─── 3. Onboarding (M1) ─────────────────────────────────────────────────────

// INO-P1-30: phone format. The platform is currently India-only (per spec
// §1.1 — campus food ordering at Indian colleges). The default 10-digit
// pattern matches Indian mobile numbers without country code. For other
// regions, set the PHONE_REGEX env var to a different pattern (e.g.
// '^\\+?[0-9]{10,15}$' for E.164 with optional +). The env var is read
// once at module load; restart the server to change it. The default is
// intentionally strict — a permissive regex would accept '12345' as a
// phone number, which is worse than rejecting valid international formats.
//
// The `typeof process !== 'undefined'` guard lets this file load in the
// browser (where `process` is undefined) — the frontend will get the
// default India pattern. The backend reads the env var on startup.
const _PHONE_REGEX_SOURCE =
  (typeof process !== 'undefined' && process.env && process.env.PHONE_REGEX) || '^[0-9]{10}$';
const _PHONE_MESSAGE =
  (typeof process !== 'undefined' && process.env && process.env.PHONE_REGEX_MESSAGE) ||
  'Phone must be a 10-digit number';
const PHONE_REGEX = new RegExp(_PHONE_REGEX_SOURCE);

const onboardingSchema = z.object({
  password: passwordField,
  profile: z.object({
    fullName: z.string().trim().min(1, { message: 'Full name is required' }).max(120),
    phone: z.string().trim().regex(PHONE_REGEX, { message: _PHONE_MESSAGE }),
    course: z.string().trim().min(1, { message: 'Course is required' }).max(120),
    year: z.string().trim().min(1, { message: 'Year is required' }).max(20),
    collegeId: z.string().trim().min(1, { message: 'College ID is required' }).max(60),
  }).strict(),
}).strict();

// ─── 4. Orders (M1) ──────────────────────────────────────────────────────────

const orderItemInputSchema = z.object({
  menuItemId: z.string().min(1, { message: 'menuItemId is required' }),
  quantity: positiveIntField,
  selectedOptions: z.array(z.object({
    groupId: z.string(),
    optionId: z.string(),
  })).optional(),
}).strict();

const createOrderSchema = z.object({
  outletId: z.string().min(1, { message: 'outletId is required' }),
  items: z.array(orderItemInputSchema).min(1, { message: 'items array cannot be empty' }),
  paymentMethod: paymentMethodEnum,
  notes: z.string().max(500).optional(),
  // INO-AUDIT6-#3: validate scheduledFor — must be a valid ISO datetime
  // in the future + within 7 days from now. Prevents clients from
  // submitting arbitrary past timestamps or dates years in the future.
  // (Within-outlet-operating-hours validation is deferred — it requires
  // querying the outlet's OperatingHours rows, which is a service-level
  // check, not a schema-level check.)
  scheduledFor: z.string().datetime().optional().refine((val) => {
    if (!val) return true; // optional — no schedule = immediate pickup
    const dt = new Date(val);
    if (isNaN(dt.getTime())) return false;
    const now = Date.now();
    const maxFuture = now + 7 * 24 * 60 * 60 * 1000; // 7 days
    return dt.getTime() > now && dt.getTime() < maxFuture;
  }, { message: 'scheduledFor must be a future datetime within 7 days from now' }),
}).strict();

const updateOrderStatusSchema = z.object({
  status: orderStatusEnum,
  reason: z.string().max(300).optional(),
}).strict();

// ─── 5. Menu items (M1) ─────────────────────────────────────────────────────

const menuItemCreateSchema = z.object({
  name: z.string().trim().min(1, { message: 'Valid name is required' }).max(120),
  description: z.string().trim().max(1000).optional(),
  price: priceField,
  category: z.string().trim().min(1, { message: 'Category is required' }).max(60),
  image: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  isAvailable: z.boolean().optional(),
  discount: z.union([z.string(), z.number()]).optional(),
  popular: z.boolean().optional(),
  vegetarian: z.boolean().optional(),
  preparationTime: nonNegativeIntField.optional(),
  dietaryFlags: z.array(z.string()).optional(),
}).strict();

const menuItemUpdateSchema = menuItemCreateSchema.partial();

const updateMenuAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
}).strict();

// ─── 6. Admin actions (M1) ──────────────────────────────────────────────────

const updateUserStatusSchema = z.object({
  status: userStatusEnum,
}).strict();

const updateOutletStatusSchema = z.object({
  status: outletStatusEnum,
}).strict();

// ─── 7. Cart (M2) ────────────────────────────────────────────────────────────

const cartItemAddSchema = z.object({
  menuItemId: z.string().min(1),
  quantity: positiveIntField,
  selectedOptions: z.array(z.object({
    groupId: z.string(),
    optionId: z.string(),
  })).optional(),
}).strict();

const cartItemUpdateSchema = z.object({
  quantity: positiveIntField,
}).strict();

// ─── 8. Payments (M2 — Razorpay) ────────────────────────────────────────────

const razorpayOrderCreateSchema = z.object({
  orderId: z.string().min(1, { message: 'orderId is required' }),
}).strict();

const razorpayPaymentVerifySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
}).strict();

const refundCreateSchema = z.object({
  orderId: z.string().min(1),
  amount: priceField,
  reason: z.string().trim().min(1).max(300),
  trigger: refundTriggerEnum,
}).strict();

// ─── 9. Outlet staff invite (M2) ────────────────────────────────────────────

const outletStaffInviteSchema = z.object({
  email: emailField,
  name: z.string().trim().min(1).max(120),
  role: outletStaffRoleEnum,
}).strict();

// ─── 10. Outlet profile (M2) ────────────────────────────────────────────────

const outletProfileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  logoUrl: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  // INO-AUDIT6-#6: these must be strictly positive (> 0), not just
  // non-negative. A pickupTimeoutMins of 0 would immediately cancel
  // every READY order (pathological behavior from an invalid admin
  // configuration). A defaultPrepMins of 0 is meaningless.
  defaultPrepMins: positiveIntField.optional(),
  pickupTimeoutMins: positiveIntField.optional(),
}).strict();

const operatingHoursSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Use HH:MM 24h' }),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Use HH:MM 24h' }),
  isClosed: z.boolean(),
}).strict();

const operatingHoursListSchema = z.array(operatingHoursSchema).length(7, { message: 'Exactly 7 days required' });

// ─── 11. Razorpay credentials (super admin) (M2) ───────────────────────────

const razorpayCredentialsSchema = z.object({
  keyId: z.string().min(1),
  keySecret: z.string().min(1),
  webhookSecret: z.string().min(1),
}).strict();

// ─── 12. Cloudinary signed-upload (M2 stretch) ───────────────────────────

const uploadSignSchema = z.object({
  folder: z.enum(['menu-items', 'outlet-logos', 'students']),
  publicId: z.string().trim().min(1).max(120)
    .regex(/^[a-zA-Z0-9_-]+$/, { message: 'publicId may only contain [a-zA-Z0-9_-]' })
    .optional(),
  tags: z.record(z.string(), z.string()).optional(),
}).strict();

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // primitives (re-exported for frontend reuse)
  emailField,
  passwordField,
  priceField,
  // enums
  orderStatusEnum,
  outletStatusEnum,
  userStatusEnum,
  paymentStatusEnum,
  paymentMethodEnum,
  roleEnum,
  outletStaffRoleEnum,
  refundTriggerEnum,
  // schemas
  devLoginSchema,
  googleLoginSchema,
  onboardingSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  menuItemCreateSchema,
  menuItemUpdateSchema,
  updateMenuAvailabilitySchema,
  updateUserStatusSchema,
  updateOutletStatusSchema,
  cartItemAddSchema,
  cartItemUpdateSchema,
  razorpayOrderCreateSchema,
  razorpayPaymentVerifySchema,
  refundCreateSchema,
  outletStaffInviteSchema,
  outletProfileUpdateSchema,
  operatingHoursSchema,
  operatingHoursListSchema,
  razorpayCredentialsSchema,
  uploadSignSchema,
};
