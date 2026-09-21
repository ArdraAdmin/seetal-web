"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-line bg-white px-6 py-16 text-slate-500">
      <div className="flex items-center gap-3">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-white px-6 py-16 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-white px-6 py-12 text-center">
      <p className="text-sm font-semibold text-red-800">Unable to complete request</p>
      <p className="mt-1 text-sm text-slate-600">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-brand bg-brand px-4 py-2 text-sm font-medium text-ink hover:bg-brand-dark hover:text-white"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-line bg-white p-4 ${className}`}>
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`min-h-10 rounded-lg border border-brand bg-brand px-4 py-2 text-sm font-medium text-ink hover:bg-brand-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`min-h-10 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function TextField({
  label,
  type = "text",
  className = "",
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (visible ? "text" : "password") : type;

  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-slate-700">{label}</span>
      <span className="relative block">
        <input
          {...props}
          type={inputType}
          className={`w-full rounded-lg border border-line bg-white px-3 py-2 text-base text-ink outline-none placeholder:text-slate-400 focus:border-brand focus:ring-1 focus:ring-brand sm:text-sm ${
            isPassword ? "pr-10" : ""
          } ${className}`}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setVisible((v) => !v);
            }}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-ink"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? (
              <EyeOff className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <Eye className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
        ) : null}
      </span>
    </label>
  );
}
