"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PrimaryButton, SecondaryButton } from "@/components/ui";
import {
  filterAttendancePeople,
  setVisibleSelection,
  toggleSelectedId,
} from "@/lib/attendance-bulk";

export type MarkAttendanceChoice = {
  id: string;
  label: string;
};

type MarkAttendanceBase = {
  open: boolean;
  description?: string;
  people: MarkAttendanceChoice[];
  date: string;
  endDate?: string;
  status: string;
  leaveType: "annual" | "sick";
  reason: string;
  saving: boolean;
  error?: string | null;
  statusOptions: Array<{ value: string; label: string }>;
  onClose: () => void;
  onDate: (value: string) => void;
  onEndDate?: (value: string) => void;
  onStatus: (value: string) => void;
  onLeaveType: (value: "annual" | "sick") => void;
  onReason: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
};

type MarkAttendanceSingle = MarkAttendanceBase & {
  multiple?: false;
  person: string;
  onPerson: (value: string) => void;
};

type MarkAttendanceMultiple = MarkAttendanceBase & {
  multiple: true;
  selected: string[];
  onSelected: (value: string[]) => void;
};

export function MarkAttendanceDialog(
  props: MarkAttendanceSingle | MarkAttendanceMultiple,
) {
  const {
    open,
    description = "Record present, absent, or annual/sick leave.",
    people,
    date,
    endDate,
    status,
    leaveType,
    reason,
    saving,
    error,
    statusOptions,
    onClose,
    onDate,
    onEndDate,
    onStatus,
    onLeaveType,
    onReason,
    onSubmit,
  } = props;
  const [query, setQuery] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!open) return;
    const selectedRow = listRef.current?.querySelector<HTMLElement>(
      "[data-selected='true']",
    );
    selectedRow?.scrollIntoView({ block: "nearest" });
  }, [open]);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setQuery("");
  }

  if (!open) return null;

  const multiple = props.multiple === true;
  const selected = multiple ? props.selected : [];
  const visible = multiple ? filterAttendancePeople(people, query) : people;
  const visibleIds = visible.map((person) => person.id);
  const selectedVisibleCount = visibleIds.filter((id) => selected.includes(id)).length;
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

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
        className={`flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-lg ${
          multiple ? "h-[min(90vh,40rem)] max-w-lg" : "max-w-md"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 px-5 pt-5">
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
        {multiple ? (
          <div className="mt-3 flex min-h-0 flex-1 flex-col px-5">
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 rounded border-line"
                checked={allVisibleSelected}
                ref={(element) => {
                  if (element) element.indeterminate = someVisibleSelected;
                }}
                onChange={(event) => {
                  props.onSelected(
                    setVisibleSelection(selected, visibleIds, event.target.checked),
                  );
                }}
                aria-label="Select all visible people"
              />
              <span className="whitespace-nowrap">Select all</span>
              <span className="font-normal text-slate-500">
                ({selected.length} selected)
              </span>
            </label>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder="Filter people"
              aria-label="Filter people"
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <p className="mt-2 text-xs text-slate-500">
              The date and status apply to everyone selected. Reason is optional.
            </p>
            <ul
              ref={listRef}
              className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-xl border border-line divide-y divide-line/60"
            >
              {visible.length === 0 ? (
                <li className="px-3 py-4 text-sm text-slate-500">No people to show.</li>
              ) : (
                visible.map((choice) => {
                  const checked = selected.includes(choice.id);
                  return (
                    <li key={choice.id} data-selected={checked ? "true" : undefined}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-[#f7f5f0]/60">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-line"
                          checked={checked}
                          onChange={() =>
                            props.onSelected(toggleSelectedId(selected, choice.id))
                          }
                        />
                        <span className="min-w-0 text-sm font-medium text-ink">
                          {choice.label}
                        </span>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : (
          <div className="px-5 pt-3">
            <select
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              value={props.person}
              onChange={(event) => props.onPerson(event.target.value)}
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
          </div>
        )}
        <div className="shrink-0 space-y-3 px-5 py-3">
        <input
          type="date"
          className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          value={date}
          onChange={(event) => onDate(event.target.value)}
          required
          aria-label={status === "holiday" ? "Holiday from" : "Date"}
        />
        {status === "holiday" && onEndDate ? (
          <input
            type="date"
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
            value={endDate || date}
            onChange={(event) => onEndDate(event.target.value)}
            required
            aria-label="Holiday to"
          />
        ) : null}
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
          placeholder="Reason (optional)"
          value={reason}
          onChange={(event) => onReason(event.target.value)}
          aria-label="Reason"
        />
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-line px-5 py-3">
          <SecondaryButton type="button" onClick={onClose}>
            Cancel
          </SecondaryButton>
          <PrimaryButton
            type="submit"
            disabled={saving || (multiple && selected.length === 0)}
          >
            {saving
              ? "Saving…"
              : multiple
                ? `Save for ${selected.length}`
                : "Save"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
