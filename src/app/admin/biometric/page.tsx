"use client";

import { BiometricDevicesPanel } from "@/components/BiometricDevicesPanel";

export default function AdminBiometricPage() {
  return (
    <BiometricDevicesPanel portal="stl" attendanceHref="/admin/attendance" />
  );
}
