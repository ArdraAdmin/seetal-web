"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ErrorState, LoadingState, SecondaryButton } from "@/components/ui";
import { companyLabel, getCompanies, type CompanyRecord } from "@/lib/api";
import { portalFieldVisible } from "@/lib/custom-users";
import { formatHrDate, hrProfileToForm } from "@/lib/hr-profile";
import { salesMoney } from "@/lib/sales";
import { getHrStaffRecord, type HrFileRef, type HrStaff } from "@/lib/stl-features-api";

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  const text = value == null || value === "" ? "-" : String(value);
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink">{text}</dd>
    </div>
  );
}

function FileValue({ file }: { file?: HrFileRef | null }) {
  if (!file?.fileName) return <>-</>;
  if (!file.url) return <>{file.fileName}</>;
  return (
    <a href={file.url} target="_blank" rel="noreferrer" className="text-brand-dark underline">
      {file.fileName}
    </a>
  );
}

function FileDetail({ label, file }: { label: string; file?: HrFileRef | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink">
        <FileValue file={file} />
      </dd>
    </div>
  );
}

function monthLabel(year: number, month: number) {
  return `${String(month).padStart(2, "0")}/${year}`;
}

export function HrStaffDetails({
  staffId,
  scope,
  onClose,
}: {
  staffId: string;
  scope: "stl" | "shmp";
  onClose: () => void;
}) {
  const { user } = useAuth();
  const portal = scope === "stl" ? "selling" : "shmp";
  const show = (fieldId: string) => portalFieldVisible(user?.customAccess, portal, "hr", fieldId);
  const [staff, setStaff] = useState<HrStaff | null>(null);
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void Promise.all([
      getHrStaffRecord(user.id, staffId),
      getCompanies().catch(() => [] as CompanyRecord[]),
    ])
      .then(([record, companyRows]) => {
        if (cancelled) return;
        setStaff(record);
        setCompanies(companyRows);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStaff(null);
        setError(err instanceof Error ? err.message : "Failed to load staff");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, staffId]);

  const profile = staff?.hrProfile;
  const salaryForm = hrProfileToForm(profile, staff?.name || "", scope);
  const company = companies.find((row) => row._id === profile?.company);
  const editHref = scope === "stl" ? `/admin/hr/staff/${staffId}` : `/shmp/hr/staff/${staffId}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-details-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="my-6 w-full max-w-3xl rounded-2xl border border-line bg-white p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="staff-details-title" className="text-lg font-semibold text-ink">
              {staff?.name || "Staff"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{staff?.email || "Staff record"}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={editHref}
              className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-4 py-2 text-sm hover:bg-[#f7f5f0]"
            >
              Edit
            </Link>
            <SecondaryButton type="button" onClick={onClose}>
              Close
            </SecondaryButton>
          </div>
        </div>

        {loading ? (
          <div className="mt-4">
            <LoadingState label="Loading staff…" />
          </div>
        ) : error ? (
          <div className="mt-4">
            <ErrorState message={error} />
          </div>
        ) : staff && profile ? (
          <div className="mt-5 space-y-6">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-ink">Personal</h3>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Detail label="Name as per visa" value={profile.visaName || staff.name} />
                <Detail label="Email" value={staff.email} />
                <Detail label="Mobile" value={staff.mobileNumber} />
                <Detail label="Role" value={staff.role} />
                <Detail label="Designation as per visa" value={profile.visaDesignation} />
                {scope === "stl" ? (
                  <Detail label="Company" value={company ? companyLabel(company) : profile.company} />
                ) : null}
                <Detail label="Joined" value={formatHrDate(staff.joiningDate)} />
                <Detail label="Years of service" value={staff.yearsOfService ?? "-"} />
                <Detail label="Food served" value={profile.foodServed ? "On" : "Off"} />
                {scope === "shmp" ? (
                  <Detail label="Production worker" value={profile.productionWorker ? "On" : "Off"} />
                ) : null}
              </dl>
            </section>

            {show("salary") ? (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-ink">Salary</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Basic salary" value={salaryForm.basicSalary === "" ? "-" : salesMoney(Number(salaryForm.basicSalary))} />
                  {scope === "stl" ? (
                    <Detail label="Other benefits" value={salaryForm.otherBenefits === "" ? "-" : salesMoney(Number(salaryForm.otherBenefits))} />
                  ) : null}
                  <Detail label="Total salary" value={salaryForm.totalSalary === "" ? "-" : salesMoney(Number(salaryForm.totalSalary))} />
                  <Detail
                    label="Sunday allowance"
                    value={profile.sundayAllowance == null ? "-" : salesMoney(profile.sundayAllowance)}
                  />
                </dl>
                {(profile.salaryIncrements || []).length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Increment history</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {[...(profile.salaryIncrements || [])].sort((a, b) =>
                        String(b.effectiveDate).localeCompare(String(a.effectiveDate)),
                      ).map((inc) => (
                        <li key={inc.entryId || `${inc.effectiveDate}-${inc.amount}`}>
                          {formatHrDate(inc.effectiveDate)} · {salesMoney(inc.amount)}
                          {inc.previousSalary != null ? ` from ${salesMoney(inc.previousSalary)}` : ""}
                          {inc.notes ? ` · ${inc.notes}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {(profile.salarySlips || []).length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Uploaded salary slips</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {[...(profile.salarySlips || [])].sort((a, b) => b.year - a.year || b.month - a.month).map((slip) => (
                        <li key={`${slip.year}-${slip.month}`}>
                          <span className="text-slate-500">{monthLabel(slip.year, slip.month)} · </span>
                          <FileValue file={slip.file} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            {show("passport") ? (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-ink">Passport</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Passport number" value={profile.passportNumber} />
                  <Detail label="Passport expiry" value={formatHrDate(profile.passportExpiry)} />
                  <FileDetail label="Passport copy" file={profile.passportCopy} />
                  <FileDetail label="Photo" file={profile.photo} />
                </dl>
              </section>
            ) : null}

            {show("eid") ? (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-ink">Emirates ID</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Detail label="EID number" value={profile.eidNumber} />
                  <Detail label="EID expiry" value={formatHrDate(profile.eidExpiry)} />
                  <FileDetail label="EID copy" file={profile.eidCopy} />
                </dl>
              </section>
            ) : null}

            {show("visa") ? (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-ink">Visa</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Visa UID number" value={profile.visaNumber} />
                  <Detail label="Visa expiry" value={formatHrDate(profile.visaExpiry)} />
                  <Detail label="Visa application year" value={profile.visaApplicationYear} />
                  <FileDetail label="Visa copy" file={profile.visaCopy} />
                </dl>
              </section>
            ) : null}

            {show("insurance") ? (
              <section>
                <h3 className="mb-3 text-sm font-semibold text-ink">Insurance and contract</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Detail label="Insurance expiry" value={formatHrDate(profile.insuranceExpiry)} />
                  <FileDetail label="Insurance copy" file={profile.insuranceCopy} />
                  <FileDetail label="Employment contract" file={profile.employmentContractCopy} />
                  <FileDetail label="Offer letter" file={profile.offerLetter} />
                </dl>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
