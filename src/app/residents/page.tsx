"use client";

import React, { useMemo, useState } from "react";
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
  status: "ADMITTED" | "DISCHARGED" | string;
  profile_image_url?: string | null;
  room_number?: string | number | null;
  unit_name?: string | null;
  home_id?: string | null;
};

export default function ResidentsPage() {
  const router = useRouter();
  const { data: residents, isLoading } = useResidents();
  const selectedHomeId = useGlobalStore((state) => state.selectedHomeId);
  const [searchTerm, setSearchTerm] = useState("");

  const displayedResidents = useMemo(() => {
    const list = (residents ?? []) as ResidentRow[];
    const needle = searchTerm.trim().toLowerCase();
    const nhsNeedle = searchTerm.trim();

    return list.filter((r) => {
      const statusOk =
        r.status === "ADMITTED" || r.status === "DISCHARGED" || r.status === "PENDING";
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
  }, [residents, searchTerm, selectedHomeId]);

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
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-gray-500 border-b border-gray-200">
              <tr>
                <th className="p-4 font-medium">Resident Name</th>
                <th className="p-4 font-medium">DOB</th>
                <th className="p-4 font-medium">Location</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4"></th>
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
                displayedResidents.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/residents/${r.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="p-4 flex items-center gap-4">
                      {r.profile_image_url ? (
                        <img
                          src={r.profile_image_url}
                          alt={`${r.first_name ?? ""}`}
                          className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-200">
                          {(r.first_name ?? " ")[0]}
                          {(r.last_name ?? " ")[0]}
                        </div>
                      )}

                      <div>
                        <div className="font-bold text-gray-900 text-base">
                          {r.last_name}, {r.first_name}
                        </div>
                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                          NHS: {r.nhs_number || "N/A"}
                        </p>
                      </div>
                    </td>
                    <td className="p-4 text-gray-600 font-medium">
                      {r.date_of_birth
                        ? new Date(r.date_of_birth).toLocaleDateString("en-GB")
                        : "—"}
                    </td>
                    <td className="p-4 text-gray-900">
                      <span className="font-medium">{r.unit_name || "N/A"}</span>
                      <p className="text-xs text-gray-500 font-normal mt-0.5">
                        Room {r.room_number || "N/A"}
                      </p>
                    </td>
                    <td className="p-4">
                      <Badge variant={r.status === "DISCHARGED" ? "warning" : "default"}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <ChevronRight className="w-5 h-5 text-gray-400 inline-block" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
