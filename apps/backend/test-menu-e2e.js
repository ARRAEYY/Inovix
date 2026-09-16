async function runTests() {
  const BASE_URL = 'http://localhost:3000/api/v1';

  const fetchJson = async (url, options) => {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };

  console.log('--- E2E TEST: Outlet Menu Management ---');
  
  // 1. Outlet 1 Login
  const { data: o1Data } = await fetchJson(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'outlet1@rishihood.edu.in' })
  });
  const outlet1Token = o1Data.data.accessToken;
  console.log('Outlet 1 logged in');

  // 2. Outlet 2 Login
  const { data: o2Data } = await fetchJson(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'outlet2@rishihood.edu.in' })
  });
  const outlet2Token = o2Data.data.accessToken;
  console.log('Outlet 2 logged in');

  // 3. Student Login
  const { data: sData } = await fetchJson(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student1@example.com' })
  });
  const studentToken = sData.data.accessToken;
  console.log('Student logged in');

  // TEST 1: Outlet 1 creates an item with forged outletId
  const createRes = await fetchJson(`${BASE_URL}/outlet/menu`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${outlet1Token}` },
    body: JSON.stringify({
      outletId: 'outlet-2', // FORGERY ATTEMPT
      name: 'E2E Test Burger',
      price: 200,
      category: 'Meals',
      isAvailable: true
    })
  });
  
  const newItemId = createRes.data.data.id;
  console.log('TEST 1 [Create]: Success?', createRes.status === 201);
  console.log('TEST 1 [Forgery check]: outletId === outlet-1?', createRes.data.data.outletId === 'outlet-1');

  // TEST 2: Outlet 1 gets its own menu
  const getMenuRes = await fetchJson(`${BASE_URL}/outlet/menu`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${outlet1Token}` }
  });
  const itemInMenu = getMenuRes.data.data.some(i => i.id === newItemId);
  console.log('TEST 2 [Get Menu]: Item found in menu?', itemInMenu);

  // TEST 3: Student attempts to access outlet menu
  const studentAccessRes = await fetchJson(`${BASE_URL}/outlet/menu`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log('TEST 3 [Student Access]: Blocked? Status =', studentAccessRes.status);

  // TEST 4: Outlet 2 tries to edit Outlet 1's item
  const editO2Res = await fetchJson(`${BASE_URL}/outlet/menu/${newItemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${outlet2Token}` },
    body: JSON.stringify({ price: 250 })
  });
  console.log('TEST 4 [Cross-Outlet Edit]: Blocked? Status =', editO2Res.status);

  // TEST 5: Outlet 1 edits its own item
  const editO1Res = await fetchJson(`${BASE_URL}/outlet/menu/${newItemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${outlet1Token}` },
    body: JSON.stringify({ price: 250, isAvailable: false })
  });
  console.log('TEST 5 [Valid Edit]: Success?', editO1Res.status === 200 && editO1Res.data.data.price === 250);

  // TEST 6: Verify student cart rejection
  // Actually checking student menu regression is done via /api/v1/auth/me etc, 
  // but let's check creating an order with the unavailable item.
  const studentOrderRes = await fetchJson(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` },
    body: JSON.stringify({
      outletId: 'outlet-1',
      items: [{ menuItemId: newItemId, quantity: 1 }],
      paymentMethod: 'online'
    })
  });
  console.log('TEST 6 [Unavailable Item in Cart/Order]: Blocked?', studentOrderRes.status === 400 && studentOrderRes.data.message.includes('unavailable'));

  // TEST 7: Outlet 2 tries to delete Outlet 1's item
  const delO2Res = await fetchJson(`${BASE_URL}/outlet/menu/${newItemId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${outlet2Token}` }
  });
  console.log('TEST 7 [Cross-Outlet Delete]: Blocked? Status =', delO2Res.status);

  // TEST 8: Outlet 1 deletes its own item
  const delO1Res = await fetchJson(`${BASE_URL}/outlet/menu/${newItemId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${outlet1Token}` }
  });
  console.log('TEST 8 [Valid Delete]: Success?', delO1Res.status === 200);
}

runTests().catch(console.error);
