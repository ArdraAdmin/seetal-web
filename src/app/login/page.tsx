"use client";

import { FormEvent, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { useAuth } from "@/components/AuthProvider";
import { PrimaryButton, TextField } from "@/components/ui";

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
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8 sm:py-12">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-8 text-center">
          <div className="mb-5 flex justify-center">
            <BrandLogo size="lg" priority />
          </div>
          <h2 className="text-xl font-semibold text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter your admin or sales email and password to continue.
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
            className="w-full py-2.5"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </PrimaryButton>
        </form>
      </div>
    </div>
  );
}
