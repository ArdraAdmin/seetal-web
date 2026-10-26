"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Factory } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/components/AuthProvider";
import { canAccessEnvironment, isSuperAdmin } from "@/lib/auth";
import { normalizeEnvironments } from "@/lib/environment";
import type { AppEnvironment } from "@/lib/types";

export default function SelectEnvironmentPage() {
  const { user, loading, selectEnvironment } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState<AppEnvironment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const envs = normalizeEnvironments(
      user.environments,
      user.role,
      isSuperAdmin(user),
    );
    if (envs.length === 1) {
      try {
        selectEnvironment(envs[0]);
      } catch {
        /* ignore */
      }
    }
  }, [loading, user, router, selectEnvironment]);

  function onSelect(env: AppEnvironment) {
    if (!user || busy) return;
    if (!canAccessEnvironment(user, env)) {
      setError(`Your account cannot open ${env.toUpperCase()}.`);
      return;
    }
    setBusy(env);
    setError(null);
    try {
      selectEnvironment(env);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open environment");
      setBusy(null);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col px-4 py-8">
      <div className="mb-8 flex items-center gap-3">
        <BrandLogo size="sm" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-dark">
            Seetal / Shamk
          </p>
          <h1 className="text-2xl font-bold text-ink">Select environment</h1>
        </div>
      </div>
      <p className="max-w-xl text-sm text-slate-600">
        Signed in as {user.name}. Choose STL for selling operations or SHMP for
        manufacturing.
      </p>
      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <div className="mt-10 grid flex-1 content-center gap-4 sm:grid-cols-2">
        {canAccessEnvironment(user, "stl") ? (
          <EnvCard
            title="STL"
            subtitle="Selling side"
            icon={Building2}
            loading={busy === "stl"}
            disabled={busy !== null}
            onClick={() => onSelect("stl")}
          />
        ) : null}
        {canAccessEnvironment(user, "shmp") ? (
          <EnvCard
            title="SHMP"
            subtitle="Manufacturing"
            icon={Factory}
            loading={busy === "shmp"}
            disabled={busy !== null}
            onClick={() => onSelect("shmp")}
          />
        ) : null}
      </div>
    </div>
  );
}

function EnvCard({
  title,
  subtitle,
  icon: Icon,
  loading,
  disabled,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: typeof Building2;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[180px] flex-col items-start rounded-2xl border border-line bg-white p-5 text-left shadow-[0_10px_30px_-18px_rgba(14,58,50,0.35)] transition hover:border-brand/50 hover:bg-[#fffaf2] disabled:cursor-wait disabled:opacity-70"
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/15 text-brand-dark">
        {loading ? (
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        ) : (
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        )}
      </span>
      <span className="mt-auto pt-8 text-lg font-semibold text-ink">{title}</span>
      <span className="text-sm text-slate-500">{subtitle}</span>
      <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-dark">
        Open
        <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
      </span>
    </button>
  );
}
