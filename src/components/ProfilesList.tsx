"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { deleteUser, searchProfiles } from "@/lib/api";
import type { ProfileUser } from "@/lib/types";
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

export function ProfilesList({
  title,
  role,
  editBase,
  fetcher,
}: {
  title: string;
  role: "Sales" | "Warehouse";
  editBase: string;
  fetcher: () => Promise<ProfileUser[]>;
}) {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ProfileUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

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

  async function onDelete(id: string) {
    if (!confirm("Delete this profile?")) return;
    try {
      await deleteUser(id);
      toast("Profile deleted", "success");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={
          role === "Sales"
            ? "Sales personnel records."
            : "Warehouse manager records."
        }
        actions={
          <SecondaryButton type="button" onClick={() => void load()}>
            Refresh
          </SecondaryButton>
        }
      />

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
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{profile.name}</p>
                <p className="text-sm text-slate-500">
                  {profile.email || "No email"}
                  {profile.mobileNumber ? ` · ${profile.mobileNumber}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`${editBase}/${profile._id}`}
                  className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-[#f7f5f0]"
                >
                  Edit
                </Link>
                <SecondaryButton
                  type="button"
                  className="border-red-200 text-red-700"
                  onClick={() => void onDelete(profile._id)}
                >
                  Delete
                </SecondaryButton>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
