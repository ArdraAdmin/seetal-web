"use client";

import { FormEvent, useState } from "react";
import { ClipboardList, Package, Warehouse } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/components/AuthProvider";
import { PrimaryButton, TextField } from "@/components/ui";

const HIGHLIGHTS = [
  {
    icon: ClipboardList,
    title: "Sales orders",
    text: "Find a store, build a cart, and send it to the warehouse.",
  },
  {
    icon: Warehouse,
    title: "Warehouse checks",
    text: "First check, double check, and load verification in one flow.",
  },
  {
    icon: Package,
    title: "Live inventory",
    text: "Stock, transfers, and product search from the same system.",
  },
];

export default function LoginPage() {
  const { login, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)]">
      <aside className="relative hidden overflow-hidden bg-ink-deep text-white lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #f7a51c 1px, transparent 0)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full bg-brand/25 blur-2xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-brand/20 blur-2xl" />
        <div className="pointer-events-none absolute right-16 top-24 h-40 w-40 rounded-full border border-brand/40" />

        <div className="relative z-10 flex min-h-dvh flex-col justify-between overflow-y-auto p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" priority className="ring-2 ring-brand/70" />
            <div>
              <p className="text-sm font-semibold tracking-[0.22em] text-brand">
                SEETAL
              </p>
              <p className="text-xs text-white/70">Wholesale operations</p>
            </div>
          </div>

          <div className="max-w-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
              One workspace
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight xl:text-4xl">
              Orders, warehouse, and inventory in one place.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/75">
              Sign in to pick up where you left off — whether you are placing
              orders, checking stock, or running the warehouse.
            </p>

            <ul className="mt-8 space-y-4">
              {HIGHLIGHTS.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-brand">
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="font-semibold text-white">{item.title}</p>
                      <p className="mt-0.5 text-sm text-white/70">{item.text}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="text-xs text-white/50">
            Sales · Warehouse · Admin
          </p>
        </div>
      </aside>

      <main className="relative flex min-h-dvh flex-col bg-background">
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-brand/20 to-transparent lg:hidden" />

        <div className="relative flex flex-1 flex-col justify-center px-4 py-10 sm:px-8">
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <BrandLogo size="md" priority className="ring-2 ring-brand/60" />
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-ink">
                SEETAL
              </p>
              <p className="text-xs text-slate-500">Wholesale operations</p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md rounded-3xl border border-line bg-white p-6 shadow-[0_24px_60px_-28px_rgba(14,58,50,0.35)] sm:p-8">
            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark">
                Welcome back
              </p>
              <h2 className="mt-2 text-2xl font-bold text-ink">Sign in</h2>
              <p className="mt-1 text-sm text-slate-500">
                Use your Seetal email and password to continue.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </p>
              ) : null}

              <PrimaryButton
                type="submit"
                disabled={submitting}
                className="mt-2 w-full py-2.5 text-base"
              >
                {submitting ? "Signing in…" : "Sign in"}
              </PrimaryButton>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
