"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { SelectField } from "@/components/StlFeatureUi";
import {
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  TextField,
} from "@/components/ui";
import { getCompanies, type CompanyRecord } from "@/lib/api";
import { getLeaveSettings, saveLeaveSettings } from "@/lib/stl-features-api";
import { filterCompaniesForModule } from "@/lib/custom-users";

export default function AdminLeaveSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [annual, setAnnual] = useState("");
  const [sick, setSick] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [defaults, setDefaults] = useState<{
    annualLeaveDays: number;
    sickLeaveDays: number;
  } | null>(null);

  useEffect(() => {
    void getCompanies()
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, []);

  const options = useMemo(
    () =>
      filterCompaniesForModule(companies, user?.customAccess, "leave-settings"),
    [companies, user],
  );
  const scopeId =
    user?.customAccess && !companyId ? (options[0]?._id ?? "") : companyId;

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getLeaveSettings(user.id, scopeId || undefined);
      setAnnual(String(data.resolved.annualLeaveDays));
      setSick(String(data.resolved.sickLeaveDays));
      setDefaults(data.defaults);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, [user, scopeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user?.id) return;
    const annualLeaveDays = Number(annual);
    const sickLeaveDays = Number(sick);
    if (
      !Number.isFinite(annualLeaveDays) ||
      !Number.isFinite(sickLeaveDays) ||
      annualLeaveDays < 0 ||
      sickLeaveDays < 0
    ) {
      toast("Enter valid non-negative day counts", "info");
      return;
    }
    setBusy(true);
    try {
      await saveLeaveSettings({
        userId: user.id,
        annualLeaveDays,
        sickLeaveDays,
        companyId: scopeId || null,
      });
      toast("Leave settings saved", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Leave settings"
        subtitle="Yearly annual and sick leave entitlements (global default or per company)."
      />
      {loading && !defaults ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <Card className="max-w-md">
          <form className="space-y-3" onSubmit={onSubmit}>
            <SelectField
              label="Scope"
              value={scopeId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              {user?.customAccess ? null : (
                <option value="">Global default (all companies)</option>
              )}
              {options.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Annual leave days / year"
              type="number"
              min={0}
              step="0.5"
              required
              value={annual}
              onChange={(e) => setAnnual(e.target.value)}
            />
            <TextField
              label="Sick leave days / year"
              type="number"
              min={0}
              step="0.5"
              required
              value={sick}
              onChange={(e) => setSick(e.target.value)}
            />
            {defaults ? (
              <p className="text-xs text-slate-500">
                System defaults: annual {defaults.annualLeaveDays}, sick{" "}
                {defaults.sickLeaveDays}
              </p>
            ) : null}
            <PrimaryButton type="submit" disabled={busy}>
              Save settings
            </PrimaryButton>
          </form>
        </Card>
      )}
    </div>
  );
}
