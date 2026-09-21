import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Shield } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { AuroraBackground } from '../../components/ui/AuroraBackground';
import { GradientText } from '../../components/ui/GradientText';

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
    <AuroraBackground intense className="min-h-screen w-full">
      <div className="flex min-h-screen w-full max-w-[1300px] mx-auto">
        <div className="flex-[1.3] px-8 pl-16 py-12 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="flex items-center gap-3 absolute top-14 left-16"
          >
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <span className="text-primary-foreground font-extrabold text-lg">n</span>
            </div>
            <span className="font-extrabold text-[1.35rem] text-foreground tracking-tight">nosh</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
            className="mt-8"
          >
            <h1 className="text-[5.5rem] font-extrabold leading-[1.05] mb-6 text-foreground tracking-tight">
              Manage the platform.<br />
              <GradientText>Total control.</GradientText>
            </h1>
            <p className="text-[1.35rem] text-muted-foreground leading-relaxed max-w-[480px] font-medium">
              Oversee operations, users, and<br />
              outlets across the entire campus network.
            </p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-12 flex items-center gap-3 text-sm text-muted-foreground"
            >
              <Shield className="w-4 h-4 text-accent" />
              <span>Encrypted at rest · Audit-logged operations</span>
            </motion.div>
          </motion.div>
        </div>

        <div className="flex-1 flex items-center justify-end px-8 pr-16 py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-12 w-full max-w-[440px] shadow-2xl shadow-primary/10"
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-accent" />
              <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Admin Login</p>
            </div>
            <h2 className="text-[2rem] font-bold leading-tight mb-9 text-foreground tracking-tight">Welcome, Admin</h2>

            <form className="flex flex-col gap-5" onSubmit={handleLogin}>
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm font-semibold text-foreground">Admin email</label>
                <input
                  type="email"
                  id="email"
                  placeholder="admin@nosh.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="px-5 py-3.5 border border-input rounded-xl text-base outline-none transition-all text-foreground bg-background/50 backdrop-blur placeholder:text-muted-foreground placeholder:font-normal focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="password" className="text-sm font-semibold text-foreground">Password</label>
                <input
                  type="password"
                  id="password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="px-5 py-3.5 border border-input rounded-xl text-base outline-none transition-all text-foreground bg-background/50 backdrop-blur placeholder:text-muted-foreground placeholder:font-normal focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
                <div className="flex justify-end mt-1">
                  <a href="#" className="text-sm font-semibold text-primary hover:text-primary-hover transition-colors no-underline">Forgot password?</a>
                </div>
              </div>
              {error && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-destructive text-sm font-medium px-4 py-2 bg-destructive/5 border border-destructive/20 rounded-lg"
                >
                  {error}
                </motion.p>
              )}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="mt-4 bg-primary text-primary-foreground border-none rounded-xl px-5 py-4 text-base font-semibold cursor-pointer flex items-center justify-center gap-2 transition-colors w-full hover:bg-primary-hover shadow-lg shadow-primary/30"
              >
                Sign in <ArrowRight className="w-4 h-4" />
              </motion.button>
            </form>
          </motion.div>
        </div>
      </div>
    </AuroraBackground>
  );
};

export default AdminLogin;
