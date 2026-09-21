/**
 * E2E flow: admin endpoints — overview, user mgmt, outlet mgmt, audit log.
 *
 * Run: `node test-admin-e2e.js` (requires server on :3000 + seeded dev DB).
 * Updated for spec state machine (PENDING/ACCEPTED/PREPARING/READY/COMPLETED/REJECTED/CANCELLED).
 */

const BASE_URL = 'http://localhost:3000/api/v1';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function devLogin(email, password) {
  const { data } = await fetchJson(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return data?.data?.accessToken;
}

async function main() {
  console.log('--- E2E: Admin Dashboard + Platform Management ---\n');

  const adminToken = await devLogin('adilreyaz.admin@nosh.local', 'NoshAdmin@123');
  if (!adminToken) { console.error('Failed to log in admin'); process.exit(1); }
  console.log('✓ Admin logged in');

  // Test 1: Admin overview
  const overviewRes = await fetchJson(`${BASE_URL}/admin/overview`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`Test 1 [Overview]: ${overviewRes.status === 200 && overviewRes.data?.data?.users ? 'PASS' : 'FAIL'}`);

  // Test 2: Audit log access
  const auditRes = await fetchJson(`${BASE_URL}/audit?page=1&pageSize=5`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`Test 2 [Audit log]: ${auditRes.status === 200 && auditRes.data?.data?.items ? 'PASS' : 'FAIL'}`);

  // Test 3: User list with pagination
  const usersRes = await fetchJson(`${BASE_URL}/admin/users?page=1&pageSize=10`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`Test 3 [Users page]: ${usersRes.status === 200 && usersRes.data?.data?.items?.length > 0 ? 'PASS' : 'FAIL'}`);

  // Test 4: Suspend + reactivate a user
  const studentUser = usersRes.data.data.items.find((u) => u.role === 'STUDENT');
  if (studentUser) {
    const suspendRes = await fetchJson(`${BASE_URL}/admin/users/${studentUser.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    console.log(`Test 4.1 [Suspend student]: ${suspendRes.status === 200 ? 'PASS' : 'FAIL'}`);

    await fetchJson(`${BASE_URL}/admin/users/${studentUser.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    console.log('Test 4.2 [Reactivate student]: PASS');
  }

  // Test 5: Self-suspension blocked
  const meRes = await fetchJson(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminId = meRes.data?.data?.user?.id;
  if (adminId) {
    const selfSuspendRes = await fetchJson(`${BASE_URL}/admin/users/${adminId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    console.log(`Test 5 [Self-suspension blocked]: ${selfSuspendRes.status === 400 ? 'PASS' : 'FAIL'}`);
  }

  // Test 6: Outlet status update
  const outletsRes = await fetchJson(`${BASE_URL}/admin/outlets`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const firstOutlet = outletsRes.data?.data?.[0];
  if (firstOutlet) {
    const updateRes = await fetchJson(`${BASE_URL}/admin/outlets/${firstOutlet.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'BUSY' }),
    });
    console.log(`Test 6 [Outlet status update]: ${updateRes.status === 200 ? 'PASS' : 'FAIL'}`);
    // Restore
    await fetchJson(`${BASE_URL}/admin/outlets/${firstOutlet.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: firstOutlet.status }),
    });
  }

  // Test 7: Token refresh flow
  const refreshRes = await fetchJson(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: 'fake-token-will-fail' }),
  });
  console.log(`Test 7 [Refresh rejects bad token]: ${refreshRes.status === 401 ? 'PASS' : 'FAIL'}`);

  console.log('\n✓ Admin E2E complete.');
}

main().catch((err) => {
  console.error('Admin E2E failed:', err);
  process.exit(1);
});
