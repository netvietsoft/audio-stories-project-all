import * as crypto from 'crypto';

export const v4 = () => crypto.randomUUID();
export const v1 = () => crypto.randomUUID();
export const v3 = () => crypto.randomUUID();
export const v5 = () => crypto.randomUUID();

export default { v4, v1, v3, v5 };
