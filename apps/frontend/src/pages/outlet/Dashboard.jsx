import React from 'react';
import { useAuth } from '../../hooks/useAuth';

const Dashboard = () => {
  const { user, logout } = useAuth();
  
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Outlet Dashboard</h1>
      <p>Welcome back, {user?.name}</p>
      <button onClick={logout} style={{ padding: '0.5rem 1rem', marginTop: '1rem', cursor: 'pointer' }}>
        Logout
      </button>
    </div>
  );
};

export default Dashboard;
