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
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { companyLabel, getCompanies, type CompanyRecord } from "@/lib/api";
import { filterCompaniesForModule } from "@/lib/custom-users";
import {
  addPublicHoliday,
  deletePublicHoliday,
  getPayrollSettings,
  savePayrollSettings,
  type PayrollConfig,
  type PublicHolidayRow,
} from "@/lib/stl-features-api";

type ConfigForm = {
  wageDays: string;
  standardHours: string;
  shiftHours: string;
  breakHours: string;
  weekdayMultiplier: string;
  sundayMultiplier: string;
  publicHolidayMultiplier: string;
  sundayAllowance: string;
};

const FIELDS: Array<{ key: keyof ConfigForm; label: string; allowZero?: boolean }> = [
  { key: "wageDays", label: "Days used to derive the daily wage" },
  { key: "standardHours", label: "Standard working hours" },
  { key: "shiftHours", label: "Shift duration (hours)" },
  { key: "breakHours", label: "Break duration (hours)", allowZero: true },
  { key: "weekdayMultiplier", label: "Weekday overtime multiplier" },
  { key: "sundayMultiplier", label: "Sunday statutory overtime multiplier" },
  { key: "publicHolidayMultiplier", label: "Public holiday overtime multiplier" },
  { key: "sundayAllowance", label: "Default Sunday allowance (AED)", allowZero: true },
];

function formFrom(config: PayrollConfig): ConfigForm {
  return {
    wageDays: String(config.wageDays),
    standardHours: String(config.standardHours),
    shiftHours: String(config.shiftHours),
    breakHours: String(config.breakHours),
    weekdayMultiplier: String(config.weekdayMultiplier),
    sundayMultiplier: String(config.sundayMultiplier),
    publicHolidayMultiplier: String(config.publicHolidayMultiplier),
    sundayAllowance: String(config.sundayAllowance),
  };
}

function readConfig(form: ConfigForm): { config?: Omit<PayrollConfig, "companyId" | "source">; error?: string } {
  const config = {} as Omit<PayrollConfig, "companyId" | "source">;
  for (const field of FIELDS) {
    const amount = Number(form[field.key]);
    if (!Number.isFinite(amount) || (field.allowZero ? amount < 0 : amount <= 0)) {
      return {
        error: field.allowZero
          ? `${field.label} must be zero or greater`
          : `${field.label} must be greater than zero`,
      };
    }
    config[field.key] = amount;
  }
  if (config.breakHours >= config.shiftHours) {
    return { error: "Break duration must be shorter than the shift" };
  }
  if (config.shiftHours - config.breakHours < config.standardHours) {
    return { error: "Working hours after the break must cover the standard hours" };
  }
  return { config };
}

function sourceLabel(source?: PayrollConfig["source"]) {
  if (source === "company") return "Saved for this company.";
  if (source === "global") return "Using the global payroll default.";
  return "Using the system defaults. Save to keep them.";
}

export function PayrollSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [form, setForm] = useState<ConfigForm | null>(null);
  const [source, setSource] = useState<PayrollConfig["source"]>();
  const [holidays, setHolidays] = useState<PublicHolidayRow[]>([]);
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [holidayRate, setHolidayRate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getCompanies()
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, []);

  const options = useMemo(
    () => filterCompaniesForModule(companies, user?.customAccess, "hr"),
    [companies, user],
  );
  const scopeId = user?.customAccess && !companyId ? (options[0]?._id ?? "") : companyId;
  const yearNumber = Number(year);

  const load = useCallback(async () => {
    if (!user?.id) return;
    if (!Number.isInteger(yearNumber) || yearNumber < 2000 || yearNumber > 2100) {
      setError("Choose a year from 2000 to 2100");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getPayrollSettings(user.id, scopeId || undefined, yearNumber);
      setForm(formFrom(data.resolved));
      setSource(data.resolved.source);
      setHolidays(data.holidays);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payroll settings");
    } finally {
      setLoading(false);
    }
  }, [user, scopeId, yearNumber]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!user?.id || !form) return;
    const parsed = readConfig(form);
    if (!parsed.config) {
      toast(parsed.error || "Check the payroll settings", "info");
      return;
    }
    setBusy(true);
    try {
      await savePayrollSettings(user.id, scopeId || null, parsed.config);
      toast("Payroll settings saved", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onAddHoliday(event: FormEvent) {
    event.preventDefault();
    if (!user?.id) return;
    const name = holidayName.trim();
    if (!holidayDate || !name) {
      toast("Enter the holiday date and name", "info");
      return;
    }
    let multiplier: number | null = null;
    if (holidayRate.trim()) {
      multiplier = Number(holidayRate);
      if (!Number.isFinite(multiplier) || multiplier <= 0) {
        toast("Holiday overtime multiplier must be greater than zero", "info");
        return;
      }
    }
    setBusy(true);
    try {
      await addPublicHoliday(user.id, {
        companyId: scopeId || null,
        date: holidayDate,
        name,
        multiplier,
      });
      setHolidayDate("");
      setHolidayName("");
      setHolidayRate("");
      toast("Public holiday added", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not add the holiday", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(row: PublicHolidayRow) {
    if (!user?.id) return;
    const ownsRow = scopeId ? row.companyId === scopeId : row.scope === "global";
    if (!ownsRow) {
      toast("Switch to the global scope to remove a holiday that applies to every company", "info");
      return;
    }
    if (!window.confirm(`Remove ${row.name} on ${row.date}?`)) return;
    setBusy(true);
    try {
      await deletePublicHoliday(user.id, row.id);
      toast("Public holiday removed", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not remove the holiday", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Payroll settings"
        subtitle="Overtime rates, shift hours, the Sunday allowance, and public holidays used by every salary slip."
      />
      {loading && !form ? (
        <LoadingState />
      ) : error && !form ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : form ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
          {error ? (
            <p className="text-sm text-red-700 xl:col-span-2">{error}</p>
          ) : null}
          <Card>
            <form className="space-y-3" onSubmit={onSave}>
              <SelectField label="Scope" value={scopeId} onChange={(event) => setCompanyId(event.target.value)}>
                {user?.customAccess ? null : <option value="">Global default (all companies)</option>}
                {options.map((company) => (
                  <option key={company._id} value={company._id}>
                    {companyLabel(company)}
                  </option>
                ))}
              </SelectField>
              {FIELDS.map((field) => (
                <TextField
                  key={field.key}
                  label={field.label}
                  type="number"
                  min={field.allowZero ? 0 : 0.01}
                  step="0.01"
                  required
                  value={form[field.key]}
                  disabled={busy}
                  onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                />
              ))}
              <p className="text-xs text-slate-500">{sourceLabel(source)}</p>
              <PrimaryButton type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save settings"}
              </PrimaryButton>
            </form>
          </Card>
          <Card>
            <h2 className="mb-1 text-sm font-semibold text-ink">Public holidays</h2>
            <p className="mb-3 text-xs text-slate-500">
              A worked public holiday is paid at the holiday rate instead of weekday or Sunday statutory overtime.
              Leave the multiplier blank to use the public holiday rate above.
            </p>
            <div className="mb-4 max-w-[10rem]">
              <TextField
                label="Year"
                type="number"
                min={2000}
                max={2100}
                required
                value={year}
                onChange={(event) => setYear(event.target.value)}
              />
            </div>
            <form className="mb-4 grid gap-3 sm:grid-cols-2" onSubmit={onAddHoliday}>
              <TextField label="Date" type="date" required value={holidayDate} disabled={busy} onChange={(event) => setHolidayDate(event.target.value)} />
              <TextField label="Name" required value={holidayName} disabled={busy} onChange={(event) => setHolidayName(event.target.value)} />
              <TextField label="Overtime multiplier" type="number" min={0.01} step="0.01" optional value={holidayRate} disabled={busy} onChange={(event) => setHolidayRate(event.target.value)} />
              <div className="flex items-end">
                <SecondaryButton type="submit" disabled={busy}>Add holiday</SecondaryButton>
              </div>
            </form>
            {holidays.length === 0 ? (
              <p className="text-sm text-slate-500">No public holidays in {year}.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {holidays.map((row) => {
                  const ownsRow = scopeId ? row.companyId === scopeId : row.scope === "global";
                  return (
                    <li key={row.id} className="flex items-start justify-between gap-3 py-2">
                      <div>
                        <p className="font-medium text-ink">{row.name}</p>
                        <p className="text-xs text-slate-500">
                          {row.date}
                          {row.multiplier != null ? ` · ${row.multiplier}×` : " · default holiday rate"}
                          {row.scope === "global" ? " · all companies" : " · this company"}
                        </p>
                      </div>
                      {ownsRow ? (
                        <button
                          type="button"
                          className="text-xs text-slate-500 underline"
                          disabled={busy}
                          onClick={() => void onDelete(row)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
