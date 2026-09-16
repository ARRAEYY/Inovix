async function runTests() {
  const BASE_URL = 'http://localhost:3000/api/v1';

  const fetchJson = async (url, options) => {
    const res = await fetch(url, options);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };

  console.log('--- E2E TEST: Admin Dashboard & Platform Management ---');
  
  // 1. Admin Login
  const { data: aData } = await fetchJson(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@rishihood.edu.in' })
  });
  const adminToken = aData.data.accessToken;
  console.log('Admin logged in');

  // 2. Student Login
  const { data: sData } = await fetchJson(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student1@example.com' })
  });
  const studentToken = sData.data.accessToken;
  console.log('Student logged in');

  // 3. Outlet Login
  const { data: oData } = await fetchJson(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'outlet1@rishihood.edu.in' })
  });
  const outletToken = oData.data.accessToken;
  console.log('Outlet logged in');


  // TEST 1: Admin can access overview
  const overviewRes = await fetchJson(`${BASE_URL}/admin/overview`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('TEST 1 [Admin Access]: Success?', overviewRes.status === 200 && overviewRes.data.data.users !== undefined);


  // TEST 2: Student receives 403 for Admin APIs
  const studentAccessRes = await fetchJson(`${BASE_URL}/admin/overview`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log('TEST 2 [Student Isolation]: Blocked? Status =', studentAccessRes.status);


  // TEST 3: Outlet receives 403 for Admin APIs
  const outletAccessRes = await fetchJson(`${BASE_URL}/admin/overview`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${outletToken}` }
  });
  console.log('TEST 3 [Outlet Isolation]: Blocked? Status =', outletAccessRes.status);


  // TEST 4: Self-protection - Admin cannot suspend itself
  const suspendSelfRes = await fetchJson(`${BASE_URL}/admin/users/user-admin-1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'SUSPENDED' })
  });
  console.log('TEST 4 [Admin Self-Protection]: Blocked? Status =', suspendSelfRes.status);


  // TEST 5: User Suspension
  // 5.1 Admin suspends Student
  const suspendStudentRes = await fetchJson(`${BASE_URL}/admin/users/user-student-1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'SUSPENDED' })
  });
  console.log('TEST 5.1 [Suspend Student]: Success?', suspendStudentRes.status === 200);

  // 5.2 Student attempts protected API
  const suspendedAccessRes = await fetchJson(`${BASE_URL}/auth/me`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log('TEST 5.2 [Suspended API Access]: Blocked? Status =', suspendedAccessRes.status);

  // 5.3 Student cannot obtain valid new authenticated session
  const newLoginRes = await fetchJson(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student1@example.com' })
  });
  console.log('TEST 5.3 [Suspended Login]: Blocked? Status =', newLoginRes.status);

  // Re-activate student for future tests if needed
  await fetchJson(`${BASE_URL}/admin/users/user-student-1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'ACTIVE' })
  });


  // TEST 6: Outlet Status Propagation
  // Admin changes OPEN -> CLOSED
  const closeOutletRes = await fetchJson(`${BASE_URL}/admin/outlets/outlet-1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'CLOSED' })
  });
  
  const studentOutletRes = await fetchJson(`${BASE_URL}/catalog/outlets/outlet-1`, {
    method: 'GET'
  });
  console.log('TEST 6 [Outlet Status Propagation]: Reflected CLOSED?', closeOutletRes.status === 200 && studentOutletRes.data.data.status === 'CLOSED');

  // Re-open outlet
  await fetchJson(`${BASE_URL}/admin/outlets/outlet-1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'OPEN' })
  });


  // TEST 7: Menu Status Propagation & Snapshot Integrity
  const allMenuRes = await fetchJson(`${BASE_URL}/admin/menu`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const testItem = allMenuRes.data.data.find(m => m.outletId === 'outlet-1' && m.isAvailable === true);
  
  if (testItem) {
    // 1. Create order for Item
    const studentTokenActive = (await fetchJson(`${BASE_URL}/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'student1@example.com' })
    })).data.data.accessToken;
      
    const studentOrderRes = await fetchJson(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentTokenActive}` },
      body: JSON.stringify({
        outletId: 'outlet-1',
        items: [{ menuItemId: testItem.id, quantity: 1 }],
        paymentMethod: 'online'
      })
    });
    
    const orderId = studentOrderRes.data.data.id;
    const orderTotal = studentOrderRes.data.data.total;
    
    // 2. Admin disables Item
    await fetchJson(`${BASE_URL}/admin/menu/${testItem.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ isAvailable: false })
    });
    
    // 3. Student catalog reflects unavailable
    const studentMenuRes = await fetchJson(`${BASE_URL}/catalog/outlets/outlet-1/menu`, {
        method: 'GET'
    });
    const itemInCatalog = studentMenuRes.data.data.find(m => m.id === testItem.id);
    console.log('TEST 7.1 [Menu Status Propagation]: Reflected unavailable?', itemInCatalog.isAvailable === false);
    
    // 4. Existing order remains unchanged
    const pastOrderRes = await fetchJson(`${BASE_URL}/orders/${orderId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${studentTokenActive}` }
    });
    console.log('TEST 7.2 [Snapshot Integrity]: Snapshot untouched?', pastOrderRes.data.data.total === orderTotal && pastOrderRes.data.data.items[0].price === testItem.price);
    
    // Re-enable item
    await fetchJson(`${BASE_URL}/admin/menu/${testItem.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ isAvailable: true })
    });

    // TEST 8: Menu Data Integrity (Only isAvailable changes)
    const afterEnableRes = await fetchJson(`${BASE_URL}/admin/menu/${testItem.id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    console.log('TEST 8 [Menu Data Integrity]: Only isAvailable changed?', 
      afterEnableRes.data.data.price === testItem.price && 
      afterEnableRes.data.data.name === testItem.name
    );

    // TEST 9: Historical order snapshot survives menu deletion
    // Create a temporary item
    const tempItemRes = await fetchJson(`${BASE_URL}/outlet/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${outletToken}` },
      body: JSON.stringify({
        outletId: 'outlet-1',
        name: 'Temp Delete Burger',
        price: 999,
        category: 'Meals',
        isAvailable: true
      })
    });
    const tempItemId = tempItemRes.data.data.id;

    // Create order with temp item
    const studentOrderResTemp = await fetchJson(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${studentTokenActive}` },
      body: JSON.stringify({
        outletId: 'outlet-1',
        items: [{ menuItemId: tempItemId, quantity: 1 }],
        paymentMethod: 'online'
      })
    });
    const orderIdTemp = studentOrderResTemp.data.data.id;
    const orderTotalTemp = studentOrderResTemp.data.data.total;

    // Delete temp item
    await fetchJson(`${BASE_URL}/outlet/menu/${tempItemId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${outletToken}` }
    });
    
    // Fetch historical order again
    const pastOrderRes2 = await fetchJson(`${BASE_URL}/orders/${orderIdTemp}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${studentTokenActive}` }
    });
    console.log('TEST 9 [Historical Order Deletion Survival]: Snapshot untouched?', 
      pastOrderRes2.data.data.total === orderTotalTemp && 
      pastOrderRes2.data.data.items[0].price === 999
    );
  } else {
    console.log('TEST 7, 8, 9 Skipped: No available item found for outlet-1');
  }

  // TEST 10: Reactivated User can login
  const reactivatedLoginRes = await fetchJson(`${BASE_URL}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student1@example.com' })
  });
  console.log('TEST 10 [Reactivated Login]: Success?', reactivatedLoginRes.status === 200);

  // TEST 11: Role cannot be changed through status endpoint
  await fetchJson(`${BASE_URL}/admin/users/user-student-1/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'ACTIVE', role: 'SUPER_ADMIN' })
  });
  
  const studentProfileRes = await fetchJson(`${BASE_URL}/admin/users/user-student-1`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log('TEST 11 [Role Escalation Protection]: Still STUDENT?', studentProfileRes.data.data.role === 'STUDENT');

}

runTests().catch(console.error);
