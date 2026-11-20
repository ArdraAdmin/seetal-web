"use client";

import { AttendanceBoard } from "@/components/AttendanceBoard";

export default function ShmpAttendancePage() {
  return (
    <AttendanceBoard
      scope="shmp"
      includeWorkers
      includePortalSupervisors
      hrBasePath="/shmp/hr"
      biometricHref="/shmp/biometric"
    />
  );
}
