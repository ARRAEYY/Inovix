import React, { useState, useEffect, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import OutletAdminLayout from '../../../components/layout/OutletAdminLayout';
import { getOrders } from '../../../services/outletAdminService';
import { toast } from 'react-hot-toast';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0
  }).format(amount || 0);
};

const getLocalDateString = (dateObj) => {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const OutletAdminHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Day filter states: 'ALL', 'TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'CUSTOM'
  const [dayFilter, setDayFilter] = useState('TODAY');
  const [customDate, setCustomDate] = useState(() => getLocalDateString(new Date()));
  
  // Status filter state
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected order for detail modal
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchHistoryOrders();
  }, []);

  const fetchHistoryOrders = async () => {
    try {
      setLoading(true);
      // Fetch up to 500 orders so full historical log is available for day filtering
      const res = await getOrders({ pageSize: 500 });
      setOrders(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch order history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper date calculations
  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateString(d);
  }, []);

  // Set day filter helper
  const handleSelectPreset = (preset) => {
    setDayFilter(preset);
    if (preset === 'TODAY') {
      setCustomDate(todayStr);
    } else if (preset === 'YESTERDAY') {
      setCustomDate(yesterdayStr);
    }
  };

  // Step one day back or forward when in a specific day view
  const handleShiftDay = (deltaDays) => {
    const base = new Date(customDate || todayStr);
    base.setDate(base.getDate() + deltaDays);
    const newDateStr = getLocalDateString(base);
    setCustomDate(newDateStr);
    if (newDateStr === todayStr) {
      setDayFilter('TODAY');
    } else if (newDateStr === yesterdayStr) {
      setDayFilter('YESTERDAY');
    } else {
      setDayFilter('CUSTOM');
    }
  };

  // Filter orders by day, status, and search
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const orderDate = new Date(order.createdAt);
      const orderDateStr = getLocalDateString(orderDate);

      // 1. Day filtering
      if (dayFilter === 'TODAY') {
        if (orderDateStr !== todayStr) return false;
      } else if (dayFilter === 'YESTERDAY') {
        if (orderDateStr !== yesterdayStr) return false;
      } else if (dayFilter === 'CUSTOM') {
        if (orderDateStr !== customDate) return false;
      } else if (dayFilter === 'LAST_7_DAYS') {
        const diffDays = (new Date() - orderDate) / (1000 * 60 * 60 * 24);
        if (diffDays > 7 || diffDays < 0) return false;
      }
      // 'ALL' passes all days

      // 2. Status filtering
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'COMPLETED' && order.status !== 'COMPLETED') return false;
        if (statusFilter === 'CANCELLED' && !['CANCELLED', 'REJECTED'].includes(order.status)) return false;
        if (statusFilter === 'READY' && order.status !== 'READY') return false;
        if (statusFilter === 'PREPARING' && !['PREPARING', 'ACCEPTED'].includes(order.status)) return false;
        if (statusFilter === 'NEW' && !['PENDING', 'NEW', 'PLACED'].includes(order.status)) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = (order.orderNumber || '').toLowerCase();
        const student = (order.studentName || order.student?.name || '').toLowerCase();
        const code = (order.pickupCode || '').toLowerCase();
        const itemsText = (order.items || []).map((i) => i.name).join(' ').toLowerCase();

        if (!num.includes(q) && !student.includes(q) && !code.includes(q) && !itemsText.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [orders, dayFilter, customDate, todayStr, yesterdayStr, statusFilter, searchQuery]);

  // Aggregate stats for the currently filtered view
  const summaryStats = useMemo(() => {
    let revenue = 0;
    let completed = 0;
    let cancelled = 0;

    filteredOrders.forEach((o) => {
      const total = Number(o.totalAmount || o.total || 0);
      if (o.status === 'COMPLETED') {
        revenue += total;
        completed++;
      } else if (['CANCELLED', 'REJECTED'].includes(o.status)) {
        cancelled++;
      }
    });

    const avgOrder = completed > 0 ? Math.round(revenue / completed) : 0;

    return {
      totalCount: filteredOrders.length,
      revenue,
      completed,
      cancelled,
      avgOrder
    };
  }, [filteredOrders]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      toast.error('No orders to export');
      return;
    }

    const headers = ['Order Number', 'Date', 'Time', 'Customer', 'Items Count', 'Status', 'Total (INR)', 'Pickup Code'];
    const rows = filteredOrders.map((o) => {
      const d = new Date(o.createdAt);
      return [
        `"${o.orderNumber || o.id}"`,
        `"${d.toLocaleDateString('en-IN')}"`,
        `"${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}"`,
        `"${o.studentName || o.student?.name || 'Student'}"`,
        (o.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0),
        `"${o.status}"`,
        Number(o.totalAmount || o.total || 0),
        `"${o.pickupCode || ''}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nosh-outlet-orders-${dayFilter.toLowerCase()}-${customDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported order history CSV');
  };

  return (
    <OutletAdminLayout>
      <div style={{ maxWidth: '1200px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
        
        {/* Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
              Order History
            </h1>
            <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem' }}>
              Complete record of all outlet orders filtered by day.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleExportCSV}
              style={{
                padding: '8px 16px',
                background: 'white',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#374151',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export CSV
            </button>

            <button
              onClick={fetchHistoryOrders}
              disabled={loading}
              style={{
                padding: '8px 16px',
                background: '#b10035',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
              >
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* View Switcher Tabs: Live Orders vs History */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', gap: '8px' }}>
          <NavLink
            to="/outlet/admin/orders"
            style={{
              padding: '10px 20px',
              fontWeight: '600',
              fontSize: '0.95rem',
              color: '#6b7280',
              textDecoration: 'none',
              borderBottom: '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Live Orders (Kanban)
          </NavLink>

          <NavLink
            to="/outlet/admin/history"
            style={{
              padding: '10px 20px',
              fontWeight: '700',
              fontSize: '0.95rem',
              color: '#b10035',
              textDecoration: 'none',
              borderBottom: '2px solid #b10035',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Order History
          </NavLink>
        </div>

        {/* Day Filter Section */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            
            {/* Quick Day Presets */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#374151', marginRight: '4px' }}>
                Filter Day:
              </span>
              {[
                { key: 'TODAY', label: 'Today' },
                { key: 'YESTERDAY', label: 'Yesterday' },
                { key: 'LAST_7_DAYS', label: 'Last 7 Days' },
                { key: 'ALL', label: 'All Days' },
              ].map((p) => {
                const isActive = dayFilter === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleSelectPreset(p.key)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      border: isActive ? '1px solid #b10035' : '1px solid #d1d5db',
                      background: isActive ? '#b10035' : 'white',
                      color: isActive ? 'white' : '#4b5563',
                      fontWeight: isActive ? '700' : '500',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Day Picker with Prev / Next Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => handleShiftDay(-1)}
                title="Previous Day"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#374151'
                }}
              >
                ‹
              </button>

              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setDayFilter('CUSTOM');
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: dayFilter === 'CUSTOM' ? '1px solid #b10035' : '1px solid #d1d5db',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: '#111827',
                  outline: 'none',
                  background: dayFilter === 'CUSTOM' ? '#fff5f5' : 'white'
                }}
              />

              <button
                type="button"
                onClick={() => handleShiftDay(1)}
                title="Next Day"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  background: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#374151'
                }}
              >
                ›
              </button>
            </div>
          </div>

          {/* Status & Search Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
            {/* Status Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { key: 'ALL', label: 'All Statuses' },
                { key: 'COMPLETED', label: 'Completed' },
                { key: 'READY', label: 'Ready' },
                { key: 'PREPARING', label: 'Preparing' },
                { key: 'NEW', label: 'New' },
                { key: 'CANCELLED', label: 'Cancelled' },
              ].map((s) => {
                const isActive = statusFilter === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStatusFilter(s.key)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: isActive ? '#f3f4f6' : 'transparent',
                      color: isActive ? '#111827' : '#6b7280',
                      fontWeight: isActive ? '700' : '500',
                      fontSize: '0.82rem',
                      cursor: 'pointer'
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '240px', flex: '1', maxWidth: '360px' }}>
              <input
                type="text"
                placeholder="Search order #, customer, item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>
        </div>

        {/* Stats Strip for Selected Period */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
          <div style={statMiniCardStyle}>
            <span style={statMiniLabelStyle}>Orders on day</span>
            <strong style={statMiniValueStyle}>{summaryStats.totalCount}</strong>
          </div>
          <div style={statMiniCardStyle}>
            <span style={statMiniLabelStyle}>Gross sales</span>
            <strong style={{ ...statMiniValueStyle, color: '#16a34a' }}>{formatCurrency(summaryStats.revenue)}</strong>
          </div>
          <div style={statMiniCardStyle}>
            <span style={statMiniLabelStyle}>Completed</span>
            <strong style={statMiniValueStyle}>{summaryStats.completed}</strong>
          </div>
          <div style={statMiniCardStyle}>
            <span style={statMiniLabelStyle}>Cancelled / Rejected</span>
            <strong style={{ ...statMiniValueStyle, color: summaryStats.cancelled > 0 ? '#b10035' : '#111827' }}>
              {summaryStats.cancelled}
            </strong>
          </div>
          <div style={statMiniCardStyle}>
            <span style={statMiniLabelStyle}>Avg order value</span>
            <strong style={statMiniValueStyle}>{formatCurrency(summaryStats.avgOrder)}</strong>
          </div>
        </div>

        {/* Orders Table */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#111827' }}>
              Orders ({filteredOrders.length})
            </h3>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              {dayFilter === 'ALL'
                ? 'All historical orders'
                : dayFilter === 'LAST_7_DAYS'
                ? 'Last 7 days'
                : `Day: ${new Date(customDate || todayStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              Loading order history...
            </div>
          ) : error ? (
            <div style={{ padding: '24px', margin: '20px', background: '#fef2f2', color: '#b10035', borderRadius: '8px' }}>
              {error}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto 12px auto', background: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', color: '#111827', fontWeight: '700' }}>
                No orders found for this day
              </h4>
              <p style={{ margin: '0 0 16px 0', color: '#6b7280', fontSize: '0.9rem' }}>
                Try selecting "All Days" or choosing another date with the date selector.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDayFilter('ALL');
                  setStatusFilter('ALL');
                  setSearchQuery('');
                }}
                style={{
                  padding: '8px 16px',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={thStyle}>Order</th>
                    <th style={thStyle}>Date & Time</th>
                    <th style={thStyle}>Customer</th>
                    <th style={thStyle}>Items</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Total</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order, idx) => {
                    const isCompleted = order.status === 'COMPLETED';
                    const isReady = order.status === 'READY';
                    const isCancelled = ['CANCELLED', 'REJECTED'].includes(order.status);
                    
                    const statusBg = isCompleted ? '#ecfdf5' : isReady ? '#eff6ff' : isCancelled ? '#fef2f2' : '#fffbeb';
                    const statusColor = isCompleted ? '#059669' : isReady ? '#2563eb' : isCancelled ? '#dc2626' : '#d97706';

                    const d = new Date(order.createdAt);
                    const timeFormatted = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                    const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                    const totalItems = (order.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);
                    const itemsSummary = (order.items || []).map(it => `${it.quantity || 1}x ${it.name}`).join(', ');

                    return (
                      <tr
                        key={order.id}
                        style={{
                          borderBottom: idx !== filteredOrders.length - 1 ? '1px solid #f3f4f6' : 'none',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                        onClick={() => setSelectedOrder(order)}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ fontWeight: '700', color: '#111827', fontSize: '0.95rem' }}>
                            #{order.orderNumber || order.id.slice(-8)}
                          </div>
                          {order.pickupCode && (
                            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600' }}>
                              Code: <strong style={{ color: '#111827' }}>{order.pickupCode}</strong>
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '16px 24px', color: '#374151', fontSize: '0.9rem' }}>
                          <div style={{ fontWeight: '600', color: '#111827' }}>{timeFormatted}</div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{dateFormatted}</div>
                        </td>

                        <td style={{ padding: '16px 24px', color: '#374151' }}>
                          <div style={{ fontWeight: '600', color: '#111827', fontSize: '0.9rem' }}>
                            {order.studentName || order.student?.name || 'Customer'}
                          </div>
                          {(order.studentPhone || order.student?.studentProfile?.phone) && (
                            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                              {order.studentPhone || order.student?.studentProfile?.phone}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '16px 24px', maxWidth: '240px' }}>
                          <div style={{ fontWeight: '600', color: '#111827', fontSize: '0.88rem' }}>
                            {totalItems} {totalItems === 1 ? 'item' : 'items'}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={itemsSummary}>
                            {itemsSummary || '—'}
                          </div>
                        </td>

                        <td style={{ padding: '16px 24px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 12px',
                              borderRadius: '16px',
                              fontSize: '0.8rem',
                              fontWeight: '700',
                              background: statusBg,
                              color: statusColor,
                              textTransform: 'capitalize'
                            }}
                          >
                            {order.status === 'PLACED' ? 'New' : order.status.toLowerCase()}
                          </span>
                        </td>

                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ fontWeight: '700', color: '#111827', fontSize: '0.95rem' }}>
                            {formatCurrency(order.totalAmount || order.total)}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: order.payment?.status === 'REFUNDED' ? '#d97706' : '#10b981', fontWeight: '600' }}>
                            {order.payment?.status || 'PAID'}
                          </div>
                        </td>

                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                            }}
                            style={{
                              padding: '6px 12px',
                              background: '#f3f4f6',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#374151',
                              fontWeight: '600',
                              fontSize: '0.82rem',
                              cursor: 'pointer'
                            }}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Order Details Modal */}
        {selectedOrder && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px'
            }}
            onClick={() => setSelectedOrder(null)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '16px',
                maxWidth: '560px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                padding: '28px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.3rem', fontWeight: '800', color: '#111827' }}>
                    Order #{selectedOrder.orderNumber || selectedOrder.id}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
                    Placed on {new Date(selectedOrder.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}
                >
                  ×
                </button>
              </div>

              {/* Status & Key Badges */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <span style={{ padding: '6px 14px', borderRadius: '16px', background: '#f3f4f6', color: '#111827', fontWeight: '700', fontSize: '0.85rem' }}>
                  Status: {selectedOrder.status}
                </span>
                {selectedOrder.pickupCode && (
                  <span style={{ padding: '6px 14px', borderRadius: '16px', background: '#fffbeb', color: '#b45309', fontWeight: '700', fontSize: '0.85rem' }}>
                    Pickup Code: {selectedOrder.pickupCode}
                  </span>
                )}
                <span style={{ padding: '6px 14px', borderRadius: '16px', background: '#f3f4f6', color: '#4b5563', fontWeight: '600', fontSize: '0.85rem' }}>
                  {selectedOrder.orderType || 'TAKEAWAY'}
                </span>
              </div>

              {/* Customer Details */}
              <div style={{ background: '#fafafa', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Customer Details
                </h4>
                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#111827' }}>
                  {selectedOrder.studentName || selectedOrder.student?.name || 'Customer'}
                </div>
                {selectedOrder.student?.email && (
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{selectedOrder.student.email}</div>
                )}
                {(selectedOrder.studentPhone || selectedOrder.student?.studentProfile?.phone) && (
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    Phone: {selectedOrder.studentPhone || selectedOrder.student?.studentProfile?.phone}
                  </div>
                )}
                {selectedOrder.notes && (
                  <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#b45309', background: '#fffbeb', padding: '8px 12px', borderRadius: '6px' }}>
                    Note: "{selectedOrder.notes}"
                  </div>
                )}
              </div>

              {/* Items List */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Ordered Items
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(selectedOrder.items || []).map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#111827', fontSize: '0.95rem' }}>
                          {item.quantity}x {item.name}
                        </div>
                        {item.price && (
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                            {formatCurrency(item.price)} each
                          </div>
                        )}
                      </div>
                      <div style={{ fontWeight: '700', color: '#111827', fontSize: '0.95rem' }}>
                        {formatCurrency((item.price || 0) * (item.quantity || 1))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bill Breakdown */}
              <div style={{ background: '#fafafa', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem', color: '#4b5563' }}>
                  <span>Subtotal</span>
                  <span>{formatCurrency(selectedOrder.subtotal || selectedOrder.totalAmount || selectedOrder.total)}</span>
                </div>
                {Number(selectedOrder.discount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem', color: '#16a34a' }}>
                    <span>Discount</span>
                    <span>-{formatCurrency(selectedOrder.discount)}</span>
                  </div>
                )}
                {Number(selectedOrder.platformFee || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem', color: '#4b5563' }}>
                    <span>Platform Fee</span>
                    <span>{formatCurrency(selectedOrder.platformFee)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e5e7eb', paddingTop: '8px', marginTop: '6px', fontSize: '1.05rem', fontWeight: '800', color: '#111827' }}>
                  <span>Total Amount</span>
                  <span>{formatCurrency(selectedOrder.totalAmount || selectedOrder.total)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#111827',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </OutletAdminLayout>
  );
};

// Styles
const thStyle = {
  padding: '16px 24px',
  fontWeight: '600',
  color: '#4b5563',
  fontSize: '0.85rem'
};

const statMiniCardStyle = {
  background: 'white',
  borderRadius: '12px',
  border: '1px solid #e5e7eb',
  padding: '16px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
};

const statMiniLabelStyle = {
  display: 'block',
  fontSize: '0.82rem',
  fontWeight: '600',
  color: '#6b7280',
  marginBottom: '4px'
};

const statMiniValueStyle = {
  fontSize: '1.4rem',
  fontWeight: '800',
  color: '#111827',
  letterSpacing: '-0.5px'
};

export default OutletAdminHistory;
