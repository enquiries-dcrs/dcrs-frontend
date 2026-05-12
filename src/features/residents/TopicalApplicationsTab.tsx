"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2, Package } from "lucide-react";
import { formatApiError } from "@/lib/format-api-error";

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Must match backend `TOPICAL_BODY_REGION_IDS` in server.js */
export const TOPICAL_REGION_LABELS: Record<string, string> = {
  head: "Head / face",
  neck: "Neck",
  chest: "Chest",
  abdomen: "Abdomen",
  left_upper_arm: "Left upper arm",
  right_upper_arm: "Right upper arm",
  left_forearm: "Left forearm",
  right_forearm: "Right forearm",
  left_hand: "Left hand",
  right_hand: "Right hand",
  left_thigh: "Left thigh",
  right_thigh: "Right thigh",
  left_shin: "Left shin (front)",
  right_shin: "Right shin (front)",
  left_foot: "Left foot",
  right_foot: "Right foot",
  groin: "Groin / genital area",
  upper_back: "Upper back",
  mid_back: "Mid back",
  lower_back: "Lower back",
  left_buttock: "Left buttock",
  right_buttock: "Right buttock",
  left_calf_back: "Left calf (back)",
  right_calf_back: "Right calf (back)",
};

type TopicalEntry = {
  id: string;
  chartDate: string;
  appliedAt: string;
  medicationName: string;
  medicationId: string | null;
  bodyRegions: string[];
  siteNotes: string | null;
  batchLot: string | null;
  recordedBy: string | null;
  createdAt: string;
};

type MedOption = { id: string; name: string; route?: string };

type Zone = { id: string; x: number; y: number; w: number; h: number; rx?: number };

const FRONT_ZONES: Zone[] = [
  { id: "head", x: 44, y: 4, w: 32, h: 36, rx: 14 },
  { id: "neck", x: 52, y: 40, w: 16, h: 14, rx: 4 },
  { id: "chest", x: 36, y: 54, w: 48, h: 44, rx: 6 },
  { id: "abdomen", x: 40, y: 98, w: 40, h: 52, rx: 6 },
  { id: "left_upper_arm", x: 12, y: 58, w: 22, h: 38, rx: 8 },
  { id: "right_upper_arm", x: 86, y: 58, w: 22, h: 38, rx: 8 },
  { id: "left_forearm", x: 8, y: 98, w: 20, h: 40, rx: 6 },
  { id: "right_forearm", x: 92, y: 98, w: 20, h: 40, rx: 6 },
  { id: "left_hand", x: 6, y: 138, w: 18, h: 22, rx: 4 },
  { id: "right_hand", x: 96, y: 138, w: 18, h: 22, rx: 4 },
  { id: "groin", x: 48, y: 150, w: 24, h: 22, rx: 4 },
  { id: "left_thigh", x: 32, y: 174, w: 28, h: 48, rx: 8 },
  { id: "right_thigh", x: 60, y: 174, w: 28, h: 48, rx: 8 },
  { id: "left_shin", x: 34, y: 224, w: 24, h: 38, rx: 6 },
  { id: "right_shin", x: 62, y: 224, w: 24, h: 38, rx: 6 },
  { id: "left_foot", x: 34, y: 262, w: 22, h: 16, rx: 4 },
  { id: "right_foot", x: 64, y: 262, w: 22, h: 16, rx: 4 },
];

const BACK_ZONES: Zone[] = [
  { id: "upper_back", x: 36, y: 52, w: 48, h: 44, rx: 6 },
  { id: "mid_back", x: 40, y: 96, w: 40, h: 36, rx: 6 },
  { id: "lower_back", x: 42, y: 132, w: 36, h: 40, rx: 6 },
  { id: "left_buttock", x: 28, y: 172, w: 28, h: 32, rx: 8 },
  { id: "right_buttock", x: 64, y: 172, w: 28, h: 32, rx: 8 },
  { id: "left_calf_back", x: 34, y: 206, w: 22, h: 42, rx: 6 },
  { id: "right_calf_back", x: 64, y: 206, w: 22, h: 42, rx: 6 },
];

function BodyMapSvg({
  title,
  viewWidth,
  viewHeight,
  zones,
  selected,
  toggle,
}: {
  title: string;
  viewWidth: number;
  viewHeight: number;
  zones: Zone[];
  selected: Set<string>;
  toggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
      <svg
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        className="h-auto w-full max-w-[200px] touch-manipulation"
        role="img"
        aria-label={`${title} body map; click a region to mark where topical product was applied.`}
      >
        <rect x={0} y={0} width={viewWidth} height={viewHeight} fill="#f8fafc" rx={8} />
        {zones.map((z) => {
          const on = selected.has(z.id);
          return (
            <rect
              key={z.id}
              x={z.x}
              y={z.y}
              width={z.w}
              height={z.h}
              rx={z.rx ?? 4}
              tabIndex={0}
              role="button"
              aria-pressed={on}
              aria-label={TOPICAL_REGION_LABELS[z.id] || z.id}
              onClick={() => toggle(z.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(z.id);
                }
              }}
              className={`cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 ${
                on ? "fill-rose-200 stroke-rose-600 stroke-2" : "fill-slate-200/90 stroke-slate-400 stroke"
              }`}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function TopicalApplicationsTab({
  residentId,
  isReadOnly,
  medications = [],
}: {
  residentId: string;
  isReadOnly: boolean;
  medications?: MedOption[];
}) {
  const queryClient = useQueryClient();
  const [chartDate, setChartDate] = useState(todayIsoDate);
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(() => new Set());
  const [medicationName, setMedicationName] = useState("");
  const [medicationId, setMedicationId] = useState("");
  const [siteNotes, setSiteNotes] = useState("");
  const [batchLot, setBatchLot] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["topical-applications", residentId, chartDate],
    queryFn: async () => {
      const { data: d } = await api.get<{
        date: string | null;
        entries: TopicalEntry[];
        allowedBodyRegions?: string[];
      }>(`/api/v1/residents/${residentId}/topical-applications`, { params: { date: chartDate } });
      return d;
    },
    enabled: Boolean(residentId),
  });

  const entries = data?.entries ?? [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const regions = [...selectedRegions];
      await api.post(`/api/v1/residents/${residentId}/topical-applications`, {
        medicationName: medicationName.trim(),
        bodyRegions: regions,
        date: chartDate,
        siteNotes: siteNotes.trim() || undefined,
        batchLot: batchLot.trim() || undefined,
        ...(medicationId ? { medicationId } : {}),
      });
    },
    onSuccess: () => {
      setFormError(null);
      setSelectedRegions(new Set());
      setSiteNotes("");
      setBatchLot("");
      setMedicationId("");
      void queryClient.invalidateQueries({ queryKey: ["topical-applications", residentId] });
      void queryClient.invalidateQueries({ queryKey: ["resident", residentId] });
      void refetch();
    },
    onError: (err: unknown) => {
      setFormError(formatApiError(err).detail || "Could not save record.");
    },
  });

  const toggleRegion = (id: string) => {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const topicalMeds = useMemo(
    () =>
      medications.filter((m) => {
        const r = (m.route || "").toLowerCase();
        const n = (m.name || "").toLowerCase();
        return r.includes("topical") || r.includes("skin") || r.includes("transdermal") || n.includes("cream") || n.includes("gel") || n.includes("ointment");
      }),
    [medications],
  );

  const applyMedTemplate = (m: MedOption) => {
    setMedicationId(m.id);
    setMedicationName(m.name);
  };

  return (
    <div className="animate-in fade-in space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Topical medicines — application record</h3>
          <p className="text-sm text-gray-500">
            Record where topical products were applied using the body maps (front and back). One entry per
            application round.
          </p>
        </div>
        <label className="flex flex-col text-xs font-medium text-gray-600">
          Chart date
          <input
            type="date"
            value={chartDate}
            onChange={(e) => setChartDate(e.target.value)}
            className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-violet-500"
          />
        </label>
      </div>

      {!isReadOnly && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-5 shadow-sm">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-violet-950">
            <Package className="h-4 w-4 shrink-0" aria-hidden />
            New application
          </h4>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Medication name <span className="text-rose-600">*</span>
                </label>
                <input
                  value={medicationName}
                  onChange={(e) => setMedicationName(e.target.value)}
                  placeholder="e.g. Dermacool 1% cream"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  maxLength={300}
                />
              </div>
              {topicalMeds.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-gray-600">Quick fill from MAR (topical / skin routes)</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {topicalMeds.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => applyMedTemplate(m)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          medicationId === m.id
                            ? "border-violet-600 bg-violet-600 text-white"
                            : "border-violet-200 bg-white text-violet-900 hover:bg-violet-100"
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600">Batch / lot (optional)</label>
                  <input
                    value={batchLot}
                    onChange={(e) => setBatchLot(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                    maxLength={120}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600">Site notes (optional)</label>
                <textarea
                  value={siteNotes}
                  onChange={(e) => setSiteNotes(e.target.value)}
                  rows={3}
                  placeholder="Broken skin, rash borders, who witnessed, etc."
                  className="mt-1 w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500"
                  maxLength={2000}
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-700">
                Body map — tap regions (front + back) <span className="text-rose-600">*</span>
              </p>
              <div className="flex flex-wrap justify-center gap-6 rounded-xl border border-white bg-white/80 p-4">
                <BodyMapSvg
                  title="Front"
                  viewWidth={120}
                  viewHeight={280}
                  zones={FRONT_ZONES}
                  selected={selectedRegions}
                  toggle={toggleRegion}
                />
                <BodyMapSvg
                  title="Back"
                  viewWidth={120}
                  viewHeight={260}
                  zones={BACK_ZONES}
                  selected={selectedRegions}
                  toggle={toggleRegion}
                />
              </div>
              {selectedRegions.size > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {[...selectedRegions].map((id) => (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => toggleRegion(id)}
                        className="rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-900 ring-1 ring-rose-200 hover:bg-rose-200"
                      >
                        {TOPICAL_REGION_LABELS[id] || id} ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-amber-800">Select at least one area on the maps.</p>
              )}
            </div>
          </div>
          {formError ? (
            <p className="mt-3 text-sm font-medium text-rose-700" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={saveMutation.isPending || !medicationName.trim() || selectedRegions.size === 0}
              onClick={() => saveMutation.mutate()}
              className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                "Save application record"
              )}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h4 className="mb-3 text-sm font-bold text-gray-900">Recorded applications — {chartDate}</h4>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : isError ? (
          <p className="text-sm text-rose-700">{formatApiError(error).detail}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500">No topical applications recorded for this date.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {entries.map((e) => (
              <li key={e.id} className="py-4 first:pt-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{e.medicationName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(e.appliedAt).toLocaleString("en-GB")}
                      {e.recordedBy ? ` · ${e.recordedBy}` : ""}
                    </p>
                  </div>
                  {e.batchLot ? (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">Lot {e.batchLot}</span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs font-medium text-gray-600">Sites</p>
                <p className="text-sm text-gray-800">
                  {(e.bodyRegions || []).map((r) => TOPICAL_REGION_LABELS[r] || r).join(", ")}
                </p>
                {e.siteNotes ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{e.siteNotes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
