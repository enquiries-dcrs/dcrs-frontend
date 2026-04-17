"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useResidents } from "@/hooks/useResidents";
import { useResident } from "@/hooks/useResident";
import { EMarPanel } from "@/features/emar";

export default function EmarPage() {
  const residents = useResidents();
  const residentsList = useMemo(
    () => residents.data ?? [],
    [residents.data],
  );

  const selectedResidentId = useMemo(() => {
    if (residents.isLoading || residents.isError) return null;
    if (residentsList.length === 0) return null;
    const arthur = residentsList.find(
      (r) =>
        (r.first_name ?? "") === "Arthur" && (r.last_name ?? "") === "Smith",
    );
    return (arthur?.id ?? residentsList[0].id) ?? null;
  }, [residents.isLoading, residents.isError, residentsList]);

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

      {residents.isLoading ? (
        <p className="text-sm text-zinc-600">Loading residents…</p>
      ) : residents.isError ? (
        <p className="text-sm text-red-700">
          {residents.error?.message ?? "Failed to load residents"}
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
