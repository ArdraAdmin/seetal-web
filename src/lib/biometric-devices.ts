export type BiometricPortal = "stl" | "shmp";

export type BiometricDeviceLike = {
  name?: string | null;
  devId?: string | null;
};

const ARDRA_DEVICE_NAME = "ardra-test-device";

function deviceNameKey(device: BiometricDeviceLike) {
  return String(device.name || "").trim().toLowerCase();
}

/** Seetal portal devices are named with "seetal". */
export function isSeetalBiometricDevice(device: BiometricDeviceLike) {
  return deviceNameKey(device).includes("seetal");
}

/** SHMP factory device (named with "shmp"). */
export function isShmpBiometricDevice(device: BiometricDeviceLike) {
  return deviceNameKey(device).includes("shmp");
}

/** Ardra device shown on the SHMP portal. */
export function isArdraBiometricDevice(device: BiometricDeviceLike) {
  return deviceNameKey(device) === ARDRA_DEVICE_NAME;
}

/** Devices visible on a portal biometric page. */
export function biometricDeviceVisibleOnPortal(
  device: BiometricDeviceLike,
  portal: BiometricPortal,
) {
  if (portal === "stl") return isSeetalBiometricDevice(device);
  return isShmpBiometricDevice(device) || isArdraBiometricDevice(device);
}

export function filterBiometricDevicesForPortal<T extends BiometricDeviceLike>(
  devices: T[],
  portal: BiometricPortal,
) {
  return (devices || []).filter((device) =>
    biometricDeviceVisibleOnPortal(device, portal),
  );
}
