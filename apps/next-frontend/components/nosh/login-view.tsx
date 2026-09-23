/**
 * Login screen — three role-based dev-login tabs.
 *
 * Student  → email-only (Google-only dev-login lets through without password)
 * Outlet   → email + password (NoshOutlet@123)
 * Admin    → email + password (NoshAdmin@123)
 *
 * Each tab prefills the documented dev credentials so the reviewer can log
 * in with one click. The "Sign in" button calls authApi.devLoginStudent
 * or authApi.devLoginStaff and stores the access token in memory via the
 * Zustand auth store.
 */

'use client';

import { useState } from 'react';
import { Loader2, LogIn, ShieldCheck, Store, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authApi, DEV_ACCOUNTS } from '@/lib/nosh/api';
import { useAuthStore } from '@/lib/nosh/store';

type Role = 'student' | 'outlet' | 'admin';

export function LoginView() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [role, setRole] = useState<Role>('student');
  const [email, setEmail] = useState(DEV_ACCOUNTS.student.email);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function selectRole(next: Role) {
    setRole(next);
    if (next === 'student') {
      setEmail(DEV_ACCOUNTS.student.email);
      setPassword('');
    } else if (next === 'outlet') {
      setEmail(DEV_ACCOUNTS.outletAdmin.email);
      setPassword(DEV_ACCOUNTS.outletAdmin.password);
    } else {
      setEmail(DEV_ACCOUNTS.superAdmin.email);
      setPassword(DEV_ACCOUNTS.superAdmin.password);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const data =
        role === 'student'
          ? await authApi.devLoginStudent(email.trim())
          : await authApi.devLoginStaff(email.trim(), password);
      setAuth(data.user, data.accessToken);
      toast.success(`Welcome, ${data.user.name ?? data.user.email}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-orange-950/20 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="size-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
            <Store className="size-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inovix</h1>
            <p className="text-sm text-muted-foreground">
              Campus food ordering, one tap away.
            </p>
          </div>
        </div>

        <Card className="border-border/60 shadow-xl shadow-orange-500/5">
          <CardHeader>
            <CardTitle className="text-xl">Sign in</CardTitle>
            <CardDescription>
              Pick a role to continue with dev-login. Credentials are pre-filled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={role} onValueChange={(v) => selectRole(v as Role)}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="student" className="gap-1.5">
                  <GraduationCap className="size-4" /> Student
                </TabsTrigger>
                <TabsTrigger value="outlet" className="gap-1.5">
                  <Store className="size-4" /> Outlet
                </TabsTrigger>
                <TabsTrigger value="admin" className="gap-1.5">
                  <ShieldCheck className="size-4" /> Admin
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                {(['student', 'outlet', 'admin'] as const).map((r) => (
                  <TabsContent key={r} value={r} className="space-y-4 m-0">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@campus.edu"
                        required
                      />
                    </div>
                    {r !== 'student' && (
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                        />
                      </div>
                    )}
                    {r === 'student' && (
                      <p className="text-xs text-muted-foreground">
                        Students sign in with Google in production. Dev-login accepts the
                        email above without a password.
                      </p>
                    )}
                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> Signing in…
                        </>
                      ) : (
                        <>
                          <LogIn className="size-4" /> Sign in as{' '}
                          {r === 'student' ? 'Student' : r === 'outlet' ? 'Outlet Admin' : 'Super Admin'}
                        </>
                      )}
                    </Button>
                  </TabsContent>
                ))}
              </form>
            </Tabs>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground justify-center">
            Backend on port 3001 · All requests via <code className="mx-1">?XTransformPort=3001</code>
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Dev accounts: <code>adil@rishihood.edu.in</code> ·{' '}
          <code>adilreyaz.outlet@nosh.local</code> ·{' '}
          <code>adilreyaz.admin@nosh.local</code>
        </p>
      </div>
    </div>
  );
}
