"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useResidents } from "@/hooks/useResidents";
import { TrendingUp, Users, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useGlobalStore } from "@/store/useGlobalStore";

export default function DashboardPage() {
  const router = useRouter();
  const { data: residents, isLoading } = useResidents();
  const selectedHomeId = useGlobalStore((state) => state.selectedHomeId);

  // In production, these come from the backend. We'll mock them here for the UI layout.
  const allRiskAlerts = [
    {
      id: "risk-1",
      type: "HIGH_UTI_DECLINE_RISK",
      residentName: "Arthur Smith",
      residentId: "55555555-5555-5555-5555-555555555555",
      drivers:
        "AI Flag: Weight down 4%, fluid intake down 25% over 72hrs. Mild confusion noted in recent daily note.",
      homeId: "11111111-1111-1111-1111-111111111111",
    },
  ];

  const activeRiskAlerts = allRiskAlerts.filter(
    (alert) => selectedHomeId === "ALL" || alert.homeId === selectedHomeId,
  );

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

      {/* AI Predictive Risk Engine Alert */}
      {activeRiskAlerts.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-rose-900 font-bold text-lg mb-3 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" /> Predictive Risk Alerts Engine
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeRiskAlerts.map((alert) => (
              <div key={alert.id} className="bg-white rounded-lg p-4 shadow-sm border border-rose-100 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-gray-900">{alert.residentName}</span>
                  <Badge variant="danger">{alert.type.replace(/_/g, " ")}</Badge>
                </div>
                <p className="text-sm text-gray-700 mb-4 flex-1">
                  <span className="font-semibold text-gray-900">Analysis: </span>{alert.drivers}
                </p>
                <div className="flex gap-2 border-t border-gray-100 pt-3">
                  <button 
                    onClick={() => router.push(`/residents/${alert.residentId}`)} 
                    className="text-blue-600 text-sm font-medium hover:underline"
                  >
                    View Clinical Record
                  </button>
                  <div className="flex-1"></div>
                  <button className="bg-rose-100 text-rose-800 hover:bg-rose-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                    Acknowledge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* High-Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div 
          onClick={() => router.push("/residents")}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 cursor-pointer hover:border-blue-300 transition-colors"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Total Census</h3>
              <p className="text-sm text-gray-500">Currently admitted across group</p>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{admittedCount}</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Pending Referrals</h3>
              <p className="text-sm text-gray-500">Awaiting clinical assessment</p>
            </div>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">0</div>
        </div>
      </div>
    </div>
  );
}
