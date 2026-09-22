import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import MobileBottomNav from '../../components/layout/MobileBottomNav';
import { useAuth } from '../../hooks/useAuth';

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getInitials = (name) => {
    if (!name) return 'SO';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="page-wrapper bg-white">
      <Header title="Profile" showBack={false} />
      
      <main className="explore-container profile-container">
        <div className="profile-header-card">
          <div className="profile-avatar-large">
            {getInitials(user?.name)}
          </div>
          <div className="profile-info-details">
            <h2 className="profile-name">{user?.name || 'Student One'}</h2>
            <p className="profile-email">{user?.email || 'student@example.com'}</p>
          </div>
        </div>

        <div className="profile-menu-section">
          <ul className="profile-menu-list">
            <li>
              <button className="profile-menu-btn">
                <span>Account</span>
                <span className="arrow-icon">→</span>
              </button>
            </li>
            <li>
              <button className="profile-menu-btn">
                <span>Notifications</span>
                <span className="arrow-icon">→</span>
              </button>
            </li>
            <li>
              <button className="profile-menu-btn">
                <span>Settings</span>
                <span className="arrow-icon">→</span>
              </button>
            </li>
            <li>
              <button className="profile-menu-btn">
                <span>Help</span>
                <span className="arrow-icon">→</span>
              </button>
            </li>
            <li>
              <button className="profile-menu-btn text-danger" onClick={handleLogout}>
                <span>Logout</span>
                <span className="arrow-icon">→</span>
              </button>
            </li>
          </ul>
        </div>
      </main>
      
      <MobileBottomNav />
    </div>
  );
};

export default Profile;
