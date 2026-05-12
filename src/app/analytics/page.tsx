"use client";

import Link from "next/link";
import {
  Download,
  FileBarChart,
  Shield,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useGlobalStore } from "@/store/useGlobalStore";

/** Must match backend `ROLES_RESIDENT_RECORD_EXPORT` (managerial roster / record export). */
const ROLES_RESIDENT_ROSTER_EXPORT = [
  "Deputy Manager",
  "Home Manager",
  "Regional Manager",
  "Admin",
] as const;

const KPI_PERIODS = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 28 days", value: "28d" },
  { label: "Quarter to date", value: "qtd" },
];

type AssuranceIndicator = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  hint?: string;
};

type AssuranceDomain = {
  id: string;
  title: string;
  cqcPrompt: string;
  indicators: AssuranceIndicator[];
};

type AssurancePackRes = {
  schemaVersion: number;
  generatedAt: string;
  period: { label: string; from: string; to: string };
  home: { filterHomeId: string | null; label: string };
  disclaimer: string;
  domains: AssuranceDomain[];
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<(typeof KPI_PERIODS)[number]["value"]>("7d");
  const [rosterExporting, setRosterExporting] = useState(false);
  const [assuranceCsvExporting, setAssuranceCsvExporting] = useState(false);
  const user = useGlobalStore((s) => s.user);
  const selectedHomeId = useGlobalStore((s) => s.selectedHomeId);
  const canExportResidentRoster =
    user?.role != null && ROLES_RESIDENT_ROSTER_EXPORT.includes(user.role as (typeof ROLES_RESIDENT_ROSTER_EXPORT)[number]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["analytics-summary", period],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/analytics/summary?period=${encodeURIComponent(period)}`);
      return data as {
        period: { label: string; from: string; to: string };
        notesCreated: number;
        residents: { admitted: number; discharged: number; pending: number };
        audit: { total: number; ai_actions: number; non_success: number };
        topActions: Array<{ action: string; count: number }>;
      };
    },
    staleTime: 30_000,
  });

  const { data: assurancePack, isLoading: assuranceLoading, isError: assuranceError } = useQuery({
    queryKey: ["analytics-assurance-pack", period, selectedHomeId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("period", period);
      if (selectedHomeId && selectedHomeId !== "ALL") {
        params.set("homeId", selectedHomeId);
      }
      const { data } = await api.get<AssurancePackRes>(
        `/api/v1/analytics/assurance-pack?${params.toString()}`
      );
      return data;
    },
    enabled: canExportResidentRoster,
    staleTime: 60_000,
  });

  const exportAssurancePackCsv = async () => {
    setAssuranceCsvExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("period", period);
      if (selectedHomeId && selectedHomeId !== "ALL") {
        params.set("homeId", selectedHomeId);
      }
      const path = `/api/v1/analytics/assurance-pack.csv?${params.toString()}`;
      const { data: blob } = await api.get(path, { responseType: "blob" });
      const dl = new Blob([blob], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(dl);
      const a = document.createElement("a");
      a.href = url;
      const suffix =
        selectedHomeId && selectedHomeId !== "ALL" ? selectedHomeId.slice(0, 8) : "estate";
      a.download = `cqc-assurance-pack-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      let msg = "Could not download assurance pack CSV.";
      if (typeof e === "object" && e !== null && "response" in e) {
        const res = (e as { response?: { data?: unknown } }).response;
        const raw = res?.data;
        if (raw instanceof Blob) {
          try {
            const text = await raw.text();
            try {
              const parsed = JSON.parse(text) as { error?: string };
              if (typeof parsed.error === "string") msg = parsed.error;
            } catch {
              if (text.trim()) msg = text.slice(0, 200);
            }
          } catch {
            /* ignore */
          }
        }
      }
      alert(msg);
    } finally {
      setAssuranceCsvExporting(false);
    }
  };

  const kpis = useMemo(() => {
    const notesCreated = data?.notesCreated ?? 0;
    const aiActions = data?.audit?.ai_actions ?? 0;
    const auditTotal = data?.audit?.total ?? 0;
    const auditNonSuccess = data?.audit?.non_success ?? 0;
    const admitted = data?.residents?.admitted ?? 0;

    return [
      {
        id: "notes",
        label: "Clinical notes created",
        value: String(notesCreated),
        detail: data?.period?.label ? `During ${data.period.label.toLowerCase()}` : "Selected period",
        icon: Shield,
        tone: "text-blue-700 bg-blue-50 border-blue-100",
      },
      {
        id: "ai",
        label: "AI actions (governance log)",
        value: String(aiActions),
        detail: auditTotal ? `${aiActions} of ${auditTotal} audit rows` : "Selected period",
        icon: Shield,
        tone: "text-violet-700 bg-violet-50 border-violet-100",
      },
      {
        id: "risk",
        label: "Non-success audit events",
        value: String(auditNonSuccess),
        detail: admitted ? `Current admitted residents: ${admitted}` : "Across the estate",
        icon: Shield,
        tone: "text-amber-800 bg-amber-50 border-amber-100",
      },
    ];
  }, [data]);

  const exportAuditCsv = async () => {
    const params = new URLSearchParams();
    if (data?.period?.from) params.set("from", data.period.from);
    if (data?.period?.to) params.set("to", data.period.to);
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000"}/api/v1/admin/audit-logs/export.csv?${params.toString()}`;

    // Use a direct navigation download so cookies/auth headers are handled by the browser.
    window.location.assign(url);
  };

  const exportResidentsRosterCsv = async () => {
    setRosterExporting(true);
    try {
      const params = new URLSearchParams();
      if (selectedHomeId && selectedHomeId !== "ALL") {
        params.set("homeId", selectedHomeId);
      }
      const qs = params.toString();
      const path = `/api/v1/analytics/residents-export.csv${qs ? `?${qs}` : ""}`;
      const { data: blob } = await api.get(path, { responseType: "blob" });
      const dl = new Blob([blob], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(dl);
      const a = document.createElement("a");
      a.href = url;
      const suffix =
        selectedHomeId && selectedHomeId !== "ALL" ? selectedHomeId : "all-homes";
      a.download = `residents-roster-${suffix}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      let msg = "Could not download roster export.";
      if (typeof e === "object" && e !== null && "response" in e) {
        const res = (e as { response?: { data?: unknown; status?: number } }).response;
        const raw = res?.data;
        if (raw instanceof Blob) {
          try {
            const text = await raw.text();
            try {
              const parsed = JSON.parse(text) as { error?: string };
              if (typeof parsed.error === "string") msg = parsed.error;
            } catch {
              if (text.trim()) msg = text.slice(0, 200);
            }
          } catch {
            /* ignore */
          }
        } else if (
          raw &&
          typeof raw === "object" &&
          "error" in raw &&
          typeof (raw as { error?: string }).error === "string"
        ) {
          msg = (raw as { error: string }).error;
        }
      }
      alert(msg);
    } finally {
      setRosterExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Analytics</h1>
          <p className="text-sm text-zinc-600">
            Compliance and quality reporting for governance and CQC evidence.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <span className="sr-only">Reporting period</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as (typeof KPI_PERIODS)[number]["value"])}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              {KPI_PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void exportAuditCsv()}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export audit CSV
          </button>
          {canExportResidentRoster ? (
            <button
              type="button"
              disabled={rosterExporting}
              onClick={() => void exportResidentsRosterCsv()}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              {rosterExporting ? "Preparing…" : "Export resident roster CSV"}
            </button>
          ) : null}
        </div>
      </div>
      {canExportResidentRoster ? (
        <p className="text-xs text-zinc-500">
          Roster export uses the home selected in the sidebar: choose one home for a single-home file,
          or &quot;All homes&quot; for an estate-wide CSV (home columns included). Accounts limited to one
          home always receive that home only.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/dashboard"
          className="font-medium text-blue-600 hover:underline"
        >
          Dashboard
        </Link>
        <Link href="/bed-board" className="text-zinc-600 hover:text-zinc-900">
          Bed board
        </Link>
        <Link href="/settings" className="text-zinc-600 hover:text-zinc-900">
          Settings
        </Link>
      </div>

      {canExportResidentRoster ? (
        <div className="rounded-xl border border-teal-200 bg-teal-50/80 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-teal-950">CQC-shaped assurance pack</h2>
              <p className="mt-1 max-w-3xl text-sm text-teal-900/90">
                Manager-grade metrics grouped under the five CQC <strong>quality statement</strong> themes (Safe,
                Effective, Caring, Responsive, Well-led). Use as <strong>evidence prompts</strong> for governance and
                inspection preparation — not a rating predictor. Same period and home scope as roster export.
              </p>
              {assurancePack?.disclaimer ? (
                <p className="mt-3 text-xs leading-relaxed text-teal-900/80">{assurancePack.disclaimer}</p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={assuranceCsvExporting || assuranceLoading}
              onClick={() => void exportAssurancePackCsv()}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-teal-700 bg-teal-700 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800 disabled:opacity-50"
            >
              <Download className="h-4 w-4" aria-hidden />
              {assuranceCsvExporting ? "Preparing CSV…" : "Download pack (CSV)"}
            </button>
          </div>
          {assuranceError ? (
            <p className="mt-4 text-sm text-rose-700">Could not load assurance pack. Check your role and try again.</p>
          ) : assuranceLoading ? (
            <p className="mt-4 text-sm text-teal-800">Loading assurance metrics…</p>
          ) : assurancePack ? (
            <div className="mt-6 space-y-4">
              <p className="text-xs text-teal-900/80">
                <span className="font-medium">Scope:</span> {assurancePack.home.label} ·{" "}
                <span className="font-medium">Generated:</span>{" "}
                {new Date(assurancePack.generatedAt).toLocaleString("en-GB")} ·{" "}
                <span className="font-medium">Period:</span> {assurancePack.period.label}
              </p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {assurancePack.domains.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-lg border border-teal-100 bg-white/90 p-4 shadow-sm"
                  >
                    <h3 className="font-semibold text-teal-950">{d.title}</h3>
                    <p className="mt-1 text-[11px] leading-snug text-teal-800/85">{d.cqcPrompt}</p>
                    <ul className="mt-3 space-y-2 text-sm">
                      {d.indicators.map((ind) => (
                        <li key={ind.key} className="flex justify-between gap-2 border-b border-teal-50 pb-2 last:border-0">
                          <span className="text-teal-900/90">{ind.label}</span>
                          <span className="shrink-0 font-mono font-semibold text-teal-950">
                            {ind.value == null ? "—" : ind.value}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
          <strong className="text-zinc-800">CQC-shaped assurance pack</strong> is available to deputy managers, home
          managers, regional managers, and admins. Ask your organisation for export permissions if you need this view.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {kpis.map((k) => (
          <div
            key={k.id}
            className={`rounded-xl border p-4 shadow-sm ${k.tone}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium opacity-90">{k.label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">
                  {isLoading ? "—" : k.value}
                </p>
                <p className="mt-1 text-xs opacity-80">
                  {isError ? "Unable to load reporting data." : k.detail}
                </p>
              </div>
              <k.icon className="h-8 w-8 shrink-0 opacity-80" aria-hidden />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-zinc-900">
          <FileBarChart className="h-5 w-5 text-zinc-500" aria-hidden />
          <h2 className="font-semibold">Trend snapshot</h2>
        </div>
        <p className="text-sm text-zinc-600">
          Charts connect to your reporting warehouse in a later phase. For now
          this section holds the layout for time-series compliance (e.g. missed
          rounds, overdue tasks, falls rate).
        </p>
        <div className="mt-6 flex h-40 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
          Chart placeholder
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="font-semibold text-zinc-900">Other audit-ready extracts</h2>
          <p className="text-xs text-zinc-500">
            Use resident CSV exports from the service user record where available; additional catalogue items below are
            roadmap placeholders.
          </p>
        </div>
        <ul className="divide-y divide-zinc-100 text-sm">
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-zinc-800">Medication administration log</span>
            <span className="text-zinc-500">CSV · PDF (planned)</span>
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-zinc-800">Incident register summary</span>
            <span className="text-zinc-500">CSV (planned)</span>
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-zinc-800">Staff competency matrix</span>
            <span className="text-zinc-500">PDF (planned)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
