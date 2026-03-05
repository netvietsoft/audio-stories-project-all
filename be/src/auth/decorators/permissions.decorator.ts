import { SetMetadata } from '@nestjs/common';

export const PERMS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) => SetMetadata(PERMS_KEY, permissions);
