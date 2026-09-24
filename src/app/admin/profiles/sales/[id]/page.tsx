"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getCompanies,
  getProfile,
  updateSalesProfile,
  type CompanyRecord,
} from "@/lib/api";
import type { ProfileUser } from "@/lib/types";
import { companyIds, dateInputValue, salesField } from "@/lib/profiles";
import { useToast } from "@/components/Toast";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";

export default function EditSalesProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    mobileNumber: "",
    altMobileNumber: "",
    spouseName: "",
    dob: "",
    joiningDate: "",
    address: "",
    companyIds: [] as string[],
  });

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([getProfile("sales", params.id), getCompanies()])
      .then(([user, companyList]) => {
        if (cancelled) return;
        const sales = salesField(user);
        setProfile(user);
        setCompanies(companyList);
        setForm({
          name: String(user.name || ""),
          email: String(user.email || ""),
          password: "",
          mobileNumber: String(user.mobileNumber || ""),
          altMobileNumber: String(user.altMobileNumber || ""),
          spouseName: String(sales.spouseName || ""),
          dob: dateInputValue(sales.dob),
          joiningDate: dateInputValue(sales.joiningDate),
          address: String(sales.address || ""),
          companyIds: companyIds(sales.company),
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load profile");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  function toggleCompany(id: string) {
    setForm((current) => ({
      ...current,
      companyIds: current.companyIds.includes(id)
        ? current.companyIds.filter((item) => item !== id)
        : [...current.companyIds, id],
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!params.id) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        role: "Sales",
        name: form.name.trim(),
        email: form.email.trim(),
        mobileNumber: form.mobileNumber.trim(),
        altMobileNumber: form.altMobileNumber.trim(),
        spouseName: form.spouseName.trim(),
        dob: form.dob,
        joiningDate: form.joiningDate,
        address: form.address.trim(),
        company: form.companyIds,
        accessToInv: form.companyIds.length > 0,
      };
      if (form.password.trim()) payload.password = form.password.trim();
      await updateSalesProfile(params.id, payload);
      toast("Sales profile updated", "success");
      router.push("/admin/profiles/sales");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={profile?.name || "Edit sales profile"}
        subtitle="Update contact details, inventory companies, and password if needed."
        actions={
          <Link
            href="/admin/profiles/sales"
            className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
          >
            Back
          </Link>
        }
      />

      {loading ? (
        <LoadingState label="Loading profile…" />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <Card>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
            <TextField
              label="Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Leave blank to keep current password"
            />
            <TextField
              label="Mobile number"
              required
              value={form.mobileNumber}
              onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
            />
            <TextField
              label="Alternate mobile"
              value={form.altMobileNumber}
              onChange={(e) => setForm({ ...form, altMobileNumber: e.target.value })}
            />
            <TextField
              label="Spouse name"
              required
              value={form.spouseName}
              onChange={(e) => setForm({ ...form, spouseName: e.target.value })}
            />
            <TextField
              label="Date of birth"
              type="date"
              required
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />
            <TextField
              label="Joining date"
              type="date"
              required
              value={form.joiningDate}
              onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
            />
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-[13px] font-medium text-slate-700">Address</span>
              <textarea
                required
                rows={3}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </label>
            <div className="sm:col-span-2">
              <p className="text-[13px] font-medium text-slate-700">
                Inventory companies
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Leave none selected if this salesperson should not see inventory.
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {companies.map((company) => (
                  <label
                    key={company._id}
                    className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={form.companyIds.includes(company._id)}
                      onChange={() => toggleCompany(company._id)}
                    />
                    {company.name || company._id}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                disabled={saving}
                onClick={() => router.push("/admin/profiles/sales")}
              >
                Cancel
              </SecondaryButton>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
