import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../services/api/client';

const Staff = () => {
  const [users, setUsers] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [filterOutlet, setFilterOutlet] = useState('All');
  const [search, setSearch] = useState('');
  
  const [selectedViewStaff, setSelectedViewStaff] = useState(null);
  const [selectedEditStaff, setSelectedEditStaff] = useState(null);

  const fetchData = async () => {
    try {
      const [usersRes, outletsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/outlets')
      ]);
      
      setUsers(usersRes.data.data);
      setOutlets(outletsRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load staff data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEditSubmit = (e) => {
    e.preventDefault();
    setUsers(users.map(u => u.id === selectedEditStaff.id ? selectedEditStaff : u));
    setSelectedEditStaff(null);
  };

  const getOutletName = (id) => outlets.find(o => o.id === id)?.name || 'Unknown Outlet';

  // Filter only staff and outlet admins
  const staffMembers = users.filter(u => u.role === 'OUTLET_STAFF' || u.role === 'OUTLET_ADMIN');

  const filteredStaff = staffMembers.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || 
                          m.email.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filterOutlet !== 'All' && m.outletId !== filterOutlet) return false;
    
    return true;
  });

  if (loading) return <AdminLayout><p style={{ padding: '24px' }}>Loading staff...</p></AdminLayout>;
  if (error) return <AdminLayout><div className="error-message" style={{ margin: '24px' }}>{error}</div></AdminLayout>;

  return (
    <AdminLayout>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
              Staff Management
            </h1>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem' }}>
              Manage outlet staff and access.
            </p>
          </div>
          <button 
            onClick={fetchData}
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
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select 
                value={filterOutlet} 
                onChange={(e) => setFilterOutlet(e.target.value)}
                style={selectStyle}
              >
                <option value="All">All Outlets</option>
                {outlets.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            
            <input 
              type="text" 
              placeholder="Search staff by name or email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px', width: '250px', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={thStyle}>Staff Name</th>
                  <th style={thStyle}>Outlet</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staff, idx) => (
                  <tr key={staff.id} style={{ borderBottom: idx !== filteredStaff.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: '700', color: '#111827' }}>{staff.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{staff.email}</div>
                    </td>
                    <td style={{ padding: '16px 24px', color: '#374151' }}>{getOutletName(staff.outletId)}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        background: staff.role === 'OUTLET_ADMIN' ? '#e0e7ff' : '#e0f2fe',
                        color: staff.role === 'OUTLET_ADMIN' ? '#4338ca' : '#0369a1'
                      }}>
                        {staff.role === 'OUTLET_ADMIN' ? 'Outlet Admin' : 'Staff'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        color: staff.status === 'ACTIVE' ? '#10b981' : '#b10035'
                      }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: staff.status === 'ACTIVE' ? '#10b981' : '#b10035' }}></div>
                        {staff.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => setSelectedViewStaff(staff)} style={{ background: 'none', border: 'none', color: '#b10035', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem' }}>View</button>
                        <button onClick={() => setSelectedEditStaff(staff)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem' }}>Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      {/* View Staff Modal */}
      {selectedViewStaff && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800' }}>{selectedViewStaff.name}</h2>
              <span style={{ 
                padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700',
                background: selectedViewStaff.status === 'ACTIVE' ? '#ecfdf5' : '#fef2f2',
                color: selectedViewStaff.status === 'ACTIVE' ? '#10b981' : '#b10035'
              }}>
                {selectedViewStaff.status}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: '#4b5563', fontSize: '0.95rem' }}>
              <div><strong style={{ color: '#111827' }}>Staff ID:</strong> {selectedViewStaff.id}</div>
              <div><strong style={{ color: '#111827' }}>Email:</strong> {selectedViewStaff.email}</div>
              <div><strong style={{ color: '#111827' }}>Role:</strong> {selectedViewStaff.role.replace('_', ' ')}</div>
              <div><strong style={{ color: '#111827' }}>Outlet:</strong> {getOutletName(selectedViewStaff.outletId)}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setSelectedViewStaff(null)} style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {selectedEditStaff && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '800' }}>Edit Staff Member</h2>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Name</label>
                <input required type="text" value={selectedEditStaff.name} onChange={e => setSelectedEditStaff({...selectedEditStaff, name: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Email</label>
                <input required type="email" value={selectedEditStaff.email} onChange={e => setSelectedEditStaff({...selectedEditStaff, email: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Role</label>
                <select value={selectedEditStaff.role} onChange={e => setSelectedEditStaff({...selectedEditStaff, role: e.target.value})} style={{...inputStyle, background: 'white'}}>
                  <option value="OUTLET_STAFF">Outlet Staff</option>
                  <option value="OUTLET_ADMIN">Outlet Admin</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Assigned Outlet</label>
                <select value={selectedEditStaff.outletId} onChange={e => setSelectedEditStaff({...selectedEditStaff, outletId: e.target.value})} style={{...inputStyle, background: 'white'}}>
                  {outlets.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setSelectedEditStaff(null)} style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 20px', background: '#b10035', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      </div>
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

const selectStyle = {
  padding: '8px 32px 8px 16px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '0.9rem',
  background: 'white',
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23111827%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  backgroundSize: '10px auto'
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

export default Staff;
