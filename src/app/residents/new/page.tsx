"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useGlobalStore } from "@/store/useGlobalStore";
import { ArrowLeft, Loader2 } from "lucide-react";

type HomeRow = { id: string; name: string };

const MANAGEMENT_ROLES = new Set(["Deputy Manager", "Regional Manager", "Home Manager", "Admin"]);

export default function NewServiceUserPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useGlobalStore((s) => s.user);
  const selectedHomeId = useGlobalStore((s) => s.selectedHomeId);

  const canCreate = user?.role != null && MANAGEMENT_ROLES.has(user.role);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nhsNumber, setNhsNumber] = useState("");
  const [homeId, setHomeId] = useState("");

  const { data: layoutData, isLoading: layoutLoading } = useQuery({
    queryKey: ["facility-layout"],
    queryFn: async () => {
      const { data } = await api.get<{ homes?: HomeRow[] }>("/api/v1/facility-layout");
      return data;
    },
  });

  const homes = useMemo(() => {
    const list = layoutData?.homes;
    return Array.isArray(list) ? list : [];
  }, [layoutData]);

  useEffect(() => {
    if (homes.length === 0) return;
    if (homeId && homes.some((h) => h.id === homeId)) return;
    const preferred =
      selectedHomeId !== "ALL" && homes.some((h) => h.id === selectedHomeId)
        ? selectedHomeId
        : homes[0]?.id ?? "";
    setHomeId(preferred);
  }, [homes, selectedHomeId, homeId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ id: string }>("/api/v1/residents", {
        firstName,
        lastName,
        dateOfBirth: dateOfBirth.trim() || undefined,
        nhsNumber: nhsNumber.trim() || undefined,
        homeId: homeId || undefined,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["residents"] });
      router.push(`/residents/${data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    if (homes.length > 0 && !homeId) return;
    createMutation.mutate();
  };

  if (!canCreate) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4 animate-in fade-in">
        <button
          type="button"
          onClick={() => router.push("/residents")}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Service Users
        </button>
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-5 text-sm">
          Your role does not include registering new service users. Ask a home or regional manager.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6 animate-in fade-in pb-20">
      <button
        type="button"
        onClick={() => router.push("/residents")}
        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Service Users
      </button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Register service user</h1>
        <p className="text-gray-500 text-sm mt-1">
          Creates a pending record. Assign a bed from their profile when they move in.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5"
      >
        {homes.length === 0 && !layoutLoading && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-3">
            No homes were returned for your scope. Check that the <code className="text-xs">homes</code> table
            has rows and your account scope is correct.
          </p>
        )}

        {homes.length > 1 && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Home</label>
            <select
              value={homeId}
              onChange={(e) => setHomeId(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              {homes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {homes.length === 1 && (
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-800">Home:</span> {homes[0].name}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">First name</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="given-name"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Last name</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="family-name"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Date of birth (optional)</label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">NHS number (optional)</label>
          <input
            value={nhsNumber}
            onChange={(e) => setNhsNumber(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 485 777 3456"
            inputMode="numeric"
          />
        </div>

        {createMutation.isError && (
          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-3">
            {(createMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
              "Could not create service user."}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/residents")}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={
              createMutation.isPending ||
              layoutLoading ||
              !firstName.trim() ||
              !lastName.trim() ||
              (homes.length > 0 && !homeId)
            }
            className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 inline-flex items-center"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create and open profile
          </button>
        </div>
      </form>
    </div>
  );
}
