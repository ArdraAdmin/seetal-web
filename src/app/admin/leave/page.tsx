import { redirect } from "next/navigation";

export default function AdminLeaveRedirectPage() {
  redirect("/admin/attendance");
}
