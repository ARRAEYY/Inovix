import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// Auth Pages
import StudentLogin from '../pages/auth/StudentLogin';
import StudentSignUp from '../pages/auth/StudentSignUp';
import ForgotPassword from '../pages/auth/ForgotPassword';
import OutletLogin from '../pages/auth/OutletLogin';
import AdminLogin from '../pages/auth/AdminLogin';

// Dashboards (Dummy)
import StudentHome from '../pages/student/Home';
import StudentOrders from '../pages/student/Orders';
import StudentProfile from '../pages/student/Profile';
import OutletMenu from '../pages/student/OutletMenu';
import OutletDashboard from '../pages/outlet/Dashboard';
import AdminDashboard from '../pages/admin/Dashboard';

// A simple PrivateRoute component to protect dashboard routes
const PrivateRoute = ({ children, allowedRolePrefix }) => {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  // Basic role check: if a specific role prefix is required
  if (allowedRolePrefix && user?.role && !user.role.startsWith(allowedRolePrefix)) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes - Auth */}
      <Route path="/" element={<StudentLogin />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/signup" element={<StudentSignUp />} />
      <Route path="/student/signup" element={<StudentSignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/student/forgot-password" element={<ForgotPassword />} />
      <Route path="/outlet/login" element={<OutletLogin />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Protected Routes - Student */}
      <Route 
        path="/student/*" 
        element={
          <PrivateRoute allowedRolePrefix="STUDENT">
            <Routes>
              <Route path="/" element={<StudentHome />} />
              <Route path="/orders" element={<StudentOrders />} />
              <Route path="/profile" element={<StudentProfile />} />
              <Route path="/outlet/:id" element={<OutletMenu />} />
            </Routes>
          </PrivateRoute>
        } 
      />

      {/* Protected Routes - Outlet */}
      <Route 
        path="/outlet/*" 
        element={
          <PrivateRoute allowedRolePrefix="OUTLET">
            <Routes>
              <Route path="/" element={<OutletDashboard />} />
            </Routes>
          </PrivateRoute>
        } 
      />

      {/* Protected Routes - Admin */}
      <Route 
        path="/admin/*" 
        element={
          <PrivateRoute allowedRolePrefix="SUPER_ADMIN">
            <Routes>
              <Route path="/" element={<AdminDashboard />} />
            </Routes>
          </PrivateRoute>
        } 
      />
    </Routes>
  );
};

export default AppRoutes;
