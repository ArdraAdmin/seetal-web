"use client";

import { useState, type FormEvent } from "react";
import { useToast } from "@/components/Toast";
import { Card, SecondaryButton, TextField } from "@/components/ui";
import {
  displayedTotalSalary,
  dubaiTodayInput,
  formatHrDate,
  type HrSalaryScope,
} from "@/lib/hr-profile";
import { salesMoney } from "@/lib/sales";
import type { HrStaff } from "@/lib/stl-features-api";

export function SalaryIncrementCard({
  staff,
  scope,
  onChanged,
  add,
  remove,
  layout = "split",
}: {
  staff: HrStaff;
  scope: HrSalaryScope;
  onChanged: () => Promise<void>;
  add: (payload: {
    amount: number;
    effectiveDate: string;
    notes?: string;
  }) => Promise<unknown>;
  remove: (entryId: string) => Promise<unknown>;
  layout?: "split" | "stack";
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const today = dubaiTodayInput();
  const previousSalary = displayedTotalSalary(staff.hrProfile, scope);
  const previousAmount = Number(previousSalary);
  const increment = Number(amount);
  const when = !date ? null : date > today ? "future" : date < today ? "past" : "today";
  const nextTotal =
    when === "today" && Number.isFinite(increment) && increment > 0 && Number.isFinite(previousAmount)
      ? previousAmount + increment
      : null;
  const increments = [...(staff.hrProfile?.salaryIncrements ?? [])].sort((a, b) =>
    String(b.effectiveDate).localeCompare(String(a.effectiveDate)),
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!Number.isFinite(increment) || increment <= 0) {
      toast("Enter an increment amount", "info");
      return;
    }
    if (!date) {
      toast("Choose an effective date", "info");
      return;
    }
    if (date > today) {
      toast("Effective date cannot be in the future", "info");
      return;
    }
    setBusy(true);
    try {
      await add({
        amount: increment,
        effectiveDate: date,
        notes: notes.trim() || undefined,
      });
      toast(
        date === today ? "Increment added and total salary updated" : "Increment added to history",
        "success",
      );
      setAmount("");
      setDate("");
      setNotes("");
      await onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add increment", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(entryId: string, applied: boolean | undefined, value: number, effectiveDate: string) {
    const message = applied
      ? `Delete this increment? Total salary will be reduced by ${salesMoney(value)}.`
      : `Delete the ${salesMoney(value)} increment from ${formatHrDate(effectiveDate)}?`;
    if (!confirm(message)) return;
    setDeletingId(entryId);
    try {
      await remove(entryId);
      toast(applied ? "Increment removed and total salary updated" : "Increment removed", "success");
      await onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete increment", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className={`mt-4 grid gap-4 ${layout === "split" ? "lg:grid-cols-2" : ""}`}>
      <Card>
        <h2 className="text-sm font-semibold text-ink">Add salary increment</h2>
        <p className="mt-1 text-sm text-ink">
          Total salary <span className="font-semibold">{salesMoney(previousAmount)}</span>
        </p>
        <form className="mt-3 space-y-3" onSubmit={onSubmit}>
          <TextField
            label="Previous salary (AED)"
            type="number"
            readOnly
            value={previousSalary}
            className="bg-[#f7f5f0]"
          />
          <TextField
            label="Amount incremented (AED)"
            type="number"
            min={0}
            step="0.01"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <TextField
            label="Effective date"
            type="date"
            required
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
          <p className="text-xs text-slate-500">
            {when === "today"
              ? "Today's date saves this in increment history and adds it to total salary."
              : when === "past"
                ? "A past date is saved in increment history. Total salary stays the same."
                : "Choose today to update total salary, or a past date to record history only."}
          </p>
          {nextTotal != null ? (
            <p className="text-xs font-medium text-ink">
              Total salary will become {salesMoney(nextTotal)}.
            </p>
          ) : null}
          <TextField label="Notes" optional value={notes} onChange={(event) => setNotes(event.target.value)} />
          <SecondaryButton type="submit" disabled={busy || deletingId != null}>
            {busy ? "Adding…" : "Add increment"}
          </SecondaryButton>
        </form>
      </Card>
      <Card>
        <h2 className="mb-3 text-sm font-semibold text-ink">Increment history</h2>
        {increments.length === 0 ? (
          <p className="text-sm text-slate-500">No increments recorded.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {increments.map((inc, index) => {
              const entryId = inc.entryId || "";
              const previous = inc.previousSalary;
              return (
                <li key={entryId || `${inc.effectiveDate}-${index}`} className="flex items-start justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">{formatHrDate(inc.effectiveDate)}</p>
                    <p className="text-xs text-slate-500">
                      {previous != null ? `Previous ${salesMoney(previous)} · ` : ""}
                      Increment {salesMoney(inc.amount)}
                      {inc.applied && previous != null ? ` · Total ${salesMoney(previous + inc.amount)}` : ""}
                    </p>
                    {inc.applied === true ? (
                      <p className="text-xs text-slate-500">Added to total salary</p>
                    ) : inc.applied === false ? (
                      <p className="text-xs text-slate-500">History only</p>
                    ) : null}
                    {inc.notes ? <p className="text-xs text-slate-500">{inc.notes}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="font-medium text-red-700 underline disabled:opacity-50"
                    disabled={!entryId || deletingId != null || busy}
                    onClick={() => void onDelete(entryId, inc.applied, inc.amount, inc.effectiveDate)}
                  >
                    {deletingId === entryId ? "Removing…" : "Delete"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
