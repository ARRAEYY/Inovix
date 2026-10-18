import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { orderService } from '../../services/api/orderService';

// Status labels & steps
const STATUS_CONFIG = {
  PENDING: {
    label: 'Order Placed',
    sublabel: 'Waiting for outlet to accept',
    tone: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    icon: '⏳',
    step: 1,
    percent: 25,
  },
  ACCEPTED: {
    label: 'Accepted',
    sublabel: 'Outlet confirmed your order',
    tone: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    icon: '✅',
    step: 2,
    percent: 50,
  },
  PREPARING: {
    label: 'Preparing',
    sublabel: 'Kitchen is preparing your food',
    tone: '#ea580c',
    bg: '#fff7ed',
    border: '#fed7aa',
    icon: '👨‍🍳',
    step: 3,
    percent: 75,
  },
  READY: {
    label: 'Ready for Pickup!',
    sublabel: 'Head to the counter to collect',
    tone: '#16a34a',
    bg: '#f0fdf4',
    border: '#86efac',
    icon: '🔔',
    step: 4,
    percent: 100,
  },
};

const STEPS = [
  { key: 'PENDING', label: 'Placed' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'READY', label: 'Ready' },
];

const parseOutletName = (order) => {
  try {
    const snap = JSON.parse(order.outletSnapshot || '{}');
    return snap.name || order.outlet?.name || 'Campus Outlet';
  } catch {
    return order.outlet?.name || 'Campus Outlet';
  }
};

const ActiveOrderBanner = () => {
  const navigate = useNavigate();
  const [activeOrders, setActiveOrders] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  const fetchActiveOrders = useCallback(async () => {
    try {
      const res = await orderService.getMyOrders();
      const allOrders = res.data || [];
      const active = allOrders.filter((o) =>
        ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status)
      );
      setActiveOrders(active);
    } catch (err) {
      // Silently fail if student has no orders or offline
    }
  }, []);

  useEffect(() => {
    fetchActiveOrders();

    // Listen to real-time socket events broadcast on window
    const handleOrderEvent = () => fetchActiveOrders();
    window.addEventListener('nosh:order-updated', handleOrderEvent);
    window.addEventListener('nosh:order-new', handleOrderEvent);
    window.addEventListener('nosh:notification', handleOrderEvent);

    // Poll every 12 seconds when there are active orders for real-time accuracy
    const interval = setInterval(fetchActiveOrders, 12000);

    return () => {
      window.removeEventListener('nosh:order-updated', handleOrderEvent);
      window.removeEventListener('nosh:order-new', handleOrderEvent);
      window.removeEventListener('nosh:notification', handleOrderEvent);
      clearInterval(interval);
    };
  }, [fetchActiveOrders]);

  if (!activeOrders.length) return null;

  const handleCopyCode = (e, code, orderId) => {
    e.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedId(orderId);
    toast.success(`Pickup code ${code} copied!`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <section
      aria-label="Active Orders"
      style={{
        marginBottom: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: '#16a34a',
              display: 'inline-block',
              boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.25)',
              animation: 'pulse 1.8s infinite',
            }}
          />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#111827' }}>
            Live Order Status {activeOrders.length > 1 && `(${activeOrders.length})`}
          </h2>
        </div>
        <button
          onClick={() => navigate('/student/orders')}
          style={{
            background: 'none',
            border: 'none',
            color: '#b10035',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          View all orders →
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {activeOrders.map((order) => {
          const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
          const outletName = parseOutletName(order);
          const isReady = order.status === 'READY';
          const itemsSummary = (order.items || [])
            .map((i) => `${i.quantity}× ${i.name}`)
            .join(', ');

          return (
            <div
              key={order.id}
              onClick={() => navigate('/student/orders')}
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: `1.5px solid ${isReady ? '#86efac' : '#e5e7eb'}`,
                boxShadow: isReady
                  ? '0 4px 20px rgba(22, 163, 74, 0.12)'
                  : '0 4px 14px rgba(0, 0, 0, 0.04)',
                padding: '1.25rem 1.4rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = isReady
                  ? '0 6px 24px rgba(22, 163, 74, 0.18)'
                  : '0 6px 20px rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = isReady
                  ? '0 4px 20px rgba(22, 163, 74, 0.12)'
                  : '0 4px 14px rgba(0, 0, 0, 0.04)';
              }}
            >
              {/* Top Accent Strip */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: isReady
                    ? 'linear-gradient(90deg, #16a34a, #4ade80)'
                    : `linear-gradient(90deg, ${config.tone}, #f59e0b)`,
                }}
              />

              {/* Main Content Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1.25rem',
                }}
              >
                {/* Left Side: Outlet, Order info & status */}
                <div style={{ flex: '1 1 280px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#111827' }}>
                      {outletName}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#6b7280',
                        background: '#f3f4f6',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                      }}
                    >
                      #{order.orderNumber}
                    </span>
                    {/* Status Badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.65rem',
                        borderRadius: '20px',
                        background: config.bg,
                        color: config.tone,
                        border: `1px solid ${config.border}`,
                      }}
                    >
                      <span>{config.icon}</span> {config.label}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: '0 0 0.75rem 0',
                      fontSize: '0.85rem',
                      color: '#4b5563',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: '480px',
                    }}
                  >
                    {itemsSummary}
                    {order.totalAmount && (
                      <span style={{ fontWeight: 700, color: '#111827', marginLeft: '0.5rem' }}>
                        • ₹{Math.round(Number(order.totalAmount))}
                      </span>
                    )}
                  </p>

                  {/* Visual Stepper */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', maxWidth: '380px' }}>
                    {STEPS.map((s, idx) => {
                      const isCompleted = idx < config.step;
                      const isCurrent = idx === config.step - 1;

                      return (
                        <React.Fragment key={s.key}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <span
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                background: isCompleted
                                  ? '#16a34a'
                                  : isCurrent
                                  ? config.tone
                                  : '#e5e7eb',
                                color: isCompleted || isCurrent ? '#ffffff' : '#9ca3af',
                                fontSize: '10px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {isCompleted ? '✓' : idx + 1}
                            </span>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: isCurrent ? 700 : 500,
                                color: isCurrent ? config.tone : isCompleted ? '#374151' : '#9ca3af',
                              }}
                            >
                              {s.label}
                            </span>
                          </div>
                          {idx < STEPS.length - 1 && (
                            <div
                              style={{
                                flex: 1,
                                height: '2px',
                                minWidth: '16px',
                                background: idx < config.step - 1 ? '#16a34a' : '#e5e7eb',
                              }}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Right Side: High-Visibility OTP / Pickup Code Box */}
                {order.pickupCode ? (
                  <div
                    onClick={(e) => handleCopyCode(e, order.pickupCode, order.id)}
                    title="Click to copy pickup code"
                    style={{
                      background: isReady ? '#f0fdf4' : '#faf5f6',
                      border: `1.5px dashed ${isReady ? '#22c55e' : '#b10035'}`,
                      borderRadius: '12px',
                      padding: '0.75rem 1.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '150px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isReady ? '#dcfce7' : '#f5e8eb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isReady ? '#f0fdf4' : '#faf5f6';
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        color: isReady ? '#15803d' : '#830027',
                        textTransform: 'uppercase',
                        marginBottom: '0.15rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <span>PICKUP OTP</span>
                      <span style={{ fontSize: '0.75rem' }}>📋</span>
                    </div>

                    <div
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: '1.6rem',
                        fontWeight: 900,
                        letterSpacing: '0.15em',
                        color: isReady ? '#166534' : '#b10035',
                        lineHeight: 1.1,
                      }}
                    >
                      {order.pickupCode}
                    </div>

                    <span
                      style={{
                        fontSize: '0.7rem',
                        color: copiedId === order.id ? '#16a34a' : '#6b7280',
                        fontWeight: copiedId === order.id ? 700 : 500,
                        marginTop: '0.2rem',
                      }}
                    >
                      {copiedId === order.id ? 'Copied to clipboard!' : 'Show at counter'}
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      background: '#f9fafb',
                      borderRadius: '10px',
                      padding: '0.65rem 1rem',
                      fontSize: '0.8rem',
                      color: '#6b7280',
                      textAlign: 'center',
                    }}
                  >
                    OTP ready upon confirmation
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ActiveOrderBanner;
