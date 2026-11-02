"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomUser,
  deleteCustomUser,
  updateCustomUser,
} from "@/lib/custom-users-api";
import {
  CUSTOM_COMPANY_LABELS,
  companiesForSide,
  moduleFields,
  modulesForCompany,
  selectedFieldIds,
  withFieldSelection,
  type CustomCompanyKey,
  type CustomModuleMap,
  type CustomUserRecord,
  type UserListSide,
} from "@/lib/custom-users";
import { useToast } from "@/components/Toast";
import { Card, PageHeader, PrimaryButton, SecondaryButton, TextField } from "@/components/ui";

function selectedCompanies(companies: CustomCompanyKey[], offered: CustomCompanyKey[]) {
  return offered.filter((key) => companies.includes(key));
}

function accessForSave(
  side: UserListSide,
  companies: CustomCompanyKey[],
  modules: CustomModuleMap,
  existing?: CustomUserRecord,
) {
  const offered = new Set(companiesForSide(side));
  const keptCompanies = (existing?.companies || []).filter((key) => !offered.has(key));
  const nextCompanies = [
    ...companies.filter((key) => offered.has(key)),
    ...keptCompanies,
  ];
  const nextModules: CustomModuleMap = {};
  for (const key of nextCompanies) {
    if (offered.has(key)) nextModules[key] = modules[key] || [];
    else nextModules[key] = existing?.modules[key] || [];
  }
  return { companies: nextCompanies, modules: nextModules };
}

export function CustomUserForm({
  basePath,
  side,
  user,
}: {
  basePath: string;
  side: UserListSide;
  user?: CustomUserRecord;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const editing = Boolean(user);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [companies, setCompanies] = useState<CustomCompanyKey[]>(user?.companies || []);
  const [modules, setModules] = useState<CustomModuleMap>(user?.modules || {});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const offered = useMemo(() => companiesForSide(side), [side]);
  const groups = useMemo(
    () => selectedCompanies(companies, offered),
    [companies, offered],
  );

  function toggleCompany(key: CustomCompanyKey) {
    setCompanies((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  function toggleModule(company: CustomCompanyKey, moduleId: string) {
    setModules((current) => {
      const list = current[company] || [];
      const on = list.includes(moduleId);
      const next = on
        ? list.filter((id) => id !== moduleId && !id.startsWith(`${moduleId}:`))
        : [...list, moduleId];
      return { ...current, [company]: next };
    });
  }

  function toggleField(company: CustomCompanyKey, moduleId: string, fieldId: string) {
    setModules((current) => {
      const list = current[company] || [];
      const known = moduleFields(company, moduleId).map((field) => field.id);
      const selected = selectedFieldIds(list, moduleId);
      const currentIds = selected === null ? known : selected;
      const nextIds = currentIds.includes(fieldId)
        ? currentIds.filter((id) => id !== fieldId)
        : [...currentIds, fieldId];
      const stored = nextIds.length === known.length ? null : nextIds;
      return {
        ...current,
        [company]: withFieldSelection(list, moduleId, stored, known),
      };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const access = accessForSave(side, companies, modules, user);
    const input = {
      name,
      email,
      password,
      companies: access.companies,
      modules: access.modules,
    };
    try {
      if (editing && user) {
        await updateCustomUser(user.id, input);
        toast("User updated", "success");
      } else {
        await createCustomUser(input);
        toast("User created", "success");
      }
      router.push(`${basePath}?group=custom`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!user || deleting) return;
    if (!confirm(`Delete ${user.name}? They will no longer be able to sign in.`)) return;
    setDeleting(true);
    try {
      await deleteCustomUser(user.id);
      toast("User deleted", "success");
      router.push(`${basePath}?group=custom`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Delete failed", "error");
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={editing ? "Edit user" : "Create user"}
        subtitle={
          side === "admin"
            ? "Choose STL, Sarvah, or SH Lakshmi, then turn on the modules that person can open."
            : "Turn on the SHMP modules that person can open."
        }
      />
      <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
        <Card className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Name"
              required
              value={name}
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              label="Email"
              type="email"
              required
              value={email}
              autoComplete="off"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <TextField
            label="Password"
            type="password"
            required={!editing}
            optional={editing}
            value={password}
            autoComplete="new-password"
            placeholder={editing ? "Leave blank to keep the current password" : ""}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-ink">Companies</h2>
          <p className="mt-1 text-sm text-slate-500">
            {side === "admin"
              ? "They will see data for every company you select."
              : "This account is for SHMP."}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {offered.map((key) => {
              const checked = companies.includes(key);
              return (
                <label
                  key={key}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${
                    checked ? "border-brand bg-[#fffaf2]" : "border-line bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand-dark"
                    checked={checked}
                    onChange={() => toggleCompany(key)}
                  />
                  <span className="text-sm font-medium text-ink">
                    {CUSTOM_COMPANY_LABELS[key]}
                  </span>
                </label>
              );
            })}
          </div>
        </Card>

        {groups.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500">
              Select a company to choose its modules.
            </p>
          </Card>
        ) : (
          groups.map((company) => (
            <Card key={company}>
              <h2 className="text-sm font-semibold text-ink">
                {CUSTOM_COMPANY_LABELS[company]} modules
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Turn a module on to show it in their menu. KPI dashboard, inventory, and HR can be limited to specific fields.
              </p>
              <ul className="mt-4 divide-y divide-line">
                {modulesForCompany(company).map((item) => {
                  const on = (modules[company] || []).includes(item.id);
                  const fields = moduleFields(company, item.id);
                  const selected = selectedFieldIds(modules[company], item.id);
                  let lastGroup = "";
                  return (
                    <li key={item.id} className="py-2.5">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-ink">{item.label}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={`${item.label} for ${CUSTOM_COMPANY_LABELS[company]}`}
                          onClick={() => toggleModule(company, item.id)}
                          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                            on ? "bg-brand" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                              on ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                      {on && fields.length > 0 ? (
                        <ul className="mt-2 space-y-1 rounded-lg bg-[#f7f5f0] px-3 py-2">
                          {fields.map((field) => {
                            const checked =
                              selected === null || selected.includes(field.id);
                            const showGroup = field.group && field.group !== lastGroup;
                            if (field.group) lastGroup = field.group;
                            return (
                              <li key={field.id}>
                                {showGroup ? (
                                  <p className="px-1 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase first:pt-0">
                                    {field.group}
                                  </p>
                                ) : null}
                                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-ink hover:bg-white">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-brand-dark"
                                    checked={checked}
                                    onChange={() => toggleField(company, item.id, field.id)}
                                  />
                                  {field.label}
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))
        )}

        <div className="flex flex-wrap gap-2">
          <PrimaryButton type="submit" disabled={saving || deleting}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create user"}
          </PrimaryButton>
          <SecondaryButton
            type="button"
            disabled={saving || deleting}
            onClick={() => router.push(`${basePath}?group=custom`)}
          >
            Cancel
          </SecondaryButton>
          {editing ? (
            <SecondaryButton
              type="button"
              disabled={saving || deleting}
              onClick={() => void onDelete()}
            >
              {deleting ? "Deleting…" : "Delete user"}
            </SecondaryButton>
          ) : null}
        </div>
      </form>
    </div>
  );
}
