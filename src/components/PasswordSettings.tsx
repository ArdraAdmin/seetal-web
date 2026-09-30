"use client";

import { FormEvent, useState } from "react";
import { changeOwnPassword } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Card, PageHeader, PrimaryButton, TextField } from "@/components/ui";

export function PasswordSettings({
  title = "Settings",
}: {
  title?: string;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast("Passwords do not match", "error");
      return;
    }
    setSaving(true);
    try {
      await changeOwnPassword(currentPassword, newPassword, confirmPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("Password updated", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={title}
        subtitle="Reset the password for this signed-in account."
      />
      <Card className="max-w-xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <TextField
            label="Email"
            type="email"
            value={user?.email ?? ""}
            readOnly
            disabled
          />
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 4 characters, no spaces"
          />
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Updating…" : "Reset password"}
          </PrimaryButton>
        </form>
      </Card>
    </div>
  );
}
