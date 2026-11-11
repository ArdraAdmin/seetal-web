"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LabelCheckerAccountForm } from "@/components/LabelCheckerAccountForm";
import { ErrorState, LoadingState } from "@/components/ui";
import { shmpAccessUser, type ShmpAccessUser } from "@/lib/shmp-api";

export default function EditLabelCheckerPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [user, setUser] = useState<ShmpAccessUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void shmpAccessUser(id)
      .then((found) => {
        if (cancelled) return;
        if (found.role !== "LabelChecker") {
          setError("This account is not a label checker.");
          return;
        }
        setUser(found);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the label checker");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!user) return <LoadingState label="Loading label checker…" />;
  return <LabelCheckerAccountForm user={user} />;
}
