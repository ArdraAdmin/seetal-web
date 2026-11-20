import { redirect } from "next/navigation";

export default function AdminLeaveSettingsRedirectPage() {
  redirect("/admin/attendance");
}
