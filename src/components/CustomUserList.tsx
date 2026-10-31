"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listCustomUsers } from "@/lib/custom-users-api";
import {
  CUSTOM_COMPANY_LABELS,
  enabledModuleCount,
  type CustomUserRecord,
} from "@/lib/custom-users";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SecondaryButton,
  TextField,
} from "@/components/ui";

export function CustomUserList({ basePath }: { basePath: string }) {
  const [users, setUsers] = useState<CustomUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listCustomUsers();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listCustomUsers()
      .then((data) => {
        if (!cancelled) setUsers(data.users);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load users");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const term = query.trim().toLowerCase();
  const rows = term
    ? users.filter((user) =>
        `${user.name} ${user.email} ${user.companies.join(" ")}`
          .toLowerCase()
          .includes(term),
      )
    : users;

  return (
    <div>
      <PageHeader
        title="User management"
        subtitle="Create a person, choose their companies, then turn on the modules they can open."
        actions={
          <div className="flex gap-2">
            <SecondaryButton
              type="button"
              disabled={loading}
              onClick={() => {
                setLoading(true);
                void load();
              }}
            >
              Refresh
            </SecondaryButton>
            <Link
              href={`${basePath}/new`}
              className="inline-flex min-h-10 items-center rounded-lg border border-brand bg-brand px-4 py-2 text-sm font-medium text-ink hover:bg-brand-dark hover:text-white"
            >
              Create user
            </Link>
          </div>
        }
      />
      <div className="mb-4 max-w-sm">
        <TextField
          label="Search"
          placeholder="Name, email or company"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={users.length === 0 ? "No custom users yet" : "No users match this search"}
          description={
            users.length === 0
              ? "Create a user and choose which company data and modules they can see."
              : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-[#f7f5f0] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Companies</th>
                <th className="px-4 py-2 text-right">Modules</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium text-ink">{user.name}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {user.companies
                      .map((key) => CUSTOM_COMPANY_LABELS[key] || key)
                      .join(", ")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {enabledModuleCount(user)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`${basePath}/${user.id}`}
                      className="font-medium text-brand-dark hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
