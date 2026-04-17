"use client";

import Link from "next/link";
import {
  ClipboardCheck,
  Download,
  FileBarChart,
  Pill,
  Shield,
} from "lucide-react";

const KPI_PERIODS = ["Last 7 days", "Last 28 days", "Quarter to date"];

/** Placeholder compliance metrics until reporting API exists. */
const MOCK_KPIS = [
  {
    id: "med",
    label: "Medication round documentation",
    value: "98.2%",
    detail: "Within policy window",
    icon: Pill,
    tone: "text-emerald-700 bg-emerald-50 border-emerald-100",
  },
  {
    id: "notes",
    label: "Daily notes completed on time",
    value: "94.0%",
    detail: "Per care plan frequency",
    icon: ClipboardCheck,
    tone: "text-blue-700 bg-blue-50 border-blue-100",
  },
  {
    id: "inc",
    label: "Incidents logged ≤ 24h",
    value: "100%",
    detail: "Regulatory target",
    icon: Shield,
    tone: "text-violet-700 bg-violet-50 border-violet-100",
  },
];

export default function AnalyticsPage() {
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
            <select className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500">
              {KPI_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
        </div>
      </div>

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

      <div className="grid gap-4 md:grid-cols-3">
        {MOCK_KPIS.map((k) => (
          <div
            key={k.id}
            className={`rounded-xl border p-4 shadow-sm ${k.tone}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium opacity-90">{k.label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">
                  {k.value}
                </p>
                <p className="mt-1 text-xs opacity-80">{k.detail}</p>
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
          <h2 className="font-semibold text-zinc-900">Audit-ready extracts</h2>
          <p className="text-xs text-zinc-500">
            Immutable logs and sign-offs for inspections (mock list).
          </p>
        </div>
        <ul className="divide-y divide-zinc-100 text-sm">
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-zinc-800">Medication administration log</span>
            <span className="text-zinc-500">CSV · PDF</span>
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-zinc-800">Incident register summary</span>
            <span className="text-zinc-500">CSV</span>
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-zinc-800">Staff competency matrix</span>
            <span className="text-zinc-500">PDF</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
