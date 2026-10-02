import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '1rem',
      background: '#faf5f6', padding: '2rem',
    }}>
      <h1 style={{ fontSize: '4rem', fontWeight: 900, color: '#b10035', margin: 0 }}>404</h1>
      <p style={{ fontSize: '1.1rem', color: '#374151' }}>This page doesn't exist.</p>
      <button
        onClick={() => navigate('/')}
        className="primary-btn"
        style={{ marginTop: '1rem', maxWidth: '200px' }}
      >
        Go to login
      </button>
    </div>
  );
};

export default NotFound;
