"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createSalesProfile,
  createdSalesProfileId,
  deleteUser,
  getCompanies,
  getProfile,
  getSalesPerformance,
  getSalesProfiles,
  setAdminSalesTarget,
  updateSalesProfile,
  type CompanyRecord,
} from "@/lib/api";
import { apiMessage } from "@/lib/approval";
import { useAuth } from "@/components/AuthProvider";
import {
  companyIds,
  dateInputValue,
  salesField,
  shmpCompanyId,
  stlCompanyId,
} from "@/lib/profiles";
import { parseReturnTo } from "@/lib/user-management";
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
  stlTarget: "",
  shmpTarget: "",
};

function parseTargetAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function SalesProfileForm({ profileId }: { profileId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const backHref = parseReturnTo(searchParams.get("returnTo")) || "/admin/profiles/sales";
  const { user } = useAuth();
  const { toast } = useToast();
  const creating = !profileId;
  const [title, setTitle] = useState(
    creating ? "Add sales profile" : "Edit sales profile",
  );
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [stlCompany, setStlCompany] = useState("");
  const [shmpCompany, setShmpCompany] = useState("");
  const [targetPeriod, setTargetPeriod] = useState<string | null>(null);
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
        let nextStl = stlCompanyId(companyList);
        let nextShmp = shmpCompanyId(companyList);

        if (!profileId) {
          setStlCompany(nextStl);
          setShmpCompany(nextShmp);
          setTargetPeriod(null);
          setForm(EMPTY);
          return;
        }

        const [userProfile, performance] = await Promise.all([
          getProfile("sales", profileId),
          getSalesPerformance(profileId).catch(() => null),
        ]);
        if (cancelled) return;

        if (performance?.stl?.companyId) {
          nextStl = String(performance.stl.companyId);
        }
        if (performance?.shmp?.companyId) {
          nextShmp = String(performance.shmp.companyId);
        }
        setStlCompany(nextStl);
        setShmpCompany(nextShmp);
        if (performance?.month && performance?.year) {
          setTargetPeriod(`${performance.month}/${performance.year}`);
        } else {
          setTargetPeriod(null);
        }

        const sales = salesField(userProfile);
        setTitle(String(userProfile.name || "Edit sales profile"));
        setForm({
          name: String(userProfile.name || ""),
          email: String(userProfile.email || ""),
          password: "",
          mobileNumber: String(userProfile.mobileNumber || ""),
          altMobileNumber: String(userProfile.altMobileNumber || ""),
          spouseName:
            String(sales.spouseName || "").trim() === "N/A"
              ? ""
              : String(sales.spouseName || ""),
          dob: dateInputValue(sales.dob),
          joiningDate: dateInputValue(sales.joiningDate),
          address: String(sales.address || ""),
          companyIds: companyIds(sales.company),
          stlTarget:
            performance?.stl?.targetSet && performance.stl.target != null
              ? String(performance.stl.target)
              : "",
          shmpTarget:
            performance?.shmp?.targetSet && performance.shmp.target != null
              ? String(performance.shmp.target)
              : "",
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

  async function saveTargets(salesId: string) {
    const stlAmount = parseTargetAmount(form.stlTarget);
    const shmpAmount = parseTargetAmount(form.shmpTarget);
    const jobs: Promise<unknown>[] = [];

    if (stlAmount != null) {
      if (!stlCompany) {
        throw new Error("STL company was not found; cannot set STL target");
      }
      jobs.push(
        setAdminSalesTarget({
          salesId,
          companyId: stlCompany,
          amount: stlAmount,
          userId: user?.id,
        }),
      );
    }

    if (shmpAmount != null) {
      if (!shmpCompany) {
        throw new Error("SHMP company was not found; cannot set SHMP target");
      }
      jobs.push(
        setAdminSalesTarget({
          salesId,
          companyId: shmpCompany,
          amount: shmpAmount,
          userId: user?.id,
        }),
      );
    }

    if (jobs.length > 0) await Promise.all(jobs);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (creating && !form.password.trim()) {
      toast("Password is required", "info");
      return;
    }
    if (form.stlTarget.trim() && parseTargetAmount(form.stlTarget) == null) {
      toast("STL target must be a non-negative number", "info");
      return;
    }
    if (form.shmpTarget.trim() && parseTargetAmount(form.shmpTarget) == null) {
      toast("SHMP target must be a non-negative number", "info");
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
        let salesId = createdSalesProfileId(result);
        if (!salesId) {
          const email = form.email.trim().toLowerCase();
          const profiles = await getSalesProfiles();
          const match = profiles.find(
            (row) => String(row.email || "").trim().toLowerCase() === email,
          );
          salesId = match?._id ? String(match._id) : "";
        }
        if (
          (form.stlTarget.trim() || form.shmpTarget.trim()) &&
          !salesId
        ) {
          throw new Error(
            "Sales profile was created but the new user id was not found. Targets were not saved.",
          );
        }
        if (salesId) await saveTargets(salesId);
        toast(
          apiMessage(result, "Sales profile created. Credentials were emailed."),
          "success",
        );
      } else if (profileId) {
        await updateSalesProfile(profileId, payload);
        await saveTargets(profileId);
        toast("Sales profile updated", "success");
      }
      router.push(backHref);
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
      router.push(backHref);
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
            ? "Create a salesperson login and set monthly sales targets. Credentials are emailed after save."
            : "Update contact details, inventory companies, monthly targets, and password if needed."
        }
        actions={
          <Link
            href={backHref}
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
            <div className="sm:col-span-2">
              <FieldLabel
                label={
                  targetPeriod
                    ? `Sales targets (${targetPeriod})`
                    : "Sales targets (current month)"
                }
                optional
              />
              <p className="mt-1 text-xs text-slate-500">
                Leave blank to skip. Enter an amount to set or update the target
                for this month.
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <TextField
                  label="STL target (AED)"
                  type="number"
                  optional
                  min="0"
                  step="0.01"
                  value={form.stlTarget}
                  onChange={(e) =>
                    setForm({ ...form, stlTarget: e.target.value })
                  }
                  placeholder="Not set"
                />
                <TextField
                  label="SHMP target (AED)"
                  type="number"
                  optional
                  min="0"
                  step="0.01"
                  value={form.shmpTarget}
                  onChange={(e) =>
                    setForm({ ...form, shmpTarget: e.target.value })
                  }
                  placeholder="Not set"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <PrimaryButton type="submit" disabled={saving || deleting}>
                {saving ? "Saving…" : creating ? "Add profile" : "Save"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                disabled={saving || deleting}
                onClick={() => router.push(backHref)}
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
