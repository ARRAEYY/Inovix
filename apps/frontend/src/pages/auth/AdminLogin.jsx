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
    <div className="flex min-h-screen w-full max-w-[1300px] mx-auto">
      <div className="flex-[1.3] px-8 pl-16 py-12 flex flex-col justify-center">
        <div className="flex items-center gap-3 absolute top-14 left-16">
          <span className="font-extrabold text-[1.35rem] text-[#0F172A] tracking-tight">nosh</span>
        </div>
        <div className="mt-8">
          <h1 className="text-[5.5rem] font-extrabold leading-[1.05] mb-6 text-[#0F172A] tracking-tight">
            Manage the platform.<br />
            <span className="text-[#EA580C]">Total control.</span>
          </h1>
          <p className="text-[1.35rem] text-[#475569] leading-relaxed max-w-[480px] font-medium">
            Oversee operations, users, and<br />
            outlets across the entire campus network.
          </p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-end px-8 pr-16 py-8">
        <div className="bg-white rounded-2xl border border-[#FCEAE1] p-12 w-full max-w-[440px]">
          <p className="text-xs font-bold tracking-widest text-[#94A3B8] uppercase mb-4">Admin Login</p>
          <h2 className="text-[2rem] font-bold leading-tight mb-9 text-[#0F172A] tracking-tight">Welcome, Admin</h2>
          <form className="flex flex-col gap-5" onSubmit={handleLogin}>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-semibold text-[#0F172A]">Admin email</label>
              <input type="email" id="email" placeholder="admin@nosh.com" value={email}
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
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
