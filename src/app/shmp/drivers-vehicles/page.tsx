"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";

export default function ShmpDriversVehiclesLandingPage() {
  return (
    <div>
      <PageHeader
        title="Drivers and vehicles"
        subtitle="The same driver and vehicle records used in STL. Edit vehicle details and keep maintenance history here."
      />
      <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
        <Link
          href="/shmp/drivers"
          className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-[#f7f5f0]"
        >
          <div>
            <p className="text-sm font-medium text-ink">Drivers</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Add, update, and remove shared driver records
            </p>
          </div>
          <span className="text-xs font-medium text-ink">Open</span>
        </Link>
        <Link
          href="/shmp/vehicles"
          className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-[#f7f5f0]"
        >
          <div>
            <p className="text-sm font-medium text-ink">Vehicles</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Shared vehicle list, purchase details, and maintenance
            </p>
          </div>
          <span className="text-xs font-medium text-ink">Open</span>
        </Link>
      </div>
    </div>
  );
}
