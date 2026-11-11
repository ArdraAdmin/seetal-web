"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from "@/components/ui";
import { validatePassword } from "@/lib/custom-users";
import {
  shmpCreateAccessUser,
  shmpUpdateAccessUser,
  type ShmpAccessUser,
} from "@/lib/shmp-api";

export function LabelCheckerAccountForm({
  user,
  returnTo = "/shmp/users?group=label-checker",
}: {
  user?: ShmpAccessUser;
  returnTo?: string;
}) {
  const router = useRouter();
  const editing = Boolean(user);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [mobile, setMobile] = useState(user?.mobileNumber || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!editing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email.");
      return;
    }
    const passwordError = validatePassword(password, !editing);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing && user) {
        await shmpUpdateAccessUser(user._id, {
          name: name.trim(),
          mobileNumber: mobile.trim(),
          ...(password.trim() ? { password: password.trim() } : {}),
        });
      } else {
        await shmpCreateAccessUser({
          role: "LabelChecker",
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          mobileNumber: mobile.trim(),
          environments: ["shmp"],
        });
      }
      router.push(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the label checker");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mx-auto max-w-lg">
      <PageHeader
        title={editing ? "Edit label checker" : "Add label checker"}
        subtitle="Label checkers approve carton and label usage before it leaves the RM store."
      />
      <Card>
        <div className="space-y-3">
          <TextField label="Name" required value={name} onChange={(event) => setName(event.target.value)} />
          <TextField
            label="Email"
            type="email"
            required
            disabled={editing}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label="Mobile"
            optional
            value={mobile}
            onChange={(event) => setMobile(event.target.value)}
          />
          <TextField
            label={editing ? "New password" : "Password"}
            type="password"
            required={!editing}
            optional={editing}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={editing ? "Leave blank to keep the current password" : ""}
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <SecondaryButton type="button" onClick={() => router.push(returnTo)}>
              Cancel
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save" : "Add label checker"}
            </PrimaryButton>
          </div>
        </div>
      </Card>
    </form>
  );
}
