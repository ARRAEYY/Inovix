import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { AuroraBackground } from '../../components/ui/AuroraBackground';
import { GradientText } from '../../components/ui/GradientText';

const StudentLogin = () => {
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
      if (user.role === 'STUDENT') navigate('/student');
      else if (user.role === 'SUPER_ADMIN') navigate('/admin');
      else if (user.role?.startsWith('OUTLET')) navigate('/outlet');
      else navigate('/');
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Login failed');
    }
  };

  const handleGoogle = () => {
    alert('Google login requires GOOGLE_CLIENT_ID to be configured. Use dev-login below for local testing.');
  };

  return (
    <AuroraBackground intense className="min-h-screen w-full">
      <div className="flex min-h-screen w-full max-w-[1300px] mx-auto">
        {/* Left hero */}
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
              Good food.<br />
              <GradientText>Zero waiting.</GradientText>
            </h1>
            <p className="text-[1.35rem] text-muted-foreground leading-relaxed max-w-[480px] font-medium">
              Order from your favorite campus outlets
              <br />
              and pick it up when it's ready
            </p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-12 flex items-center gap-6 text-sm text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span>4 outlets open now</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>Pickup in 15 min avg</span>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Right login card */}
        <div className="flex-1 flex items-center justify-end px-8 pr-16 py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl p-12 w-full max-w-[440px] shadow-2xl shadow-primary/10"
          >
            <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-4">Student Login</p>
            <h2 className="text-[2rem] font-bold leading-tight mb-9 text-foreground tracking-tight">Welcome</h2>

            <form className="flex flex-col gap-5" onSubmit={handleLogin}>
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm font-semibold text-foreground">College email</label>
                <input
                  type="email"
                  id="email"
                  placeholder="you@campus.edu"
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
                  required
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

            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleGoogle}
              className="w-full bg-card border border-border text-foreground font-semibold rounded-xl px-5 py-3.5 text-base cursor-pointer flex items-center justify-center gap-3 hover:bg-muted transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </motion.button>
          </motion.div>
        </div>
      </div>
    </AuroraBackground>
  );
};

export default StudentLogin;
