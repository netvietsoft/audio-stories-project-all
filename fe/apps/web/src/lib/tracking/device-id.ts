const DEVICE_STORAGE_KEY = 'wta_device_id';

const randomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const rand = Math.random().toString(36).slice(2, 12);
  return `wta-${Date.now()}-${rand}`;
};

export const getOrCreateDeviceId = () => {
  if (typeof window === 'undefined') return null;

  const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY);
  if (existing) return existing;

  const next = randomId();
  window.localStorage.setItem(DEVICE_STORAGE_KEY, next);
  return next;
};
