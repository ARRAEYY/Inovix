/**
 * Nosh frontend types — mirror backend Prisma models + API response shapes.
 *
 * All money fields come back as strings (Decimal in Prisma). Use `formatINR`
 * from ./format for display.
 */

export type Role = 'STUDENT' | 'OUTLET_STAFF' | 'OUTLET_ADMIN' | 'SUPER_ADMIN';

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export type OutletStatus = 'OPEN' | 'BUSY' | 'CLOSED' | 'PENDING' | 'SUSPENDED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export type PaymentMethod = 'ONLINE' | 'WALLET';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING';

export interface StudentProfile {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  course: string;
  year: string;
  collegeId: string;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutletStaff {
  id: string;
  userId: string;
  outletId: string;
  role: 'STAFF' | 'ADMIN';
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
  outlet?: {
    id: string;
    name: string;
    location?: string | null;
    status?: string;
  };
}

export interface User {
  id: string;
  email: string;
  googlePicture?: string | null;
  name: string | null;
  role: Role;
  status: UserStatus;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  outletStaff?: OutletStaff | null;
  studentProfile?: StudentProfile | null;
  /** Flattened from outletStaff in `stripSensitive` */
  outletId?: string | null;
  /** Flattened from outletStaff.role in `stripSensitive` */
  outletRole?: string | null;
}

export interface AuthData {
  user: User;
  accessToken: string;
}

export interface Outlet {
  id: string;
  slug: string;
  campusId: string | null;
  name: string;
  description: string;
  logoUrl: string | null;
  status: OutletStatus;
  defaultPrepMins: number;
  pickupTimeoutMins: number;
  rating: number;
  estimatedTime: string;
  location: string;
  tags: string;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MenuCategory {
  id: string;
  outletId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomizationOption {
  id: string;
  groupId: string;
  label: string;
  priceDelta: string;
  createdAt: string;
}

export interface CustomizationGroup {
  id: string;
  menuItemId: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: CustomizationOption[];
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  outletId: string;
  categoryId: string | null;
  name: string;
  description: string;
  price: string; // Decimal as string
  imageUrl: string | null;
  isAvailable: boolean;
  prepTimeMins: number;
  discount: string | null;
  popular: boolean;
  vegetarian: boolean;
  isVeg?: boolean;
  dietaryFlags: string;
  createdAt: string;
  updatedAt: string;
  category?: MenuCategory | null;
  customizationGroups?: CustomizationGroup[];
}

export interface CartItem {
  id: string;
  cartId: string;
  menuItemId: string;
  quantity: number;
  selectedOptions: string; // JSON string
  createdAt: string;
  updatedAt: string;
  menuItem: MenuItem;
}

export interface Cart {
  id: string;
  studentId: string;
  outletId: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  items: CartItem[];
  outlet?: { id: string; name: string; slug: string; status: OutletStatus };
}

export interface CartTotals {
  subtotal: string;
  platformFee: string;
  total: string;
  itemCount: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  name: string;
  price: string;
  quantity: number;
  imageUrl: string | null;
  optionsSnapshot: string;
  itemTotal: string;
}

export interface Refund {
  id: string;
  paymentId: string;
  amount: string;
  reason: string;
  gatewayRef: string | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  triggeredBy: string;
  initiatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  gatewayRef: string | null;
  razorpayPaymentId: string | null;
  razorpayOrderId: string | null;
  amount: string;
  status: PaymentStatus;
  method: PaymentMethod | null;
  createdAt: string;
  updatedAt: string;
  refunds: Refund[];
}

export interface Order {
  id: string;
  orderNumber: string;
  studentId: string;
  outletId: string;
  outletSnapshot: string; // JSON
  status: OrderStatus;
  totalAmount: string;
  subtotal: string;
  discount: string;
  platformFee: string;
  notes: string;
  pickupCode: string;
  scheduledFor: string | null;
  timeline: string; // JSON
  cancelReason: string | null;
  createdAt: string;
  acceptedAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  items: OrderItem[];
  payment: Payment | null;
  user?: { id?: string; name?: string; email?: string } | null;
}

export interface AdminOverview {
  users: {
    students: number;
    outletAdmins: number;
    outletStaff: number;
    superAdmins: number;
    total: number;
  };
  outlets: {
    total: number;
    open: number;
    busy: number;
    closed: number;
    pending: number;
    suspended: number;
  };
  menu: {
    total: number;
    available: number;
    unavailable: number;
  };
  orders: {
    total: number;
    pending: number;
    accepted: number;
    preparing: number;
    ready: number;
    completed: number;
    rejected: number;
    cancelled: number;
  };
}

/** Outlet-side KPI endpoint returns a plain { [status]: count } map. */
export type OutletKPIs = Partial<Record<OrderStatus, number>>;

/** API envelope — all backend responses are wrapped in { success, data?, message? }. */
export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
  errors?: unknown[];
}

// ─── Notifications ──────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  payload: string; // JSON
  isRead: boolean;
  orderId: string | null;
  createdAt: string;
}

export interface NotificationListResult {
  items: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
}

// ─── Audit log ──────────────────────────────────────────────────────────────

export interface AuditActor {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  before: string; // JSON
  after: string; // JSON
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  actor?: AuditActor | null;
}

export interface AuditListResult {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Admin (users / outlets / orders / refunds) ────────────────────────────

export interface AdminUserItem extends Omit<User, 'passwordHash'> {
  passwordHash?: never;
  outletStaff?: OutletStaff | null;
  studentProfile?: StudentProfile | null;
}

export interface AdminUserListResult {
  items: AdminUserItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminOutletStaff {
  id: string;
  userId: string;
  outletId: string;
  role: string;
  invitedBy: string | null;
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOutletItem extends Outlet {
  staff?: AdminOutletStaff[];
}

export interface AdminOrderItem extends Order {
  student?: { id: string; email: string; name: string | null } | null;
  outlet?: { id: string; name: string; status: OutletStatus } | null;
}

export interface AdminOrderListResult {
  items: AdminOrderItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminRefundResult {
  id: string;
  paymentId: string;
  amount: string;
  reason: string;
  gatewayRef: string | null;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  triggeredBy: string;
  initiatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Catalog search + popular ──────────────────────────────────────────────

export interface PopularMenuItem extends MenuItem {
  outlet?: { id: string; name: string; slug: string };
}

export interface SearchMenuHit extends MenuItem {
  outlet?: { id: string; name: string; status: OutletStatus };
}

export interface SearchResult {
  outlets: Outlet[];
  menuItems: SearchMenuHit[];
}

// ─── Onboarding ────────────────────────────────────────────────────────────

export interface OnboardingPayload {
  password: string;
  profile: {
    fullName: string;
    phone: string;
    course: string;
    year: string;
    collegeId: string;
  };
}

export interface OnboardingResponse {
  user: User;
}

// ─── Staff & Analytics (Spaces from legend) ────────────────────────────────

export interface StaffMember {
  staffId?: string;
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  lastLoginAt?: string | null;
  outlet?: {
    id: string;
    name: string;
    location?: string | null;
    status: string;
  };
}

export interface OutletAnalytics {
  todaySales: number;
  monthSales: number;
  totalOrders: number;
  prepTime: string;
  weeklyOrders: { day: string; date: string; value: number }[];
  popularItems: { name: string; orders: number }[];
  attentionNeeded: { type: 'warning' | 'error' | 'success'; message: string; action: string }[];
}

export interface CreateStaffInput {
  name: string;
  email: string;
  password?: string;
  role?: 'OUTLET_STAFF' | 'OUTLET_ADMIN';
}

export interface CreateOutletInput {
  name: string;
  description?: string;
  location?: string;
  contactNumber?: string;
  contactEmail?: string;
  openingTime?: string;
  closingTime?: string;
  status?: OutletStatus;
}

