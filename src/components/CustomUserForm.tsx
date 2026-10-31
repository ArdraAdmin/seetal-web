"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomUser,
  deleteCustomUser,
  updateCustomUser,
} from "@/lib/custom-users-api";
import {
  CUSTOM_COMPANY_KEYS,
  CUSTOM_COMPANY_LABELS,
  modulesForCompany,
  type CustomCompanyKey,
  type CustomModuleMap,
  type CustomUserRecord,
} from "@/lib/custom-users";
import { useToast } from "@/components/Toast";
import { Card, PageHeader, PrimaryButton, SecondaryButton, TextField } from "@/components/ui";

function selectedCompanies(companies: CustomCompanyKey[]) {
  return CUSTOM_COMPANY_KEYS.filter((key) => companies.includes(key));
}

export function CustomUserForm({
  basePath,
  user,
}: {
  basePath: string;
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

  const groups = useMemo(() => selectedCompanies(companies), [companies]);

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
      const next = list.includes(moduleId)
        ? list.filter((id) => id !== moduleId)
        : [...list, moduleId];
      return { ...current, [company]: next };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const input = {
      name,
      email,
      password,
      companies,
      modules,
    };
    try {
      if (editing && user) {
        await updateCustomUser(user.id, input);
        toast("User updated", "success");
      } else {
        await createCustomUser(input);
        toast("User created", "success");
      }
      router.push(basePath);
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
      router.push(basePath);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Delete failed", "error");
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={editing ? "Edit user" : "Create user"}
        subtitle="Choose one or more companies, then turn on the modules that person can open."
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
            They will see data for every company you select.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {CUSTOM_COMPANY_KEYS.map((key) => {
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
                Turn a module on to show it in their menu.
              </p>
              <ul className="mt-4 divide-y divide-line">
                {modulesForCompany(company).map((item) => {
                  const on = (modules[company] || []).includes(item.id);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-4 py-2.5"
                    >
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
            onClick={() => router.push(basePath)}
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
