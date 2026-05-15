import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar } from "recharts";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

type Summary = {
  severity_counts: Record<string, number>;
  timeline: { date: string; count: number }[];
  top_iocs: { ioc: string; count: number }[];
  origins: Record<string, number>;
  integrations: { provider: string; status: string }[];
};

export function DashboardPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

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
    return ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((k) => ({ name: k, value: data.severity_counts[k] || 0 }));
  }, [data]);

  const originsSorted = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.origins)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [data]);

  if (loading || !data) {
    return <div className="animate-pulse text-slate-300">Loading dashboard…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
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
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Analyses over time</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.timeline}>
                <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Severity distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sevData}>
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#7c3aed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
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
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
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
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
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
            </span>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
