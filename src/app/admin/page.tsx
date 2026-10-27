"use client";

import { useEffect, useState } from "react";
import { KpiDashboard } from "@/components/KpiDashboard";
import { useAuth } from "@/components/AuthProvider";
import { useDubaiNow } from "@/components/StlFeatureUi";
import { getMulkyaAlerts, loadDashboardStats, type DashboardStats } from "@/lib/api";
import type { ExpiryAlertRow } from "@/lib/expiry-window";
import {
  getAdminKpiDashboard,
  type AdminKpiDashboard,
  type CompanyKey,
} from "@/lib/stl-features-api";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const dubai = useDubaiNow();
  const [companyKey, setCompanyKey] = useState<CompanyKey>("stl");
  const [kpi, setKpi] = useState<AdminKpiDashboard | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [stats, setStats] = useState<Partial<DashboardStats>>({});
  const [statsError, setStatsError] = useState<string | null>(null);
  const [kpiEpoch, setKpiEpoch] = useState(0);
  const [statsEpoch, setStatsEpoch] = useState(0);
  const [mulkyaAlerts, setMulkyaAlerts] = useState<ExpiryAlertRow[]>([]);
  const [mulkyaLoading, setMulkyaLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    let cancelled = false;

    void (async () => {
      try {
        const data = await getAdminKpiDashboard(userId, { companyKey });
        if (cancelled) return;
        setKpi(data);
        setKpiError(null);
      } catch (e) {
        if (cancelled) return;
        setKpiError(e instanceof Error ? e.message : "Failed to load KPIs");
      } finally {
        if (!cancelled) setKpiLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, companyKey, kpiEpoch]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await getMulkyaAlerts();
        if (cancelled) return;
        setMulkyaAlerts(data.vehicles || []);
      } catch {
        if (!cancelled) setMulkyaAlerts([]);
      } finally {
        if (!cancelled) setMulkyaLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kpiEpoch]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const next: Partial<DashboardStats> = {};
        await loadDashboardStats((partial) => {
          Object.assign(next, partial);
          if (!cancelled) setStats({ ...next });
        });
        if (!cancelled) setStatsError(null);
      } catch (e) {
        if (!cancelled) {
          setStatsError(
            e instanceof Error ? e.message : "Failed to load dashboard totals",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [statsEpoch]);

  return (
    <KpiDashboard
      dubai={dubai}
      companyKey={companyKey}
      onCompanyKey={(key) => {
        setCompanyKey(key);
        setKpiLoading(true);
      }}
      loading={kpiLoading}
      onRefresh={() => {
        setKpiLoading(true);
        setMulkyaLoading(true);
        setStats({});
        setKpiEpoch((n) => n + 1);
        setStatsEpoch((n) => n + 1);
      }}
      kpi={kpi}
      kpiError={kpiError}
      onRetryKpi={() => {
        setKpiLoading(true);
        setMulkyaLoading(true);
        setKpiEpoch((n) => n + 1);
      }}
      stats={stats}
      statsError={statsError}
      onRetryStats={() => setStatsEpoch((n) => n + 1)}
      mulkyaAlerts={mulkyaAlerts}
      mulkyaLoading={mulkyaLoading}
    />
  );
}
