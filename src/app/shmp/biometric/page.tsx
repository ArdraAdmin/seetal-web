"use client";

import { BiometricDevicesPanel } from "@/components/BiometricDevicesPanel";

export default function ShmpBiometricPage() {
  return (
    <BiometricDevicesPanel portal="shmp" attendanceHref="/shmp/attendance" />
  );
}
