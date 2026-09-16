async function runTests() {
  const BASE_URL = 'http://localhost:3000/api/v1';

  // 1. Outlet 1 Login
  const o1Res = await fetch(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'outlet1@rishihood.edu.in' })
  });
  const o1Data = await o1Res.json();
  const outlet1Token = o1Data.data.accessToken;
  console.log('Outlet 1 logged in');

  // 2. Student Login (Add student1 to mockUsers if not there, or use dev-login?)
  // Actually wait, let's use dev-login for student too! I added him to mockUsers.
  const sRes = await fetch(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student1@example.com' })
  });
  const sData = await sRes.json();
  const studentToken = sData.data.accessToken;
  console.log('Student logged in');

  // 3. Student creates order
  const orderRes = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentToken}` },
    body: JSON.stringify({
      outletId: 'outlet-1',
      items: [{ menuItemId: 'item-1', quantity: 1 }],
      paymentMethod: 'online',
      notes: 'Test order'
    })
  });
  const orderData = await orderRes.json();
  const orderId = orderData.data.id;
  console.log('Student created order:', orderId, 'Status:', orderData.data.status);

  // 4. Outlet views orders
  const o1OrdersRes = await fetch(`${BASE_URL}/outlet/orders`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${outlet1Token}` }
  });
  const o1OrdersData = await o1OrdersRes.json();
  console.log('Outlet 1 found', o1OrdersData.data.length, 'orders. Includes new order?', o1OrdersData.data.some(o => o.id === orderId));

  // 5. Outlet accepts order
  const updateRes = await fetch(`${BASE_URL}/outlet/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${outlet1Token}` },
    body: JSON.stringify({ status: 'PREPARING' })
  });
  const updateData = await updateRes.json();
  console.log('Outlet 1 accepted order. Status is now:', updateData.data.status);

  // 6. Student views order
  const studentViewRes = await fetch(`${BASE_URL}/orders/${orderId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  const studentViewData = await studentViewRes.json();
  console.log('Student checked order. Status:', studentViewData.data.status);

  // 7. Student tries to view Outlet endpoint (should fail)
  const studentOutletRes = await fetch(`${BASE_URL}/outlet/orders`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log('Student tried to access outlet endpoint. Status:', studentOutletRes.status);

  // 8. Outlet marks Ready then Completed
  await fetch(`${BASE_URL}/outlet/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${outlet1Token}` },
    body: JSON.stringify({ status: 'READY' })
  });
  await fetch(`${BASE_URL}/outlet/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${outlet1Token}` },
    body: JSON.stringify({ status: 'COMPLETED' })
  });
  console.log('Outlet 1 marked order as COMPLETED');

  // 9. Outlet tries invalid transition
  const invalidRes = await fetch(`${BASE_URL}/outlet/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${outlet1Token}` },
    body: JSON.stringify({ status: 'PREPARING' })
  });
  console.log('Outlet 1 tried invalid transition COMPLETED -> PREPARING. Status:', invalidRes.status);

  // 10. Outlet 2 tries to access Outlet 1's order
  const o2Res = await fetch(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'outlet2@rishihood.edu.in' })
  });
  const o2Data = await o2Res.json();
  const outlet2Token = o2Data.data.accessToken;
  const o2AccessRes = await fetch(`${BASE_URL}/outlet/orders/${orderId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${outlet2Token}` }
  });
  console.log('Outlet 2 tried to access Outlet 1 order. Status:', o2AccessRes.status);
}

runTests().catch(console.error);
