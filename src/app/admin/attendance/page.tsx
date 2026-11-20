"use client";

import { AttendanceBoard } from "@/components/AttendanceBoard";

export default function AdminAttendancePage() {
  return (
    <AttendanceBoard
      scope="stl"
      includeWorkers={false}
      includePortalSupervisors={false}
      hrBasePath="/admin/hr"
      biometricHref="/admin/biometric"
      subtitle="Seetal HR staff attendance. Leave, mark attendance, and fines are handled here."
    />
  );
}
