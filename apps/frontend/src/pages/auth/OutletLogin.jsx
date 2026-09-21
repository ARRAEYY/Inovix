import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const OutletLogin = () => {
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
      if (user.role?.startsWith('OUTLET')) navigate('/outlet');
      else if (user.role === 'SUPER_ADMIN') navigate('/admin');
      else if (user.role === 'STUDENT') navigate('/student');
      else navigate('/');
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Login failed');
    }
  };

  const handleGoogle = () => {
    alert('Google login requires GOOGLE_CLIENT_ID to be configured. Use dev-login below for local testing.');
  };

  return (
    <div className="flex min-h-screen w-full max-w-[1300px] mx-auto">
      <div className="flex-[1.3] px-8 pl-16 py-12 flex flex-col justify-center">
        <div className="flex items-center gap-3 absolute top-14 left-16">
          <span className="font-extrabold text-[1.35rem] text-[#0F172A] tracking-tight">nosh</span>
        </div>
        <div className="mt-8">
          <h1 className="text-[5.5rem] font-extrabold leading-[1.05] mb-6 text-[#0F172A] tracking-tight">
            Grow your business.<br />
            <span className="text-[#EA580C]">Zero hassle.</span>
          </h1>
          <p className="text-[1.35rem] text-[#475569] leading-relaxed max-w-[480px] font-medium">
            Manage your campus outlet, process orders,<br />
            and track your revenue easily.
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-end px-8 pr-16 py-8">
        <div className="bg-white rounded-2xl border border-[#FCEAE1] p-12 w-full max-w-[440px]">
          <p className="text-xs font-bold tracking-widest text-[#94A3B8] uppercase mb-4">Outlet Login</p>
          <h2 className="text-[2rem] font-bold leading-tight mb-9 text-[#0F172A] tracking-tight">Welcome, Partner</h2>
          <form className="flex flex-col gap-5" onSubmit={handleLogin}>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-semibold text-[#0F172A]">Work email</label>
              <input type="email" id="email" placeholder="manager@outlet.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required 
                className="px-5 py-3.5 border border-[#FED7AA] rounded-xl text-base outline-none transition-colors text-[#0F172A] bg-white placeholder:text-[#94A3B8] placeholder:font-normal focus:border-[#EA580C]" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-semibold text-[#0F172A]">Password</label>
              <input type="password" id="password" placeholder="Your password" value={password}
                onChange={(e) => setPassword(e.target.value)} required 
                className="px-5 py-3.5 border border-[#FED7AA] rounded-xl text-base outline-none transition-colors text-[#0F172A] bg-white placeholder:text-[#94A3B8] placeholder:font-normal focus:border-[#EA580C]" />
              <div className="flex justify-end mt-1">
                <a href="#" className="text-sm font-semibold text-[#EA580C] no-underline">Forgot password?</a>
              </div>
            </div>
            {error && <p className="text-[#EA580C] text-[0.85rem] font-medium mt-1">{error}</p>}
            <button type="submit" className="mt-4 bg-[#EA580C] text-white border-none rounded-xl px-5 py-4 text-base font-semibold cursor-pointer flex items-center justify-center gap-2 transition-colors w-full hover:bg-[#C2410C]">
              Sign in <span>→</span>
            </button>
          </form>
          <div className="flex items-center text-center my-7 before:content-[''] before:flex-1 before:border-b before:border-[#FCEAE1] after:content-[''] after:flex-1 after:border-b after:border-[#FCEAE1]">
            <span className="px-4 text-[#94A3B8] text-[0.85rem]">or</span>
          </div>
          <button type="button" className="w-full bg-white border border-[#FCEAE1] rounded-xl px-5 py-4 text-base font-semibold text-[#0F172A] cursor-pointer flex items-center justify-center gap-3 transition-colors hover:bg-gray-50" onClick={handleGoogle}>
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default OutletLogin;
