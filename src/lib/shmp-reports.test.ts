import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ShmpProductionLog } from "./shmp-production.ts";
import {
  buildAttendanceReport,
  buildProductionReport,
  dubaiRangeInstants,
  eachIsoDate,
  formatDubaiDateTime,
  loadProductionLogs,
  monthBoundsIso,
  renderAttendanceReport,
  renderProductionReport,
} from "./shmp-reports.ts";

function pdfText(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("latin1");
}

function assertValidPdf(bytes: Uint8Array) {
  const text = pdfText(bytes);
  assert.equal(text.startsWith("%PDF-1.4\n"), true);
  assert.equal(text.trimEnd().endsWith("%%EOF"), true);
  const marker = text.lastIndexOf("startxref\n");
  const xrefOffset = Number(text.slice(marker + "startxref\n".length).split("\n")[0]);
  assert.equal(text.slice(xrefOffset, xrefOffset + 4), "xref");
  for (const match of text.matchAll(/^(\d{10}) 00000 n $/gm)) {
    const offset = Number(match[1]);
    assert.match(text.slice(offset, offset + 12), /^\d+ 0 obj/);
  }
  return text;
}

const ahmed: ShmpProductionLog = {
  entryId: "e1",
  worker: { _id: "w1", name: "Ahmed" },
  designation: "Operator",
  order: { invoiceNo: "SHMP-1" },
  store: { storeName: "Al Ain Market" },
  item: { name: "Floor tile" },
  date: "2026-11-02T06:00:00.000Z",
  cartonQty: 10,
  value: 300,
};

const sara: ShmpProductionLog = {
  entryId: "e2",
  worker: { _id: "w2", name: "Sara" },
  order: { invoiceNo: "SHMP-2" },
  store: { storeName: "Dubai Mall" },
  item: { name: "Wall tile" },
  date: "2026-11-02T08:00:00.000Z",
  cartonQty: 4,
  value: 80,
};

describe("production report", () => {
  it("totals cartons, value, and the worker with the most cartons", () => {
    const report = buildProductionReport({
      title: "Daily production report",
      periodLabel: "2 Nov 2026",
      generatedLabel: "2 Nov 2026, 10:05 Dubai",
      logs: [sara, { ...ahmed, entryId: "e3", cartonQty: 6, value: 120 }, ahmed],
      cartons: 20,
      value: 500,
      showValue: true,
    });
    assert.equal(report.cartons, 20);
    assert.equal(report.value, 500);
    assert.deepEqual(report.leaders, [{ name: "Ahmed (Operator)", cartons: 16 }]);
    assert.equal(report.workers[0].name, "Ahmed (Operator)");
    assert.equal(report.logs[0].store, "Al Ain Market");
    const text = assertValidPdf(renderProductionReport(report));
    assert.match(text, /Daily production report/);
    assert.match(text, /Highest cartons: Ahmed/);
    assert.match(text, /Total cartons packed: 20/);
    assert.match(text, /AED 500\.00/);
  });

  it("lists every worker when the carton count is tied", () => {
    const report = buildProductionReport({
      title: "Daily production report",
      periodLabel: "2 Nov 2026",
      generatedLabel: "now",
      logs: [ahmed, { ...sara, cartonQty: 10, value: 300 }],
      showValue: true,
    });
    assert.equal(report.leaders.length, 2);
    const text = pdfText(renderProductionReport(report));
    assert.match(text, /10 each/);
  });

  it("splits one packing entry across the workers on it and hides value", () => {
    const report = buildProductionReport({
      title: "Daily production report",
      periodLabel: "2 Nov 2026",
      generatedLabel: "now",
      logs: [
        { ...ahmed, entryId: "shared", cartonQty: 10, value: 200 },
        { ...sara, entryId: "shared", cartonQty: 10, value: 200 },
      ],
      showValue: false,
    });
    assert.equal(report.cartons, 10);
    assert.equal(report.value, undefined);
    assert.deepEqual(
      report.workers.map((worker) => worker.cartons),
      [5, 5],
    );
    assert.equal(report.logs[0].cartons, "5");
    const text = pdfText(renderProductionReport(report));
    assert.equal(text.includes("AED"), false);
  });
});

describe("loadProductionLogs", () => {
  it("asks for one day by date", async () => {
    const calls: Record<string, string>[] = [];
    const loaded = await loadProductionLogs(
      { from: "2026-11-02", to: "2026-11-02" },
      "co",
      async (params) => {
        calls.push(params);
        return { todayCartons: 3, todayValue: 9, logs: [ahmed] };
      },
    );
    assert.deepEqual(calls, [{ date: "2026-11-02", companyId: "co" }]);
    assert.equal(loaded.cartons, 3);
    assert.equal(loaded.value, 9);
  });

  it("uses a ranged response when the API returns the period", async () => {
    const calls: string[] = [];
    const loaded = await loadProductionLogs(
      { from: "2026-11-01", to: "2026-11-02" },
      "",
      async (params) => {
        calls.push(params.date || `${params.from}:${params.to}`);
        return {
          periodStart: "2026-11-01",
          periodEnd: "2026-11-02",
          todayCartons: 14,
          todayValue: 40,
          logs: [ahmed, sara],
        };
      },
    );
    assert.deepEqual(calls, ["2026-11-01:2026-11-02"]);
    assert.equal(loaded.cartons, 14);
    assert.equal(loaded.logs.length, 2);
  });

  it("loads each day when the API has no period", async () => {
    const calls: string[] = [];
    const loaded = await loadProductionLogs(
      { from: "2026-11-01", to: "2026-11-03" },
      "co",
      async (params) => {
        calls.push(params.date || "range");
        if (!params.date) return { logs: [] };
        return {
          todayCartons: 1,
          logs: [{ ...ahmed, entryId: params.date, date: `${params.date}T08:00:00.000Z` }],
        };
      },
    );
    assert.deepEqual(calls, ["range", "2026-11-01", "2026-11-02", "2026-11-03"]);
    assert.equal(loaded.cartons, 3);
    assert.equal(loaded.value, undefined);
    assert.equal(loaded.logs.length, 3);
  });
});

describe("attendance report", () => {
  const people = [
    { key: "worker:w1", name: "Ahmed", role: "Operator" },
    { key: "portal:s1", name: "Sara", role: "Supervisor" },
  ];

  it("includes the roster, leave, half day, holiday, and check-in times", () => {
    const report = buildAttendanceReport({
      title: "Daily attendance report",
      periodLabel: "2 Nov 2026",
      generatedLabel: "2 Nov 2026, 10:05 Dubai",
      from: "2026-11-02",
      to: "2026-11-02",
      people,
      rows: [
        {
          status: "absent",
          date: "2026-11-02T00:00:00.000Z",
          employee: { _id: "w1", name: "Old name", designation: "Helper" },
        },
        {
          status: "checked_out",
          date: "2026-11-02T00:00:00.000Z",
          checkInAt: "2026-11-02T04:00:00.000Z",
          checkOutAt: "2026-11-02T13:00:00.000Z",
          source: "biometric",
          shift: { name: "Morning" },
          employee: { _id: "w1", name: "Ahmed", designation: "Operator" },
        },
        {
          status: "leave",
          date: "2026-11-01T20:30:00.000Z",
          leaveType: "annual",
          source: "leave",
          user: { _id: "s1", name: "Sara", role: "Supervisor" },
        },
        {
          status: "present",
          date: "2026-10-01T00:00:00.000Z",
          employee: { _id: "w1", name: "Ahmed" },
        },
      ],
    });
    assert.equal(report.staff, 2);
    assert.equal(report.presentDays, 1);
    assert.equal(report.leaveDays, 1);
    assert.equal(report.absentDays, 0);
    const ahmed = report.people.find((person) => person.name === "Ahmed");
    assert.equal(ahmed?.present, 1);
    assert.equal(ahmed?.role, "Operator");
    const ahmedDay = report.days.find((day) => day.name === "Ahmed");
    assert.equal(ahmedDay?.status, "Present");
    assert.equal(ahmedDay?.checkIn, "02 Nov 08:00");
    assert.equal(ahmedDay?.role, "Operator, Morning");
    assert.equal(ahmedDay?.source, "Fingerprint");
    const sara = report.days.find((day) => day.name === "Sara");
    assert.equal(sara?.status, "Leave");
    assert.equal(sara?.leave, "Annual");
    const text = assertValidPdf(renderAttendanceReport(report));
    assert.match(text, /Daily attendance report/);
    assert.match(text, /Present days: 1/);
  });

  it("marks roster staff with no record as absent and keeps half days and holidays", () => {
    const report = buildAttendanceReport({
      title: "Monthly attendance report",
      periodLabel: "November 2026",
      generatedLabel: "now",
      from: "2026-11-01",
      to: "2026-11-02",
      people,
      rows: [
        {
          status: "half_day",
          date: "2026-11-01T08:00:00.000Z",
          source: "override",
          remarks: "Left early",
          employee: { _id: "w1", name: "Ahmed", designation: "Operator" },
        },
        {
          status: "holiday",
          date: "2026-11-02T08:00:00.000Z",
          employee: { _id: "w1", name: "Ahmed" },
        },
      ],
    });
    assert.equal(report.halfDays, 1);
    assert.equal(report.holidayDays, 1);
    assert.equal(report.absentDays, 2);
    const ahmed = report.people.find((person) => person.name === "Ahmed");
    assert.equal(ahmed?.halfDay, 1);
    assert.equal(ahmed?.holiday, 1);
    assert.equal(ahmed?.absent, 0);
    const sara = report.people.find((person) => person.name === "Sara");
    assert.equal(sara?.absent, 2);
    assert.equal(
      report.days.find((day) => day.name === "Ahmed" && day.status === "Half day")?.source,
      "Override - Left early",
    );
  });

  it("keeps a person who is no longer on the roster", () => {
    const report = buildAttendanceReport({
      title: "Daily attendance report",
      periodLabel: "2 Nov 2026",
      generatedLabel: "now",
      from: "2026-11-02",
      to: "2026-11-02",
      people: [],
      rows: [
        {
          status: "present",
          date: "2026-11-02T08:00:00.000Z",
          checkInAt: "2026-11-02T04:15:00.000Z",
          employee: { _id: "old", name: "Nabil", designation: "Helper" },
        },
      ],
    });
    assert.equal(report.staff, 1);
    assert.equal(report.presentDays, 1);
    assert.equal(report.absentDays, 0);
    assert.equal(report.days[0].name, "Nabil");
  });
});

describe("report periods", () => {
  it("lists each calendar day and the Dubai instants for a range", () => {
    assert.deepEqual(eachIsoDate("2026-11-01", "2026-11-03"), [
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
    assert.deepEqual(eachIsoDate("2026-11-03", "2026-11-01"), []);
    assert.deepEqual(monthBoundsIso("2026-11"), {
      from: "2026-11-01",
      to: "2026-11-30",
    });
    assert.equal(monthBoundsIso("2026-13"), null);
    assert.deepEqual(dubaiRangeInstants("2026-11-02", "2026-11-02"), {
      from: "2026-11-01T20:00:00.000Z",
      to: "2026-11-02T19:59:59.999Z",
    });
  });

  it("formats check-in time in Dubai", () => {
    assert.equal(formatDubaiDateTime("2026-11-02T06:05:00.000Z"), "02 Nov 10:05");
    assert.equal(formatDubaiDateTime(""), "-");
  });

  it("starts a second page when the log is long", () => {
    const logs = Array.from({ length: 80 }, (_, index) => ({
      ...ahmed,
      entryId: `e${index}`,
      worker: { _id: `w${index}`, name: `Worker ${index}` },
    }));
    const report = buildProductionReport({
      title: "Monthly production report",
      periodLabel: "November 2026",
      generatedLabel: "now",
      logs,
      showValue: true,
    });
    const text = assertValidPdf(renderProductionReport(report));
    assert.ok((text.match(/\/Type \/Page \/Parent/g) || []).length >= 2);
  });
});
