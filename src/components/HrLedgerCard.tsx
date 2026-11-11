"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Card, PrimaryButton, SecondaryButton, TextField } from "@/components/ui";
import { formatHrDate } from "@/lib/hr-profile";
import { loanBalance, printVoucher } from "@/lib/hr-ledger";
import { salesMoney } from "@/lib/sales";
import {
  addHrFine,
  deleteHrFine,
  deleteHrLoan,
  deleteHrLoanRepayment,
  issueHrLoan,
  repayHrLoan,
  type HrLoan,
  type HrStaff,
} from "@/lib/stl-features-api";

function moneyProblem(label: string, value: string) {
  const amount = Number(value);
  if (!value.trim() || !Number.isFinite(amount) || amount <= 0) {
    return `${label} must be greater than zero`;
  }
  return null;
}

export function HrLedgerCard({
  staff,
  onChanged,
  kind = "staff",
}: {
  staff: HrStaff;
  onChanged: () => Promise<void> | void;
  kind?: "staff" | "employee";
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loanAmount, setLoanAmount] = useState("");
  const [loanDate, setLoanDate] = useState("");
  const [loanNote, setLoanNote] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  const [fineDate, setFineDate] = useState("");
  const [fineReason, setFineReason] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [repayDate, setRepayDate] = useState("");
  const [repayNote, setRepayNote] = useState("");
  const [repayLoanId, setRepayLoanId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loans = staff.hrProfile?.loans || [];
  const fines = staff.hrProfile?.fines || [];
  const name = staff.hrProfile?.visaName || staff.name;

  async function run(action: () => Promise<unknown>, success: string) {
    if (!user?.id) return;
    setBusy(true);
    try {
      await action();
      toast(success, "success");
      await onChanged();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  function onIssueLoan(event: FormEvent) {
    event.preventDefault();
    const problem = moneyProblem("Loan amount", loanAmount);
    if (problem || !loanDate) {
      toast(problem || "Loan date is required", "info");
      return;
    }
    void run(async () => {
      if (!user?.id) return;
      await issueHrLoan(user.id, staff.id, {
        amount: Number(loanAmount),
        issuedOn: loanDate,
        note: loanNote.trim() || undefined,
      }, kind);
      setLoanAmount("");
      setLoanDate("");
      setLoanNote("");
    }, "Loan voucher saved");
  }

  function onAddFine(event: FormEvent) {
    event.preventDefault();
    const problem = moneyProblem("Fine amount", fineAmount);
    if (problem || !fineDate || !fineReason.trim()) {
      toast(problem || (!fineDate ? "Fine date is required" : "A reason is required"), "info");
      return;
    }
    void run(async () => {
      if (!user?.id) return;
      await addHrFine(user.id, staff.id, {
        amount: Number(fineAmount),
        date: fineDate,
        reason: fineReason.trim(),
      }, kind);
      setFineAmount("");
      setFineDate("");
      setFineReason("");
    }, "Fine recorded");
  }

  function onRepay(event: FormEvent, loan: HrLoan) {
    event.preventDefault();
    const problem = moneyProblem("Receipt amount", repayAmount);
    if (problem || !repayDate) {
      toast(problem || "Receipt date is required", "info");
      return;
    }
    void run(async () => {
      if (!user?.id) return;
      await repayHrLoan(user.id, staff.id, loan.entryId, {
        amount: Number(repayAmount),
        date: repayDate,
        note: repayNote.trim() || undefined,
      }, kind);
      setRepayAmount("");
      setRepayDate("");
      setRepayNote("");
      setRepayLoanId(null);
    }, "Receipt voucher saved");
  }

  function printLoan(loan: HrLoan) {
    try {
      printVoucher({
        title: "Loan voucher",
        voucherNo: loan.voucherNo,
        date: formatHrDate(loan.issuedOn),
        staffName: name,
        amount: salesMoney(loan.amount),
        particulars: loan.note || "Staff loan",
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Print failed", "error");
    }
  }

  function printReceipt(loan: HrLoan, repaymentId: string) {
    const repayment = (loan.repayments || []).find((row) => row.entryId === repaymentId);
    if (!repayment) return;
    try {
      printVoucher({
        title: "Receipt voucher",
        voucherNo: repayment.voucherNo,
        date: formatHrDate(repayment.date),
        staffName: name,
        amount: salesMoney(repayment.amount),
        particulars: repayment.note || "Loan repayment",
        extra: `Against ${loan.voucherNo}. Balance ${salesMoney(loanBalance(loan))}`,
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : "Print failed", "error");
    }
  }

  return (
    <Card>
      <h2 className="text-base font-semibold text-ink">Loans and fines</h2>
      <p className="mt-1 text-sm text-slate-500">
        A loan stays as its own balance. A fine dated in a month is taken off that month&apos;s final pay.
      </p>

      <div className="mt-4 space-y-3">
        {loans.length === 0 ? (
          <p className="text-sm text-slate-500">No loans yet.</p>
        ) : (
          loans.map((loan) => {
            const balance = loanBalance(loan);
            return (
              <div key={loan.entryId} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">
                      {loan.voucherNo} · {salesMoney(loan.amount)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatHrDate(loan.issuedOn)}
                      {loan.note ? ` · ${loan.note}` : ""} · Balance {salesMoney(balance)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <button type="button" className="font-medium text-brand-dark underline" onClick={() => printLoan(loan)}>
                      Print loan voucher
                    </button>
                    {balance > 0 ? (
                      <button
                        type="button"
                        className="font-medium text-brand-dark underline"
                        onClick={() => setRepayLoanId(repayLoanId === loan.entryId ? null : loan.entryId)}
                      >
                        Record receipt
                      </button>
                    ) : null}
                    {(loan.repayments || []).length === 0 ? (
                      <button
                        type="button"
                        className="font-medium text-red-700 underline disabled:opacity-50"
                        disabled={busy}
                        onClick={() => {
                          if (!user?.id || !confirm(`Remove loan ${loan.voucherNo}?`)) return;
                          void run(
                            () => deleteHrLoan(user.id, staff.id, loan.entryId, kind),
                            "Loan removed",
                          );
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
                {(loan.repayments || []).length ? (
                  <ul className="mt-3 space-y-1 text-sm">
                    {(loan.repayments || []).map((repayment) => (
                      <li key={repayment.entryId} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {repayment.voucherNo} · {formatHrDate(repayment.date)} · {salesMoney(repayment.amount)}
                          {repayment.note ? ` · ${repayment.note}` : ""}
                        </span>
                        <span className="flex gap-3">
                          <button
                            type="button"
                            className="font-medium text-brand-dark underline"
                            onClick={() => printReceipt(loan, repayment.entryId)}
                          >
                            Print receipt
                          </button>
                          <button
                            type="button"
                            className="font-medium text-red-700 underline disabled:opacity-50"
                            disabled={busy}
                            onClick={() => {
                              if (!user?.id || !confirm(`Remove receipt ${repayment.voucherNo}?`)) return;
                              void run(
                                () => deleteHrLoanRepayment(user.id, staff.id, loan.entryId, repayment.entryId, kind),
                                "Receipt removed",
                              );
                            }}
                          >
                            Delete
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {repayLoanId === loan.entryId ? (
                  <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={(event) => onRepay(event, loan)}>
                    <TextField label="Receipt amount (AED)" type="number" min={0} step="0.01" required value={repayAmount} onChange={(event) => setRepayAmount(event.target.value)} />
                    <TextField label="Receipt date" type="date" required value={repayDate} onChange={(event) => setRepayDate(event.target.value)} />
                    <TextField label="Note" optional value={repayNote} onChange={(event) => setRepayNote(event.target.value)} />
                    <div className="flex items-end">
                      <PrimaryButton type="submit" disabled={busy}>Save receipt</PrimaryButton>
                    </div>
                  </form>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={onIssueLoan}>
        <TextField label="New loan amount (AED)" type="number" min={0} step="0.01" value={loanAmount} onChange={(event) => setLoanAmount(event.target.value)} />
        <TextField label="Loan date" type="date" value={loanDate} onChange={(event) => setLoanDate(event.target.value)} />
        <TextField label="Loan note" optional value={loanNote} onChange={(event) => setLoanNote(event.target.value)} />
        <div className="flex items-end">
          <SecondaryButton type="submit" disabled={busy}>Add loan</SecondaryButton>
        </div>
      </form>

      <div className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold text-ink">Fines / deductions</h3>
        {fines.length === 0 ? (
          <p className="text-sm text-slate-500">No fines yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {fines.map((fine) => (
              <li key={fine.entryId} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {formatHrDate(fine.date)} · {salesMoney(fine.amount)} · {fine.reason}
                </span>
                <button
                  type="button"
                  className="font-medium text-red-700 underline disabled:opacity-50"
                  disabled={busy}
                  onClick={() => {
                    if (!user?.id || !confirm("Remove this fine?")) return;
                    void run(() => deleteHrFine(user.id, staff.id, fine.entryId, kind), "Fine removed");
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={onAddFine}>
        <TextField label="Fine amount (AED)" type="number" min={0} step="0.01" value={fineAmount} onChange={(event) => setFineAmount(event.target.value)} />
        <TextField label="Fine date" type="date" value={fineDate} onChange={(event) => setFineDate(event.target.value)} />
        <TextField label="Reason" value={fineReason} onChange={(event) => setFineReason(event.target.value)} />
        <div className="flex items-end">
          <SecondaryButton type="submit" disabled={busy}>Add fine</SecondaryButton>
        </div>
      </form>
    </Card>
  );
}
