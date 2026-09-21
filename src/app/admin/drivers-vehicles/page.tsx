"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";

export default function DriversVehiclesLandingPage() {
  return (
    <div>
      <PageHeader
        title="Drivers and vehicles"
        subtitle="Maintain driver records and vehicle numbers used in dispatch."
      />
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
        <Link
          href="/admin/drivers"
          className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-[#f7f5f0]"
        >
          <div>
            <p className="text-sm font-medium text-ink">Drivers</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Add, update, and remove driver records
            </p>
          </div>
          <span className="text-xs font-medium text-ink">Open</span>
        </Link>
        <Link
          href="/admin/vehicles"
          className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-[#f7f5f0]"
        >
          <div>
            <p className="text-sm font-medium text-ink">Vehicles</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Add, update, and remove vehicle numbers
            </p>
          </div>
          <span className="text-xs font-medium text-ink">Open</span>
        </Link>
      </div>
    </div>
  );
}
