"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useResidents } from "@/hooks/useResidents";
import { useResident } from "@/hooks/useResident";
import { EMarPanel } from "@/features/emar";

function residentSortKey(r: {
  first_name: string | null;
  last_name: string | null;
}): string {
  const ln = (r.last_name ?? "").trim().toLowerCase();
  const fn = (r.first_name ?? "").trim().toLowerCase();
  return `${ln}, ${fn}`;
}

export default function EmarPage() {
  const residents = useResidents();
  const residentsList = useMemo(
    () => residents.data ?? [],
    [residents.data],
  );

  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);

  const emarEligibleSorted = useMemo(() => {
    return residentsList
      .filter((r) => r.status === "ADMITTED" || r.status === "PENDING")
      .slice()
      .sort((a, b) => residentSortKey(a).localeCompare(residentSortKey(b)));
  }, [residentsList]);

  useEffect(() => {
    if (residents.isLoading || residents.isError) return;
    if (emarEligibleSorted.length === 0) {
      setSelectedResidentId(null);
      return;
    }
    setSelectedResidentId((prev) => {
      if (prev && emarEligibleSorted.some((r) => r.id === prev)) return prev;
      return emarEligibleSorted[0].id;
    });
  }, [residents.isLoading, residents.isError, emarEligibleSorted]);

  const residentDetails = useResident(selectedResidentId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">eMAR</h1>
          <p className="text-sm text-zinc-600">
            Electronic medication administration record
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Link
            href="/dashboard"
            className="font-medium text-blue-600 hover:underline"
          >
            Group dashboard
          </Link>
          <Link
            href="/residents"
            className="text-zinc-600 hover:text-zinc-900"
          >
            Service users
          </Link>
        </div>
      </div>

      {!residents.isLoading && !residents.isError && emarEligibleSorted.length > 0 ? (
        <label className="flex max-w-md flex-col gap-1 text-sm text-zinc-700">
          <span className="font-medium text-zinc-800">Service user</span>
          <select
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedResidentId ?? ""}
            onChange={(e) => setSelectedResidentId(e.target.value || null)}
          >
            {emarEligibleSorted.map((r) => (
              <option key={r.id} value={r.id}>
                {[r.first_name, r.last_name].filter(Boolean).join(" ").trim() || r.id}
                {r.status === "PENDING" ? " (pending)" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {residents.isLoading ? (
        <p className="text-sm text-zinc-600">Loading residents…</p>
      ) : residents.isError ? (
        <p className="text-sm text-red-700">
          {residents.error?.message ?? "Failed to load residents"}
        </p>
      ) : emarEligibleSorted.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No admitted or pending service users in your scope. Add a resident or widen the home filter in the sidebar.
        </p>
      ) : selectedResidentId == null ? (
        <p className="text-sm text-zinc-600">No resident selected.</p>
      ) : residentDetails.isLoading ? (
        <p className="text-sm text-zinc-600">Loading chart…</p>
      ) : residentDetails.isError ? (
        <p className="text-sm text-red-700">
          {residentDetails.error?.message ?? "Failed to load resident chart"}
        </p>
      ) : residentDetails.data ? (
        <EMarPanel
          residentId={residentDetails.data.id}
          medications={residentDetails.data.medications}
        />
      ) : (
        <p className="text-sm text-zinc-600">No chart data.</p>
      )}
    </div>
  );
}
