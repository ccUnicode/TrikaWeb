export function getOrCreateDeviceId() {
  const key = 'tw_device_id';
  let deviceId = localStorage.getItem(key);

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(key, deviceId);
  }

  return deviceId;
}