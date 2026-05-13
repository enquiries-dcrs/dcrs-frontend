'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Home, Bed, Users, Pill, BarChart3, Settings, LogOut, Droplets } from 'lucide-react';
import { useGlobalStore } from '@/store/useGlobalStore';
import { api } from '@/lib/api';
import { isValidUuid } from '@/lib/uuid';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  
  const selectedHomeId = useGlobalStore((state) => state.selectedHomeId);
  const setSelectedHomeId = useGlobalStore((state) => state.setSelectedHomeId);
  const logout = useGlobalStore((state) => state.logout);
  const user = useGlobalStore((state) => state.user);

  const { data: layout } = useQuery({
    queryKey: ['facility-layout'],
    queryFn: async () => {
      const { data } = await api.get<{ homes: Array<{ id: string; name: string }> }>('/api/v1/facility-layout');
      return data;
    },
    staleTime: 60_000,
  });

  const homes = layout?.homes ?? [];

  useEffect(() => {
    if (selectedHomeId === 'ALL') return;
    if (!isValidUuid(selectedHomeId)) {
      setSelectedHomeId('ALL');
      return;
    }
    if (!homes.length) return;
    const ok = homes.some((h) => h.id === selectedHomeId);
    if (!ok) setSelectedHomeId('ALL');
  }, [homes, selectedHomeId, setSelectedHomeId]);

  // Updated to match the exact routes verified by the frontend check
  const navItems = [
    { name: 'Dashboard', icon: Home, path: '/dashboard' },
    { name: 'Bed Board', icon: Bed, path: '/bed-board' },
    { name: 'Bathroom clean', icon: Droplets, path: '/communal-bathroom-weekly-clean' },
    { name: 'Service Users', icon: Users, path: '/residents' },
    { name: 'eMAR Admin', icon: Pill, path: '/emar' },
    { name: 'Analytics', icon: BarChart3, path: '/analytics' },
    { name: 'Admin Settings', icon: Settings, path: '/admin' },
  ];

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <nav className="w-64 bg-[#1e293b] text-slate-300 flex flex-col shrink-0 z-10 h-screen sticky top-0">
      <div className="p-4 border-b border-slate-700/50 mb-4">
        <h1 className="text-xl font-bold text-white tracking-tight">DCRS Care</h1>
        <p className="text-xs text-slate-400 mt-1">Production Platform</p>
      </div>
      
      <div className="px-4 mb-6">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Location Scope</label>
        <select 
          value={selectedHomeId} 
          onChange={(e) => setSelectedHomeId(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">Group View (All Homes)</option>
          {homes.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>

      <div className="px-3 space-y-1 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.path);
          return (
            <Link 
              key={item.name}
              href={item.path} 
              className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <item.icon className={`w-5 h-5 mr-3 ${isActive ? 'opacity-100' : 'opacity-70'}`} /> 
              {item.name}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-700/50 mt-auto space-y-3">
        <button 
          onClick={() => router.push('/family')} 
          className="w-full flex items-center justify-center px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors"
        >
          Switch to Family Portal
        </button>
        <div className="flex items-center pt-2 justify-between">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.[0] || 'A'}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white leading-none">{user?.name || 'Admin'}</p>
              <p className="text-xs text-slate-400 mt-1">{user?.role || 'User'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors p-2" title="Log Out">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}