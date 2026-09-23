/**
 * Nosh API client — the single HTTP entry point for the frontend.
 *
 * CRITICAL RULES (per project conventions):
 *   1. Every URL is RELATIVE — never `http://localhost:3001`. Caddy routes
 *      based on the `XTransformPort` query param.
 *   2. Every request includes `credentials: 'include'` so the browser
 *      sends the httpOnly `nosh_refresh` cookie.
 *   3. The access token (in-memory only, via useAuthStore) is sent as
 *      `Authorization: Bearer <token>`.
 *   4. On 401, we attempt a single refresh call (which uses the cookie),
 *      then retry the original request exactly once with the new token.
 *      If refresh fails, we clear the auth state and surface the 401.
 *   5. No client-to-server state is persisted in localStorage — the
 *      httpOnly cookie is the only long-lived credential.
 */

'use client';

import { useAuthStore } from './store';
import type {
  AdminOverview,
  AdminOrderListResult,
  AdminOutletItem,
  AdminRefundResult,
  AdminUserListResult,
  ApiEnvelope,
  AuditListResult,
  AuthData,
  Cart,
  CartTotals,
  MenuItem,
  NotificationListResult,
  OnboardingPayload,
  OnboardingResponse,
  Order,
  OrderStatus,
  Outlet,
  OutletKPIs,
  PopularMenuItem,
  SearchResult,
  User,
  StaffMember,
  OutletAnalytics,
  CreateStaffInput,
  CreateOutletInput,
} from './types';

/** The backend port Caddy should forward to. */
const NOSH_PORT = '3001';

/** Dev-login accounts documented in the task spec. */
export const DEV_ACCOUNTS = {
  student: { email: 'adil@rishihood.edu.in' },
  outletStaff: { email: 'outlet1.staff@rishihood.edu.in' },
  outletAdmin: { email: 'adilreyaz.outlet@nosh.local', password: 'NoshOutlet@123' },
  superAdmin: { email: 'adilreyaz.admin@nosh.local', password: 'NoshAdmin@123' },
} as const;

/** Append `XTransformPort=3001` to a relative path, preserving other query params. */
export function withPort(path: string): string {
  if (!path.startsWith('/')) path = '/' + path;
  const sep = path.includes('?') ? '&' : '?';
  // Avoid duplicating the param if the caller already added it.
  if (path.includes('XTransformPort=')) return path;
  return `${path}${sep}XTransformPort=${NOSH_PORT}`;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: unknown;
  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/** True if a path is one of the auth endpoints that should NOT trigger auto-refresh. */
function isAuthRoute(path: string): boolean {
  return (
    path.startsWith('/api/v1/auth/refresh') ||
    path.startsWith('/api/v1/auth/dev-login') ||
    path.startsWith('/api/v1/auth/google') ||
    path.startsWith('/api/v1/auth/logout')
  );
}

// ─── Token refresh coordination ──────────────────────────────────────────────
// Multiple in-flight 401s can trigger multiple refresh attempts concurrently.
// We dedupe them with a single shared promise.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const res = await fetch(withPort('/api/v1/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return null;
      const body = (await res.json()) as ApiEnvelope<AuthData>;
      if (!body.success || !body.data) return null;
      useAuthStore.getState().setAuth(body.data.user, body.data.accessToken);
      return body.data.accessToken;
    } catch {
      return null;
    } finally {
      // Allow the next refresh attempt (after this call resolves).
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Set true to opt out of the auto-refresh retry (used by /refresh itself). */
  skipRefresh?: boolean;
  signal?: AbortSignal;
  /** Optional explicit content type; defaults to JSON. */
  contentType?: string;
}

/** Core fetch wrapper. Throws ApiError on non-2xx; returns parsed data. */
async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, skipRefresh = false, signal, contentType } = opts;
  const token = useAuthStore.getState().accessToken;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = contentType ?? 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const init: RequestInit = {
    method,
    credentials: 'include', // ALWAYS send the httpOnly refresh cookie
    headers,
    signal,
  };
  if (body !== undefined) {
    init.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const res = await fetch(withPort(path), init);

  // 401 handling — try refresh + retry once.
  if (res.status === 401 && !skipRefresh && !isAuthRoute(path)) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryHeaders: Record<string, string> = { ...headers };
      retryHeaders.Authorization = `Bearer ${newToken}`;
      const retryRes = await fetch(withPort(path), {
        ...init,
        headers: retryHeaders,
      });
      return parseResponse<T>(retryRes, path);
    }
    // Refresh failed — the user is no longer authenticated.
    useAuthStore.getState().clear();
    throw new ApiError('Authentication required', 401, 'UNAUTHORIZED');
  }

  return parseResponse<T>(res, path);
}

async function parseResponse<T>(res: Response, path: string): Promise<T> {
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const env = body as ApiEnvelope<unknown> | { message?: string } | string;
    const message =
      (typeof env === 'object' && env && 'message' in env && typeof env.message === 'string' && env.message) ||
      `Request failed: ${res.status} ${res.statusText}`;
    const code =
      typeof env === 'object' && env && 'code' in env && typeof env.code === 'string'
        ? env.code
        : undefined;
    throw new ApiError(message, res.status, code, body);
  }

  // Auth routes return { success, data: { user, accessToken } }.
  // Other routes return { success, data: T }.
  if (typeof body === 'object' && body && 'success' in body) {
    const env = body as ApiEnvelope<T>;
    if (env.success === false) {
      throw new ApiError(env.message ?? 'Request failed', res.status, env.code, body);
    }
    return env.data as T;
  }
  // Raw response (no envelope) — return as-is.
  return body as T;
}

// ─── Auth endpoints ──────────────────────────────────────────────────────────

export const authApi = {
  /** Standard production email + password authentication. */
  async login(email: string, password: string): Promise<AuthData> {
    try {
      return await request<AuthData>('/api/v1/auth/login', {
        method: 'POST',
        body: { email, password },
        skipRefresh: true,
      });
    } catch (err) {
      // If dev-login is available and password wasn't provided or dev account is passwordless
      if (!password) {
        return authApi.devLoginStudent(email);
      }
      throw err;
    }
  },

  /** Student dev-login: email only (Google-only account). */
  devLoginStudent(email: string): Promise<AuthData> {
    return request<AuthData>('/api/v1/auth/dev-login', {
      method: 'POST',
      body: { email },
      skipRefresh: true,
    });
  },

  /** Outlet/admin dev-login: email + password. */
  devLoginStaff(email: string, password: string): Promise<AuthData> {
    return request<AuthData>('/api/v1/auth/dev-login', {
      method: 'POST',
      body: { email, password },
      skipRefresh: true,
    });
  },

  /** Refresh via httpOnly cookie. Returns null if no valid session. */
  async refresh(): Promise<AuthData | null> {
    try {
      return await request<AuthData>('/api/v1/auth/refresh', {
        method: 'POST',
        skipRefresh: true,
      });
    } catch {
      return null;
    }
  },

  async me(): Promise<User> {
    return request<User>('/api/v1/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await request<{ message: string }>('/api/v1/auth/logout', {
        method: 'POST',
      });
    } catch {
      // Ignore — we clear local state regardless.
    } finally {
      useAuthStore.getState().clear();
    }
  },

  /**
   * Step 1 of password recovery — ask the backend to email a 6-digit OTP
   * to the supplied college email. The endpoint always returns 200 (even
   * for unknown emails) so we don't leak which addresses exist.
   *
   * In dev mode the OTP is also logged to the backend console — the UI
   * surfaces a hint pointing the user there.
   */
  forgotPassword(email: string): Promise<{ message?: string }> {
    return request<{ message?: string }>('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: { email },
      skipRefresh: true,
    });
  },

  /**
   * Step 2 of password recovery — submit the OTP + a new password. The
   * backend verifies the OTP against the in-memory cache populated by
   * `forgotPassword`, then resets the user's password hash.
   */
  resetPassword(email: string, otp: string, newPassword: string): Promise<{ message?: string }> {
    return request<{ message?: string }>('/api/v1/auth/reset-password', {
      method: 'POST',
      body: { email, otp, newPassword },
      skipRefresh: true,
    });
  },
};

// ─── Catalog endpoints (student browse) ─────────────────────────────────────

export const catalogApi = {
  listOutlets(): Promise<Outlet[]> {
    return request<Outlet[]>('/api/v1/catalog/outlets');
  },
  listMenu(outletId: string): Promise<MenuItem[]> {
    return request<MenuItem[]>(`/api/v1/catalog/outlets/${outletId}/menu`);
  },
  popular(): Promise<PopularMenuItem[]> {
    return request<PopularMenuItem[]>('/api/v1/catalog/menu/popular');
  },
  search(q: string): Promise<SearchResult> {
    const encoded = encodeURIComponent(q);
    return request<SearchResult>(`/api/v1/catalog/search?q=${encoded}`);
  },
};

// ─── Onboarding endpoint (student first-time setup) ─────────────────────────

export const onboardingApi = {
  complete(payload: OnboardingPayload): Promise<OnboardingResponse> {
    return request<OnboardingResponse>('/api/v1/onboarding', {
      method: 'POST',
      body: payload,
    });
  },
};

// ─── Notifications endpoints ────────────────────────────────────────────────

export const notificationsApi = {
  list(opts: { page?: number; pageSize?: number; unreadOnly?: boolean } = {}): Promise<NotificationListResult> {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
    if (opts.unreadOnly) params.set('unread', 'true');
    const qs = params.toString();
    return request<NotificationListResult>(`/api/v1/notifications${qs ? `?${qs}` : ''}`);
  },
  markRead(id: string): Promise<NotificationListResult['items'][number]> {
    return request(`/api/v1/notifications/read/${id}`, { method: 'POST' });
  },
  markAllRead(): Promise<{ marked: number }> {
    return request('/api/v1/notifications/read/all', { method: 'POST' });
  },
};

// ─── Audit endpoint (SUPER_ADMIN) ───────────────────────────────────────────

export const auditApi = {
  list(opts: { page?: number; pageSize?: number } = {}): Promise<AuditListResult> {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
    const qs = params.toString();
    return request<AuditListResult>(`/api/v1/audit${qs ? `?${qs}` : ''}`);
  },
};

// ─── Cart endpoints ─────────────────────────────────────────────────────────

export const cartApi = {
  /** Active cart (the student's most-recently-updated one). */
  getActive(): Promise<Cart | null> {
    return request<Cart | null>('/api/v1/cart');
  },
  /** Create-or-get a cart for a specific outlet. */
  getOrCreate(outletId: string): Promise<Cart> {
    return request<Cart>(`/api/v1/cart/outlets/${outletId}`);
  },
  addItem(
    outletId: string,
    item: { menuItemId: string; quantity: number; selectedOptions?: { groupId: string; optionId: string }[] },
  ): Promise<Cart> {
    return request<Cart>(`/api/v1/cart/outlets/${outletId}/items`, {
      method: 'POST',
      body: item,
    });
  },
  updateItem(cartItemId: string, quantity: number): Promise<Cart> {
    // Note: backend uses PATCH (not PUT) for cart item updates.
    return request<Cart>(`/api/v1/cart/items/${cartItemId}`, {
      method: 'PATCH',
      body: { quantity },
    });
  },
  removeItem(cartItemId: string): Promise<Cart> {
    return request<Cart>(`/api/v1/cart/items/${cartItemId}`, {
      method: 'DELETE',
    });
  },
  async clear(): Promise<void> {
    // Returns { success, message } — no data field, so swallow the response.
    await request<{ message?: string }>('/api/v1/cart', { method: 'DELETE' });
  },
};

// ─── Orders endpoints (student) ─────────────────────────────────────────────

export interface CreateOrderInput {
  outletId: string;
  items: { menuItemId: string; quantity: number; selectedOptions?: { groupId: string; optionId: string }[] }[];
  paymentMethod: 'ONLINE' | 'WALLET';
  notes?: string;
}

export const ordersApi = {
  list(): Promise<Order[]> {
    return request<Order[]>('/api/v1/orders');
  },
  getById(id: string): Promise<Order> {
    return request<Order>(`/api/v1/orders/${id}`);
  },
  create(input: CreateOrderInput): Promise<Order> {
    return request<Order>('/api/v1/orders', { method: 'POST', body: input });
  },
  cancel(id: string): Promise<Order> {
    return request<Order>(`/api/v1/orders/${id}/cancel`, { method: 'POST' });
  },
};

// ─── Outlet dashboard endpoints (OUTLET_STAFF/ADMIN) ────────────────────────

export interface MenuItemCreateInput {
  name: string;
  description?: string;
  price: number | string;
  category?: string;
  image?: string;
  isAvailable?: boolean;
  discount?: number | string;
  popular?: boolean;
  vegetarian?: boolean;
  isVeg?: boolean;
  preparationTime?: number;
  dietaryFlags?: string[];
}

export type MenuItemUpdateInput = Partial<MenuItemCreateInput>;

export const outletApi = {
  listOrders(): Promise<Order[]> {
    return request<Order[]>('/api/v1/outlet/orders');
  },
  kpis(): Promise<OutletKPIs> {
    return request<OutletKPIs>('/api/v1/outlet/orders/kpis');
  },
  updateOrderStatus(id: string, status: OrderStatus, reason?: string): Promise<Order> {
    return request<Order>(`/api/v1/outlet/orders/${id}/status`, {
      method: 'PATCH',
      body: { status, reason },
    });
  },
  // ── Outlet menu management (OUTLET_ADMIN only) ──
  listMenu(): Promise<MenuItem[]> {
    return request<MenuItem[]>('/api/v1/outlet/menu');
  },
  createMenuItem(input: MenuItemCreateInput): Promise<MenuItem> {
    return request<MenuItem>('/api/v1/outlet/menu', { method: 'POST', body: input });
  },
  updateMenuItem(itemId: string, input: MenuItemUpdateInput): Promise<MenuItem> {
    return request<MenuItem>(`/api/v1/outlet/menu/${itemId}`, { method: 'PATCH', body: input });
  },
  /** Toggle availability via the partial PATCH route (no /status endpoint exists). */
  setItemAvailability(itemId: string, isAvailable: boolean): Promise<MenuItem> {
    return this.updateMenuItem(itemId, { isAvailable });
  },
  deleteMenuItem(itemId: string): Promise<{ message?: string }> {
    return request<{ message?: string }>(`/api/v1/outlet/menu/${itemId}`, { method: 'DELETE' });
  },
  /**
   * Verify the 4-digit pickup code shown to a student. The backend only
   * allows this transition when the order is READY; on success the order
   * flips to COMPLETED.
   *
   * Status semantics:
   *   200 → success (order now COMPLETED)
   *   400 (code mismatch)   → "Invalid pickup code"
   *   400 (not READY)       → "Order must be READY first"
   */
  verifyPickup(orderId: string, pickupCode: string): Promise<Order> {
    return request<Order>(`/api/v1/outlet/orders/${orderId}/verify-pickup`, {
      method: 'POST',
      body: { pickupCode },
    });
  },
  // ── Outlet Staff & Analytics (Spaces from legend) ──
  getStaff(): Promise<StaffMember[]> {
    return request<StaffMember[]>('/api/v1/outlet/staff');
  },
  createStaff(input: CreateStaffInput): Promise<StaffMember> {
    return request<StaffMember>('/api/v1/outlet/staff', { method: 'POST', body: input });
  },
  updateStaffStatus(staffId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<StaffMember> {
    return request<StaffMember>(`/api/v1/outlet/staff/${staffId}/status`, { method: 'PATCH', body: { status } });
  },
  analytics(): Promise<OutletAnalytics> {
    return request<OutletAnalytics>('/api/v1/outlet/orders/analytics');
  },
};

// ─── Payments endpoints (Razorpay) ─────────────────────────────────────────
//
// The student-side flow is:
//   1. POST /api/v1/payments/razorpay/order  { orderId }
//      → { razorpayOrderId, amount, currency, keyId }
//   2. The frontend lazily loads Razorpay checkout.js and opens the real
//      Razorpay modal via `new window.Razorpay({...}).open()`.
//   3. POST /api/v1/payments/razorpay/verify
//      { razorpayOrderId, razorpayPaymentId, razorpaySignature }
//      → 200 PAID  |  503 if Razorpay gateway is unreachable in dev
//      |  400 PAYMENT_NOT_CONFIGURED if the outlet has no Razorpay keys
//
// The /payments/admin/outlets/:outletId/razorpay-credentials endpoint is
// mounted under SUPER_ADMIN auth. In dev the outlet admin can sign in
// as the super-admin to set credentials.

export interface RazorpayOrderResponse {
  razorpayOrderId: string;
  amount: number; // in paise
  currency: string;
  keyId: string;
}

export interface RazorpayVerifyInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface RazorpayCredentialsInput {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}

export const paymentsApi = {
  /** Create a Razorpay order against an existing nosh order. */
  createRazorpayOrder(orderId: string): Promise<RazorpayOrderResponse> {
    return request<RazorpayOrderResponse>('/api/v1/payments/razorpay/order', {
      method: 'POST',
      body: { orderId },
    });
  },

  /**
   * Verify a Razorpay payment. In dev the gateway may be unreachable,
   * in which case the backend returns 503 with a "processing" code —
   * the order is still confirmed asynchronously by a webhook.
   */
  verifyRazorpay(input: RazorpayVerifyInput): Promise<unknown> {
    return request<unknown>('/api/v1/payments/razorpay/verify', {
      method: 'POST',
      body: input,
    });
  },

  /**
   * Store Razorpay credentials for an outlet. Encrypted at rest; never
   * returned by any GET endpoint.
   *
   * Mounted under SUPER_ADMIN auth — outlet admins must use the super
   * admin account to set credentials in dev.
   */
  saveOutletRazorpayCredentials(
    outletId: string,
    input: RazorpayCredentialsInput,
  ): Promise<{ message?: string }> {
    return request<{ message?: string }>(
      `/api/v1/payments/admin/outlets/${outletId}/razorpay-credentials`,
      {
        method: 'POST',
        body: input,
      },
    );
  },
};

// ─── Admin endpoints (SUPER_ADMIN) ──────────────────────────────────────────

export const adminApi = {
  overview(): Promise<AdminOverview> {
    return request<AdminOverview>('/api/v1/admin/overview');
  },
  listUsers(opts: { page?: number; pageSize?: number } = {}): Promise<AdminUserListResult> {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
    const qs = params.toString();
    return request<AdminUserListResult>(`/api/v1/admin/users${qs ? `?${qs}` : ''}`);
  },
  updateUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<User> {
    return request<User>(`/api/v1/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: { status },
    });
  },
  listOutlets(): Promise<AdminOutletItem[]> {
    return request<AdminOutletItem[]>('/api/v1/admin/outlets');
  },
  updateOutletStatus(outletId: string, status: 'OPEN' | 'BUSY' | 'CLOSED' | 'PENDING' | 'SUSPENDED'): Promise<Outlet> {
    return request<Outlet>(`/api/v1/admin/outlets/${outletId}/status`, {
      method: 'PATCH',
      body: { status },
    });
  },
  listOrders(opts: { page?: number; pageSize?: number } = {}): Promise<AdminOrderListResult> {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
    const qs = params.toString();
    return request<AdminOrderListResult>(`/api/v1/admin/orders${qs ? `?${qs}` : ''}`);
  },
  issueRefund(input: { orderId: string; amount: number | string; reason: string; trigger?: string }): Promise<AdminRefundResult> {
    return request<AdminRefundResult>('/api/v1/admin/refunds', {
      method: 'POST',
      body: {
        orderId: input.orderId,
        amount: input.amount,
        reason: input.reason,
        // Server always overrides this to SUPER_ADMIN_MANUAL per the route
        // comment, but the schema requires it to be a valid enum value.
        trigger: input.trigger ?? 'SUPER_ADMIN_MANUAL',
      },
    });
  },
  // ── Additional Super Admin spaces from legend ──
  createOutlet(input: CreateOutletInput): Promise<Outlet> {
    return request<Outlet>('/api/v1/admin/outlets', { method: 'POST', body: input });
  },
  listAllStaff(): Promise<StaffMember[]> {
    return request<StaffMember[]>('/api/v1/admin/staff');
  },
  listMenu(): Promise<MenuItem[]> {
    return request<MenuItem[]>('/api/v1/admin/menu');
  },
  updateMenuItemStatus(itemId: string, isAvailable: boolean): Promise<MenuItem> {
    return request<MenuItem>(`/api/v1/admin/menu/${itemId}/status`, { method: 'PATCH', body: { isAvailable } });
  },
};

// ─── Convenience helpers ─────────────────────────────────────────────────────

/** Compute cart totals locally (mirrors backend computeTotals for display). */
export function computeCartTotals(cart: Cart | null): CartTotals {
  if (!cart || !cart.items || cart.items.length === 0) {
    return { subtotal: '0', platformFee: '0', total: '0', itemCount: 0 };
  }
  let subtotal = 0;
  let itemCount = 0;
  for (const item of cart.items) {
    const base = Number(item.menuItem.price) || 0;
    // Add customization deltas (re-compute from current menu state).
    let optionsDelta = 0;
    if (item.menuItem.customizationGroups && item.selectedOptions) {
      try {
        const selected = JSON.parse(item.selectedOptions) as { groupId: string; optionId: string }[];
        if (Array.isArray(selected)) {
          for (const sel of selected) {
            const grp = item.menuItem.customizationGroups.find((g) => g.id === sel.groupId);
            const opt = grp?.options.find((o) => o.id === sel.optionId);
            if (opt) optionsDelta += Number(opt.priceDelta) || 0;
          }
        }
      } catch {
        // ignore malformed JSON
      }
    }
    const unit = base + optionsDelta;
    subtotal += unit * item.quantity;
    itemCount += item.quantity;
  }
  const platformFee = subtotal > 0 ? 5 : 0;
  const total = subtotal + platformFee;
  return {
    subtotal: subtotal.toFixed(2),
    platformFee: platformFee.toFixed(2),
    total: total.toFixed(2),
    itemCount,
  };
}
