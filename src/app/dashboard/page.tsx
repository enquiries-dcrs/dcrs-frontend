"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useResidents } from "@/hooks/useResidents";
import {
  TrendingUp,
  Users,
  AlertTriangle,
  Loader2,
  ListChecks,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useGlobalStore } from "@/store/useGlobalStore";
import { api } from "@/lib/api";
import { formatApiError } from "@/lib/format-api-error";

type RiskSeverity = "critical" | "high" | "medium" | "low";

type ClinicalRiskItem = {
  fingerprint: string;
  severity: RiskSeverity;
  category: string;
  type: string;
  title: string;
  detail: string;
  serviceUserId: string;
  residentName: string;
  homeId: string | null;
  homeName: string | null;
  /** Resolved cooldown for this row (per homes.metadata or API default). */
  ackCooldownHours?: number;
  ref?: { type: string; id: string };
  suggestedActions?: string[];
};

type HomeAckPolicy = { homeName: string | null; ackCooldownHours: number };

type ClinicalRiskReviewResponse = {
  items: ClinicalRiskItem[];
  methodology: string[];
  defaultAckCooldownHours?: number;
  homeAckCooldownByHomeId?: Record<string, HomeAckPolicy>;
  warnings: string[];
  generatedAt: string;
};

function severityBadgeVariant(s: RiskSeverity): "danger" | "warning" | "default" {
  if (s === "critical") return "danger";
  if (s === "high") return "warning";
  return "default";
}

function formatSeverityLabel(s: RiskSeverity): string {
  if (s === "critical") return "Critical";
  if (s === "high") return "High";
  if (s === "medium") return "Medium";
  return "Low";
}

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: residents, isLoading } = useResidents();
  const selectedHomeId = useGlobalStore((state) => state.selectedHomeId);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const [ackNotes, setAckNotes] = useState<Record<string, string>>({});

  const { data: overdueTasksData, isLoading: overdueTasksLoading } = useQuery({
    queryKey: ["tasks-inbox", "overdue"],
    queryFn: async () => {
      const { data } = await api.get("/api/v1/tasks?overdue=true");
      return data as { tasks: Array<{ id: string; title: string; serviceUserId: string; residentName: string }> };
    },
    staleTime: 30_000,
  });
  const overdueTasks = overdueTasksData?.tasks ?? [];

  const {
    data: riskReview,
    isLoading: riskLoading,
    isError: riskIsError,
    error: riskError,
    refetch: refetchRisk,
  } = useQuery({
    queryKey: ["clinical-risk-review"],
    queryFn: async () => {
      const { data } = await api.get<ClinicalRiskReviewResponse>("/api/v1/clinical-risk-review");
      return data;
    },
    staleTime: 45_000,
  });

  const filteredRiskItems = useMemo(() => {
    const list = riskReview?.items ?? [];
    if (selectedHomeId === "ALL") return list;
    return list.filter((i) => i.homeId === selectedHomeId);
  }, [riskReview?.items, selectedHomeId]);

  const acknowledgeMutation = useMutation({
    mutationFn: async ({ item, note }: { item: ClinicalRiskItem; note: string }) => {
      await api.post("/api/v1/clinical-risk-review/acknowledge", {
        fingerprint: item.fingerprint,
        serviceUserId: item.serviceUserId,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
    },
    onSuccess: (_data, vars) => {
      setAckError(null);
      setAckNotes((prev) => {
        const next = { ...prev };
        delete next[vars.item.fingerprint];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["clinical-risk-review"] });
    },
    onError: (err: unknown) => {
      setAckError(formatApiError(err).detail || "Could not acknowledge.");
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const admittedCount = residents?.filter((r) => r.status === "ADMITTED").length || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Group Command Center</h2>
          <p className="text-gray-500">Live clinical safety and occupancy overview.</p>
        </div>
      </div>

      {/* Clinical risk & review inbox (rule-based) */}
      <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center text-lg font-bold text-rose-950">
              <ClipboardList className="mr-2 h-5 w-5 shrink-0 text-rose-800" aria-hidden />
              Clinical risk &amp; review inbox
            </h3>
            <p className="mt-1 max-w-3xl text-sm text-rose-900/90">
              Deterministic rules over tasks, observations, and PEEP review dates — not predictive AI. Use alongside
              professional judgement and local policy.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-rose-900 ring-1 ring-rose-200">
              {riskLoading ? "—" : filteredRiskItems.length}
            </span>
            <button
              type="button"
              onClick={() => void refetchRisk()}
              className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-900 shadow-sm hover:bg-rose-100"
            >
              Refresh
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMethodologyOpen((v) => !v)}
          className="mb-3 flex w-full items-center justify-between rounded-lg border border-rose-200 bg-white/80 px-3 py-2 text-left text-sm font-medium text-rose-950 hover:bg-white"
        >
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4 shrink-0 text-rose-700" aria-hidden />
            Methodology &amp; thresholds
          </span>
          {methodologyOpen ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-rose-700" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-rose-700" aria-hidden />
          )}
        </button>
        {methodologyOpen && riskReview?.methodology?.length ? (
          <>
            <ul className="mb-4 list-disc space-y-1 rounded-lg border border-rose-100 bg-white/90 px-5 py-3 text-sm text-rose-900/95 marker:text-rose-600">
              {riskReview.methodology.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
            {riskReview.homeAckCooldownByHomeId &&
            Object.keys(riskReview.homeAckCooldownByHomeId).length > 0 ? (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-3 text-sm text-slate-800">
                <p className="mb-2 font-semibold text-slate-900">Acknowledgement cooldown by home (resolved)</p>
                <p className="mb-2 text-xs text-slate-600">
                  API default fallback: <strong>{riskReview.defaultAckCooldownHours ?? 48}h</strong>. Override in Postgres on{" "}
                  <code className="rounded bg-white px-1 py-0.5 text-[11px]">homes.metadata</code>: path{" "}
                  <code className="rounded bg-white px-1 py-0.5 text-[11px]">clinicalRiskReview.ackCooldownHours</code>{" "}
                  (integer 1–168), or legacy <code className="rounded bg-white px-1 py-0.5 text-[11px]">clinicalRiskAckCooldownHours</code>.
                </p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                  {Object.entries(riskReview.homeAckCooldownByHomeId).map(([hid, pol]) => (
                    <li key={hid} className="flex justify-between gap-2 border-b border-slate-200/80 py-1 last:border-0">
                      <span className="min-w-0 truncate font-medium text-slate-800">{pol.homeName || hid}</span>
                      <span className="shrink-0 font-mono text-slate-600">{pol.ackCooldownHours}h</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}

        {riskReview?.warnings?.length ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950">
            {riskReview.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        ) : null}

        {riskIsError ? (
          <div className="rounded-lg border border-rose-200 bg-white p-4 text-sm text-rose-800">
            <p className="font-semibold">Could not load risk inbox.</p>
            <p className="mt-1 text-rose-700">{formatApiError(riskError).detail}</p>
          </div>
        ) : riskLoading ? (
          <div className="flex items-center gap-2 text-sm text-rose-900/80">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading review items…
          </div>
        ) : filteredRiskItems.length === 0 ? (
          <p className="text-sm font-medium text-rose-900/80">
            No open review items for this location scope.{" "}
            {selectedHomeId !== "ALL" ? "Try &quot;Group View&quot; in the sidebar to see all homes." : ""}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredRiskItems.map((item) => (
              <div
                key={item.fingerprint}
                className="flex flex-col rounded-lg border border-rose-100 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold uppercase tracking-wide text-rose-700/90">
                      {item.category.replace(/_/g, " ")} · {item.type.replace(/_/g, " ")}
                    </p>
                    <p className="font-bold text-gray-900">{item.residentName}</p>
                    {item.homeName ? (
                      <p className="text-xs text-gray-500">{item.homeName}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={severityBadgeVariant(item.severity)}>{formatSeverityLabel(item.severity)}</Badge>
                    <span className="text-[10px] font-medium uppercase text-gray-400">Review</span>
                  </div>
                </div>
                <p className="mb-2 text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="mb-3 flex-1 text-sm text-gray-700">{item.detail}</p>
                {item.suggestedActions?.length ? (
                  <ul className="mb-3 list-disc space-y-1 border-t border-gray-100 pt-3 pl-4 text-xs text-gray-600 marker:text-gray-400">
                    {item.suggestedActions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                ) : null}
                <details className="mb-3 rounded-lg border border-gray-100 bg-slate-50/80 px-3 py-2 text-xs text-gray-700">
                  <summary className="cursor-pointer font-semibold text-gray-800 outline-none">
                    Optional acknowledgement note
                  </summary>
                  <label className="mt-2 block">
                    <span className="sr-only">Optional note</span>
                    <textarea
                      className="mt-1 w-full resize-y rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-rose-400"
                      rows={3}
                      maxLength={2000}
                      placeholder="e.g. GP aware, observations repeated, duty manager informed…"
                      value={ackNotes[item.fingerprint] ?? ""}
                      onChange={(e) =>
                        setAckNotes((prev) => ({ ...prev, [item.fingerprint]: e.target.value }))
                      }
                    />
                  </label>
                </details>
                <div className="mt-auto flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => router.push(`/residents/${item.serviceUserId}`)}
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Open clinical record
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    disabled={acknowledgeMutation.isPending}
                    onClick={() =>
                      acknowledgeMutation.mutate({
                        item,
                        note: ackNotes[item.fingerprint] ?? "",
                      })
                    }
                    className="rounded-lg bg-rose-100 px-3 py-1.5 text-sm font-semibold text-rose-900 transition-colors hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Acknowledge ({item.ackCooldownHours ?? riskReview?.defaultAckCooldownHours ?? 48}h)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {ackError ? (
          <p className="mt-3 text-sm font-medium text-rose-700" role="alert">
            {ackError}
          </p>
        ) : null}

        {riskReview?.generatedAt ? (
          <p className="mt-3 text-[11px] text-rose-800/70">
            Snapshot: {new Date(riskReview.generatedAt).toLocaleString("en-GB")}
          </p>
        ) : null}
      </div>

      {/* Overdue tasks (home-scoped via API user scope) */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center text-lg font-bold text-amber-950">
            <ListChecks className="mr-2 h-5 w-5 shrink-0" aria-hidden />
            Overdue tasks
          </h3>
          <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-amber-900 ring-1 ring-amber-200">
            {overdueTasksLoading ? "—" : overdueTasks.length}
          </span>
        </div>
        {overdueTasksLoading ? (
          <div className="flex items-center gap-2 text-sm text-amber-900/80">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : overdueTasks.length === 0 ? (
          <p className="text-sm text-amber-900/80">No overdue open tasks in your scope.</p>
        ) : (
          <ul className="divide-y divide-amber-200/80 rounded-lg border border-amber-200/80 bg-white">
            {overdueTasks.slice(0, 8).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-gray-900">{t.title}</span>
                  {t.residentName ? (
                    <span className="mt-0.5 block truncate text-xs text-gray-500">{t.residentName}</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => router.push(`/residents/${t.serviceUserId}`)}
                  className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  Open chart
                </button>
              </li>
            ))}
          </ul>
        )}
        {overdueTasks.length > 8 ? (
          <p className="mt-2 text-xs text-amber-900/70">
            Showing 8 of {overdueTasks.length}. Filter on each service user&apos;s Tasks tab.
          </p>
        ) : null}
      </div>

      {/* High-Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => router.push("/residents")}
          className="cursor-pointer rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-300"
        >
          <div className="mb-4 flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Total Census</h3>
              <p className="text-sm text-gray-500">Currently admitted across group</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{admittedCount}</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Pending Referrals</h3>
              <p className="text-sm text-gray-500">Awaiting clinical assessment</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">0</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm opacity-80">
          <div className="mb-4 flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Predictive models</h3>
              <p className="text-sm text-gray-500">Reserved for governed AI workflows</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2 text-slate-500">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-gray-600">
            The inbox above uses explicit rules only. Separate governance is required before any ML risk scores ship
            here.
          </p>
        </div>
      </div>
    </div>
  );
}
