import { ForbiddenException } from '@nestjs/common';
import { assertManager } from '../common/roles';
import type { AuthUserPayload } from '../common/types/auth-user';

/** Mirrors AgentsService.update gate for aiRuntimeMode changes. */
function assertCanChangeAiRuntimeMode(user: AuthUserPayload): void {
  assertManager(
    user,
    'Solo el dueño o un administrador puede cambiar el motor de inteligencia.',
  );
}

describe('aiRuntimeMode authorization', () => {
  const base = {
    sub: 'user-1',
    tenantId: 'tenant-1',
    email: 'ops@example.test',
  };

  it('allows OWNER and ADMIN to change the motor', () => {
    expect(() =>
      assertCanChangeAiRuntimeMode({ ...base, membershipRole: 'OWNER' }),
    ).not.toThrow();
    expect(() =>
      assertCanChangeAiRuntimeMode({ ...base, membershipRole: 'ADMIN' }),
    ).not.toThrow();
  });

  it('forbids AGENT from changing the motor', () => {
    expect(() =>
      assertCanChangeAiRuntimeMode({ ...base, membershipRole: 'AGENT' }),
    ).toThrow(ForbiddenException);
  });
});
