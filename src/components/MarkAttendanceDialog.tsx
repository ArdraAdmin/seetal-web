"use client";

import { FormEvent } from "react";
import { X } from "lucide-react";
import { PrimaryButton, SecondaryButton } from "@/components/ui";

export type MarkAttendanceChoice = {
  id: string;
  label: string;
};

export function MarkAttendanceDialog({
  open,
  description = "Record present, absent, or annual/sick leave.",
  people,
  person,
  date,
  status,
  leaveType,
  reason,
  saving,
  statusOptions,
  onClose,
  onPerson,
  onDate,
  onStatus,
  onLeaveType,
  onReason,
  onSubmit,
}: {
  open: boolean;
  description?: string;
  people: MarkAttendanceChoice[];
  person: string;
  date: string;
  status: string;
  leaveType: "annual" | "sick";
  reason: string;
  saving: boolean;
  statusOptions: Array<{ value: string; label: string }>;
  onClose: () => void;
  onPerson: (value: string) => void;
  onDate: (value: string) => void;
  onStatus: (value: string) => void;
  onLeaveType: (value: "annual" | "sick") => void;
  onReason: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-attendance-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-3 rounded-2xl border border-line bg-white p-5 shadow-lg"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="mark-attendance-title" className="text-lg font-semibold text-ink">
              Mark attendance / leave
            </h2>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <select
          className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          value={person}
          onChange={(event) => onPerson(event.target.value)}
          required
          aria-label="Select person"
        >
          <option value="">Select person</option>
          {people.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          value={date}
          onChange={(event) => onDate(event.target.value)}
          required
          aria-label="Date"
        />
        <select
          className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          value={status}
          onChange={(event) => onStatus(event.target.value)}
          aria-label="Status"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {status === "leave" ? (
          <select
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            value={leaveType}
            onChange={(event) => onLeaveType(event.target.value === "sick" ? "sick" : "annual")}
            aria-label="Leave type"
          >
            <option value="annual">Annual leave</option>
            <option value="sick">Sick leave</option>
          </select>
        ) : null}
        <input
          className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          placeholder="Reason (required)"
          value={reason}
          onChange={(event) => onReason(event.target.value)}
          required
          aria-label="Reason"
        />
        <div className="flex justify-end gap-2 pt-1">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
