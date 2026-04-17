'use client';

import React, { useState } from 'react';
import { useGlobalStore } from '@/store/useGlobalStore';
import { CheckCircle2, UserCircle, Clock, Ban, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function BedBoardPage() {
  const selectedHomeId = useGlobalStore((state) => state.selectedHomeId);
  const [selectedBed, setSelectedBed] = useState<any>(null);

  // Fetch live facility layout (units and beds) from the database
  const { data: layoutData, isLoading, error } = useQuery({
    queryKey: ['facility-layout'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/facility-layout');
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center flex-col space-y-4 animate-in fade-in">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Loading live facility layout...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-center font-medium">
          Error loading beds. Please ensure the backend server is running and the database is seeded.
        </div>
      </div>
    );
  }

  const units = layoutData?.units || [];
  const beds = layoutData?.beds || [];

  // Filter beds based on the active sidebar location filter
  const displayBeds = beds.filter((b: any) => selectedHomeId === 'ALL' || b.home_id === selectedHomeId);

  // Dynamically calculate unit capacity and availability based on the live beds
  const displayUnits = units
    .filter((u: any) => selectedHomeId === 'ALL' || u.home_id === selectedHomeId)
    .map((unit: any) => {
      const unitBeds = beds.filter((b: any) => b.unit_id === unit.id);
      return {
        ...unit,
        total: unitBeds.length,
        available: unitBeds.filter((b: any) => b.status === 'AVAILABLE').length,
      };
    })
    // Only show units that actually have beds configured
    .filter((u: any) => u.total > 0);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return {
          color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: CheckCircle2,
          label: 'Available',
        };
      case 'OCCUPIED':
        return {
          color: 'bg-blue-50 text-blue-900 border-blue-200',
          icon: UserCircle,
          label: 'Occupied',
        };
      case 'TURNAROUND':
        return {
          color: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: Clock,
          label: 'Cleaning',
        };
      case 'MAINTENANCE':
        return {
          color: 'bg-rose-100 text-rose-800 border-rose-200',
          icon: Ban,
          label: 'Blocked',
        };
      default:
        return { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Ban, label: 'Unknown' };
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Live Bed Board</h2>
          <p className="text-gray-500">Real-time occupancy management directly from the database.</p>
        </div>
        <div className="flex gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm flex-wrap">
          <span className="flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1.5 rounded-md">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> Available
          </span>
          <span className="flex items-center text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1.5 rounded-md">
            <UserCircle className="w-3.5 h-3.5 mr-1.5 text-blue-600" /> Occupied
          </span>
          <span className="flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1.5 rounded-md">
            <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-600" /> Turnaround
          </span>
        </div>
      </div>

      {displayUnits.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500 font-medium">No beds found for this location.</p>
        </div>
      ) : (
        displayUnits.map((unit: any) => {
          const unitBeds = displayBeds.filter((b: any) => b.unit_id === unit.id);

          return (
            <div key={unit.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all">
              <div className="bg-slate-50 border-b border-gray-200 px-5 py-4 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800 text-lg">{unit.name}</h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold ${
                    unit.available > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}
                >
                  {unit.available} / {unit.total} Available
                </span>
              </div>
              <div className="p-5 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                {unitBeds
                  // Sort by room number so they appear in sequential order
                  .sort((a: any, b: any) => {
                    const numA = parseInt(a.room_number) || 0;
                    const numB = parseInt(b.room_number) || 0;
                    return numA - numB;
                  })
                  .map((bed: any) => {
                    const config = getStatusConfig(bed.status);
                    const Icon = config.icon;
                    const residentName = bed.first_name ? `${bed.first_name} ${bed.last_name}` : null;

                    return (
                      <div
                        key={bed.id}
                        onClick={() => setSelectedBed(bed)}
                        className={`relative flex flex-col p-4 rounded-xl border-2 cursor-pointer hover:shadow-lg transition-all transform hover:-translate-y-1 duration-200 ${config.color}`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className="font-bold text-sm">Rm {bed.room_number}</span>
                          <Icon className="w-5 h-5 opacity-70" />
                        </div>
                        <div className="mt-auto pt-4">
                          {residentName ? (
                            <p className="font-bold text-sm leading-tight truncate" title={residentName}>
                              {residentName}
                            </p>
                          ) : (
                            <p className="text-[11px] font-bold opacity-70 uppercase tracking-widest">{config.label}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
