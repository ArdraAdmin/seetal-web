"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  shmpAttendance,
  shmpCreateEmployee,
  shmpEmployees,
  shmpImportAttendance,
  shmpOverrideAttendance,
} from "@/lib/shmp-api";

type Emp = {
  _id: string;
  name: string;
  designation?: string;
  company?: string;
  biometricId?: string;
  salary?: { basic?: number };
};

export default function ShmpHrPage() {
  const [tab, setTab] = useState<"employees" | "attendance">("employees");
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [attendance, setAttendance] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("Operator");
  const [biometricId, setBiometricId] = useState("");
  const [importJson, setImportJson] = useState(
    '[{"biometricId":"1","punchedAt":"2026-10-22T08:00:00.000Z","punchType":"in"}]',
  );
  const [overrideEmp, setOverrideEmp] = useState("");
  const [overrideStatus, setOverrideStatus] = useState("present");
  const [overrideReason, setOverrideReason] = useState("");

  async function refresh() {
    setError(null);
    try {
      const list = (await shmpEmployees(companyId || undefined)) as Emp[];
      setEmployees(list);
      const att = await shmpAttendance(
        companyId ? { companyId, mine: "0" } : { mine: "0" },
      );
      setAttendance(att as unknown[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!companyId || !name) return;
    try {
      await shmpCreateEmployee({
        name,
        company: companyId,
        designation,
        biometricId: biometricId || undefined,
      });
      setName("");
      setBiometricId("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function onImport(e: FormEvent) {
    e.preventDefault();
    if (!companyId) {
      setError("Company ID required for import");
      return;
    }
    try {
      const punches = JSON.parse(importJson);
      await shmpImportAttendance({ companyId, punches });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  }

  async function onOverride(e: FormEvent) {
    e.preventDefault();
    if (!companyId || !overrideEmp || !overrideReason) return;
    try {
      await shmpOverrideAttendance({
        companyId,
        employeeId: overrideEmp,
        date: new Date().toISOString(),
        newStatus: overrideStatus,
        reason: overrideReason,
      });
      setOverrideReason("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Override failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">HR & Attendance</h1>
        <p className="mt-1 text-sm text-slate-600">
          Factory staff profiles, fingerprint import, and attendance overrides.
        </p>
      </div>

      <label className="block max-w-md text-sm">
        <span className="font-medium text-slate-700">Company ID</span>
        <input
          className="mt-1 w-full rounded-xl border border-line px-3 py-2"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          placeholder="Mongo Company ObjectId for SHMP"
        />
      </label>

      <div className="flex gap-2">
        <TabBtn active={tab === "employees"} onClick={() => setTab("employees")}>
          Employees
        </TabBtn>
        <TabBtn
          active={tab === "attendance"}
          onClick={() => setTab("attendance")}
        >
          Attendance
        </TabBtn>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl border border-line px-3 py-1.5 text-sm"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {tab === "employees" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={onCreate}
            className="space-y-3 rounded-2xl border border-line bg-white p-5"
          >
            <h2 className="font-semibold">Add employee</h2>
            <input
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            >
              <option>Operator</option>
              <option>Helper</option>
              <option>Supervisor</option>
              <option>Staff</option>
              <option>Other</option>
            </select>
            <input
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              placeholder="Biometric ID"
              value={biometricId}
              onChange={(e) => setBiometricId(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold"
            >
              Create
            </button>
          </form>
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="font-semibold">Staff ({employees.length})</h2>
            <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto text-sm">
              {employees.map((e) => (
                <li
                  key={e._id}
                  className="flex justify-between border-b border-line/50 py-2"
                >
                  <span>
                    {e.name}{" "}
                    <span className="text-slate-500">({e.designation})</span>
                  </span>
                  <span className="text-xs text-slate-400">
                    {e.biometricId || e._id.slice(-6)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={onImport}
            className="space-y-3 rounded-2xl border border-line bg-white p-5"
          >
            <h2 className="font-semibold">Import fingerprint punches (JSON)</h2>
            <textarea
              className="h-40 w-full rounded-xl border border-line px-3 py-2 font-mono text-xs"
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold"
            >
              Import
            </button>
          </form>
          <form
            onSubmit={onOverride}
            className="space-y-3 rounded-2xl border border-line bg-white p-5"
          >
            <h2 className="font-semibold">Attendance override</h2>
            <select
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              value={overrideEmp}
              onChange={(e) => setOverrideEmp(e.target.value)}
            >
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              value={overrideStatus}
              onChange={(e) => setOverrideStatus(e.target.value)}
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="leave">Leave</option>
              <option value="holiday">Holiday</option>
            </select>
            <input
              className="w-full rounded-xl border border-line px-3 py-2 text-sm"
              placeholder="Reason (required)"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold"
            >
              Override
            </button>
          </form>
          <div className="rounded-2xl border border-line bg-white p-5 lg:col-span-2">
            <h2 className="font-semibold">Recent attendance</h2>
            <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-slate-50 p-3 text-xs">
              {JSON.stringify(attendance.slice(0, 30), null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
        active ? "bg-brand text-black" : "border border-line bg-white"
      }`}
    >
      {children}
    </button>
  );
}
