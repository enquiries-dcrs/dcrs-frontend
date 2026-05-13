"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useGlobalStore } from "@/store/useGlobalStore";
import { formatApiError } from "@/lib/format-api-error";
import { isValidUuid } from "@/lib/uuid";
import {
  mergeCommunalBathroomItems,
  type ChecklistItemRow,
} from "@/features/facility/communalBathroomChecklistDef";
import { ChevronLeft, ChevronRight, Droplets, Loader2, Save } from "lucide-react";

function mondayOfWeekLocal(d: Date): string {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = t.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  t.setDate(t.getDate() + diff);
  const yyyy = t.getFullYear();
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  const dd = String(t.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addWeeksToMonday(mondayIso: string, weeks: number): string {
  const [y, m, d] = mondayIso.split("-").map(Number);
  const t = new Date(y, m - 1, d + weeks * 7);
  return mondayOfWeekLocal(t);
}

type CleanGetResponse = {
  home: { id: string; name: string };
  weekStartMonday: string;
  items: ChecklistItemRow[];
  supervisorNotes: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export default function CommunalBathroomWeeklyCleanPage() {
  const queryClient = useQueryClient();
  const selectedHomeId = useGlobalStore((s) => s.selectedHomeId);
  const [weekMonday, setWeekMonday] = useState(() => mondayOfWeekLocal(new Date()));
  const [supervisorNotes, setSupervisorNotes] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  /** Real DB home id from sidebar; invalid legacy mock UUIDs are ignored here. */
  const sidebarScopedHome =
    selectedHomeId !== "ALL" && isValidUuid(selectedHomeId) ? selectedHomeId : null;

  const { data: layout, isLoading: layoutLoading } = useQuery({
    queryKey: ["facility-layout"],
    queryFn: async () => {
      const { data } = await api.get<{ homes: Array<{ id: string; name: string }> }>("/api/v1/facility-layout");
      return data;
    },
    staleTime: 60_000,
  });

  const [pickedHome, setPickedHome] = useState<string>("");

  const homesList = layout?.homes ?? [];
  const firstValidHomeId = useMemo(
    () => homesList.map((h) => h?.id).find((id) => isValidUuid(String(id ?? ""))) ?? "",
    [homesList]
  );

  const activeHomeId = useMemo(() => {
    if (sidebarScopedHome) return sidebarScopedHome;
    if (!homesList.length) return "";
    if (pickedHome && homesList.some((h) => h.id === pickedHome) && isValidUuid(pickedHome)) return pickedHome;
    return firstValidHomeId;
  }, [sidebarScopedHome, pickedHome, homesList, firstValidHomeId]);

  const queryEnabled = isValidUuid(activeHomeId);

  const { data, isLoading, isFetching, isError, error, refetch, isPending } = useQuery({
    queryKey: ["communal-bathroom-weekly-clean", activeHomeId, weekMonday],
    queryFn: async () => {
      const { data: d } = await api.get<CleanGetResponse>("/api/v1/facility/communal-bathroom-weekly-clean", {
        params: { homeId: activeHomeId, weekStart: weekMonday },
      });
      return d;
    },
    enabled: queryEnabled,
  });

  const displayItems = useMemo(() => mergeCommunalBathroomItems(data), [data]);

  const checklistInitialLoad = queryEnabled && !data && !isError && (isPending || isLoading || isFetching);

  React.useEffect(() => {
    if (!displayItems.length) return;
    const next: Record<string, boolean> = {};
    for (const it of displayItems) next[it.key] = it.done;
    setChecks(next);
    setSupervisorNotes(data?.supervisorNotes || "");
  }, [data?.weekStartMonday, data?.home?.id, data?.updatedAt, data?.supervisorNotes, displayItems]);

  React.useEffect(() => {
    if (sidebarScopedHome != null || !layout?.homes?.length) return;
    setPickedHome((prev) => {
      if (prev && layout.homes.some((h) => h.id === prev)) return prev;
      return layout.homes[0].id;
    });
  }, [layout?.homes, sidebarScopedHome]);

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      checklistState: Record<string, { done: boolean }>;
      homeId: string;
      weekMonday: string;
      supervisorNotes: string;
    }) => {
      await api.put("/api/v1/facility/communal-bathroom-weekly-clean", {
        homeId: payload.homeId,
        weekStartMonday: payload.weekMonday,
        checklistState: payload.checklistState,
        supervisorNotes: payload.supervisorNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      setSaveError(null);
      void queryClient.invalidateQueries({ queryKey: ["communal-bathroom-weekly-clean"] });
      void refetch();
    },
    onError: (err: unknown) => {
      setSaveError(formatApiError(err).detail || "Save failed.");
    },
  });

  const progress = useMemo(() => {
    const keys = displayItems.map((i) => i.key);
    if (!keys.length) return { done: 0, total: 0 };
    const done = keys.filter((k) => checks[k]).length;
    return { done, total: keys.length };
  }, [displayItems, checks]);

  const needsHomePick = !sidebarScopedHome && !layoutLoading && homesList.length === 0;

  const waitingForHomes = !sidebarScopedHome && layoutLoading;

  const homesLoadedButNoValidHomeId =
    !sidebarScopedHome && !layoutLoading && homesList.length > 0 && !queryEnabled;

  const homeLabel =
    sidebarScopedHome != null
      ? homesList.find((h) => h.id === sidebarScopedHome)?.name ?? data?.home?.name ?? "Selected home"
      : homesList.find((h) => h.id === (pickedHome || firstValidHomeId))?.name ?? data?.home?.name ?? "";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 pb-20 animate-in fade-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Droplets className="h-7 w-7 shrink-0 text-cyan-600" aria-hidden />
            Communal bathroom — weekly deep clean
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            One checklist per home, per week (week starts Monday). Use with your local cleaning SOP and COSHH
            requirements.
          </p>
        </div>
      </div>

      {sidebarScopedHome == null ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm">
          <label className="block text-xs font-semibold uppercase tracking-wide text-amber-950">Home</label>
          <select
            value={pickedHome || homesList[0]?.id || ""}
            onChange={(e) => setPickedHome(e.target.value)}
            className="mt-1 w-full max-w-md rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">Select a home…</option>
            {homesList.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          {!homesList.length ? (
            <p className="mt-2 text-xs text-amber-900/80">Loading homes…</p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          Recording for: <strong>{homeLabel}</strong> (from sidebar location scope).
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <span className="text-sm font-medium text-gray-700">Week starting (Monday)</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekMonday((w) => addWeeksToMonday(w, -1))}
            className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[10rem] text-center font-mono text-sm font-semibold text-gray-900">{weekMonday}</span>
          <button
            type="button"
            onClick={() => setWeekMonday((w) => addWeeksToMonday(w, 1))}
            className="rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50"
            aria-label="Next week"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setWeekMonday(mondayOfWeekLocal(new Date()))}
            className="ml-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-200"
          >
            This week
          </button>
        </div>
      </div>

      {waitingForHomes ? (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading homes…
        </div>
      ) : needsHomePick ? (
        <p className="text-sm font-medium text-amber-800">
          No homes are available in your account scope. Check access or try again later.
        </p>
      ) : homesLoadedButNoValidHomeId ? (
        <p className="text-sm font-medium text-amber-800">
          Facility layout returned homes without a usable id. Refresh the page or contact support.
        </p>
      ) : checklistInitialLoad ? (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading checklist…
        </div>
      ) : isError ? (
        <p className="text-sm text-rose-700">{formatApiError(error).detail}</p>
      ) : queryEnabled && displayItems.length > 0 ? (
        <>
          <div className="rounded-lg border border-cyan-100 bg-cyan-50/80 px-4 py-2 text-sm text-cyan-950">
            <strong>{data?.home?.name ?? homeLabel}</strong> · {progress.done} / {progress.total} tasks marked complete
            {!data?.items?.length ? (
              <span className="ml-2 text-xs text-amber-800">
                Checklist loaded from app defaults (API returned no rows). Save still syncs to the server.
              </span>
            ) : null}
            {data?.updatedAt ? (
              <span className="ml-2 text-xs text-cyan-900/80">
                Last saved {new Date(data.updatedAt).toLocaleString("en-GB")}
                {data.updatedBy ? ` · ${data.updatedBy}` : ""}
              </span>
            ) : null}
          </div>

          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {displayItems.map((item) => (
              <li key={item.key} className="flex gap-3 p-4 hover:bg-slate-50/80">
                <input
                  id={`cb-${item.key}`}
                  type="checkbox"
                  checked={Boolean(checks[item.key])}
                  onChange={(e) => setChecks((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                />
                <div className="min-w-0 flex-1">
                  <label htmlFor={`cb-${item.key}`} className="cursor-pointer font-medium text-gray-900">
                    {item.label}
                  </label>
                  <p className="mt-0.5 text-xs text-gray-500">{item.hint}</p>
                  {item.done && item.completedAt ? (
                    <p className="mt-1 text-[11px] text-gray-400">
                      Logged {new Date(item.completedAt).toLocaleString("en-GB")}
                      {item.completedBy ? ` · ${item.completedBy}` : ""}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
              Supervisor / handover notes
            </label>
            <textarea
              value={supervisorNotes}
              onChange={(e) => setSupervisorNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Issues escalated, stock orders, maintenance tickets…"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {saveError ? (
            <p className="text-sm font-medium text-rose-700" role="alert">
              {saveError}
            </p>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saveMutation.isPending || !displayItems.length}
              onClick={() => {
                if (!displayItems.length) return;
                const checklistState: Record<string, { done: boolean }> = {};
                for (const it of displayItems) {
                  checklistState[it.key] = { done: Boolean(checks[it.key]) };
                }
                const hid = data?.home?.id ?? activeHomeId;
                saveMutation.mutate({
                  checklistState,
                  homeId: hid,
                  weekMonday,
                  supervisorNotes,
                });
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              Save checklist
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
