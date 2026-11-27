"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { deleteUser, searchProfiles, updateWarehouseListFlags } from "@/lib/api";
import type { ProfileUser } from "@/lib/types";
import { asObject, warehouseField } from "@/lib/profiles";
import { withReturnTo } from "@/lib/user-management";
import { useToast } from "@/components/Toast";
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";

const WAREHOUSE_LISTS = [
  { key: "customs", label: "Customs" },
  { key: "loadList", label: "Load List" },
  { key: "zeroList", label: "Zero List" },
] as const;

type WarehouseListKey = (typeof WAREHOUSE_LISTS)[number]["key"];

function withListFlag(
  profile: ProfileUser,
  key: WarehouseListKey,
  on: boolean,
): ProfileUser {
  const field = asObject(profile.field) || {};
  const warehouse = asObject(field.warehouse) || {};
  return {
    ...profile,
    field: {
      ...field,
      warehouse: { ...warehouse, [key]: on },
    },
  };
}

function ListSwitch({
  label,
  on,
  disabled,
  onClick,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 text-sm text-ink disabled:opacity-60"
    >
      <span>{label}</span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          on ? "bg-brand" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

export function ProfilesList({
  title,
  role,
  editBase,
  addHref,
  addLabel,
  fetcher,
  embedded = false,
  returnTo,
}: {
  title: string;
  role: "Sales" | "Warehouse";
  editBase: string;
  addHref: string;
  addLabel: string;
  fetcher: () => Promise<ProfileUser[]>;
  embedded?: boolean;
  returnTo?: string;
}) {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ProfileUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingList, setSavingList] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetcher();
      setProfiles(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSearch() {
    if (!query.trim()) {
      await load();
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await searchProfiles(query.trim(), role);
      setProfiles(Array.isArray(res.users) ? res.users : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function onDelete(profile: ProfileUser) {
    const label = profile.name?.trim() || profile.email || "this profile";
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    setDeletingId(profile._id);
    try {
      await deleteUser(profile._id);
      toast("Profile deleted", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function onToggleList(profile: ProfileUser, key: WarehouseListKey) {
    const savingKey = `${profile._id}:${key}`;
    if (savingList) return;
    const next = warehouseField(profile)[key] !== true;
    setProfiles((current) =>
      current.map((item) =>
        item._id === profile._id ? withListFlag(item, key, next) : item,
      ),
    );
    setSavingList(savingKey);
    try {
      const saved = await updateWarehouseListFlags(profile._id, { [key]: next });
      setProfiles((current) =>
        current.map((item) =>
          item._id === profile._id ? withListFlag(item, key, saved[key] === true) : item,
        ),
      );
    } catch (err) {
      setProfiles((current) =>
        current.map((item) =>
          item._id === profile._id ? withListFlag(item, key, !next) : item,
        ),
      );
      toast(err instanceof Error ? err.message : "Could not update list", "error");
    } finally {
      setSavingList(null);
    }
  }

  const createHref = returnTo ? withReturnTo(addHref, returnTo) : addHref;

  return (
    <div>
      {embedded ? null : (
        <PageHeader
          title={title}
          subtitle={
            role === "Sales"
              ? "Sales personnel records."
              : "Warehouse manager records."
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <SecondaryButton type="button" onClick={() => void load()}>
                Refresh
              </SecondaryButton>
              <Link
                href={createHref}
                className="inline-flex min-h-10 items-center rounded-lg border border-brand bg-brand px-4 py-2 text-sm font-medium text-ink hover:bg-brand-dark hover:text-white"
              >
                {addLabel}
              </Link>
            </div>
          }
        />
      )}

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 w-full flex-1 sm:min-w-[220px]">
            <TextField
              label="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or email"
              onKeyDown={(e) => {
                if (e.key === "Enter") void onSearch();
              }}
            />
          </div>
          <PrimaryButton
            type="button"
            disabled={searching}
            onClick={() => void onSearch()}
          >
            Search
          </PrimaryButton>
        </div>
      </Card>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : profiles.length === 0 ? (
        <EmptyState title="No profiles found" />
      ) : (
        <div className="space-y-3">
          {profiles.map((profile) => (
            <Card
              key={profile._id}
              className={`flex flex-col gap-3 sm:flex-row sm:justify-between ${
                role === "Warehouse" ? "sm:items-start" : "sm:items-center"
              }`}
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{profile.name}</p>
                <p className="text-sm text-slate-500">
                  {profile.email || "No email"}
                  {profile.mobileNumber ? ` · ${profile.mobileNumber}` : ""}
                </p>
              </div>
              <div
                className={
                  role === "Warehouse"
                    ? "flex w-full flex-col gap-3 sm:w-56 sm:items-stretch"
                    : "flex flex-wrap gap-2"
                }
              >
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Link
                    href={
                      returnTo
                        ? withReturnTo(`${editBase}/${profile._id}`, returnTo)
                        : `${editBase}/${profile._id}`
                    }
                    className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
                  >
                    Edit
                  </Link>
                  <SecondaryButton
                    type="button"
                    className="border-red-200 text-red-700"
                    disabled={deletingId === profile._id}
                    onClick={() => void onDelete(profile)}
                  >
                    {deletingId === profile._id ? "Deleting…" : "Delete"}
                  </SecondaryButton>
                </div>
                {role === "Warehouse" ? (
                  <div className="space-y-1.5">
                    {WAREHOUSE_LISTS.map((item) => (
                      <ListSwitch
                        key={item.key}
                        label={item.label}
                        on={warehouseField(profile)[item.key] === true}
                        disabled={savingList !== null}
                        onClick={() => void onToggleList(profile, item.key)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
