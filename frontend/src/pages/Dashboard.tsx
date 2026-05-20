import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
<<<<<<< HEAD
import { useI18n } from "@/i18n";
import type { TranslationKey } from "@/i18n";
import { api } from "@/lib/api";
import { useThemeStore } from "@/store/theme";
=======
import { api } from "@/lib/api";
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca

type Summary = {
  severity_counts: Record<string, number>;
  timeline: { date: string; count: number }[];
  top_iocs: { ioc: string; count: number }[];
  origins: Record<string, number>;
  integrations: { provider: string; status: string }[];
};

<<<<<<< HEAD
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

function integrationBadge(status: string) {
  if (status === "live") return "badge-live";
  if (status === "missing") return "badge-missing";
  return "badge-error";
}

export function DashboardPage() {
  const { t } = useI18n();
  const theme = useThemeStore((s) => s.theme);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const chartTick = theme === "dark" ? "#94a3b8" : "#64748b";

=======
export function DashboardPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<Summary>("/api/v1/dashboard/summary");
        if (!cancelled) setData(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sevData = useMemo(() => {
    if (!data) return [];
<<<<<<< HEAD
    return SEVERITIES.map((k) => ({
      name: t(`dashboard.severity.${k}` as TranslationKey),
      value: data.severity_counts[k] || 0,
    }));
  }, [data, t]);
=======
    return ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((k) => ({ name: k, value: data.severity_counts[k] || 0 }));
  }, [data]);
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca

  const originsSorted = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.origins)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [data]);

  if (loading || !data) {
<<<<<<< HEAD
    return <div className="animate-pulse text-secondary">{t("dashboard.loading")}</div>;
=======
    return <div className="animate-pulse text-slate-300">Loading dashboard…</div>;
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
  }

  return (
    <div className="space-y-6">
      <div>
<<<<<<< HEAD
        <h1 className="page-title">{t("dashboard.title")}</h1>
        <p className="page-subtitle">{t("dashboard.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {SEVERITIES.map((k, idx) => (
          <motion.div key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-secondary">{t(`dashboard.severity.${k}` as TranslationKey)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{data.severity_counts[k] || 0}</div>
=======
        <h1 className="text-2xl font-semibold">Threat dashboard</h1>
        <p className="text-sm text-slate-400">Last 30 days, scoped to your tenant.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((k, idx) => (
          <motion.div key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-slate-300">{k}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{data.severity_counts[k] || 0}</div>
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
<<<<<<< HEAD
            <CardTitle>{t("dashboard.analysesOverTime")}</CardTitle>
=======
            <CardTitle>Analyses over time</CardTitle>
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.timeline}>
<<<<<<< HEAD
                <XAxis dataKey="date" tick={{ fill: chartTick, fontSize: 10 }} />
                <YAxis tick={{ fill: chartTick, fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: theme === "dark" ? "#1e293b" : "#fff",
                    border: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
                    borderRadius: "8px",
                    color: theme === "dark" ? "#f1f5f9" : "#0f172a",
                  }}
                />
=======
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip />
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
                <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
<<<<<<< HEAD
            <CardTitle>{t("dashboard.severityDistribution")}</CardTitle>
=======
            <CardTitle>Severity distribution</CardTitle>
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sevData}>
<<<<<<< HEAD
                <XAxis dataKey="name" tick={{ fill: chartTick, fontSize: 10 }} />
                <YAxis tick={{ fill: chartTick, fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: theme === "dark" ? "#1e293b" : "#fff",
                    border: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.1)" : "#e2e8f0"}`,
                    borderRadius: "8px",
                    color: theme === "dark" ? "#f1f5f9" : "#0f172a",
                  }}
                />
=======
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip />
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
                <Bar dataKey="value" fill="#7c3aed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
<<<<<<< HEAD
            <CardTitle>{t("dashboard.topIocs")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.top_iocs.length === 0 ? (
              <div className="text-sm text-muted">{t("dashboard.noData")}</div>
            ) : (
              data.top_iocs.map((r) => (
                <div key={r.ioc} className="surface-row flex items-center justify-between">
                  <span className="truncate font-mono text-primary">{r.ioc}</span>
                  <span className="font-medium text-secondary">{r.count}</span>
=======
            <CardTitle>Top IOCs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.top_iocs.length === 0 ? (
              <div className="text-sm text-slate-400">No data yet.</div>
            ) : (
              data.top_iocs.map((r) => (
                <div key={r.ioc} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  <span className="truncate font-mono">{r.ioc}</span>
                  <span className="text-slate-300">{r.count}</span>
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
<<<<<<< HEAD
            <CardTitle>{t("dashboard.threatOrigins")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {originsSorted.length === 0 ? (
              <div className="text-sm text-muted">{t("dashboard.noGeo")}</div>
            ) : (
              originsSorted.map(([c, n]) => (
                <div key={c} className="surface-row flex items-center justify-between">
                  <span className="text-primary">{c}</span>
                  <span className="font-medium text-secondary">{n}</span>
=======
            <CardTitle>Threat origins (approx.)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {originsSorted.length === 0 ? (
              <div className="text-sm text-slate-400">No geo hints yet.</div>
            ) : (
              originsSorted.map(([c, n]) => (
                <div key={c} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  <span>{c}</span>
                  <span className="text-slate-300">{n}</span>
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
<<<<<<< HEAD
          <CardTitle>{t("dashboard.integrationStatus")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {data.integrations.map((i) => (
            <span key={i.provider} className={integrationBadge(i.status)}>
              {i.provider}: {t(`dashboard.integration.${i.status}` as TranslationKey) || i.status}
=======
          <CardTitle>Integration status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {data.integrations.map((i) => (
            <span
              key={i.provider}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                i.status === "live"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : i.status === "missing"
                    ? "bg-slate-500/15 text-slate-300"
                    : "bg-rose-500/15 text-rose-300"
              }`}
            >
              {i.provider}: {i.status}
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
            </span>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
