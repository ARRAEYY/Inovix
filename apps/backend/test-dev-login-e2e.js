async function runTests() {
  const BASE_URL = 'http://localhost:3000/api/v1';

  const fetchJson = async (url, options) => {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };

  console.log('--- E2E TEST: Development Mock Login ---');

  // TEST 1: Admin Login
  const adminLoginRes = await fetchJson(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'adilreyaz.admin@nosh.local', password: 'NoshAdmin@123' })
  });
  console.log('TEST 1 [Admin Login]: Success?', adminLoginRes.status === 200 && adminLoginRes.data.data.user.role === 'SUPER_ADMIN');
  const adminToken = adminLoginRes.data.data.accessToken;

  // TEST 2: Outlet Login
  const outletLoginRes = await fetchJson(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'adilreyaz.outlet@nosh.local', password: 'NoshOutlet@123' })
  });
  console.log('TEST 2 [Outlet Login]: Success?', outletLoginRes.status === 200 && outletLoginRes.data.data.user.role === 'OUTLET_ADMIN' && outletLoginRes.data.data.user.outletId === 'mock-outlet-adil');
  const outletToken = outletLoginRes.data.data.accessToken;

  // TEST 3: Admin Authorization (Allowed)
  const adminAuthRes = await fetchJson(`${BASE_URL}/admin/overview`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('TEST 3 [Admin Authorization]: Success?', adminAuthRes.status === 200);

  // TEST 4: Outlet Authorization (Allowed)
  const outletAuthRes = await fetchJson(`${BASE_URL}/outlet/menu`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${outletToken}` }
  });
  console.log('TEST 4 [Outlet Authorization]: Success?', outletAuthRes.status === 200);

  // TEST 5: Isolation - Admin accesses Outlet (Should fail 403)
  const adminIsolRes = await fetchJson(`${BASE_URL}/outlet/menu`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('TEST 5 [Isolation Admin->Outlet]: Blocked?', adminIsolRes.status === 403);

  // TEST 6: Isolation - Outlet accesses Admin (Should fail 403)
  const outletIsolRes = await fetchJson(`${BASE_URL}/admin/overview`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${outletToken}` }
  });
  console.log('TEST 6 [Isolation Outlet->Admin]: Blocked?', outletIsolRes.status === 403);

  // TEST 7: Invalid password
  const invalidPassRes = await fetchJson(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'adilreyaz.admin@nosh.local', password: 'wrong' })
  });
  console.log('TEST 7 [Invalid Password]: Blocked?', invalidPassRes.status === 401);
  
  // TEST 8: Suspension compatibility
  await fetchJson(`${BASE_URL}/admin/users/dev-outlet/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'SUSPENDED' })
  });
  
  const suspendedLoginRes = await fetchJson(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'adilreyaz.outlet@nosh.local', password: 'NoshOutlet@123' })
  });
  console.log('TEST 8 [Suspension Compatibility]: Login Blocked?', suspendedLoginRes.status === 403);
  
  // Reactivate
  await fetchJson(`${BASE_URL}/admin/users/dev-outlet/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'ACTIVE' })
  });
}

runTests().catch(console.error);
