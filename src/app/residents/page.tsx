"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useResidents } from "@/hooks/useResidents";
import { ChevronRight, Loader2, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useGlobalStore } from "@/store/useGlobalStore";

type ResidentRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  nhs_number: string | null;
  status: "ADMITTED" | "DISCHARGED" | "ARCHIVED" | "PENDING" | string;
  profile_image_url?: string | null;
  room_number?: string | number | null;
  unit_name?: string | null;
  home_id?: string | null;
};

export default function ResidentsPage() {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const { data: residents, isLoading } = useResidents({ includeArchived: showArchived });
  const selectedHomeId = useGlobalStore((state) => state.selectedHomeId);
  const [searchTerm, setSearchTerm] = useState("");

  const displayedResidents = useMemo(() => {
    const list = (residents ?? []) as ResidentRow[];
    const needle = searchTerm.trim().toLowerCase();
    const nhsNeedle = searchTerm.trim();

    return list.filter((r) => {
      const statusOk =
        r.status === "ADMITTED" ||
        r.status === "DISCHARGED" ||
        r.status === "PENDING" ||
        (showArchived && r.status === "ARCHIVED");
      const inScope = selectedHomeId === "ALL" || r.home_id === selectedHomeId;

      const fullName = `${r.first_name ?? ""} ${r.last_name ?? ""}`
        .trim()
        .toLowerCase();
      const matches =
        needle.length === 0 ||
        fullName.includes(needle) ||
        (!!r.nhs_number && nhsNeedle.length > 0 && r.nhs_number.includes(nhsNeedle));

      return statusOk && inScope && matches;
    });
  }, [residents, searchTerm, selectedHomeId, showArchived]);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center flex-col space-y-4 animate-in fade-in">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Loading service users...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            Service Users
          </h2>
          <p className="text-gray-500">Manage admitted residents and records.</p>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived (discharged users moved off the active list)
          </label>
        </div>
        <button
          type="button"
          onClick={() => router.push("/residents/new")}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center shadow-sm text-sm transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" /> Admit
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-slate-50">
          <div className="relative max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or NHS number..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-white text-gray-500 border-b border-gray-200">
              <tr>
                <th colSpan={5} className="p-0 font-normal">
                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.25fr)_auto_2.5rem] items-center gap-x-4 px-4 py-4">
                    <div className="font-medium">Resident Name</div>
                    <div className="font-medium">DOB</div>
                    <div className="font-medium">Location</div>
                    <div className="font-medium">Status</div>
                    <span className="sr-only">Open</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedResidents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No residents found.
                  </td>
                </tr>
              ) : (
                displayedResidents.map((r) => {
                  const label = `${r.last_name ?? ""}, ${r.first_name ?? ""}`.trim() || "Service user";
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-slate-50">
                      <td colSpan={5} className="p-0">
                        <Link
                          href={`/residents/${r.id}`}
                          prefetch
                          className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.25fr)_auto_2.5rem] items-center gap-x-4 px-4 py-4 text-inherit no-underline outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                          aria-label={`Open clinical record for ${label}`}
                        >
                          <div className="flex min-w-0 items-center gap-4">
                            {r.profile_image_url ? (
                              <img
                                src={r.profile_image_url}
                                alt=""
                                className="h-12 w-12 shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
                              />
                            ) : (
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-sm font-bold text-blue-700">
                                {(r.first_name ?? " ")[0]}
                                {(r.last_name ?? " ")[0]}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-base font-bold text-gray-900">
                                {r.last_name}, {r.first_name}
                              </div>
                              <p className="mt-0.5 text-xs font-medium text-gray-500">
                                NHS: {r.nhs_number || "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="font-medium text-gray-600">
                            {r.date_of_birth
                              ? new Date(r.date_of_birth).toLocaleDateString("en-GB")
                              : "—"}
                          </div>
                          <div className="text-gray-900">
                            <span className="font-medium">{r.unit_name || "N/A"}</span>
                            <p className="mt-0.5 text-xs font-normal text-gray-500">
                              Room {r.room_number || "N/A"}
                            </p>
                          </div>
                          <div>
                            <Badge
                              variant={
                                r.status === "DISCHARGED"
                                  ? "warning"
                                  : r.status === "ARCHIVED"
                                    ? "default"
                                    : "default"
                              }
                            >
                              {r.status}
                            </Badge>
                          </div>
                          <div className="flex justify-end">
                            <ChevronRight className="h-5 w-5 text-gray-400" aria-hidden />
                          </div>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
