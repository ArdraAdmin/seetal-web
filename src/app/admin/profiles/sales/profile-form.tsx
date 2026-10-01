"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createSalesProfile,
  deleteUser,
  getCompanies,
  getProfile,
  updateSalesProfile,
  type CompanyRecord,
} from "@/lib/api";
import { apiMessage } from "@/lib/approval";
import { companyIds, dateInputValue, salesField } from "@/lib/profiles";
import { useToast } from "@/components/Toast";
import {
  Card,
  ErrorState,
  FieldLabel,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";

const EMPTY = {
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
};

export function SalesProfileForm({ profileId }: { profileId?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const creating = !profileId;
  const [title, setTitle] = useState(
    creating ? "Add sales profile" : "Edit sales profile",
  );
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const companyList = await getCompanies();
        if (cancelled) return;
        setCompanies(companyList);
        if (!profileId) {
          setForm(EMPTY);
          return;
        }
        const user = await getProfile("sales", profileId);
        if (cancelled) return;
        const sales = salesField(user);
        setTitle(String(user.name || "Edit sales profile"));
        setForm({
          name: String(user.name || ""),
          email: String(user.email || ""),
          password: "",
          mobileNumber: String(user.mobileNumber || ""),
          altMobileNumber: String(user.altMobileNumber || ""),
          spouseName:
            String(sales.spouseName || "").trim() === "N/A"
              ? ""
              : String(sales.spouseName || ""),
          dob: dateInputValue(sales.dob),
          joiningDate: dateInputValue(sales.joiningDate),
          address: String(sales.address || ""),
          companyIds: companyIds(sales.company),
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

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
    if (creating && !form.password.trim()) {
      toast("Password is required", "info");
      return;
    }
    setSaving(true);
    try {
      const company = form.companyIds;
      const payload: Record<string, unknown> = {
        role: "Sales",
        name: form.name.trim(),
        email: form.email.trim(),
        mobileNumber: form.mobileNumber.trim(),
        altMobileNumber: form.altMobileNumber.trim(),
        spouseName: form.spouseName.trim() || "N/A",
        dob: form.dob,
        joiningDate: form.joiningDate,
        address: form.address.trim(),
        company,
        accessToInv: true,
      };
      if (form.password.trim()) payload.password = form.password.trim();
      if (creating) {
        const result = await createSalesProfile(payload);
        toast(
          apiMessage(result, "Sales profile created. Credentials were emailed."),
          "success",
        );
      } else if (profileId) {
        await updateSalesProfile(profileId, payload);
        toast("Sales profile updated", "success");
      }
      router.push("/admin/profiles/sales");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!profileId) return;
    const label = form.name.trim() || form.email.trim() || "this profile";
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteUser(profileId);
      toast("Profile deleted", "success");
      router.push("/admin/profiles/sales");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={
          creating
            ? "Create a salesperson login. Credentials are emailed after save."
            : "Update contact details, inventory companies, and password if needed."
        }
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
        <LoadingState label="Loading…" />
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
              required={creating}
              optional={!creating}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={creating ? "" : "Leave blank to keep current password"}
            />
            <TextField
              label="Mobile number"
              required
              value={form.mobileNumber}
              onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
            />
            <TextField
              label="Alternate mobile"
              optional
              value={form.altMobileNumber}
              onChange={(e) => setForm({ ...form, altMobileNumber: e.target.value })}
            />
            <TextField
              label="Spouse name"
              optional
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
              <FieldLabel label="Address" required />
              <textarea
                required
                rows={3}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </label>
            <div className="sm:col-span-2">
              <FieldLabel label="Inventory companies" optional />
              <p className="mt-1 text-xs text-slate-500">
                If none are selected, this salesperson sees STL stock only.
                Selecting companies shows only those companies’ products.
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
              <PrimaryButton type="submit" disabled={saving || deleting}>
                {saving ? "Saving…" : creating ? "Add profile" : "Save"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                disabled={saving || deleting}
                onClick={() => router.push("/admin/profiles/sales")}
              >
                Cancel
              </SecondaryButton>
              {!creating ? (
                <SecondaryButton
                  type="button"
                  className="border-red-200 text-red-700"
                  disabled={saving || deleting}
                  onClick={() => void onDelete()}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </SecondaryButton>
              ) : null}
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
