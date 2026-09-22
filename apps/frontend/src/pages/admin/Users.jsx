import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../services/api/client';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  
  const [selectedViewUser, setSelectedViewUser] = useState(null);
  const [selectedEditUser, setSelectedEditUser] = useState(null);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSuspend = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const confirmMsg = currentStatus === 'ACTIVE' 
      ? 'Are you sure you want to suspend this user? They will lose platform access.'
      : 'Are you sure you want to reactivate this user?';

    if (window.confirm(confirmMsg)) {
      try {
        await api.patch(`/admin/users/${userId}/status`, { status: newStatus });
        setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to update user status');
      }
    }
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    setUsers(users.map(u => u.id === selectedEditUser.id ? selectedEditUser : u));
    setSelectedEditUser(null);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(search.toLowerCase()) || 
                          u.email?.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filter === 'All') return true;
    if (filter === 'Suspended') return u.status === 'SUSPENDED';
    
    // Map filter tab to role string
    const roleMap = {
      'Students': 'STUDENT',
      'Outlet Staff': 'OUTLET_STAFF',
      'Outlet Admins': 'OUTLET_ADMIN',
      'Super Admins': 'SUPER_ADMIN'
    };
    
    return u.role === roleMap[filter];
  });

  if (loading) return <AdminLayout><p style={{ padding: '24px' }}>Loading users...</p></AdminLayout>;
  if (error) return <AdminLayout><div className="error-message" style={{ margin: '24px' }}>{error}</div></AdminLayout>;

  return (
    <AdminLayout>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
              Users
            </h1>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem' }}>
              Manage users and platform access.
            </p>
          </div>
          <button 
            onClick={fetchUsers}
            style={{ padding: '8px 16px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontWeight: '500' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh
          </button>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '8px', overflowX: 'auto', flexWrap: 'nowrap' }}>
              {['All', 'Students', 'Outlet Staff', 'Outlet Admins', 'Super Admins', 'Suspended'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    background: filter === f ? 'white' : 'transparent',
                    color: filter === f ? '#111827' : '#6b7280',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            
            <input 
              type="text" 
              placeholder="Search users..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px', width: '250px', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, idx) => {
                  
                  let roleDisplay = user.role;
                  let roleColor = '#4b5563';
                  let roleBg = '#f3f4f6';
                  
                  if (user.role === 'SUPER_ADMIN') { roleDisplay = 'Super Admin'; roleColor = '#b10035'; roleBg = '#fdf2f8'; }
                  if (user.role === 'OUTLET_ADMIN') { roleDisplay = 'Outlet Admin'; roleColor = '#4338ca'; roleBg = '#e0e7ff'; }
                  if (user.role === 'OUTLET_STAFF') { roleDisplay = 'Outlet Staff'; roleColor = '#0369a1'; roleBg = '#e0f2fe'; }
                  if (user.role === 'STUDENT') { roleDisplay = 'Student'; roleColor = '#15803d'; roleBg = '#dcfce3'; }

                  return (
                    <tr key={user.id} style={{ borderBottom: idx !== filteredUsers.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <td style={{ padding: '16px 24px', fontWeight: '700', color: '#111827' }}>{user.name}</td>
                      <td style={{ padding: '16px 24px', color: '#4b5563', fontSize: '0.9rem' }}>{user.email}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          background: roleBg,
                          color: roleColor
                        }}>
                          {roleDisplay}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          background: user.status === 'ACTIVE' ? '#ecfdf5' : '#fef2f2',
                          color: user.status === 'ACTIVE' ? '#10b981' : '#b10035'
                        }}>
                          {user.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button onClick={() => setSelectedViewUser(user)} style={{ background: 'none', border: 'none', color: '#b10035', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem' }}>View</button>
                          <button onClick={() => setSelectedEditUser(user)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem' }}>Edit</button>
                          <button 
                            onClick={() => handleSuspend(user.id, user.status)} 
                            style={{ background: 'none', border: 'none', color: user.status === 'ACTIVE' ? '#b10035' : '#10b981', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem' }}
                          >
                            {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View User Modal */}
      {selectedViewUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800' }}>{selectedViewUser.name}</h2>
              <span style={{ 
                padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700',
                background: selectedViewUser.status === 'ACTIVE' ? '#ecfdf5' : '#fef2f2',
                color: selectedViewUser.status === 'ACTIVE' ? '#10b981' : '#b10035'
              }}>
                {selectedViewUser.status}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: '#4b5563', fontSize: '0.95rem' }}>
              <div><strong style={{ color: '#111827' }}>User ID:</strong> {selectedViewUser.id}</div>
              <div><strong style={{ color: '#111827' }}>Email:</strong> {selectedViewUser.email}</div>
              <div><strong style={{ color: '#111827' }}>Role:</strong> {selectedViewUser.role.replace('_', ' ')}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setSelectedViewUser(null)} style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {selectedEditUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '800' }}>Edit User</h2>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Name</label>
                <input required type="text" value={selectedEditUser.name} onChange={e => setSelectedEditUser({...selectedEditUser, name: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Email</label>
                <input required type="email" value={selectedEditUser.email} onChange={e => setSelectedEditUser({...selectedEditUser, email: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Role</label>
                <select value={selectedEditUser.role} onChange={e => setSelectedEditUser({...selectedEditUser, role: e.target.value})} style={{...inputStyle, background: 'white'}}>
                  <option value="STUDENT">Student</option>
                  <option value="OUTLET_STAFF">Outlet Staff</option>
                  <option value="OUTLET_ADMIN">Outlet Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setSelectedEditUser(null)} style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 20px', background: '#b10035', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </AdminLayout>
  );
};

// Extracted styles
const cardStyle = {
  background: 'white',
  borderRadius: '16px',
  border: '1px solid #e5e7eb',
  padding: '24px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
};

const thStyle = {
  padding: '16px 24px',
  fontWeight: '600',
  color: '#4b5563',
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '0.95rem',
  color: '#111827'
};

export default Users;
