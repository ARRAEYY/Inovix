/**
 * Student profile — account + onboarding info display.
 * Read-only in V1; pulls from the auth store's user snapshot.
 */

'use client';

import {
  AtSign,
  Calendar,
  CreditCard,
  GraduationCap,
  Hash,
  IdCard,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/lib/nosh/store';
import { formatDateTime } from '@/lib/nosh/format';

export function StudentProfile() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  const profile = user.studentProfile ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserRound className="size-4 text-orange-500" /> Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldRow
          icon={<AtSign className="size-4" />}
          label="Email"
          value={user.email}
        />
        <FieldRow
          icon={<UserRound className="size-4" />}
          label="Name"
          value={user.name ?? '—'}
        />
        <FieldRow
          icon={<ShieldCheck className="size-4" />}
          label="Role"
          value={<Badge variant="secondary">{user.role}</Badge>}
        />
        <FieldRow
          icon={<ShieldCheck className="size-4" />}
          label="Status"
          value={<Badge variant="outline">{user.status}</Badge>}
        />
        <FieldRow
          icon={<Calendar className="size-4" />}
          label="Onboarding completed"
          value={user.onboardingCompleted ? 'Yes' : 'No'}
        />
        <FieldRow
          icon={<Calendar className="size-4" />}
          label="Joined"
          value={formatDateTime(user.createdAt)}
        />
        {user.lastLoginAt && (
          <FieldRow
            icon={<Calendar className="size-4" />}
            label="Last sign-in"
            value={formatDateTime(user.lastLoginAt)}
          />
        )}

        {profile ? (
          <>
            <Separator className="my-2" />
            <CardTitle className="text-base flex items-center gap-2 mb-2">
              <IdCard className="size-4 text-orange-500" /> Student profile
            </CardTitle>
            <FieldRow
              icon={<UserRound className="size-4" />}
              label="Full name"
              value={profile.fullName}
            />
            <FieldRow
              icon={<Phone className="size-4" />}
              label="Phone"
              value={profile.phone}
            />
            <FieldRow
              icon={<GraduationCap className="size-4" />}
              label="Course"
              value={profile.course}
            />
            <FieldRow
              icon={<GraduationCap className="size-4" />}
              label="Year"
              value={profile.year}
            />
            <FieldRow
              icon={<Hash className="size-4" />}
              label="College ID"
              value={<span className="font-mono">{profile.collegeId}</span>}
            />
            {profile.submittedAt && (
              <FieldRow
                icon={<Calendar className="size-4" />}
                label="Profile submitted"
                value={formatDateTime(profile.submittedAt)}
              />
            )}
          </>
        ) : (
          <>
            <Separator className="my-2" />
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <CreditCard className="size-4" /> Student profile not yet submitted.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FieldRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-all">{value}</span>
    </div>
  );
}
