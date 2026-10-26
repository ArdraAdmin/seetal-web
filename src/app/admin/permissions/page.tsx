"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui";
import {
  getModuleAccessUsers,
  updateModuleAccess,
} from "@/lib/stl-features-api";

type Data = Awaited<ReturnType<typeof getModuleAccessUsers>>;

function norm(v: string[] | null) {
  return v === null ? "null" : JSON.stringify([...v].sort());
}

const LAV_EMAIL = "lav@shrseetal.com";

export default function AdminPermissionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isLav = String(user?.email || "").trim().toLowerCase() === LAV_EMAIL;
  const [data, setData] = useState<Data | null>(null);
  /** Draft per user id; null = no restriction (defaults). */
  const [drafts, setDrafts] = useState<Record<string, string[] | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id || !isLav) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getModuleAccessUsers(user.id);
      setData(res);
      const next: Record<string, string[] | null> = {};
      for (const u of res.users) next[u.id] = u.moduleAccess;
      setDrafts(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }, [user?.id, isLav]);

  useEffect(() => {
    void load();
  }, [load]);

  function effective(id: string, fallback: string[]) {
    return drafts[id] ?? fallback;
  }

  function toggle(id: string, mod: string, fallback: string[]) {
    setDrafts((d) => {
      const cur = d[id] ?? fallback;
      const next = cur.includes(mod) ? cur.filter((m) => m !== mod) : [...cur, mod];
      return { ...d, [id]: next };
    });
  }

  async function save(id: string, value: string[] | null) {
    if (!user?.id) return;
    setSavingId(id);
    try {
      await updateModuleAccess(user.id, id, value);
      toast("Permissions updated", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    } finally {
      setSavingId(null);
    }
  }

  if (!isLav) {
    return (
      <div>
        <PageHeader title="Permissions" />
        <EmptyState
          title="Restricted"
          description={`Only ${LAV_EMAIL} can edit module permissions.`}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Permissions"
        subtitle="Choose which modules each user can access. Reset returns the user to role defaults."
        actions={
          <SecondaryButton type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : data && data.users.length > 0 ? (
        <div className="space-y-3">
          {data.users.map((u) => {
            const current = effective(u.id, u.effectiveModules);
            const dirty = norm(drafts[u.id] ?? null) !== norm(u.moduleAccess);
            return (
              <Card key={u.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">
                      {u.name}{" "}
                      {u.isSuperAdmin ? (
                        <span className="rounded-full bg-brand px-2 py-0.5 text-xs">
                          super admin
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-slate-500">
                      {u.email} · {u.role}
                      {u.moduleAccess === null ? " · role defaults" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <SecondaryButton
                      type="button"
                      disabled={savingId === u.id || u.moduleAccess === null}
                      onClick={() => void save(u.id, null)}
                    >
                      Reset
                    </SecondaryButton>
                    <PrimaryButton
                      type="button"
                      disabled={savingId === u.id || !dirty}
                      onClick={() => void save(u.id, drafts[u.id] ?? u.effectiveModules)}
                    >
                      Save
                    </PrimaryButton>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {data.modules.map((mod) => (
                    <label key={mod} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={current.includes(mod)}
                        onChange={() => toggle(u.id, mod, u.effectiveModules)}
                      />
                      <span className="capitalize">{mod.replace(/[_-]/g, " ")}</span>
                    </label>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No users found" />
      )}
    </div>
  );
}
