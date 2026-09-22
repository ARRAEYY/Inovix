import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import api from '../../services/api/client';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount);
};

const Menu = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterOutlet, setFilterOutlet] = useState('All');
  const [filterAvailability, setFilterAvailability] = useState('All');
  const [search, setSearch] = useState('');
  
  const [selectedEditItem, setSelectedEditItem] = useState(null);

  const fetchData = async () => {
    try {
      const [menuRes, outletsRes] = await Promise.all([
        api.get('/admin/menu'),
        api.get('/admin/outlets')
      ]);
      
      setMenuItems(menuRes.data.data);
      setOutlets(outletsRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load menu data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleAvailability = async (itemId, currentAvailability) => {
    if (window.confirm(`Are you sure you want to mark this item as ${currentAvailability ? 'unavailable' : 'available'}?`)) {
      try {
        await api.patch(`/admin/menu/${itemId}/status`, { isAvailable: !currentAvailability });
        setMenuItems(menuItems.map(m => m.id === itemId ? { ...m, isAvailable: !currentAvailability } : m));
      } catch (err) {
        alert('Failed to update menu item');
      }
    }
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    setMenuItems(menuItems.map(m => m.id === selectedEditItem.id ? selectedEditItem : m));
    setSelectedEditItem(null);
  };

  const getOutletName = (id) => outlets.find(o => o.id === id)?.name || 'Unknown Outlet';

  const filteredMenu = menuItems.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) || 
                          m.category.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filterOutlet !== 'All' && m.outletId !== filterOutlet) return false;
    
    if (filterAvailability === 'Available' && !m.isAvailable) return false;
    if (filterAvailability === 'Unavailable' && m.isAvailable) return false;
    
    return true;
  });

  if (loading) return <AdminLayout><p style={{ padding: '24px' }}>Loading menu items...</p></AdminLayout>;
  if (error) return <AdminLayout><div className="error-message" style={{ margin: '24px' }}>{error}</div></AdminLayout>;

  return (
    <AdminLayout>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
              Menu Management
            </h1>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem' }}>
              Manage menu items across all outlets.
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

              <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', padding: '4px', borderRadius: '8px' }}>
                {['All', 'Available', 'Unavailable'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterAvailability(f)}
                    style={{
                      padding: '6px 12px',
                      border: 'none',
                      background: filterAvailability === f ? 'white' : 'transparent',
                      color: filterAvailability === f ? '#111827' : '#6b7280',
                      borderRadius: '6px',
                      fontWeight: '600',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      boxShadow: filterAvailability === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            
            <input 
              type="text" 
              placeholder="Search items or categories..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px', width: '250px', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={thStyle}>Item</th>
                  <th style={thStyle}>Outlet</th>
                  <th style={thStyle}>Category</th>
                  <th style={thStyle}>Price</th>
                  <th style={thStyle}>Availability</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMenu.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: idx !== filteredMenu.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={item.image} alt={item.name} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontWeight: '700', color: '#111827' }}>{item.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                            {item.vegetarian ? '🟩 Veg' : '🟥 Non-Veg'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', color: '#374151' }}>{getOutletName(item.outletId)}</td>
                    <td style={{ padding: '16px 24px', color: '#4b5563' }}>{item.category}</td>
                    <td style={{ padding: '16px 24px', color: '#111827', fontWeight: '500' }}>{formatCurrency(item.price)}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        background: item.isAvailable ? '#ecfdf5' : '#fef2f2',
                        color: item.isAvailable ? '#10b981' : '#b10035'
                      }}>
                        {item.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => setSelectedEditItem(item)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem' }}>Edit</button>
                        <button 
                          onClick={() => handleToggleAvailability(item.id, item.isAvailable)} 
                          style={{ background: 'none', border: 'none', color: item.isAvailable ? '#b10035' : '#10b981', fontWeight: '500', cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                          {item.isAvailable ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Menu Item Modal */}
      {selectedEditItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '16px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', fontWeight: '800' }}>Edit Menu Item</h2>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Item Name</label>
                <input required type="text" value={selectedEditItem.name} onChange={e => setSelectedEditItem({...selectedEditItem, name: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Category</label>
                <input required type="text" value={selectedEditItem.category} onChange={e => setSelectedEditItem({...selectedEditItem, category: e.target.value})} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Price (₹)</label>
                  <input required type="number" min="0" value={selectedEditItem.price} onChange={e => setSelectedEditItem({...selectedEditItem, price: parseFloat(e.target.value)})} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Outlet ID</label>
                  <input required type="text" value={selectedEditItem.outletId} disabled style={{...inputStyle, background: '#f3f4f6', cursor: 'not-allowed'}} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem', color: '#374151' }}>Description</label>
                <textarea value={selectedEditItem.description || ''} onChange={e => setSelectedEditItem({...selectedEditItem, description: e.target.value})} style={{...inputStyle, minHeight: '80px', resize: 'vertical'}} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setSelectedEditItem(null)} style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>Cancel</button>
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

export default Menu;
