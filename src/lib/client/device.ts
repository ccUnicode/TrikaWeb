export const DEVICE_STORAGE_KEY = "tw_device_id";

export function ensureDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let current = window.localStorage.getItem(DEVICE_STORAGE_KEY);
  if (!current) {
    current = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_STORAGE_KEY, current);
  }
  return current;
}
