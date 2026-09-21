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

const priceField = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? Number(v) : v))
  .refine((n) => !Number.isNaN(n) && n > 0, { message: 'Price must be a number greater than 0' });

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

const refundTriggerEnum = z.enum([
  'OUTLET_REJECT', 'OUTLET_CANCEL', 'SUPER_ADMIN_MANUAL',
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

const onboardingSchema = z.object({
  password: passwordField,
  profile: z.object({
    fullName: z.string().trim().min(1, { message: 'Full name is required' }).max(120),
    phone: z.string().trim().regex(/^[0-9]{10}$/, { message: 'Phone must be a 10-digit number' }),
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
  scheduledFor: z.string().datetime().optional(),
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
  defaultPrepMins: nonNegativeIntField.optional(),
  pickupTimeoutMins: nonNegativeIntField.optional(),
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
