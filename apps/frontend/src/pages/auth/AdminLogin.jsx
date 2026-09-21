import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await login(email, password);
      if (user.role === 'SUPER_ADMIN') navigate('/admin');
      else if (user.role?.startsWith('OUTLET')) navigate('/outlet');
      else if (user.role === 'STUDENT') navigate('/student');
      else navigate('/');
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Login failed');
    }
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="brand"><span className="brand-name">nosh</span></div>
        <div className="hero-content">
          <h1 className="hero-title">
            Manage the platform.<br />
            <span className="highlight"> Total control.</span>
          </h1>
          <p className="hero-description">
            Oversee operations, users, and<br />
            outlets across the entire campus network.
          </p>
        </div>
      </div>
      <div className="login-right">
        <div className="login-card">
          <p className="card-subheading">Admin Login</p>
          <h2 className="card-title">Welcome, Admin</h2>
          <form className="login-form" onSubmit={handleLogin}>
            <div className="input-group">
              <label htmlFor="email">Admin email</label>
              <input type="email" id="email" placeholder="admin@nosh.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input type="password" id="password" placeholder="Your password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
              <div className="forgot-password-container"><a href="#" className="forgot-password">Forgot password?</a></div>
            </div>
            {error && <p style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 500, marginTop: '0.25rem' }}>{error}</p>}
            <button type="submit" className="primary-btn">Sign in <span className="arrow">→</span></button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
