import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../services/api/client';

const Outlets = () => {
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  
  // Add Outlet Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedViewOutlet, setSelectedViewOutlet] = useState(null);
  const [selectedEditOutlet, setSelectedEditOutlet] = useState(null);
  const [newOutlet, setNewOutlet] = useState({
    name: '',
    description: '',
    location: '',
    contactEmail: '',
    contactNumber: '',
    status: 'OPEN'
  });

  const fetchOutlets = async () => {
    try {
      const response = await api.get('/admin/outlets');
      setOutlets(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load outlets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutlets();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/admin/outlets', newOutlet);
      setOutlets([...outlets, { ...response.data.data, ordersToday: 0, staffCount: 0 }]);
      setShowAddModal(false);
      setNewOutlet({ name: '', description: '', location: '', contactEmail: '', contactNumber: '', status: 'OPEN' });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add outlet');
    }
  };

  const handleSuspend = async (outletId) => {
    if (window.confirm('Are you sure you want to suspend this outlet? This will immediately stop new orders.')) {
      try {
        await api.patch(`/admin/outlets/${outletId}/status`, { status: 'CLOSED' });
        // Update local state
        setOutlets(outlets.map(o => o.id === outletId ? { ...o, status: 'CLOSED' } : o));
      } catch (err) {
        alert('Failed to suspend outlet');
      }
    }
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    // Simulate updating local state without a real endpoint
    setOutlets(outlets.map(o => o.id === selectedEditOutlet.id ? selectedEditOutlet : o));
    setSelectedEditOutlet(null);
  };

  const filteredOutlets = outlets.filter(o => {
    const matchesSearch = o.name.toLowerCase().includes(search.toLowerCase());
    if (filter === 'All') return matchesSearch;
    if (filter === 'Active') return matchesSearch && (o.status === 'OPEN' || o.status === 'BUSY');
    if (filter === 'Inactive') return matchesSearch && o.status === 'CLOSED';
    return matchesSearch;
  });

  if (loading) return <AdminLayout><p style={{ padding: '24px' }}>Loading outlets...</p></AdminLayout>;
  if (error) return <AdminLayout><div className="error-message" style={{ margin: '24px' }}>{error}</div></AdminLayout>;

  return (
    <AdminLayout>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
              Outlets
            </h1>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem' }}>
              Manage all Nosh outlets.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button 
              onClick={fetchOutlets}
              style={{ padding: '10px 20px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#374151', fontWeight: '500' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Refresh
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              style={{ padding: '10px 20px', background: '#b10035', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}
            >
              + Add Outlet
            </button>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', background: '#f3f4f6', padding: '4px', borderRadius: '8px' }}>
              {['All', 'Active', 'Inactive'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '6px 16px',
                    border: 'none',
                    background: filter === f ? 'white' : 'transparent',
                    color: filter === f ? '#111827' : '#6b7280',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            
            <input 
              type="text" 
              placeholder="Search outlets..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px', width: '250px', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={thStyle}>Outlet Name</th>
                  <th style={thStyle}>Outlet ID</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Staff</th>
                  <th style={thStyle}>Orders Today</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOutlets.map((outlet, idx) => (
                  <tr key={outlet.id} style={{ borderBottom: idx !== filteredOutlets.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <td style={{ padding: '16px 24px', fontWeight: '700', color: '#111827' }}>{outlet.name}</td>
                    <td style={{ padding: '16px 24px', color: '#6b7280', fontSize: '0.85rem' }}>{outlet.id}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        background: outlet.status === 'OPEN' ? '#ecfdf5' : outlet.status === 'BUSY' ? '#fffbeb' : '#fef2f2',
                        color: outlet.status === 'OPEN' ? '#10b981' : outlet.status === 'BUSY' ? '#f59e0b' : '#b10035'
                      }}>
                        {outlet.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', color: '#4b5563' }}>{outlet.staffCount}</td>
                    <td style={{ padding: '16px 24px', color: '#4b5563' }}>{outlet.ordersToday}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => setSelectedViewOutlet(outlet)} style={{ background: 'none', border: 'none', color: '#b10035', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem' }}>View</button>
                        <button onClick={() => setSelectedEditOutlet(outlet)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem' }}>Edit</button>
                        {outlet.status !== 'CLOSED' && (
                          <button onClick={() => handleSuspend(outlet.id)} style={{ background: 'none', border: 'none', color: '#b10035', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem' }}>Suspend</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Outlet Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '800' }}>Add New Outlet</h2>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Outlet Name</label>
                <input required type="text" value={newOutlet.name} onChange={e => setNewOutlet({...newOutlet, name: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Description</label>
                <input required type="text" value={newOutlet.description} onChange={e => setNewOutlet({...newOutlet, description: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Location</label>
                <input required type="text" value={newOutlet.location} onChange={e => setNewOutlet({...newOutlet, location: e.target.value})} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Contact Email</label>
                  <input required type="email" value={newOutlet.contactEmail} onChange={e => setNewOutlet({...newOutlet, contactEmail: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Contact Number</label>
                  <input required type="text" value={newOutlet.contactNumber} onChange={e => setNewOutlet({...newOutlet, contactNumber: e.target.value})} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Cancel</button>
                <button type="submit" style={{ padding: '10px 20px', background: '#b10035', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Create Outlet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Outlet Modal */}
      {selectedViewOutlet && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800' }}>{selectedViewOutlet.name}</h2>
              <span style={{ 
                padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700',
                background: selectedViewOutlet.status === 'OPEN' ? '#ecfdf5' : selectedViewOutlet.status === 'BUSY' ? '#fffbeb' : '#fef2f2',
                color: selectedViewOutlet.status === 'OPEN' ? '#10b981' : selectedViewOutlet.status === 'BUSY' ? '#f59e0b' : '#b10035'
              }}>
                {selectedViewOutlet.status}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: '#4b5563', fontSize: '0.95rem' }}>
              <div><strong style={{ color: '#111827' }}>Outlet ID:</strong> {selectedViewOutlet.id}</div>
              <div><strong style={{ color: '#111827' }}>Description:</strong> {selectedViewOutlet.description || 'No description provided'}</div>
              <div><strong style={{ color: '#111827' }}>Location:</strong> {selectedViewOutlet.location || 'N/A'}</div>
              <div><strong style={{ color: '#111827' }}>Contact Email:</strong> {selectedViewOutlet.contactEmail || 'N/A'}</div>
              <div><strong style={{ color: '#111827' }}>Contact Number:</strong> {selectedViewOutlet.contactNumber || 'N/A'}</div>
              <div style={{ display: 'flex', gap: '24px', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
                <div><strong style={{ color: '#111827' }}>Orders Today:</strong> {selectedViewOutlet.ordersToday || 0}</div>
                <div><strong style={{ color: '#111827' }}>Staff Count:</strong> {selectedViewOutlet.staffCount || 0}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setSelectedViewOutlet(null)} style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Outlet Modal */}
      {selectedEditOutlet && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '800' }}>Edit Outlet</h2>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Outlet Name</label>
                <input required type="text" value={selectedEditOutlet.name} onChange={e => setSelectedEditOutlet({...selectedEditOutlet, name: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Description</label>
                <input required type="text" value={selectedEditOutlet.description || ''} onChange={e => setSelectedEditOutlet({...selectedEditOutlet, description: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Location</label>
                <input required type="text" value={selectedEditOutlet.location || ''} onChange={e => setSelectedEditOutlet({...selectedEditOutlet, location: e.target.value})} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Contact Email</label>
                  <input required type="email" value={selectedEditOutlet.contactEmail || ''} onChange={e => setSelectedEditOutlet({...selectedEditOutlet, contactEmail: e.target.value})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Contact Number</label>
                  <input required type="text" value={selectedEditOutlet.contactNumber || ''} onChange={e => setSelectedEditOutlet({...selectedEditOutlet, contactNumber: e.target.value})} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setSelectedEditOutlet(null)} style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Cancel</button>
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
  fontSize: '0.95rem'
};

export default Outlets;
