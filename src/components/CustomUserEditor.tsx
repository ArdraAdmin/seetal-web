"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CustomUserForm } from "@/components/CustomUserForm";
import { ErrorState, LoadingState } from "@/components/ui";
import { getCustomUser } from "@/lib/custom-users-api";
import type { CustomUserRecord } from "@/lib/custom-users";

export function CustomUserEditor({ basePath }: { basePath: string }) {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [user, setUser] = useState<CustomUserRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void getCustomUser(id)
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load user");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <LoadingState />;
  if (error || !user) {
    return <ErrorState message={error || "User not found"} />;
  }
  return <CustomUserForm basePath={basePath} user={user} />;
}
