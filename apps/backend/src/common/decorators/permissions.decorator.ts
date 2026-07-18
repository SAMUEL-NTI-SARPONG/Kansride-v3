import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@kansride/auth';

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata('permissions', permissions);
