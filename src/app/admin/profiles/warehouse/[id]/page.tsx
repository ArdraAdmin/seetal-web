"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getMasterCategories,
  getProfile,
  updateWarehouseProfile,
} from "@/lib/api";
import type { ProfileUser } from "@/lib/types";
import { masterCategoryName, warehouseField } from "@/lib/profiles";
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

interface MasterCategory {
  masterCategoryId?: string;
  masterCategoryName?: string;
  name?: string;
}

export default function EditWarehouseProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [categories, setCategories] = useState<MasterCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    mobileNumber: "",
    altMobileNumber: "",
    isSuperManager: false,
    category: "",
    pinNumber: "",
  });

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      getProfile("warehouse", params.id),
      getMasterCategories(),
    ])
      .then(([user, cats]) => {
        if (cancelled) return;
        const list = Array.isArray(cats) ? (cats as MasterCategory[]) : [];
        const warehouse = warehouseField(user);
        setProfile(user);
        setCategories(list);
        setForm({
          name: String(user.name || ""),
          email: String(user.email || ""),
          password: "",
          mobileNumber: String(user.mobileNumber || ""),
          altMobileNumber: String(user.altMobileNumber || ""),
          isSuperManager: Boolean(warehouse.isSuperManager),
          category: masterCategoryName(list, warehouse.masterCategoryId),
          pinNumber:
            warehouse.pinNumber == null || warehouse.pinNumber === ""
              ? ""
              : String(warehouse.pinNumber),
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!params.id) return;
    if (!form.isSuperManager && !form.category) {
      toast("Select a category for this warehouse manager", "info");
      return;
    }
    if (form.isSuperManager && !form.pinNumber.trim()) {
      toast("Super managers need a PIN", "info");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        mobileNumber: form.mobileNumber.trim(),
        altMobileNumber: form.altMobileNumber.trim(),
        isSuperManager: form.isSuperManager ? "true" : "false",
      };
      if (form.password.trim()) payload.password = form.password.trim();
      if (form.isSuperManager) {
        payload.pinNumber = Number(form.pinNumber);
        payload.category = form.category || "Miscellaneous";
      } else {
        payload.category = form.category;
      }
      await updateWarehouseProfile(params.id, payload);
      toast("Warehouse profile updated", "success");
      router.push("/admin/profiles/warehouse");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={profile?.name || "Edit warehouse profile"}
        subtitle="Update contact details, category, super-manager access, and password if needed."
        actions={
          <Link
            href="/admin/profiles/warehouse"
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
            <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.isSuperManager}
                onChange={(e) =>
                  setForm({ ...form, isSuperManager: e.target.checked })
                }
              />
              Super manager
            </label>
            {form.isSuperManager ? (
              <TextField
                label="PIN"
                required
                value={form.pinNumber}
                onChange={(e) => setForm({ ...form, pinNumber: e.target.value })}
              />
            ) : (
              <label className="block space-y-1.5">
                <span className="text-[13px] font-medium text-slate-700">
                  Category
                </span>
                <select
                  required
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                >
                  <option value="">Select category</option>
                  {categories.map((category) => {
                    const name =
                      category.masterCategoryName || category.name || "";
                    if (!name) return null;
                    return (
                      <option key={category.masterCategoryId || name} value={name}>
                        {name}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </PrimaryButton>
              <SecondaryButton
                type="button"
                disabled={saving}
                onClick={() => router.push("/admin/profiles/warehouse")}
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
