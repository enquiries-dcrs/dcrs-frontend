"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useResident } from '@/hooks/useResident';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { 
  ArrowLeft, MapPin, UserCircle, Loader2, X, FileUp, File, Sparkles, 
  FileText, Mail, Globe, AlertCircle, Plus, CheckCircle2, AlertTriangle, 
  Mic, Activity, TrendingUp, ShieldAlert, GitMerge, Hospital, QrCode, Clock, Package, Camera,
  Download,
  Heart,
  UserPlus,
  Printer,
  Archive,
  Undo2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useGlobalStore } from '@/store/useGlobalStore';
import { formatApiError } from '@/lib/format-api-error';
import { TopicalApplicationsTab } from '@/features/residents/TopicalApplicationsTab';
import { resolveResidentRouteId } from '@/lib/resident-route';

function todayIsoDate(): string {
  // Use local date; chart_date is stored as a DATE.
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function taskPriorityIsHighClient(p: string | undefined): boolean {
  const s = String(p || '').trim().toLowerCase();
  return s === 'high' || s === 'critical';
}

function isTaskOverdue(task: { dueDateIso?: string | null; status?: string }): boolean {
  const st = String(task.status || '').toLowerCase();
  if (st === 'completed' || st === 'done') return false;
  if (!task.dueDateIso) return false;
  return task.dueDateIso < todayIsoDate();
}

function isTaskDueToday(task: { dueDateIso?: string | null; status?: string }): boolean {
  const st = String(task.status || '').toLowerCase();
  if (st === 'completed' || st === 'done') return false;
  if (!task.dueDateIso) return false;
  return task.dueDateIso === todayIsoDate();
}

const TASK_ASSIGN_ROLES = new Set([
  'Senior Carer',
  'Deputy Manager',
  'Home Manager',
  'Regional Manager',
  'Admin',
]);

function observationSinceIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function parseObservationNumeric(code: string, value: string): number | null {
  if (!value) return null;
  if (code === 'BP') {
    const m = value.match(/^\s*(\d+(?:\.\d+)?)/);
    return m && Number.isFinite(Number(m[1])) ? Number(m[1]) : null;
  }
  const n = parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function ObservationTrendChart({
  title,
  points,
}: {
  title: string;
  points: Array<{ at: string; v: number }>;
}) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-gray-500">
        Need at least two numeric readings for {title} in this date range to show a trend.
      </p>
    );
  }
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const w = 320;
  const h = 120;
  const pad = 8;
  const pts = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const yn = (p.v - min) / span;
    const y = pad + (1 - yn) * (h - pad * 2);
    return `${x},${y}`;
  });
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-600">{title}</p>
      <svg width={w} height={h} className="text-blue-600" aria-hidden>
        <rect x={0} y={0} width={w} height={h} fill="#f8fafc" rx={8} />
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pts.join(' ')}
        />
      </svg>
      <p className="text-xs text-gray-500">
        Range in window: {min.toFixed(1)} – {max.toFixed(1)}
      </p>
    </div>
  );
}

function taskPriorityToSelectKey(p: string | undefined): string {
  const s = String(p || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (s === 'LOW' || s === 'NORMAL' || s === 'HIGH' || s === 'CRITICAL') return s;
  const t = String(p || '').trim().toLowerCase();
  if (t === 'low') return 'LOW';
  if (t === 'high') return 'HIGH';
  if (t === 'critical') return 'CRITICAL';
  return 'NORMAL';
}

function FoodAndDrinkTab({ residentId, isReadOnly }: { residentId: string; isReadOnly: boolean }) {
  const queryClient = useQueryClient();
  const [chartDate, setChartDate] = useState<string>(todayIsoDate());
  const [period, setPeriod] = useState<'Breakfast' | 'Mid-morning' | 'Lunch' | 'Mid-Afternoon' | 'Evening' | 'Bedtime'>('Breakfast');
  const [entryType, setEntryType] = useState<'FOOD' | 'DRINK'>('DRINK');
  const [description, setDescription] = useState('');
  const [amountMl, setAmountMl] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['food-drink', residentId, chartDate],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/residents/${residentId}/food-drink`, {
        params: { date: chartDate },
      });
      return data as { entries: any[] };
    },
  });

  const entries = data?.entries || [];

  const totalMl = entries.reduce((sum: number, e: any) => {
    const n = typeof e.amount_ml === 'number' ? e.amount_ml : Number(e.amount_ml);
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);

  const submit = async () => {
    const desc = description.trim();
    if (!desc) return;
    setSaving(true);
    try {
      await api.post(`/api/v1/residents/${residentId}/food-drink`, {
        period,
        entryType,
        description: desc,
        amountMl: amountMl.trim() === '' ? null : Number(amountMl),
        date: chartDate,
      });
      setDescription('');
      setAmountMl('');
      await queryClient.invalidateQueries({ queryKey: ['food-drink', residentId, chartDate] });
    } catch (e) {
      console.error(e);
      alert('Could not add entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-slate-50 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">Date</label>
            <input
              type="date"
              value={chartDate}
              onChange={(e) => setChartDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="sm:ml-auto flex items-center gap-2 text-sm">
            <span className="text-gray-600">Total drinks:</span>
            <span className="font-semibold text-gray-900">{totalMl} ml</span>
          </div>
        </div>

        {!isReadOnly && (
          <div className="p-4 border-b border-gray-200 grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Period</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Breakfast">Breakfast</option>
                <option value="Mid-morning">Mid-morning</option>
                <option value="Lunch">Lunch</option>
                <option value="Mid-Afternoon">Mid-Afternoon</option>
                <option value="Evening">Evening</option>
                <option value="Bedtime">Bedtime</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Type</label>
              <select
                value={entryType}
                onChange={(e) => setEntryType(e.target.value === 'FOOD' ? 'FOOD' : 'DRINK')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="DRINK">Drink</option>
                <option value="FOOD">Food</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={entryType === 'DRINK' ? 'E.g. Water' : 'E.g. Ate 3/4 lunch'}
              />
            </div>
            <div className="md:col-span-1">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Amount (ml)</label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={amountMl}
                onChange={(e) => setAmountMl(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional"
                disabled={entryType === 'FOOD'}
              />
            </div>
            <div className="md:col-span-6 flex justify-end">
              <button
                type="button"
                onClick={submit}
                disabled={saving || !description.trim()}
                className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add entry
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading chart…</div>
          ) : error ? (
            <div className="p-8 text-center text-rose-600">Could not load chart.</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No entries for this day.</div>
          ) : (
            ([
              'Breakfast',
              'Mid-morning',
              'Lunch',
              'Mid-Afternoon',
              'Evening',
              'Bedtime',
            ] as const).map((p) => {
              const bucket = entries.filter((e: any) => (e.period || 'Lunch') === p);
              return (
                <div key={p} className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900">{p}</h4>
                    <span className="text-xs text-gray-500">{bucket.length} entr{bucket.length === 1 ? 'y' : 'ies'}</span>
                  </div>
                  {bucket.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-gray-500">
                      No entries
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bucket.map((e: any) => (
                        <div key={e.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
                          <div className="mt-0.5 shrink-0">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                e.entry_type === 'DRINK'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {e.entry_type === 'DRINK' ? 'Drink' : 'Food'}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="text-sm font-medium text-gray-900 break-words">{e.description}</p>
                              {e.amount_ml != null && e.amount_ml !== '' ? (
                                <span className="text-xs font-semibold text-gray-700 bg-slate-100 border border-slate-200 rounded px-2 py-0.5">
                                  {e.amount_ml} ml
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                              {e.recorded_by ? `By ${e.recorded_by} • ` : null}
                              {e.created_at ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function ActivitiesTab({ residentId, isReadOnly }: { residentId: string; isReadOnly: boolean }) {
  const queryClient = useQueryClient();
  const [chartDate, setChartDate] = useState<string>(todayIsoDate());
  const activityOptions = [
    'Exercise class',
    'Arts and Crafts',
    'Puzzles',
    'Watched television',
    'Movie matinee',
    'Gardening',
    'Sitting in the garden',
    'Pampering session',
    'Bingo',
    'Seasonal crafts',
    'Reading',
    'Social outings',
    'Visitors',
    'Dominoes',
  ] as const;
  const [activityType, setActivityType] = useState<(typeof activityOptions)[number]>(activityOptions[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['activities', residentId, chartDate],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/residents/${residentId}/activities`, {
        params: { date: chartDate },
      });
      return data as { entries: any[] };
    },
  });

  const entries = data?.entries || [];

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/api/v1/residents/${residentId}/activities`, {
        activityType,
        notes: notes.trim() || null,
        date: chartDate,
      });
      setNotes('');
      await queryClient.invalidateQueries({ queryKey: ['activities', residentId, chartDate] });
    } catch (e) {
      console.error(e);
      alert('Could not add activity entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-slate-50 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">Date</label>
            <input
              type="date"
              value={chartDate}
              onChange={(e) => setChartDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="sm:ml-auto text-xs text-gray-500">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</div>
        </div>

        {!isReadOnly && (
          <div className="p-4 border-b border-gray-200 grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Activity</label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as any)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                {activityOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="E.g. Joined group, engaged well"
              />
            </div>
            <div className="md:col-span-6 flex justify-end">
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add activity
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading chart…</div>
          ) : error ? (
            <div className="p-8 text-center text-rose-600">Could not load chart.</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No entries for this day.</div>
          ) : (
            entries.map((e: any) => (
              <div key={e.id} className="p-4 flex items-start gap-4">
                <div className="mt-0.5 shrink-0">
                  <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-800 px-2.5 py-1 text-xs font-semibold">
                    {e.activity_type}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  {e.notes ? <p className="text-sm text-gray-900 break-words">{e.notes}</p> : <p className="text-sm text-gray-500">No notes</p>}
                  <p className="mt-1 text-xs text-gray-500">
                    {e.recorded_by ? `By ${e.recorded_by} • ` : null}
                    {e.created_at ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function DailyCareTab({ residentId, isReadOnly }: { residentId: string; isReadOnly: boolean }) {
  const queryClient = useQueryClient();
  const [chartDate, setChartDate] = useState<string>(todayIsoDate());
  const items = [
    'Bath',
    'Hair',
    'Nails',
    'Bowels Open',
    'Fluids',
    'Medicate',
    'Visitors',
    'Been out',
    'Stayed in',
    'Other',
  ] as const;

  const [careItem, setCareItem] = useState<(typeof items)[number]>(items[0]);
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['daily-care', residentId, chartDate],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/residents/${residentId}/daily-care`, {
        params: { date: chartDate },
      });
      return data as { entries: any[] };
    },
  });

  const entries = data?.entries || [];

  const submit = async () => {
    setSaving(true);
    try {
      await api.post(`/api/v1/residents/${residentId}/daily-care`, {
        careItem,
        value: value.trim() || null,
        notes: notes.trim() || null,
        date: chartDate,
      });
      setValue('');
      setNotes('');
      await queryClient.invalidateQueries({ queryKey: ['daily-care', residentId, chartDate] });
    } catch (e) {
      console.error(e);
      alert('Could not add daily care entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-slate-50 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">Date</label>
            <input
              type="date"
              value={chartDate}
              onChange={(e) => setChartDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="sm:ml-auto text-xs text-gray-500">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</div>
        </div>

        {!isReadOnly && (
          <div className="p-4 border-b border-gray-200 grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Item</label>
              <select
                value={careItem}
                onChange={(e) => setCareItem(e.target.value as any)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                {items.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Value (optional)</label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="E.g. Yes / No / 500ml"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="E.g. Assisted, tolerated well"
              />
            </div>
            <div className="md:col-span-6 flex justify-end">
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add entry
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading chart…</div>
          ) : error ? (
            <div className="p-8 text-center text-rose-600">Could not load chart.</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No entries for this day.</div>
          ) : (
            items.map((i) => {
              const bucket = entries.filter((e: any) => e.care_item === i);
              return (
                <div key={i} className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900">{i}</h4>
                    <span className="text-xs text-gray-500">{bucket.length} entr{bucket.length === 1 ? 'y' : 'ies'}</span>
                  </div>
                  {bucket.length === 0 ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-gray-500">
                      No entries
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bucket.map((e: any) => (
                        <div key={e.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              {e.value ? (
                                <span className="text-xs font-semibold text-gray-700 bg-slate-100 border border-slate-200 rounded px-2 py-0.5">
                                  {e.value}
                                </span>
                              ) : null}
                              {e.notes ? (
                                <p className="text-sm text-gray-900 break-words">{e.notes}</p>
                              ) : (
                                <p className="text-sm text-gray-500">No notes</p>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                              {e.recorded_by ? `By ${e.recorded_by} • ` : null}
                              {e.created_at ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function PeepTab({ residentId, isReadOnly }: { residentId: string; isReadOnly: boolean }) {
  const queryClient = useQueryClient();
  const canEdit = useGlobalStore((s) => {
    const role = s.user?.role as string | undefined;
    return Boolean(role) && ['Deputy Manager', 'Home Manager', 'Regional Manager', 'Admin'].includes(role);
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['peep', residentId],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/residents/${residentId}/peep`);
      return data as { peep: any | null };
    },
  });

  const [form, setForm] = useState({
    mobility: '',
    assistanceRequired: '',
    evacuationMethod: '',
    alarmAwareness: '',
    communicationNeeds: '',
    nightArrangements: '',
    equipmentRequired: '',
    keyRisks: '',
    routeAndRefuge: '',
    otherNotes: '',
    reviewDate: '',
  });

  useEffect(() => {
    const p = data?.peep;
    if (!p) return;
    setForm({
      mobility: p.mobility || '',
      assistanceRequired: p.assistance_required || '',
      evacuationMethod: p.evacuation_method || '',
      alarmAwareness: p.alarm_awareness || '',
      communicationNeeds: p.communication_needs || '',
      nightArrangements: p.night_arrangements || '',
      equipmentRequired: p.equipment_required || '',
      keyRisks: p.key_risks || '',
      routeAndRefuge: p.route_and_refuge || '',
      otherNotes: p.other_notes || '',
      reviewDate: p.review_date || '',
    });
  }, [data?.peep]);

  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await api.put(`/api/v1/residents/${residentId}/peep`, {
        mobility: form.mobility,
        assistanceRequired: form.assistanceRequired,
        evacuationMethod: form.evacuationMethod,
        alarmAwareness: form.alarmAwareness,
        communicationNeeds: form.communicationNeeds,
        nightArrangements: form.nightArrangements,
        equipmentRequired: form.equipmentRequired,
        keyRisks: form.keyRisks,
        routeAndRefuge: form.routeAndRefuge,
        otherNotes: form.otherNotes,
        reviewDate: form.reviewDate || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['peep', residentId] });
      alert('PEEP saved.');
    } catch (e) {
      console.error(e);
      alert('Could not save PEEP. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({
    label,
    value,
    onChange,
    rows = 3,
    placeholder,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    rows?: number;
    placeholder?: string;
  }) => (
    <div>
      <label className="mb-1 block text-xs font-semibold text-gray-600">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={isReadOnly || !canEdit}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
      />
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 bg-slate-50 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">PEEP (Personal Emergency Evacuation Plan)</h3>
            <p className="text-sm text-gray-600 mt-1">
              Standard evacuation plan for this resident. {canEdit ? 'Managers can edit.' : 'Read-only.'}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Print
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canEdit || isReadOnly || saving}
              className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500">Loading PEEP…</div>
          ) : error ? (
            <div className="p-6 text-center text-rose-600">Could not load PEEP.</div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field
              label="Mobility"
              value={form.mobility}
              onChange={(v) => setForm((p) => ({ ...p, mobility: v }))}
              placeholder="E.g. Independent with walking frame; cannot manage stairs"
            />
            <Field
              label="Assistance required"
              value={form.assistanceRequired}
              onChange={(v) => setForm((p) => ({ ...p, assistanceRequired: v }))}
              placeholder="E.g. 2 staff assist for evacuation"
            />
            <Field
              label="Evacuation method"
              value={form.evacuationMethod}
              onChange={(v) => setForm((p) => ({ ...p, evacuationMethod: v }))}
              placeholder="E.g. Assisted walk / wheelchair / evac chair"
            />
            <Field
              label="Alarm awareness"
              value={form.alarmAwareness}
              onChange={(v) => setForm((p) => ({ ...p, alarmAwareness: v }))}
              placeholder="E.g. Hard of hearing; needs visual/verbal prompt"
            />
            <Field
              label="Communication needs"
              value={form.communicationNeeds}
              onChange={(v) => setForm((p) => ({ ...p, communicationNeeds: v }))}
              placeholder="E.g. Simple instructions; anxiety reassurance"
            />
            <Field
              label="Night arrangements"
              value={form.nightArrangements}
              onChange={(v) => setForm((p) => ({ ...p, nightArrangements: v }))}
              placeholder="E.g. Bedroom location; sensor mats; night staff aware"
            />
            <Field
              label="Equipment required"
              value={form.equipmentRequired}
              onChange={(v) => setForm((p) => ({ ...p, equipmentRequired: v }))}
              placeholder="E.g. Wheelchair; oxygen; evacuation sheet"
            />
            <Field
              label="Key risks"
              value={form.keyRisks}
              onChange={(v) => setForm((p) => ({ ...p, keyRisks: v }))}
              placeholder="E.g. Confusion, falls risk, oxygen dependency"
              rows={4}
            />
          </div>

          <Field
            label="Route / refuge points"
            value={form.routeAndRefuge}
            onChange={(v) => setForm((p) => ({ ...p, routeAndRefuge: v }))}
            placeholder="E.g. Preferred route from room; refuge point if needed"
            rows={4}
          />

          <Field
            label="Other notes"
            value={form.otherNotes}
            onChange={(v) => setForm((p) => ({ ...p, otherNotes: v }))}
            rows={4}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Review date</label>
              <input
                type="date"
                value={form.reviewDate}
                onChange={(e) => setForm((p) => ({ ...p, reviewDate: e.target.value }))}
                disabled={isReadOnly || !canEdit}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
              />
            </div>
            <div className="text-xs text-gray-500 flex items-end">
              {data?.peep?.updated_at ? (
                <div>
                  Last updated: {new Date(data.peep.updated_at).toLocaleString()} {data.peep.updated_by ? `by ${data.peep.updated_by}` : ''}
                </div>
              ) : (
                <div>No PEEP saved yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CarePlanTab({
  residentId,
  isReadOnly,
  onTaskCreated,
}: {
  residentId: string;
  isReadOnly: boolean;
  onTaskCreated?: () => void;
}) {
  const queryClient = useQueryClient();
  const userRole = useGlobalStore((s) => (s.user?.role as string | undefined) || undefined);

  const canEdit = Boolean(userRole) && ['Senior Carer', 'Deputy Manager', 'Home Manager', 'Regional Manager', 'Admin'].includes(userRole as string);
  const canArchive = Boolean(userRole) && ['Deputy Manager', 'Home Manager', 'Regional Manager', 'Admin'].includes(userRole as string);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['care-plans', residentId],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/residents/${residentId}/care-plans`);
      return data as {
        plans: Array<{
          id: string;
          title: string;
          status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
          created_at: string;
          updated_at: string;
          created_by_name?: string | null;
          updated_by_name?: string | null;
          goals: Array<{
            id: string;
            care_plan_id: string;
            goal_text: string;
            target_date: string | null;
            status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
            created_at?: string;
            updated_at: string;
            created_by_name?: string | null;
            updated_by_name?: string | null;
            linkedTasks?: Array<{
              id: string;
              title: string;
              status: string;
              priority: string;
              dueDate: string | null;
            }>;
          }>;
        }>;
      };
    },
    staleTime: 15_000,
  });

  const plans = data?.plans ?? [];
  const activePlan = plans.find((p) => p.status === 'ACTIVE') ?? null;
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  useEffect(() => {
    if (selectedPlanId && plans.some((p) => p.id === selectedPlanId)) return;
    if (activePlan?.id) setSelectedPlanId(activePlan.id);
    else if (plans[0]?.id) setSelectedPlanId(plans[0].id);
    else setSelectedPlanId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans.map((p) => p.id).join('|'), activePlan?.id]);

  const selectedPlan = selectedPlanId ? plans.find((p) => p.id === selectedPlanId) ?? null : null;

  const [newPlanTitle, setNewPlanTitle] = useState('Care plan');
  const [newPlanStatus, setNewPlanStatus] = useState<'DRAFT' | 'ACTIVE'>('ACTIVE');
  const [creatingPlan, setCreatingPlan] = useState(false);
  const createPlan = async () => {
    if (!canEdit || isReadOnly) return;
    const title = newPlanTitle.trim();
    if (!title) return;
    setCreatingPlan(true);
    try {
      await api.post(`/api/v1/residents/${residentId}/care-plans`, { title, status: newPlanStatus });
      await queryClient.invalidateQueries({ queryKey: ['care-plans', residentId] });
      setNewPlanTitle('Care plan');
      setNewPlanStatus('ACTIVE');
    } catch (e) {
      console.error(e);
      alert('Could not create care plan. Check permissions and that the DB migration has been applied.');
    } finally {
      setCreatingPlan(false);
    }
  };

  const [goalText, setGoalText] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [addingGoal, setAddingGoal] = useState(false);
  const addGoal = async () => {
    if (!selectedPlan || !canEdit || isReadOnly) return;
    const text = goalText.trim();
    if (!text) return;
    setAddingGoal(true);
    try {
      await api.post(`/api/v1/care-plans/${selectedPlan.id}/goals`, {
        goalText: text,
        targetDate: goalTarget.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['care-plans', residentId] });
      setGoalText('');
      setGoalTarget('');
    } catch (e) {
      console.error(e);
      alert('Could not add goal.');
    } finally {
      setAddingGoal(false);
    }
  };

  const updateGoalStatus = async (goalId: string, status: string) => {
    if (!selectedPlan || !canEdit || isReadOnly) return;
    try {
      await api.patch(`/api/v1/care-plans/${selectedPlan.id}/goals/${goalId}`, { status });
      await queryClient.invalidateQueries({ queryKey: ['care-plans', residentId] });
    } catch (e) {
      console.error(e);
      alert('Could not update goal.');
    }
  };

  const [activatingPlan, setActivatingPlan] = useState(false);
  const setPlanActive = async () => {
    if (!selectedPlan || !canEdit || isReadOnly) return;
    if (selectedPlan.status === 'ACTIVE') return;
    setActivatingPlan(true);
    try {
      await api.patch(`/api/v1/care-plans/${selectedPlan.id}`, { status: 'ACTIVE' });
      await queryClient.invalidateQueries({ queryKey: ['care-plans', residentId] });
    } catch (e) {
      console.error(e);
      alert('Could not set plan active.');
    } finally {
      setActivatingPlan(false);
    }
  };

  const archivePlan = async () => {
    if (!selectedPlan || !canArchive || isReadOnly) return;
    if (!window.confirm('Archive this care plan? It will become read-only.')) return;
    try {
      await api.patch(`/api/v1/care-plans/${selectedPlan.id}`, { status: 'ARCHIVED' });
      await queryClient.invalidateQueries({ queryKey: ['care-plans', residentId] });
    } catch (e) {
      console.error(e);
      alert('Could not archive care plan.');
    }
  };

  const renamePlan = async () => {
    if (!selectedPlan || !canEdit || isReadOnly) return;
    if (selectedPlan.status === 'ARCHIVED') return;
    const next = window.prompt('Rename care plan', selectedPlan.title);
    if (next == null) return;
    const title = next.trim();
    if (!title) return;
    try {
      await api.patch(`/api/v1/care-plans/${selectedPlan.id}`, { title });
      await queryClient.invalidateQueries({ queryKey: ['care-plans', residentId] });
    } catch (e) {
      console.error(e);
      alert('Could not rename care plan.');
    }
  };

  const [creatingTaskGoalId, setCreatingTaskGoalId] = useState<string | null>(null);
  const createTaskFromGoal = async (goalId: string, goalTextValue: string) => {
    if (!canEdit || isReadOnly) return;
    const title = goalTextValue.trim().replace(/\s+/g, ' ');
    if (!title) return;
    setCreatingTaskGoalId(goalId);
    try {
      if (!selectedPlan) throw new Error('No selected plan');
      await api.post(`/api/v1/care-plans/${selectedPlan.id}/goals/${goalId}/tasks`, { priority: 'Normal' });
      if (typeof onTaskCreated === 'function') onTaskCreated();
      await queryClient.invalidateQueries({ queryKey: ['resident', residentId] });
      await queryClient.invalidateQueries({ queryKey: ['care-plans', residentId] });
    } catch (e) {
      console.error(e);
      alert('Could not create task from goal.');
    } finally {
      setCreatingTaskGoalId(null);
    }
  };

  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editGoalText, setEditGoalText] = useState('');
  const [editGoalTarget, setEditGoalTarget] = useState('');
  const [savingGoalId, setSavingGoalId] = useState<string | null>(null);

  const startEditGoal = (goalId: string, currentText: string, currentTargetDate: string | null) => {
    setEditingGoalId(goalId);
    setEditGoalText(currentText || '');
    setEditGoalTarget(currentTargetDate ? String(currentTargetDate).slice(0, 10) : '');
  };

  const cancelEditGoal = () => {
    setEditingGoalId(null);
    setEditGoalText('');
    setEditGoalTarget('');
  };

  const saveGoalEdit = async (goalId: string) => {
    if (!selectedPlan || !canEdit || isReadOnly) return;
    if (selectedPlan.status === 'ARCHIVED') return;

    const goalTextNext = editGoalText.trim();
    if (!goalTextNext) return;
    const cleaned = editGoalTarget.trim();
    if (cleaned !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      alert('Target date must be YYYY-MM-DD (or blank).');
      return;
    }

    setSavingGoalId(goalId);
    try {
      await api.patch(`/api/v1/care-plans/${selectedPlan.id}/goals/${goalId}`, {
        goalText: goalTextNext,
        targetDate: cleaned === '' ? null : cleaned,
      });
      await queryClient.invalidateQueries({ queryKey: ['care-plans', residentId] });
      cancelEditGoal();
    } catch (e) {
      console.error(e);
      alert('Could not update goal.');
    } finally {
      setSavingGoalId(null);
    }
  };

  const deleteGoal = async (goalId: string) => {
    if (!selectedPlan || !canEdit || isReadOnly) return;
    if (selectedPlan.status === 'ARCHIVED') return;
    if (!window.confirm('Delete this goal?')) return;
    try {
      await api.delete(`/api/v1/care-plans/${selectedPlan.id}/goals/${goalId}`);
      await queryClient.invalidateQueries({ queryKey: ['care-plans', residentId] });
    } catch (e) {
      console.error(e);
      alert('Could not delete goal.');
    }
  };

  const errMsg =
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
      ? (error as { response: { data: { error: string } } }).response.data.error
      : null;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 bg-slate-50 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Care plan</h3>
            <p className="text-sm text-gray-600 mt-1">
              Goals and outcomes for this resident. {canEdit ? 'Senior staff and managers can edit.' : 'Read-only.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {selectedPlan && canEdit ? (
              <button
                type="button"
                onClick={renamePlan}
                disabled={isReadOnly || selectedPlan.status === 'ARCHIVED'}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Rename
              </button>
            ) : null}
            {selectedPlan && canArchive ? (
              <button
                type="button"
                onClick={archivePlan}
                disabled={isReadOnly || selectedPlan.status === 'ARCHIVED'}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Archive
              </button>
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-gray-500">Loading care plan…</div>
        ) : isError ? (
          <div className="p-6 text-center text-rose-700 bg-rose-50/40">
            {errMsg || 'Could not load care plans.'}
          </div>
        ) : !selectedPlan ? (
          <div className="p-6 space-y-4">
            <div className="text-sm text-gray-600">
              No care plan yet. Create one to start capturing structured goals and outcomes.
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Plan title</label>
                <input
                  value={newPlanTitle}
                  onChange={(e) => setNewPlanTitle(e.target.value)}
                  disabled={!canEdit || isReadOnly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Create as</label>
                <select
                  value={newPlanStatus}
                  onChange={(e) => setNewPlanStatus(e.target.value === 'DRAFT' ? 'DRAFT' : 'ACTIVE')}
                  disabled={!canEdit || isReadOnly}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
                >
                  <option value="ACTIVE">Active (archives other active plan)</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>
              <button
                type="button"
                onClick={createPlan}
                disabled={!canEdit || isReadOnly || creatingPlan || !newPlanTitle.trim()}
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creatingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create plan
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {!canEdit ? (
              <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                You can view care plans, but your role cannot edit them. Ask a Senior Carer or manager.
              </div>
            ) : selectedPlan.status === 'ARCHIVED' ? (
              <div className="text-sm text-gray-700 bg-slate-50 border border-gray-200 rounded-lg px-4 py-3">
                This plan is archived and read-only. Select another plan or create a new draft.
              </div>
            ) : null}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {selectedPlan.title}{' '}
                  <span className="ml-2 text-xs font-medium text-gray-600">({selectedPlan.status})</span>
                </div>
                <div className="text-xs text-gray-500">
                  Updated {selectedPlan.updated_at ? new Date(selectedPlan.updated_at).toLocaleString() : '—'}
                  {selectedPlan.updated_by_name ? (
                    <span className="ml-2">by {selectedPlan.updated_by_name}</span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                {plans.length > 1 ? (
                  <select
                    value={selectedPlanId ?? ''}
                    onChange={(e) => setSelectedPlanId(e.target.value || null)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.status === 'ACTIVE'
                          ? 'ACTIVE — '
                          : p.status === 'ARCHIVED'
                            ? 'ARCHIVED — '
                            : p.status === 'DRAFT'
                              ? 'DRAFT — '
                              : ''}
                        {p.title}
                      </option>
                    ))}
                  </select>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    onClick={setPlanActive}
                    disabled={isReadOnly || selectedPlan.status === 'ARCHIVED' || selectedPlan.status === 'ACTIVE' || activatingPlan}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    title="Sets this plan as the resident's single active plan"
                  >
                    {activatingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Set active
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 bg-white border-b border-gray-200">
                <div className="text-sm font-semibold text-gray-900">Goals</div>
                <div className="text-xs text-gray-500 mt-1">
                  Add goals/outcomes and track progress over time.
                </div>
              </div>

              <div className="p-4 space-y-3 bg-slate-50/30">
                <label className="block text-xs font-semibold text-gray-600">New goal</label>
                <textarea
                  value={goalText}
                  onChange={(e) => setGoalText(e.target.value)}
                  rows={3}
                  disabled={!canEdit || isReadOnly || selectedPlan.status === 'ARCHIVED'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
                  placeholder="E.g. Maintain hydration with at least 1500ml daily unless contraindicated"
                />
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Target date (optional)</label>
                    <input
                      type="date"
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(e.target.value)}
                      disabled={!canEdit || isReadOnly || selectedPlan.status === 'ARCHIVED'}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addGoal}
                    disabled={!canEdit || isReadOnly || selectedPlan.status === 'ARCHIVED' || addingGoal || !goalText.trim()}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-5 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                  >
                    {addingGoal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Add goal
                  </button>
                </div>
              </div>

              <div className="divide-y divide-gray-100 bg-white">
                {(selectedPlan.goals || []).length === 0 ? (
                  <div className="p-5 text-sm text-gray-500">No goals yet.</div>
                ) : (
                  (selectedPlan.goals || []).map((g) => (
                    <div key={g.id} className="p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex-1">
                        {editingGoalId === g.id ? (
                          <div className="space-y-2">
                            <label className="block text-xs font-semibold text-gray-600">Goal</label>
                            <textarea
                              value={editGoalText}
                              onChange={(e) => setEditGoalText(e.target.value)}
                              rows={3}
                              disabled={!canEdit || isReadOnly || selectedPlan.status === 'ARCHIVED' || savingGoalId === g.id}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
                            />
                            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Target date (optional)</label>
                                <input
                                  type="date"
                                  value={editGoalTarget}
                                  onChange={(e) => setEditGoalTarget(e.target.value)}
                                  disabled={!canEdit || isReadOnly || selectedPlan.status === 'ARCHIVED' || savingGoalId === g.id}
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => void saveGoalEdit(g.id)}
                                  disabled={!canEdit || isReadOnly || selectedPlan.status === 'ARCHIVED' || savingGoalId === g.id || !editGoalText.trim()}
                                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {savingGoalId === g.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditGoal}
                                  disabled={savingGoalId === g.id}
                                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm font-medium text-gray-900">{g.goal_text}</div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          Status: <span className="font-semibold text-gray-700">{g.status}</span>
                          {g.target_date ? (
                            <span className="ml-2">Target: {new Date(g.target_date).toLocaleDateString()}</span>
                          ) : null}
                          {g.updated_at ? (
                            <span className="ml-2">
                              • Updated {new Date(g.updated_at).toLocaleString()}
                              {g.updated_by_name ? ` by ${g.updated_by_name}` : ''}
                            </span>
                          ) : null}
                        </div>
                        {g.created_at || g.created_by_name ? (
                          <div className="text-[11px] text-gray-400 mt-1">
                            {g.created_at ? `Created ${new Date(g.created_at).toLocaleString()}` : 'Created'}
                            {g.created_by_name ? ` by ${g.created_by_name}` : ''}
                          </div>
                        ) : null}
                        {(g.linkedTasks || []).length > 0 ? (
                          <div className="mt-2 rounded-lg border border-gray-200 bg-white">
                            <div className="px-3 py-2 border-b border-gray-200 text-xs font-semibold text-gray-700">
                              Linked tasks
                            </div>
                            <div className="divide-y divide-gray-100">
                              {(g.linkedTasks || []).map((t) => (
                                <div key={t.id} className="px-3 py-2 text-xs text-gray-700 flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate font-medium text-gray-900">{t.title}</div>
                                    <div className="text-[11px] text-gray-500">
                                      {t.status}
                                      {t.dueDate ? ` • Due ${t.dueDate}` : ''}
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-[11px] text-gray-500">{t.priority}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditGoal(g.id, g.goal_text, g.target_date)}
                          disabled={!canEdit || isReadOnly || selectedPlan.status === 'ARCHIVED' || (editingGoalId !== null && editingGoalId !== g.id)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {editingGoalId === g.id ? 'Editing…' : 'Edit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteGoal(g.id)}
                          disabled={!canEdit || isReadOnly || selectedPlan.status === 'ARCHIVED'}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => createTaskFromGoal(g.id, g.goal_text)}
                          disabled={!canEdit || isReadOnly || selectedPlan.status === 'ARCHIVED' || creatingTaskGoalId === g.id}
                          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          title="Create a task from this goal"
                        >
                          {creatingTaskGoalId === g.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                          Create task
                        </button>
                        <button
                          type="button"
                          onClick={() => updateGoalStatus(g.id, 'IN_PROGRESS')}
                          disabled={!canEdit || isReadOnly || selectedPlan.status === 'ARCHIVED'}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          In progress
                        </button>
                        <button
                          type="button"
                          onClick={() => updateGoalStatus(g.id, 'DONE')}
                          disabled={!canEdit || isReadOnly || selectedPlan.status === 'ARCHIVED'}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AssessmentsTab({ residentId, isReadOnly }: { residentId: string; isReadOnly: boolean }) {
  const queryClient = useQueryClient();
  const userRole = useGlobalStore((s) => (s.user?.role as string | undefined) || undefined);
  const canCreate = Boolean(userRole) && ['Senior Carer', 'Deputy Manager', 'Home Manager', 'Regional Manager', 'Admin'].includes(userRole as string);

  const { data: templateData, isLoading: templatesLoading } = useQuery({
    queryKey: ['assessment-templates'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/assessment-templates');
      return data as { templates: Array<{ id: string; name: string; version: number; schema_json: any; is_active: boolean }> };
    },
    staleTime: 30_000,
  });

  const { data: assessmentsData, isLoading: assessmentsLoading, isError: assessmentsError, error: assessmentsErr } = useQuery({
    queryKey: ['assessments', residentId],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/residents/${residentId}/assessments`);
      return data as {
        assessments: Array<{
          id: string;
          template_id: string;
          template_name: string;
          template_version: number;
          created_at: string;
          score: number | null;
          review_date: string | null;
          answers_json: any;
        }>;
      };
    },
    staleTime: 15_000,
  });

  const templates = (templateData?.templates || []).filter((t) => t.is_active);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;

  const fields: Array<any> = Array.isArray(selectedTemplate?.schema_json?.fields) ? selectedTemplate!.schema_json.fields : [];
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [score, setScore] = useState<string>('');
  const [reviewDate, setReviewDate] = useState<string>('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    setAnswers({});
    setScore('');
    setReviewDate('');
    setValidationErrors({});
  }, [selectedTemplateId]);

  const computeValidationErrors = (draftAnswers: Record<string, any>) => {
    if (!selectedTemplate) return {};
    const errs: Record<string, string> = {};
    const schemaFields: Array<any> = Array.isArray(selectedTemplate.schema_json?.fields) ? selectedTemplate.schema_json.fields : [];
    for (const f of schemaFields) {
      const key = String(f?.key || '').trim();
      if (!key) continue;
      const label = String(f?.label || key);
      const type = String(f?.type || 'text').toLowerCase();
      const required = Boolean(f?.required);
      const v = draftAnswers[key];
      const isEmpty =
        v === null ||
        v === undefined ||
        (typeof v === 'string' && v.trim() === '') ||
        (type === 'checkbox' && v === false);
      if (required && isEmpty) {
        errs[key] = `${label} is required.`;
        continue;
      }
      if (isEmpty) continue;
      if (type === 'number') {
        const n = typeof v === 'number' ? v : Number(v);
        if (!Number.isFinite(n)) {
          errs[key] = `${label} must be a number.`;
          continue;
        }
        if (f.min != null && Number.isFinite(Number(f.min)) && n < Number(f.min)) {
          errs[key] = `${label} must be at least ${Number(f.min)}.`;
          continue;
        }
        if (f.max != null && Number.isFinite(Number(f.max)) && n > Number(f.max)) {
          errs[key] = `${label} must be at most ${Number(f.max)}.`;
          continue;
        }
        continue;
      }
      if (type === 'select' && Array.isArray(f.options)) {
        const allowed = new Set(
          f.options
            .map((o: any) => (o && typeof o === 'object' ? String(o.value ?? o.label ?? '') : String(o)))
            .filter((x: string) => x.trim() !== '')
        );
        if (allowed.size > 0 && !allowed.has(String(v))) {
          errs[key] = `${label} must be one of the allowed options.`;
          continue;
        }
      }
      const s = typeof v === 'string' ? v : String(v);
      if (f.minLength != null && Number.isFinite(Number(f.minLength)) && s.length < Number(f.minLength)) {
        errs[key] = `${label} must be at least ${Number(f.minLength)} characters.`;
        continue;
      }
      if (f.maxLength != null && Number.isFinite(Number(f.maxLength)) && s.length > Number(f.maxLength)) {
        errs[key] = `${label} must be at most ${Number(f.maxLength)} characters.`;
        continue;
      }
      if (typeof f.pattern === 'string' && f.pattern.trim() !== '') {
        try {
          const re = new RegExp(f.pattern);
          if (!re.test(s)) errs[key] = `${label} is not in the expected format.`;
        } catch {
          // ignore invalid pattern
        }
      }
    }
    return errs;
  };

  const computeScorePreview = () => {
    const scoring = selectedTemplate?.scoring_json;
    if (!scoring || typeof scoring !== 'object') return { score: null as number | null, band: null as string | null };
    if (String((scoring as any).type || '').toLowerCase() !== 'sum') return { score: null, band: null };
    const fieldsMap = (scoring as any).fields && typeof (scoring as any).fields === 'object' ? (scoring as any).fields : {};
    let total = 0;
    for (const key of Object.keys(fieldsMap)) {
      const rule = fieldsMap[key];
      const map = rule?.map && typeof rule.map === 'object' ? rule.map : null;
      const def = rule?.default != null && Number.isFinite(Number(rule.default)) ? Number(rule.default) : 0;
      const v = answers[key];
      if (v === null || v === undefined || v === '') {
        total += def;
        continue;
      }
      if (map) {
        const mapped = map[String(v)];
        total += mapped != null && Number.isFinite(Number(mapped)) ? Number(mapped) : def;
      } else if (typeof v === 'number' && Number.isFinite(v)) total += v;
      else if (Number.isFinite(Number(v))) total += Number(v);
      else total += def;
    }
    let band: string | null = null;
    const bands = Array.isArray((scoring as any).bands) ? (scoring as any).bands : [];
    for (const b of bands) {
      const min = b?.min != null && Number.isFinite(Number(b.min)) ? Number(b.min) : null;
      const max = b?.max != null && Number.isFinite(Number(b.max)) ? Number(b.max) : null;
      if (min != null && total < min) continue;
      if (max != null && total > max) continue;
      if (typeof b?.label === 'string' && b.label.trim()) {
        band = b.label.trim();
        break;
      }
    }
    return { score: total, band };
  };

  const [saving, setSaving] = useState(false);
  const saveAssessment = async () => {
    if (!canCreate || isReadOnly) return;
    if (!selectedTemplate) return;
    const errs = computeValidationErrors(answers);
    setValidationErrors(errs);
    if (Object.keys(errs).length > 0) {
      alert('Please fix validation errors before saving.');
      return;
    }
    setSaving(true);
    try {
      const scoring = selectedTemplate?.scoring_json;
      const hasScoring = Boolean(scoring && typeof scoring === 'object');
      await api.post(`/api/v1/residents/${residentId}/assessments`, {
        templateId: selectedTemplate.id,
        status: 'COMPLETED',
        answersJson: answers,
        score: hasScoring ? null : score.trim() === '' ? null : Number(score),
        reviewDate: reviewDate.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['assessments', residentId] });
      setSelectedTemplateId('');
      setAnswers({});
      setScore('');
      setReviewDate('');
      alert('Assessment saved.');
    } catch (e) {
      console.error(e);
      alert('Could not save assessment.');
    } finally {
      setSaving(false);
    }
  };

  const errMsg =
    typeof assessmentsErr === 'object' &&
    assessmentsErr !== null &&
    'response' in assessmentsErr &&
    typeof (assessmentsErr as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
      ? (assessmentsErr as { response: { data: { error: string } } }).response.data.error
      : null;

  const [viewAssessmentId, setViewAssessmentId] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const {
    data: assessmentDetail,
    isLoading: detailLoading,
    isError: detailIsError,
    error: detailErr,
  } = useQuery({
    queryKey: ['assessment-detail', viewAssessmentId],
    enabled: Boolean(viewAssessmentId),
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/assessments/${viewAssessmentId}`);
      return data as { assessment: any };
    },
    staleTime: 30_000,
  });

  const closeDetail = () => {
    setViewOpen(false);
    setViewAssessmentId(null);
  };

  const detailErrMsg =
    typeof detailErr === 'object' &&
    detailErr !== null &&
    'response' in detailErr &&
    typeof (detailErr as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
      ? (detailErr as { response: { data: { error: string } } }).response.data.error
      : null;

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-200 bg-slate-50">
          <h3 className="text-lg font-semibold text-gray-900">Assessments</h3>
          <p className="text-sm text-gray-600 mt-1">Complete and review structured assessments for this resident.</p>
        </div>

        <div className="p-5 space-y-4">
          {!canCreate ? (
            <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              Your role can view assessments but cannot create them.
            </div>
          ) : null}

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="text-sm font-semibold text-gray-900">New assessment</div>
              <div className="text-xs text-gray-500 mt-1">Select a template and complete the form.</div>
            </div>
            <div className="p-4 space-y-4 bg-slate-50/30">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Template</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  disabled={!canCreate || isReadOnly || templatesLoading}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
                >
                  <option value="">{templatesLoading ? 'Loading templates…' : 'Select a template'}</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (v{t.version})
                    </option>
                  ))}
                </select>
              </div>

              {selectedTemplate ? (
                <div className="space-y-3">
                  {fields.length === 0 ? (
                    <div className="text-sm text-gray-600">
                      This template has no fields. Edit its schema in Admin Settings.
                    </div>
                  ) : null}
                  {fields.map((f) => {
                    const key = String(f.key || '');
                    const label = String(f.label || key || 'Field');
                    const type = String(f.type || 'text');
                    const value = answers[key] ?? (type === 'checkbox' ? false : '');

                    if (!key) return null;
                    if (type === 'select' && Array.isArray(f.options)) {
                      return (
                        <div key={key}>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                          <select
                            value={String(value)}
                            onChange={(e) =>
                              setAnswers((p) => {
                                const next = { ...p, [key]: e.target.value };
                                setValidationErrors(computeValidationErrors(next));
                                return next;
                              })
                            }
                            disabled={!canCreate || isReadOnly}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
                          >
                            <option value="">Select…</option>
                            {f.options.map((o: any) => (
                              <option key={String(o.value ?? o)} value={String(o.value ?? o)}>
                                {String(o.label ?? o.value ?? o)}
                              </option>
                            ))}
                          </select>
                          {validationErrors[key] ? (
                            <div className="text-xs text-rose-700 mt-1">{validationErrors[key]}</div>
                          ) : null}
                        </div>
                      );
                    }
                    if (type === 'textarea') {
                      return (
                        <div key={key}>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                          <textarea
                            value={String(value)}
                            onChange={(e) =>
                              setAnswers((p) => {
                                const next = { ...p, [key]: e.target.value };
                                setValidationErrors(computeValidationErrors(next));
                                return next;
                              })
                            }
                            rows={3}
                            disabled={!canCreate || isReadOnly}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
                          />
                          {validationErrors[key] ? (
                            <div className="text-xs text-rose-700 mt-1">{validationErrors[key]}</div>
                          ) : null}
                        </div>
                      );
                    }
                    if (type === 'checkbox') {
                      return (
                        <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(e) =>
                              setAnswers((p) => {
                                const next = { ...p, [key]: e.target.checked };
                                setValidationErrors(computeValidationErrors(next));
                                return next;
                              })
                            }
                            disabled={!canCreate || isReadOnly}
                            className="h-4 w-4"
                          />
                          <span className="font-medium">{label}</span>
                          {validationErrors[key] ? (
                            <span className="text-xs text-rose-700 ml-2">{validationErrors[key]}</span>
                          ) : null}
                        </label>
                      );
                    }
                    if (type === 'number') {
                      return (
                        <div key={key}>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                          <input
                            type="number"
                            value={value === '' ? '' : Number(value)}
                            onChange={(e) =>
                              setAnswers((p) => {
                                const next = { ...p, [key]: e.target.value === '' ? '' : Number(e.target.value) };
                                setValidationErrors(computeValidationErrors(next));
                                return next;
                              })
                            }
                            disabled={!canCreate || isReadOnly}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
                          />
                          {validationErrors[key] ? (
                            <div className="text-xs text-rose-700 mt-1">{validationErrors[key]}</div>
                          ) : null}
                        </div>
                      );
                    }
                    return (
                      <div key={key}>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                        <input
                          value={String(value)}
                          onChange={(e) =>
                            setAnswers((p) => {
                              const next = { ...p, [key]: e.target.value };
                              setValidationErrors(computeValidationErrors(next));
                              return next;
                            })
                          }
                          disabled={!canCreate || isReadOnly}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
                        />
                        {validationErrors[key] ? (
                          <div className="text-xs text-rose-700 mt-1">{validationErrors[key]}</div>
                        ) : null}
                      </div>
                    );
                  })}

                  {selectedTemplate?.scoring_json ? (
                    <div className="pt-2 border-t border-gray-200/60">
                      {(() => {
                        const preview = computeScorePreview();
                        return (
                          <div className="text-sm text-gray-700 bg-slate-50 border border-gray-200 rounded-lg px-4 py-3">
                            <div className="font-semibold text-gray-900">Score (computed)</div>
                            <div className="text-sm mt-1">
                              Preview: <span className="font-semibold">{preview.score ?? '—'}</span>
                              {preview.band ? <span className="ml-2 text-gray-600">({preview.band})</span> : null}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              This template has scoring rules. The final score is calculated on save.
                            </div>
                          </div>
                        );
                      })()}
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Review date (optional)</label>
                          <input
                            type="date"
                            value={reviewDate}
                            onChange={(e) => setReviewDate(e.target.value)}
                            disabled={!canCreate || isReadOnly}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200/60">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Score (optional)</label>
                        <input
                          type="number"
                          value={score}
                          onChange={(e) => setScore(e.target.value)}
                          disabled={!canCreate || isReadOnly}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
                          placeholder="e.g. 2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Review date (optional)</label>
                        <input
                          type="date"
                          value={reviewDate}
                          onChange={(e) => setReviewDate(e.target.value)}
                          disabled={!canCreate || isReadOnly}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-gray-600"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void saveAssessment()}
                      disabled={!canCreate || isReadOnly || saving || !selectedTemplateId || Object.keys(validationErrors).length > 0}
                      className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save assessment
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="text-sm font-semibold text-gray-900">History</div>
              <div className="text-xs text-gray-500 mt-1">Most recent assessments first.</div>
            </div>
            {assessmentsLoading ? (
              <div className="p-6 text-center text-gray-500">Loading assessments…</div>
            ) : assessmentsError ? (
              <div className="p-6 text-center text-rose-700 bg-rose-50/40">{errMsg || 'Could not load assessments.'}</div>
            ) : (assessmentsData?.assessments || []).length === 0 ? (
              <div className="p-6 text-center text-gray-500">No assessments recorded yet.</div>
            ) : (
              <div className="divide-y divide-gray-100 bg-white">
                {(assessmentsData?.assessments || []).map((a) => (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => {
                      setViewAssessmentId(a.id);
                      setViewOpen(true);
                    }}
                    className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
                    title="View assessment details"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {a.template_name} <span className="text-xs font-medium text-gray-500">(v{a.template_version})</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {a.created_at ? new Date(a.created_at).toLocaleString() : '—'}
                          {a.review_date ? ` • Review ${new Date(a.review_date).toLocaleDateString()}` : ''}
                        </div>
                      </div>
                      {a.score != null ? (
                        <div className="shrink-0 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1">
                          Score: {a.score}
                        </div>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {viewOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-gray-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Assessment details</h3>
                <p className="text-xs text-gray-500">Review saved answers and score.</p>
              </div>
              <button onClick={closeDetail} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {detailLoading ? (
                <div className="p-6 text-center text-gray-500">Loading…</div>
              ) : detailIsError ? (
                <div className="p-4 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-lg">
                  {detailErrMsg || 'Could not load assessment.'}
                </div>
              ) : (
                (() => {
                  const a = assessmentDetail?.assessment;
                  const schemaFields: Array<any> = Array.isArray(a?.schema_json?.fields) ? a.schema_json.fields : [];
                  const answersJson = a?.answers_json || {};
                  return (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-gray-900">{a?.template_name}</span>
                        <span className="text-gray-500">v{a?.template_version}</span>
                        {a?.score != null ? (
                          <span className="ml-auto text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1">
                            Score: {a.score}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-gray-500">
                        {a?.created_at ? new Date(a.created_at).toLocaleString() : '—'}
                        {a?.review_date ? ` • Review ${new Date(a.review_date).toLocaleDateString()}` : ''}
                      </div>

                      <div className="rounded-lg border border-gray-200 overflow-hidden">
                        <div className="divide-y divide-gray-100">
                          {schemaFields.length === 0 ? (
                            <div className="p-5 text-sm text-gray-600">No schema fields found for this template.</div>
                          ) : (
                            schemaFields.map((f) => {
                              const key = String(f?.key || '').trim();
                              if (!key) return null;
                              const label = String(f?.label || key);
                              const v = answersJson[key];
                              const display =
                                typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v == null || v === '' ? '—' : String(v);
                              return (
                                <div key={key} className="p-4">
                                  <div className="text-xs font-semibold text-gray-600">{label}</div>
                                  <div className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{display}</div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end bg-slate-50">
              <button
                type="button"
                onClick={closeDetail}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResidentProfilePage() {
  const params = useParams();
  const pathname = usePathname();
  const rawParam = params?.id;
  const residentId = useMemo(
    () => resolveResidentRouteId({ id: rawParam }, pathname),
    [rawParam, pathname],
  );
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    data: resident,
    isLoading,
    isPending,
    isFetching,
    isError: residentDetailIsError,
    error: residentDetailError,
  } = useResident(residentId);
  const residentChartLoading =
    Boolean(residentId) && resident === undefined && (isPending || isFetching || isLoading);
  const user = useGlobalStore((s) => s.user);
  const [activeTab, setActiveTab] = useState('Overview');

  const canEditProfilePhoto =
    Boolean(user?.role) &&
    ['Deputy Manager', 'Regional Manager', 'Home Manager', 'Admin'].includes(user.role as string);

  const canInviteFamilyContact =
    Boolean(user?.role) &&
    ['Deputy Manager', 'Home Manager', 'Regional Manager', 'Admin'].includes(user.role as string);

  const [familyInviteOpen, setFamilyInviteOpen] = useState(false);
  const [familyInvite, setFamilyInvite] = useState({
    email: '',
    firstName: '',
    lastName: '',
    relationship: '',
  });
  const [familyInviteSubmitting, setFamilyInviteSubmitting] = useState(false);

  const EMERGENCY_PROFILE_EDIT_ROLES = [
    'Senior Carer',
    'Deputy Manager',
    'Home Manager',
    'Regional Manager',
    'Admin',
  ] as const;
  const [emergencyForm, setEmergencyForm] = useState({
    knownAllergies: '',
    gpPracticeName: '',
    gpPracticePhone: '',
    nextOfKinName: '',
    nextOfKinPhone: '',
    nextOfKinRelationship: '',
    advanceCareNotes: '',
  });
  const [emergencySaving, setEmergencySaving] = useState(false);
  const [emergencyDownloadBusy, setEmergencyDownloadBusy] = useState<'json' | 'csv' | null>(null);

  const [isProfilePhotoModalOpen, setIsProfilePhotoModalOpen] = useState(false);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [profilePhotoPreviewUrl, setProfilePhotoPreviewUrl] = useState<string | null>(null);
  const [profilePhotoSaving, setProfilePhotoSaving] = useState(false);
  const [headerPhotoFailed, setHeaderPhotoFailed] = useState(false);
  const profilePhotoCameraInputRef = useRef<HTMLInputElement>(null);
  const profilePhotoGalleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHeaderPhotoFailed(false);
  }, [resident?.profile_image_url]);

  useEffect(() => {
    if (!resident?.id) return;
    setEmergencyForm({
      knownAllergies: resident.known_allergies ?? '',
      gpPracticeName: resident.gp_practice_name ?? '',
      gpPracticePhone: resident.gp_practice_phone ?? '',
      nextOfKinName: resident.next_of_kin_name ?? '',
      nextOfKinPhone: resident.next_of_kin_phone ?? '',
      nextOfKinRelationship: resident.next_of_kin_relationship ?? '',
      advanceCareNotes: resident.advance_care_notes ?? '',
    });
  }, [
    resident?.id,
    resident?.known_allergies,
    resident?.gp_practice_name,
    resident?.gp_practice_phone,
    resident?.next_of_kin_name,
    resident?.next_of_kin_phone,
    resident?.next_of_kin_relationship,
    resident?.advance_care_notes,
  ]);

  // --- Modal & Global States ---
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [bedModalAction, setBedModalAction] = useState<'transfer' | 'admit'>('transfer');
  const [transferBedId, setTransferBedId] = useState('');
  const [isDischargeModalOpen, setIsDischargeModalOpen] = useState(false);
  const [dischargeForm, setDischargeForm] = useState({ reason: '', destination: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Documents Tab State ---
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('General');
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentDownloadingId, setDocumentDownloadingId] = useState<string | null>(null);
  const [documentDeletingId, setDocumentDeletingId] = useState<string | null>(null);

  // --- Tasks Tab State ---
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('NORMAL');
  const [taskListFilter, setTaskListFilter] = useState<'all' | 'overdue' | 'dueToday' | 'highPriority'>('all');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDue, setEditDue] = useState('');
  const [editPriority, setEditPriority] = useState('NORMAL');
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);

  // --- Notes & Incidents Tab State ---
  const [draftNote, setDraftNote] = useState('');
  const [draftNoteShareWithFamily, setDraftNoteShareWithFamily] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteShareBusyId, setNoteShareBusyId] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [handoverSummary, setHandoverSummary] = useState('');
  const [isDraftingIncident, setIsDraftingIncident] = useState(false);
  const [incidentDraft, setIncidentDraft] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [unarchiving, setUnarchiving] = useState(false);

  // --- Observations Tab State ---
  const [isAddingObservation, setIsAddingObservation] = useState(false);
  const [observationForm, setObservationForm] = useState({
    type: 'Blood Pressure',
    value: '',
    unit: 'mmHg',
    notes: '',
  });
  const [obsTrendRange, setObsTrendRange] = useState<'7d' | '30d'>('7d');
  const [obsTrendType, setObsTrendType] = useState<string>('BP');
  const [showObsTrends, setShowObsTrends] = useState(false);
  
  // --- eMAR Tab State ---
  const [isAddingMed, setIsAddingMed] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', dose: '', route: 'Oral', frequency: 'OD', stockCount: 28 });
  const [isCheckingMeds, setIsCheckingMeds] = useState(false);
  const [medSafetyReport, setMedSafetyReport] = useState('');

  // Fetch live facility layout to populate the transfer dropdown
  const { data: layoutData } = useQuery({
    queryKey: ['facility-layout'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/facility-layout');
      return data;
    }
  });

  const obsQueryEnabled = !residentChartLoading && !!resident?.id && activeTab === 'Observations';
  const {
    data: observationsQueryData,
    isLoading: observationsQueryLoading,
    isError: observationsQueryIsError,
  } = useQuery({
    queryKey: ['resident-observations', residentId, obsTrendRange],
    enabled: obsQueryEnabled,
    queryFn: async () => {
      const since = observationSinceIso(obsTrendRange === '7d' ? 7 : 30);
      const { data } = await api.get(`/api/v1/residents/${residentId}/observations`, {
        params: { since },
      });
      return data as { observations: Array<any> };
    },
  });

  const { data: observationsSummaryData, isError: observationsSummaryIsError } = useQuery({
    queryKey: ['resident-observations-summary', residentId],
    enabled: obsQueryEnabled,
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/residents/${residentId}/observations/summary`);
      return data as { latestByType: Array<any> };
    },
  });

  const documentsQueryEnabled = Boolean(residentId && resident?.id);
  const {
    data: residentDocumentsData,
    isLoading: residentDocumentsLoading,
    isError: residentDocumentsIsError,
  } = useQuery({
    queryKey: ['resident-documents', residentId],
    enabled: documentsQueryEnabled,
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/residents/${residentId}/documents`);
      return data as { documents: Array<any> };
    },
  });

  const trendPoints = useMemo(() => {
    const raw = observationsQueryData?.observations;
    const rows = Array.isArray(raw) ? raw : [];
    const filtered = rows
      .filter((o: any) => String(o.type) === obsTrendType)
      .map((o: any) => ({
        at: o.recordedAt,
        v: parseObservationNumeric(obsTrendType, String(o.value ?? '')),
      }))
      .filter((p) => p.v != null && Number.isFinite(p.v)) as Array<{ at: string; v: number }>;
    filtered.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return filtered;
  }, [observationsQueryData?.observations, obsTrendType]);

  const filteredTasks = useMemo(() => {
    const list = [...(resident?.tasks || [])];
    if (taskListFilter === 'overdue') return list.filter((t: any) => isTaskOverdue(t));
    if (taskListFilter === 'dueToday') return list.filter((t: any) => isTaskDueToday(t));
    if (taskListFilter === 'highPriority') return list.filter((t: any) => taskPriorityIsHighClient(t.priority));
    return list;
  }, [resident?.tasks, taskListFilter]);

  if (!residentId) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-rose-600 font-medium">This service user link is not valid.</p>
        <button
          type="button"
          onClick={() => router.push('/residents')}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Back to service users
        </button>
      </div>
    );
  }

  if (residentChartLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center flex-col space-y-4 animate-in fade-in">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Loading clinical record...</p>
      </div>
    );
  }

  if (!resident && residentDetailIsError) {
    const { title, detail } = formatApiError(residentDetailError);
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg font-semibold text-rose-700">{title}</p>
        <p className="max-w-md text-sm text-slate-600">{detail}</p>
        <button
          type="button"
          onClick={() => void queryClient.invalidateQueries({ queryKey: ['resident', residentId] })}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={() => router.push('/residents')}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Back to service users
        </button>
      </div>
    );
  }

  if (!resident) {
    return <div className="p-8 text-center text-rose-500">Resident not found.</div>;
  }

  const documents = residentDocumentsData?.documents ?? [];

  const isReadOnly = resident.status === 'ARCHIVED';
  const canAssignTasks = Boolean(user?.role) && TASK_ASSIGN_ROLES.has(user.role as string);
  const canExportResident =
    Boolean(user?.role) &&
    ['Deputy Manager', 'Home Manager', 'Regional Manager', 'Admin'].includes(user.role as string);
  const canArchiveDischargedResident =
    Boolean(user?.role) &&
    ['Deputy Manager', 'Home Manager', 'Regional Manager', 'Admin'].includes(user.role as string);
  const canUnarchiveArchivedResident = canArchiveDischargedResident;
  const canUseEmergencyTransfer =
    Boolean(user?.role) && user.role !== 'Family' && !isReadOnly;
  const canEditEmergencyTransfer =
    Boolean(user?.role) &&
    EMERGENCY_PROFILE_EDIT_ROLES.includes(user.role as (typeof EMERGENCY_PROFILE_EDIT_ROLES)[number]);
  const tabs = ['Overview', 'Care plan', 'Assessments', 'Tasks', 'Food & Drink', 'Activities', 'Daily care', 'Topical', 'PEEP', 'Notes & Incidents', 'Observations', 'eMAR', 'Documents'];

  const availableBeds = layoutData?.beds?.filter((b: any) => b.status === 'AVAILABLE') || [];
  const units = layoutData?.units || [];

  const displayObservations = (() => {
    const fromQuery = observationsQueryData?.observations;
    const fromResident = resident.observations;
    const raw = fromQuery ?? fromResident ?? [];
    return Array.isArray(raw) ? raw : [];
  })();

  const saveEmergencyTransferProfile = async () => {
    if (!canEditEmergencyTransfer) return;
    setEmergencySaving(true);
    try {
      await api.patch(`/api/v1/residents/${resident.id}/emergency-transfer-profile`, {
        knownAllergies: emergencyForm.knownAllergies.trim() || null,
        gpPracticeName: emergencyForm.gpPracticeName.trim() || null,
        gpPracticePhone: emergencyForm.gpPracticePhone.trim() || null,
        nextOfKinName: emergencyForm.nextOfKinName.trim() || null,
        nextOfKinPhone: emergencyForm.nextOfKinPhone.trim() || null,
        nextOfKinRelationship: emergencyForm.nextOfKinRelationship.trim() || null,
        advanceCareNotes: emergencyForm.advanceCareNotes.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
      alert('Emergency transfer details saved.');
    } catch (e) {
      console.error(e);
      let msg = 'Could not save emergency transfer details.';
      if (e && typeof e === 'object' && 'response' in e) {
        const d = (e as { response?: { data?: { error?: string } } }).response?.data?.error;
        if (d) msg = d;
      }
      alert(msg);
    } finally {
      setEmergencySaving(false);
    }
  };

  const downloadEmergencyTransferPack = async (format: 'json' | 'csv') => {
    setEmergencyDownloadBusy(format);
    try {
      if (format === 'json') {
        const { data } = await api.get(`/api/v1/residents/${resident.id}/emergency-transfer-pack`);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `emergency-transfer-pack-${resident.id}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        const { data: blob } = await api.get(`/api/v1/residents/${resident.id}/emergency-transfer-pack.csv`, {
          responseType: 'blob',
        });
        const dl = new Blob([blob], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(dl);
        const a = document.createElement('a');
        a.href = url;
        a.download = `emergency-transfer-pack-${resident.id}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error(e);
      let msg = format === 'json' ? 'Could not download JSON pack.' : 'Could not download CSV pack.';
      if (e && typeof e === 'object' && 'response' in e) {
        const res = (e as { response?: { data?: unknown } }).response;
        const raw = res?.data;
        if (raw instanceof Blob) {
          try {
            const text = await raw.text();
            try {
              const parsed = JSON.parse(text) as { error?: string };
              if (typeof parsed.error === 'string') msg = parsed.error;
            } catch {
              if (text.trim()) msg = text.slice(0, 240);
            }
          } catch {
            /* ignore */
          }
        }
      }
      alert(msg);
    } finally {
      setEmergencyDownloadBusy(null);
    }
  };

  // --- Core Handlers ---
  const openBedModal = (action: 'transfer' | 'admit') => {
    setBedModalAction(action);
    setTransferBedId('');
    setIsTransferModalOpen(true);
  };

  const closeBedModal = () => {
    setIsTransferModalOpen(false);
    setTransferBedId('');
  };

  const handleConfirmBedModal = async () => {
    if (!transferBedId) return;
    setIsSubmitting(true);
    try {
      if (bedModalAction === 'admit') {
        await api.post(`/api/v1/residents/${resident.id}/admit`, { newBedId: transferBedId });
        alert('Admission successful!');
      } else {
        await api.post(`/api/v1/residents/${resident.id}/transfer`, { newBedId: transferBedId });
        alert('Transfer successful!');
      }
      closeBedModal();
      await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
      await queryClient.invalidateQueries({ queryKey: ['residents'] });
      await queryClient.invalidateQueries({ queryKey: ['facility-layout'] });
    } catch (error) {
      console.error(error);
      alert(
        bedModalAction === 'admit'
          ? 'Failed to admit service user. Check the bed is available and you have permission.'
          : 'Failed to transfer service user. Make sure the backend endpoint exists.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDischarge = async () => {
    if (!dischargeForm.reason) return;
    setIsSubmitting(true);
    try {
      await api.post(`/api/v1/residents/${resident.id}/discharge`, dischargeForm);
      alert('Discharge successful!');
      setIsDischargeModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['residents'] });
      router.push('/residents');
    } catch (error) {
      console.error(error);
      alert('Failed to discharge resident. Make sure the backend endpoint exists.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveDischarged = async () => {
    if (
      !window.confirm(
        'Archive this discharged service user? They will leave the main Service Users list (enable “Show archived” to find them). The record stays available read-only for audit.'
      )
    ) {
      return;
    }
    setArchiving(true);
    try {
      await api.post(`/api/v1/residents/${resident.id}/archive`);
      await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
      await queryClient.invalidateQueries({ queryKey: ['residents'] });
      alert('Service user archived.');
      router.push('/residents');
    } catch (error) {
      console.error(error);
      const msg =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
          ? (error as { response: { data: { error: string } } }).response.data.error
          : 'Could not archive. Check permissions and that the person is discharged.';
      alert(msg);
    } finally {
      setArchiving(false);
    }
  };

  const handleUnarchiveArchived = async () => {
    if (
      !window.confirm(
        'Unarchive this service user? Their status will return to Discharged so the record is editable again and they appear in the main Service Users list (unless you archive again).'
      )
    ) {
      return;
    }
    setUnarchiving(true);
    try {
      await api.post(`/api/v1/residents/${resident.id}/unarchive`);
      await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
      await queryClient.invalidateQueries({ queryKey: ['residents'] });
      alert('Service user unarchived. Status is now Discharged.');
    } catch (error) {
      console.error(error);
      const msg =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
          ? (error as { response: { data: { error: string } } }).response.data.error
          : 'Could not unarchive. Check permissions.';
      alert(msg);
    } finally {
      setUnarchiving(false);
    }
  };

  const userRole = user?.role as string | undefined;
  const canUploadDocuments =
    Boolean(userRole) && ['Senior Carer', 'Deputy Manager', 'Home Manager', 'Regional Manager', 'Admin'].includes(userRole as string);
  const canDeleteDocuments =
    Boolean(userRole) && ['Deputy Manager', 'Home Manager', 'Regional Manager', 'Admin'].includes(userRole as string);

  const onDocumentFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setDocumentFile(f);
  };

  const handleUploadDocument = async () => {
    if (!canUploadDocuments || isReadOnly) return;
    if (!documentFile) {
      alert('Choose a file to upload first.');
      return;
    }
    setDocumentUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', documentFile);
      fd.append('docType', documentType);
      await api.post(`/api/v1/residents/${resident.id}/documents`, fd);
      setIsUploadingDoc(false);
      setDocumentFile(null);
      setDocumentType('General');
      await queryClient.invalidateQueries({ queryKey: ['resident-documents', resident.id] });
    } catch (e) {
      console.error(e);
      const msg =
        typeof e === 'object' &&
        e !== null &&
        'response' in e &&
        typeof (e as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
          ? (e as { response: { data: { error: string } } }).response.data.error
          : 'Could not upload document.';
      alert(msg);
    } finally {
      setDocumentUploading(false);
    }
  };

  const handleDownloadDocument = async (docId: string) => {
    setDocumentDownloadingId(docId);
    try {
      const { data } = await api.get(`/api/v1/documents/${docId}/download`);
      if (data?.url) window.open(String(data.url), '_blank', 'noopener,noreferrer');
      else alert('No download link returned.');
    } catch (e) {
      console.error(e);
      alert('Could not generate download link.');
    } finally {
      setDocumentDownloadingId(null);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!canDeleteDocuments || isReadOnly) return;
    if (!window.confirm('Delete this document? This removes it from the resident record.')) return;
    setDocumentDeletingId(docId);
    try {
      await api.delete(`/api/v1/documents/${docId}`);
      await queryClient.invalidateQueries({ queryKey: ['resident-documents', resident.id] });
    } catch (e) {
      console.error(e);
      alert('Could not delete document.');
    } finally {
      setDocumentDeletingId(null);
    }
  };

  const downloadResidentCsv = async (exportType: 'timeline' | 'documents') => {
    try {
      const { data } = await api.get(`/api/v1/residents/${resident.id}/export.csv`, {
        params: { type: exportType },
        responseType: 'blob',
      });
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resident-${resident.id}-${exportType}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      const msg =
        typeof e === 'object' &&
        e !== null &&
        'response' in e &&
        typeof (e as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
          ? (e as { response: { data: { error: string } } }).response.data.error
          : 'Could not download export.';
      alert(msg);
    }
  };

  const handleSaveObservation = async () => {
    if (isReadOnly) return;
    const v = observationForm.value.trim();
    if (!v) return;
    try {
      await api.post(`/api/v1/residents/${resident.id}/observations`, {
        type: observationForm.type,
        value: v,
        unit: observationForm.unit || undefined,
        notes: observationForm.notes?.trim() || undefined,
      });
      const { type, unit } = observationForm;
      setIsAddingObservation(false);
      setObservationForm({ type, value: '', unit, notes: '' });
      await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
      await queryClient.invalidateQueries({ queryKey: ['resident-observations', resident.id] });
      await queryClient.invalidateQueries({ queryKey: ['resident-observations-summary', resident.id] });
    } catch (e) {
      console.error(e);
      const msg =
        typeof e === 'object' &&
        e !== null &&
        'response' in e &&
        typeof (e as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
          ? (e as { response: { data: { error: string } } }).response.data.error
          : 'Could not save observation.';
      alert(msg);
    }
  };

  // --- AI Feature Handlers ---
  const handleSummarizeNotes = async () => {
    setIsSummarizing(true); setHandoverSummary('');
    try {
      const notesText = (resident.dailyNotes || []).map((n: any) => `[${n.time} by ${n.author}]: ${n.text}`).join('\n');
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/handover`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: notesText })
      });
      const data = await response.json();
      if (response.ok) setHandoverSummary(data.summary);
    } catch (e) { alert("Failed to generate summary"); } finally { setIsSummarizing(false); }
  };

  const handleDraftIncidentReport = async () => {
    setIsDraftingIncident(true); setIncidentDraft('');
    try {
      const notesText = (resident.dailyNotes || []).slice(0, 5).map((n: any) => `[${n.time} by ${n.author}]: ${n.text}`).join('\n');
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/draft-incident`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: notesText })
      });
      const data = await response.json();
      if (response.ok) setIncidentDraft(data.report);
    } catch (e) { alert("Failed to generate report"); } finally { setIsDraftingIncident(false); }
  };

  const handleCheckMedSafety = async () => {
    if (!resident.medications || resident.medications.length === 0) return;
    setIsCheckingMeds(true); setMedSafetyReport('');
    try {
      const medList = resident.medications.map((m: any) => `${m.name} ${m.dose}`).join(', ');
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/med-safety`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ medications: medList })
      });
      const data = await response.json();
      if (response.ok) setMedSafetyReport(data.report);
    } catch (e) { alert("Error analyzing medications"); } finally { setIsCheckingMeds(false); }
  };

  const saveDailyNote = async (
    rawText: string,
    resetFn: () => void,
    opts?: { prefix?: string; shareWithFamily?: boolean }
  ) => {
    const prefix = opts?.prefix || '';
    const text = (prefix ? `${prefix}\n\n${rawText}` : rawText).trim();
    if (!text) return;
    setNoteSaving(true);
    try {
      await api.post(`/api/v1/residents/${resident.id}/daily-notes`, {
        text,
        shareWithFamily: Boolean(opts?.shareWithFamily),
      });
      await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
      resetFn();
    } catch (e) {
      console.error(e);
      alert('Could not save note.');
    } finally {
      setNoteSaving(false);
    }
  };

  // --- General UI Submission Handlers (Medication row still mocked) ---
  const handleGenericSubmit = (type: string, resetFn: () => void) => {
    if (type === 'Medication') {
      alert(`${type} feature submitted! Ensure a backend endpoint is added to persist to the database.`);
      resetFn();
    }
  };

  const revokeProfilePhotoPreview = () => {
    setProfilePhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setProfilePhotoFile(null);
  };

  const closeProfilePhotoModal = () => {
    revokeProfilePhotoPreview();
    setIsProfilePhotoModalOpen(false);
  };

  const openProfilePhotoModal = () => {
    revokeProfilePhotoPreview();
    setIsProfilePhotoModalOpen(true);
  };

  const onProfilePhotoFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setProfilePhotoFile(f);
    setProfilePhotoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  };

  const handleSaveProfilePhoto = async () => {
    if (!profilePhotoFile) {
      alert('Take a new photo or choose one from your device first.');
      return;
    }
    setProfilePhotoSaving(true);
    try {
      const fd = new FormData();
      fd.append('photo', profilePhotoFile);
      await api.post(`/api/v1/residents/${resident.id}/profile-photo`, fd);
      closeProfilePhotoModal();
      await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
      await queryClient.invalidateQueries({ queryKey: ['residents'] });
    } catch (e) {
      console.error(e);
      const msg =
        typeof e === 'object' &&
        e !== null &&
        'response' in e &&
        typeof (e as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
          ? (e as { response: { data: { error: string } } }).response.data.error
          : 'Could not upload profile photo. Check the image is JPEG, PNG, or WebP and under 5MB.';
      alert(msg);
    } finally {
      setProfilePhotoSaving(false);
    }
  };

  const handleRemoveProfilePhoto = async () => {
    if (!resident.profile_image_url) return;
    if (!window.confirm('Remove the profile photo from this service user?')) return;
    setProfilePhotoSaving(true);
    try {
      await api.patch(`/api/v1/residents/${resident.id}`, { profileImageUrl: null });
      closeProfilePhotoModal();
      await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
      await queryClient.invalidateQueries({ queryKey: ['residents'] });
    } catch (e) {
      console.error(e);
      alert('Could not remove profile photo.');
    } finally {
      setProfilePhotoSaving(false);
    }
  };

  const profilePhotoAlt = `${resident.first_name ?? ''} ${resident.last_name ?? ''}`.trim() || 'Service user';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-32 animate-in fade-in relative">
      <button 
        onClick={() => router.push('/residents')} 
        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Service Users
      </button>

      {/* Resident Header — prominent photo for quick identification */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6 w-full md:w-auto">
          <div className="relative shrink-0 mx-auto sm:mx-0">
            <div
              className={`rounded-full p-1 shadow-sm ${
                isReadOnly
                  ? 'bg-slate-200 ring-2 ring-slate-300 ring-offset-2 ring-offset-white'
                  : 'bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-100 ring-2 ring-blue-200/90 ring-offset-2 ring-offset-white'
              }`}
            >
              {resident.profile_image_url && !headerPhotoFailed ? (
                <img
                  src={resident.profile_image_url}
                  alt={profilePhotoAlt}
                  className="w-32 h-32 sm:w-36 sm:h-36 rounded-full object-cover border-2 border-white"
                  onError={() => setHeaderPhotoFailed(true)}
                />
              ) : (
                <div
                  className={`w-32 h-32 sm:w-36 sm:h-36 rounded-full flex items-center justify-center text-4xl font-bold border-2 border-white ${
                    isReadOnly ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {resident.first_name?.[0]}
                  {resident.last_name?.[0]}
                </div>
              )}
            </div>
            {canEditProfilePhoto && !isReadOnly && (
              <button
                type="button"
                onClick={openProfilePhotoModal}
                title="Set profile photo"
                className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-colors"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
              {resident.first_name} {resident.last_name}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-gray-600">
              <span className="flex items-center font-medium bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                <UserCircle className="w-4 h-4 mr-1.5 text-slate-400" />
                {(() => {
                  const raw = resident.date_of_birth?.trim();
                  if (!raw) return '—';
                  const d = new Date(raw);
                  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB');
                })()}
              </span>
              <span className="flex items-center font-medium bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                NHS: {resident.nhs_number}
              </span>
              <Badge
                variant={
                  resident.status === 'DISCHARGED'
                    ? 'warning'
                    : resident.status === 'ARCHIVED'
                      ? 'default'
                      : 'default'
                }
              >
                {resident.status}
              </Badge>
              {resident.room_number ? (
                <span className="flex items-center text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md font-medium">
                  <MapPin className="w-4 h-4 mr-1.5 text-blue-500" /> 
                  {resident.home_name} - {resident.unit_name}, Rm {resident.room_number}
                </span>
              ) : (
                <span className="flex items-center text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                  <MapPin className="w-4 h-4 mr-1" /> No active bed
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/residents/${resident.id}/summary`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-800 rounded-lg shadow-sm hover:bg-gray-50 font-medium transition-colors print:hidden"
          >
            <Printer className="h-4 w-4 text-gray-600" aria-hidden />
            Print summary
          </Link>
          {!isReadOnly && resident.status === 'ADMITTED' && (
            <>
              <button
                type="button"
                onClick={() => openBedModal('transfer')}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg shadow-sm hover:bg-gray-50 font-medium transition-colors"
              >
                {resident.room_number ? 'Transfer' : 'Admit to bed'}
              </button>
              <button
                type="button"
                onClick={() => setIsDischargeModalOpen(true)}
                className="px-4 py-2 bg-white border border-rose-200 text-rose-700 rounded-lg shadow-sm hover:bg-rose-50 font-medium transition-colors"
              >
                Discharge
              </button>
            </>
          )}
          {!isReadOnly && (resident.status === 'DISCHARGED' || resident.status === 'PENDING') && (
            <button
              type="button"
              onClick={() => openBedModal('admit')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 font-medium transition-colors"
            >
              {resident.status === 'PENDING' ? 'Admit' : 'Readmit'}
            </button>
          )}
          {!isReadOnly && resident.status === 'DISCHARGED' && canArchiveDischargedResident && (
            <button
              type="button"
              disabled={archiving}
              onClick={() => void handleArchiveDischarged()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-800 rounded-lg shadow-sm hover:bg-slate-50 font-medium transition-colors disabled:opacity-50"
            >
              {archiving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Archive className="h-4 w-4 text-slate-600" aria-hidden />
              )}
              Archive record
            </button>
          )}
          {resident.status === 'ARCHIVED' && canUnarchiveArchivedResident && (
            <button
              type="button"
              disabled={unarchiving}
              onClick={() => void handleUnarchiveArchived()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-emerald-300 text-emerald-900 rounded-lg shadow-sm hover:bg-emerald-50 font-medium transition-colors disabled:opacity-50"
            >
              {unarchiving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Undo2 className="h-4 w-4 text-emerald-700" aria-hidden />
              )}
              Unarchive (Discharged)
            </button>
          )}
          {canExportResident && (
            <>
              <button
                type="button"
                onClick={() => void downloadResidentCsv('timeline')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
                title="Download tasks, notes, observations, assessments, documents metadata, and daily charts as CSV"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                Export timeline CSV
              </button>
              <button
                type="button"
                onClick={() => void downloadResidentCsv('documents')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
                title="Download resident document metadata as CSV"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                Export documents CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`${activeTab === tab ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* --- TAB: OVERVIEW --- */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
          <div className="md:col-span-2 space-y-6">
            {!isReadOnly && canInviteFamilyContact && (
              <div className="rounded-xl border border-teal-200 bg-teal-50/90 p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-teal-900 flex items-center gap-2">
                      <UserPlus className="h-5 w-5 shrink-0 text-teal-600" aria-hidden />
                      Family portal
                    </h3>
                    <p className="mt-1 text-sm text-teal-800/95">
                      Email an invite to a relative or representative. When they accept, they sign in here and see
                      updates you mark for the family portal.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFamilyInviteOpen(true)}
                    className="shrink-0 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
                  >
                    Invite family contact
                  </button>
                </div>
              </div>
            )}
            {canUseEmergencyTransfer && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold text-amber-950 flex items-center gap-2">
                      <Hospital className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
                      Emergency &amp; hospital transfer pack
                    </h3>
                    <p className="mt-1 text-sm text-amber-900/95">
                      DCRS standard v1: identity, allergies, MAR list, recent observations, PEEP, GP and next of kin,
                      and advance care pointers. For ambulance and acute handover — verify against original records
                      before leaving the home.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={emergencyDownloadBusy !== null}
                      onClick={() => void downloadEmergencyTransferPack('json')}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-700 bg-white px-3 py-2 text-sm font-medium text-amber-950 shadow-sm hover:bg-amber-100 disabled:opacity-50"
                    >
                      <Download className="h-4 w-4 shrink-0" aria-hidden />
                      {emergencyDownloadBusy === 'json' ? 'Preparing…' : 'JSON pack'}
                    </button>
                    <button
                      type="button"
                      disabled={emergencyDownloadBusy !== null}
                      onClick={() => void downloadEmergencyTransferPack('csv')}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-700 bg-amber-800 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-900 disabled:opacity-50"
                    >
                      <Download className="h-4 w-4 shrink-0" aria-hidden />
                      {emergencyDownloadBusy === 'csv' ? 'Preparing…' : 'CSV pack'}
                    </button>
                  </div>
                </div>
                {!isReadOnly && canEditEmergencyTransfer ? (
                  <div className="mt-4 space-y-3 border-t border-amber-200/80 pt-4">
                    <p className="text-xs font-medium text-amber-900">Transfer profile (edit)</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs text-amber-900 sm:col-span-2">
                        Known allergies &amp; intolerances
                        <textarea
                          className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                          rows={2}
                          value={emergencyForm.knownAllergies}
                          onChange={(e) => setEmergencyForm((f) => ({ ...f, knownAllergies: e.target.value }))}
                          maxLength={4000}
                        />
                      </label>
                      <label className="block text-xs text-amber-900">
                        GP practice
                        <input
                          className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900"
                          value={emergencyForm.gpPracticeName}
                          onChange={(e) => setEmergencyForm((f) => ({ ...f, gpPracticeName: e.target.value }))}
                          maxLength={500}
                        />
                      </label>
                      <label className="block text-xs text-amber-900">
                        GP phone
                        <input
                          className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900"
                          value={emergencyForm.gpPracticePhone}
                          onChange={(e) => setEmergencyForm((f) => ({ ...f, gpPracticePhone: e.target.value }))}
                          maxLength={80}
                        />
                      </label>
                      <label className="block text-xs text-amber-900">
                        Next of kin name
                        <input
                          className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900"
                          value={emergencyForm.nextOfKinName}
                          onChange={(e) => setEmergencyForm((f) => ({ ...f, nextOfKinName: e.target.value }))}
                          maxLength={200}
                        />
                      </label>
                      <label className="block text-xs text-amber-900">
                        Next of kin phone
                        <input
                          className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900"
                          value={emergencyForm.nextOfKinPhone}
                          onChange={(e) => setEmergencyForm((f) => ({ ...f, nextOfKinPhone: e.target.value }))}
                          maxLength={80}
                        />
                      </label>
                      <label className="block text-xs text-amber-900 sm:col-span-2">
                        Relationship
                        <input
                          className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900"
                          value={emergencyForm.nextOfKinRelationship}
                          onChange={(e) =>
                            setEmergencyForm((f) => ({ ...f, nextOfKinRelationship: e.target.value }))
                          }
                          maxLength={120}
                        />
                      </label>
                      <label className="block text-xs text-amber-900 sm:col-span-2">
                        Advance care (e.g. where RESPECT / DNACPR is filed — not a legal form in this box)
                        <textarea
                          className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-500"
                          rows={2}
                          value={emergencyForm.advanceCareNotes}
                          onChange={(e) => setEmergencyForm((f) => ({ ...f, advanceCareNotes: e.target.value }))}
                          maxLength={4000}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={emergencySaving}
                      onClick={() => void saveEmergencyTransferProfile()}
                      className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-900 disabled:opacity-50"
                    >
                      {emergencySaving ? 'Saving…' : 'Save transfer profile'}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {(resident.dailyNotes || []).length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No recent activity recorded.</p>
                ) : (resident.dailyNotes || []).slice(0, 3).map((note: any, i: number) => (
                  <div key={i} className="flex gap-4 p-3 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><FileText className="w-5 h-5" /></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{note.text}</p>
                      <p className="text-xs text-gray-400 mt-1">{note.time} by {note.author}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {!isReadOnly && (
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-5 border border-violet-100 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-violet-900 flex items-center gap-2"><Mail className="w-5 h-5 text-violet-600" /> Family Update Drafter</h3>
                    <p className="text-sm text-violet-700 mt-1">Draft a reassuring email to the Next of Kin based on recent notes.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Globe className="w-4 h-4 text-violet-500 absolute left-2 top-1/2 -translate-y-1/2" />
                      <select className="pl-8 pr-2 py-2 text-xs border border-violet-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-violet-500 text-violet-900">
                        <option>English</option><option>Spanish</option><option>Polish</option>
                      </select>
                    </div>
                    <button className="bg-violet-600 hover:bg-violet-700 text-white px-3 py-2 rounded-lg font-medium flex items-center shadow-sm transition-colors text-sm">
                      <Sparkles className="w-4 h-4 mr-2" /> ✨ Draft
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
                Alerts & Risks <AlertCircle className="w-5 h-5 text-amber-500" />
              </h3>
              <ul className="space-y-3">
                <li className="text-sm bg-rose-50 text-rose-800 border-rose-100 p-3 rounded-lg border">
                  <span className="font-semibold block mb-1">High Fall Risk</span>Requires assistance with mobility.
                </li>
                {resident.known_allergies ? (
                  <li className="text-sm bg-rose-50 text-rose-800 border-rose-100 p-3 rounded-lg border">
                    <span className="font-semibold block mb-1">Allergies (transfer profile)</span>
                    {resident.known_allergies}
                  </li>
                ) : (
                  <li className="text-sm bg-slate-50 text-slate-600 border-slate-100 p-3 rounded-lg border">
                    <span className="font-semibold block mb-1">Allergies</span>
                    No allergies recorded in the emergency transfer profile yet.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: CARE PLAN --- */}
      {activeTab === 'Care plan' && (
        <CarePlanTab
          residentId={resident.id}
          isReadOnly={isReadOnly}
          onTaskCreated={() => setActiveTab('Tasks')}
        />
      )}

      {/* --- TAB: ASSESSMENTS --- */}
      {activeTab === 'Assessments' && (
        <AssessmentsTab residentId={resident.id} isReadOnly={isReadOnly} />
      )}

      {/* --- TAB: TASKS --- */}
      {activeTab === 'Tasks' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {!isReadOnly && (
              <div className="p-4 border-b border-gray-200 bg-slate-50 flex flex-col gap-3">
                <div className="flex flex-col lg:flex-row gap-3">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="E.g. Prepare for hospital discharge..."
                  />
                  <input
                    type="date"
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                    className="w-full lg:w-44 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    title="Due date"
                  />
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="w-full lg:w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    title="Priority"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      const title = newTaskTitle.trim();
                      if (!title) return;
                      try {
                        await api.post(`/api/v1/residents/${resident.id}/tasks`, {
                          title,
                          priority: newTaskPriority,
                          ...(newTaskDue ? { dueDate: newTaskDue } : {}),
                        });
                        setNewTaskTitle('');
                        setNewTaskDue('');
                        setNewTaskPriority('NORMAL');
                        await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
                      } catch (e) {
                        console.error(e);
                        const msg =
                          typeof e === 'object' &&
                          e !== null &&
                          'response' in e &&
                          typeof (e as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
                            ? (e as { response: { data: { error: string } } }).response.data.error
                            : 'Could not add task. Please try again.';
                        alert(msg);
                      }
                    }}
                    disabled={!newTaskTitle.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Task
                  </button>
                  <button
                    onClick={() => {
                      setIsGeneratingTasks(true);
                      setTimeout(() => setIsGeneratingTasks(false), 1500);
                    }}
                    disabled={isGeneratingTasks || !newTaskTitle.trim()}
                    className="bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center"
                  >
                    {isGeneratingTasks ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}{' '}
                    ✨ AI Breakdown
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 border-b border-gray-100 bg-white px-4 py-3">
              {(
                [
                  { id: 'all' as const, label: 'All' },
                  { id: 'overdue' as const, label: 'Overdue' },
                  { id: 'dueToday' as const, label: 'Due today' },
                  { id: 'highPriority' as const, label: 'High priority' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setTaskListFilter(chip.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    taskListFilter === chip.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div className="divide-y divide-gray-100">
              {(resident.tasks || []).length === 0 ? (
                <div className="p-8 text-center text-gray-500">No tasks yet.</div>
              ) : filteredTasks.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No tasks match this filter.</div>
              ) : (
                filteredTasks.map((task: any) => {
                  const overdue = isTaskOverdue(task);
                  const dueToday = isTaskDueToday(task);
                  const high = taskPriorityIsHighClient(task.priority);
                  const isEditing = editingTaskId === task.id;
                  return (
                    <div key={task.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start hover:bg-slate-50 transition-colors">
                      <div className="flex items-start gap-3 w-full">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const nextStatus = task.status === 'Completed' ? 'Open' : 'Completed';
                              await api.patch(`/api/v1/residents/${resident.id}/tasks/${task.id}`, {
                                status: nextStatus,
                              });
                              await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
                            } catch (e) {
                              console.error(e);
                              alert('Could not update task. Please try again.');
                            }
                          }}
                          className={`mt-0.5 w-6 h-6 rounded border flex items-center justify-center shrink-0 ${
                            task.status === 'Completed'
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-gray-300 bg-white'
                          }`}
                          title={task.status === 'Completed' ? 'Mark as open' : 'Mark as completed'}
                        >
                          {task.status === 'Completed' && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p
                              className={`text-sm font-medium ${
                                task.status === 'Completed' ? 'text-gray-400 line-through' : 'text-gray-900'
                              }`}
                            >
                              {task.title}
                            </p>
                            {overdue ? (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-rose-700 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">
                                Overdue
                              </span>
                            ) : null}
                            {dueToday && !overdue ? (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                                Due today
                              </span>
                            ) : null}
                            {high ? (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-800 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">
                                High priority
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Due: {task.dueDate || '—'} • Priority:{' '}
                            <span className={high ? 'text-rose-600 font-semibold' : ''}>{task.priority}</span>
                            {task.assignedToName ? (
                              <>
                                {' '}
                                • Assigned: <span className="font-medium text-gray-700">{task.assignedToName}</span>
                              </>
                            ) : null}
                          </p>
                          {isEditing ? (
                            <div className="mt-3 flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-end">
                              <input
                                type="date"
                                value={editDue}
                                onChange={(e) => setEditDue(e.target.value)}
                                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                              />
                              <select
                                value={editPriority}
                                onChange={(e) => setEditPriority(e.target.value)}
                                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
                              >
                                <option value="LOW">Low</option>
                                <option value="NORMAL">Normal</option>
                                <option value="HIGH">High</option>
                                <option value="CRITICAL">Critical</option>
                              </select>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={savingTaskId === task.id}
                                  onClick={async () => {
                                    setSavingTaskId(task.id);
                                    try {
                                      await api.patch(`/api/v1/residents/${resident.id}/tasks/${task.id}`, {
                                        dueDate: editDue || null,
                                        priority: editPriority,
                                      });
                                      setEditingTaskId(null);
                                      await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
                                    } catch (e) {
                                      console.error(e);
                                      alert('Could not save task changes.');
                                    } finally {
                                      setSavingTaskId(null);
                                    }
                                  }}
                                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                                >
                                  {savingTaskId === task.id ? 'Saving…' : 'Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingTaskId(null)}
                                  className="border border-gray-300 bg-white px-3 py-1.5 rounded-lg text-xs font-medium"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : !isReadOnly ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTaskId(task.id);
                                  setEditDue(task.dueDateIso || '');
                                  setEditPriority(taskPriorityToSelectKey(task.priority));
                                }}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                              >
                                Edit due / priority
                              </button>
                              {canAssignTasks && user?.id ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={assigningTaskId === task.id}
                                    onClick={async () => {
                                      setAssigningTaskId(task.id);
                                      try {
                                        await api.patch(`/api/v1/residents/${resident.id}/tasks/${task.id}`, {
                                          assigned_to: user.id,
                                        });
                                        await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
                                      } catch (e) {
                                        console.error(e);
                                        const msg =
                                          typeof e === 'object' &&
                                          e !== null &&
                                          'response' in e &&
                                          typeof (e as { response?: { data?: { error?: string } } }).response?.data
                                            ?.error === 'string'
                                            ? (e as { response: { data: { error: string } } }).response.data.error
                                            : 'Could not assign task.';
                                        alert(msg);
                                      } finally {
                                        setAssigningTaskId(null);
                                      }
                                    }}
                                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 disabled:opacity-50"
                                  >
                                    {assigningTaskId === task.id ? 'Assigning…' : 'Assign to me'}
                                  </button>
                                  {task.assignedToId ? (
                                    <button
                                      type="button"
                                      disabled={assigningTaskId === task.id}
                                      onClick={async () => {
                                        setAssigningTaskId(task.id);
                                        try {
                                          await api.patch(`/api/v1/residents/${resident.id}/tasks/${task.id}`, {
                                            assigned_to: null,
                                          });
                                          await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
                                        } catch (e) {
                                          console.error(e);
                                          alert('Could not clear assignee.');
                                        } finally {
                                          setAssigningTaskId(null);
                                        }
                                      }}
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-800 disabled:opacity-50"
                                    >
                                      Clear assignee
                                    </button>
                                  ) : null}
                                </>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: FOOD & DRINK --- */}
      {activeTab === 'Food & Drink' && (
        <FoodAndDrinkTab residentId={resident.id} isReadOnly={isReadOnly} />
      )}

      {/* --- TAB: ACTIVITIES --- */}
      {activeTab === 'Activities' && (
        <ActivitiesTab residentId={resident.id} isReadOnly={isReadOnly} />
      )}

      {/* --- TAB: DAILY CARE --- */}
      {activeTab === 'Daily care' && (
        <DailyCareTab residentId={resident.id} isReadOnly={isReadOnly} />
      )}

      {activeTab === 'Topical' && (
        <TopicalApplicationsTab
          residentId={resident.id}
          isReadOnly={isReadOnly}
          medications={resident.medications ?? []}
        />
      )}

      {/* --- TAB: PEEP --- */}
      {activeTab === 'PEEP' && (
        <PeepTab residentId={resident.id} isReadOnly={isReadOnly} />
      )}

      {/* --- TAB: NOTES & INCIDENTS --- */}
      {activeTab === 'Notes & Incidents' && (
        <div className="space-y-6 animate-in fade-in">
          {!isReadOnly && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Shift Handover Panel */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100 flex flex-col h-full">
                <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2 mb-1"><Sparkles className="w-5 h-5 text-blue-600" /> AI Shift Handover</h3>
                <p className="text-sm text-blue-700 mb-4">Synthesize today's notes into a concise handover summary.</p>
                <button onClick={handleSummarizeNotes} disabled={isSummarizing} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center shadow-sm w-max text-sm disabled:opacity-50">
                  {isSummarizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />} ✨ Generate
                </button>
                {handoverSummary && (
                  <div className="mt-4 bg-white rounded-lg p-4 shadow-sm border border-blue-200 flex flex-col flex-1 animate-in fade-in">
                    <div className="text-sm text-gray-800 whitespace-pre-wrap flex-1">{handoverSummary}</div>
                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-blue-50">
                      <button onClick={() => setHandoverSummary('')} className="text-sm text-gray-600 font-medium">Discard</button>
                      <button
                        type="button"
                        onClick={() =>
                          void saveDailyNote(handoverSummary, () => setHandoverSummary(''), {
                            prefix: '[AI Handover Summary]',
                          })
                        }
                        disabled={noteSaving || !handoverSummary.trim()}
                        className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Incident Drafter Panel */}
              <div className="bg-gradient-to-r from-rose-50 to-orange-50 rounded-xl p-6 border border-rose-100 flex flex-col h-full">
                <h3 className="text-lg font-semibold text-rose-900 flex items-center gap-2 mb-1"><AlertTriangle className="w-5 h-5 text-rose-600" /> Incident Report Drafter</h3>
                <p className="text-sm text-rose-700 mb-4">Auto-draft clinical incident reports from recent observations.</p>
                <button onClick={handleDraftIncidentReport} disabled={isDraftingIncident} className="bg-rose-600 text-white px-4 py-2 rounded-lg font-medium flex items-center shadow-sm w-max text-sm disabled:opacity-50">
                  {isDraftingIncident ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />} ✨ Draft Incident Report
                </button>
                {incidentDraft && (
                  <div className="mt-4 bg-white rounded-lg p-4 shadow-sm border border-rose-200 flex flex-col flex-1 animate-in fade-in">
                    <div className="text-sm text-gray-800 whitespace-pre-wrap flex-1">{incidentDraft}</div>
                    <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-rose-50">
                      <button onClick={() => setIncidentDraft('')} className="text-sm text-gray-600 font-medium">Dismiss</button>
                      <button
                        type="button"
                        onClick={() =>
                          void saveDailyNote(incidentDraft, () => setIncidentDraft(''), {
                            prefix: '[AI Incident Draft]',
                          })
                        }
                        disabled={noteSaving || !incidentDraft.trim()}
                        className="text-sm bg-rose-600 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                      >
                        Save to Record
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual Entry & Historical Notes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Historical Notes</h3>
            {!isReadOnly && (
              <>
              <div className="mb-3 flex items-center gap-2 text-xs text-gray-600">
                <input
                  id="share-note-family"
                  type="checkbox"
                  checked={draftNoteShareWithFamily}
                  onChange={(e) => setDraftNoteShareWithFamily(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="share-note-family" className="cursor-pointer select-none">
                  Also show this note on the family portal (non-clinical updates only)
                </label>
              </div>
            <div className="flex gap-2 mb-6 p-4 bg-slate-50 rounded-lg border border-gray-100">
                <textarea 
                  value={draftNote} onChange={e => setDraftNote(e.target.value)} 
                  placeholder="Type or dictate care note..." 
                  className="flex-1 border border-gray-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 h-16 resize-none" 
                />
                <div className="flex flex-col gap-2">
                  <button className="text-blue-600 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg font-medium text-sm flex items-center justify-center transition-colors">
                    <Mic className="w-4 h-4 mr-1"/> Dictate
                  </button>
                  <button 
                    onClick={() =>
                      void saveDailyNote(draftNote, () => {
                        setDraftNote('');
                        setDraftNoteShareWithFamily(false);
                      }, { shareWithFamily: draftNoteShareWithFamily })
                    } 
                    disabled={!draftNote.trim() || noteSaving} 
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg font-medium text-xs flex-1 transition-colors"
                  >
                    {noteSaving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Save'}
                  </button>
                </div>
            </div>
              </>
            )}
            <div className="space-y-4">
              {(resident.dailyNotes || []).length === 0 ? (
                <p className="text-sm text-gray-500 italic">No historical notes recorded.</p>
              ) : (resident.dailyNotes || []).map((note: any) => (
                <div key={note.id || note.time} className="p-4 bg-slate-50 rounded-lg border border-gray-100">
                  <div className="flex justify-between items-start mb-2 gap-2">
                    <span className="font-semibold text-sm text-gray-900">{note.author}</span>
                    <span className="text-xs text-gray-500 shrink-0">{note.time}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.text}</p>
                  {!isReadOnly && note.id ? (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        disabled={noteShareBusyId === note.id}
                        onClick={async () => {
                          setNoteShareBusyId(note.id);
                          try {
                            await api.patch(`/api/v1/residents/${resident.id}/daily-notes/${note.id}`, {
                              shareWithFamily: !note.shareWithFamily,
                            });
                            await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
                          } catch (e) {
                            console.error(e);
                            alert('Could not update family portal sharing.');
                          } finally {
                            setNoteShareBusyId(null);
                          }
                        }}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          note.shareWithFamily
                            ? 'border-teal-300 bg-teal-50 text-teal-800'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-teal-200'
                        } disabled:opacity-50`}
                      >
                        {noteShareBusyId === note.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                        ) : (
                          <Heart className="h-3 w-3" aria-hidden />
                        )}
                        {note.shareWithFamily ? 'On family portal' : 'Family portal'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: OBSERVATIONS --- */}
      {activeTab === 'Observations' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Clinical Observations</h3>
              <p className="text-sm text-gray-500">Record vitals and review recent trends.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowObsTrends((v) => !v)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors flex items-center shadow-sm ${
                  showObsTrends
                    ? 'border-cyan-300 bg-cyan-100 text-cyan-900'
                    : 'border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100'
                }`}
              >
                <Activity className="mr-2 h-4 w-4" aria-hidden />
                {showObsTrends ? 'Hide trends' : 'View trends'}
              </button>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setIsAddingObservation(!isAddingObservation)}
                  className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  <Plus className="mr-2 h-4 w-4" /> Record vitals
                </button>
              )}
            </div>
          </div>

          {(observationsQueryIsError || observationsSummaryIsError) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-medium">Observations feed could not be refreshed</p>
              <p className="mt-1 text-xs text-amber-900/90">
                The table below may show data from the main record only. If this persists, confirm the observations
                migration is applied on the API database.
              </p>
            </div>
          )}

          {Array.isArray(observationsSummaryData?.latestByType) && observationsSummaryData.latestByType.length > 0 ? (
            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <span className="w-full text-xs font-semibold uppercase tracking-wide text-slate-500">Latest by type</span>
              {observationsSummaryData.latestByType.slice(0, 8).map((o: any) => (
                <span
                  key={String(o.type)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-800"
                >
                  <span className="font-semibold">{o.typeLabel || o.type}</span>
                  <span className="text-slate-500">
                    {o.value}
                    {o.unit ? ` ${o.unit}` : ''}
                  </span>
                </span>
              ))}
            </div>
          ) : null}

          {showObsTrends && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Trend (numeric)</h4>
                  <p className="text-xs text-gray-500">Uses readings in the selected window. Blood pressure uses systolic (first number).</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={obsTrendType}
                    onChange={(e) => setObsTrendType(e.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="BP">Blood pressure</option>
                    <option value="PULSE">Heart rate</option>
                    <option value="TEMP">Temperature</option>
                    <option value="WEIGHT">Weight</option>
                    <option value="SPO2">SpO₂</option>
                    <option value="RESP_RATE">Respiratory rate</option>
                    <option value="PAIN">Pain</option>
                  </select>
                  <div className="flex rounded-lg border border-gray-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => setObsTrendRange('7d')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                        obsTrendRange === '7d' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      7 days
                    </button>
                    <button
                      type="button"
                      onClick={() => setObsTrendRange('30d')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                        obsTrendRange === '30d' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      30 days
                    </button>
                  </div>
                </div>
              </div>
              {observationsQueryLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading chart data…
                </div>
              ) : (
                <ObservationTrendChart
                  title={
                    {
                      BP: 'Blood pressure (systolic)',
                      PULSE: 'Heart rate',
                      TEMP: 'Temperature',
                      WEIGHT: 'Weight',
                      SPO2: 'SpO₂',
                      RESP_RATE: 'Respiratory rate',
                      PAIN: 'Pain',
                    }[obsTrendType] || obsTrendType
                  }
                  points={trendPoints}
                />
              )}
            </div>
          )}

          {isAddingObservation && !isReadOnly && (
            <div className="grid animate-in fade-in slide-in-from-top-4 grid-cols-1 gap-4 rounded-xl border border-blue-100 bg-blue-50 p-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-blue-900">Observation type</label>
                <select
                  value={observationForm.type}
                  onChange={(e) => {
                    const type = e.target.value;
                    let unit = 'mmHg';
                    if (type === 'Temperature') unit = '°C';
                    if (type === 'Heart Rate') unit = 'bpm';
                    if (type === 'Weight') unit = 'kg';
                    if (type === 'SpO2') unit = '%';
                    if (type === 'Respiratory rate') unit = '/min';
                    if (type === 'Pain') unit = '/10';
                    setObservationForm({ ...observationForm, type, unit });
                  }}
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>Blood Pressure</option>
                  <option>Heart Rate</option>
                  <option>Temperature</option>
                  <option>Weight</option>
                  <option value="SpO2">SpO₂</option>
                  <option>Respiratory rate</option>
                  <option>Pain</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-blue-900">Value</label>
                <input
                  type="text"
                  value={observationForm.value}
                  onChange={(e) => setObservationForm({ ...observationForm, value: e.target.value })}
                  className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="E.g. 120/80, 98.6, 72"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-blue-900">Unit</label>
                <input
                  type="text"
                  disabled
                  value={observationForm.unit}
                  className="w-full rounded-lg border border-blue-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-blue-900">Notes (optional)</label>
                <textarea
                  value={observationForm.notes}
                  onChange={(e) => setObservationForm({ ...observationForm, notes: e.target.value })}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-blue-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Context for this reading (optional)"
                />
              </div>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setIsAddingObservation(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveObservation()}
                  disabled={!observationForm.value.trim()}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:flex-none"
                >
                  Save to record
                </button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="p-4">Date & time</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Value</th>
                  <th className="p-4">Notes</th>
                  <th className="p-4">Recorded by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {observationsQueryLoading && displayObservations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-600" aria-hidden />
                      Loading observations…
                    </td>
                  </tr>
                ) : displayObservations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      No observations recorded.
                    </td>
                  </tr>
                ) : (
                  displayObservations.map((obs: any) => (
                    <tr key={obs.id || `${obs.date}-${obs.time}-${obs.type}`} className="hover:bg-slate-50">
                      <td className="p-4 text-gray-600">
                        {obs.date} {obs.time}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center font-medium text-gray-900">
                          <Activity className="mr-2 h-4 w-4 shrink-0 text-blue-500" aria-hidden />
                          {obs.typeLabel || obs.type}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-base font-bold text-gray-900">{obs.value}</span>
                        {obs.unit ? <span className="ml-1 text-xs text-gray-500">{obs.unit}</span> : null}
                      </td>
                      <td className="max-w-xs p-4 text-xs text-gray-600">
                        {obs.notes ? <span className="line-clamp-3 whitespace-pre-wrap">{obs.notes}</span> : '—'}
                      </td>
                      <td className="p-4 text-gray-600">{obs.author}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB: EMAR --- */}
      {activeTab === 'eMAR' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Electronic MAR</h3>
              <p className="text-sm text-gray-500">Manage daily medications and stock levels.</p>
            </div>
            <div className="flex gap-2">
              {!isReadOnly && (
                <>
                  <button onClick={handleCheckMedSafety} disabled={isCheckingMeds || !resident.medications?.length} className="bg-white text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center shadow-sm hover:bg-indigo-50 transition-colors">
                    {isCheckingMeds ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />} ✨ Run Safety Check
                  </button>
                  <button onClick={() => setIsAddingMed(!isAddingMed)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm">
                    <Plus className="w-4 h-4 mr-2" /> Add Prescribed Med
                  </button>
                </>
              )}
            </div>
          </div>

          {medSafetyReport && (
            <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100 shadow-sm animate-in fade-in">
              <h4 className="font-semibold text-indigo-900 flex items-center mb-3"><ShieldAlert className="w-5 h-5 mr-2" /> AI Medication Safety Briefing</h4>
              <div className="text-sm text-gray-800 whitespace-pre-wrap">{medSafetyReport}</div>
              <div className="mt-3 flex justify-end"><button onClick={() => setMedSafetyReport('')} className="text-sm text-indigo-700 font-medium">Close Briefing</button></div>
            </div>
          )}

          {/* NHS Integration Box */}
          {!isReadOnly && (
            <div className="bg-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2"><GitMerge className="w-5 h-5 text-indigo-400" /> NHS Medication Reconciliation</h3>
                <button className="bg-indigo-600/30 border border-indigo-400/50 hover:bg-indigo-600/50 px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center">
                  <Hospital className="w-4 h-4 mr-2 text-indigo-300" /> Fetch from NHS Spine
                </button>
              </div>
              <p className="text-sm text-slate-400 mb-3">Sync recent prescriptions directly from the GP Connect service.</p>
            </div>
          )}

          {isAddingMed && !isReadOnly && (
            <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100 grid grid-cols-1 md:grid-cols-6 gap-4 items-end animate-in fade-in slide-in-from-top-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-emerald-900 mb-1">Medication Name</label>
                <input type="text" value={newMed.name} onChange={e => setNewMed({...newMed, name: e.target.value})} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm" placeholder="e.g. Amoxicillin" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-emerald-900 mb-1">Dose</label>
                <input type="text" value={newMed.dose} onChange={e => setNewMed({...newMed, dose: e.target.value})} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm" placeholder="e.g. 500mg" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-emerald-900 mb-1">Frequency</label>
                <select value={newMed.frequency} onChange={e => setNewMed({...newMed, frequency: e.target.value})} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm bg-white">
                  <option value="OD">OD</option><option value="BD">BD</option><option value="PRN">PRN</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-emerald-900 mb-1">Init Stock</label>
                <input type="number" value={newMed.stockCount} onChange={e => setNewMed({...newMed, stockCount: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm" />
              </div>
              <div className="flex gap-2 md:col-span-6 justify-end border-t border-emerald-200/50 pt-4 mt-2">
                <button onClick={() => setIsAddingMed(false)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium">Cancel</button>
                <button onClick={() => handleGenericSubmit('Medication', () => setIsAddingMed(false))} className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-medium">Save Prescription</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-slate-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                   <th className="p-4 font-medium">Medication & Dose</th><th className="p-4 font-medium">Freq</th><th className="p-4 font-medium">Stock</th>{!isReadOnly && <th className="p-4 font-medium text-right">Action</th>}
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 text-sm">
                 {(resident.medications || []).length === 0 ? (
                   <tr><td colSpan={isReadOnly ? 3 : 4} className="p-8 text-center text-gray-500">No medications prescribed.</td></tr>
                 ) : (resident.medications || []).map((med: any) => (
                   <tr key={med.id} className="hover:bg-slate-50">
                     <td className="p-4">
                       <div className="font-semibold text-gray-900 text-base">{med.name}</div>
                       <div className="text-gray-500 font-medium">{med.dose}</div>
                     </td>
                     <td className="p-4"><Badge variant={med.frequency === 'PRN' ? 'warning' : 'default'}>{med.frequency}</Badge></td>
                     <td className="p-4 text-gray-600"><span className={`font-bold text-lg ${med.stockCount < 7 && !isReadOnly ? 'text-rose-600' : 'text-gray-800'}`}>{med.stockCount}</span></td>
                     {!isReadOnly && (
                       <td className="p-4 text-right">
                         <div className="flex justify-end gap-2">
                           <button className="px-3 py-1.5 border border-rose-200 text-rose-700 bg-rose-50 rounded-lg text-sm font-medium">Omit</button>
                           <button disabled={med.stockCount <= 0} className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg font-bold text-xs disabled:opacity-50 flex items-center"><QrCode className="w-3.5 h-3.5 mr-1" /> Scan</button>
                           <button disabled={med.stockCount <= 0} className="px-3 py-1.5 border border-emerald-200 text-emerald-800 bg-emerald-100 rounded-lg text-sm font-bold disabled:opacity-50 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1.5"/> Give</button>
                         </div>
                       </td>
                     )}
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider flex items-center"><Clock className="w-4 h-4 mr-2 text-gray-500"/> Administration Audit</h4>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-sm text-gray-500 italic text-center">Audit logs will appear here.</div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider flex items-center"><Package className="w-4 h-4 mr-2 text-gray-500"/> Stock Audit</h4>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-sm text-gray-500 italic text-center">Stock logs will appear here.</div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: DOCUMENTS --- */}
      {activeTab === 'Documents' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Resident Documents</h3>
              <p className="text-sm text-gray-500">Securely store and manage files linked to this resident.</p>
            </div>
            {!isReadOnly && canUploadDocuments && (
              <button onClick={() => setIsUploadingDoc(!isUploadingDoc)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm transition-colors">
                <FileUp className="w-4 h-4 mr-2" /> Upload Document
              </button>
            )}
          </div>

          {isUploadingDoc && !isReadOnly && canUploadDocuments && (
            <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-semibold text-indigo-900 mb-1">File</label>
                  <input
                    type="file"
                    onChange={onDocumentFileSelected}
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    accept="application/pdf,image/*,text/plain,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  />
                  {documentFile ? (
                    <div className="mt-2 text-xs text-indigo-900">
                      Selected: <span className="font-semibold">{documentFile.name}</span> ({Math.round(documentFile.size / 1024)} KB)
                    </div>
                  ) : null}
                </div>
                <div className="w-full sm:w-56">
                  <label className="block text-xs font-semibold text-indigo-900 mb-1">Type</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="General">General</option>
                    <option value="Hospital">Hospital</option>
                    <option value="GP">GP</option>
                    <option value="DNACPR">DNACPR</option>
                    <option value="Risk assessment">Risk assessment</option>
                    <option value="Consent">Consent</option>
                    <option value="Safeguarding">Safeguarding</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => setIsUploadingDoc(false)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 flex-1 sm:flex-none transition-colors">Cancel</button>
                  <button onClick={handleUploadDocument} disabled={documentUploading || !documentFile} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center flex-1 sm:flex-none transition-colors">
                    {documentUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />} Upload
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-slate-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                     <th className="p-4 font-medium">File Details</th>
                     <th className="p-4 font-medium">Upload Date</th>
                     <th className="p-4 font-medium text-right">Action</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100 text-sm">
                   {residentDocumentsLoading ? (
                     <tr><td colSpan={3} className="p-8 text-center text-gray-500">Loading documents…</td></tr>
                   ) : residentDocumentsIsError ? (
                     <tr><td colSpan={3} className="p-8 text-center text-rose-600">Could not load documents.</td></tr>
                   ) : documents.length === 0 ? (
                     <tr><td colSpan={3} className="p-8 text-center text-gray-500">No documents uploaded yet.</td></tr>
                   ) : documents.map((doc: any) => (
                     <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                       <td className="p-4">
                         <div className="font-medium text-gray-900 flex items-center">
                           <File className={`w-4 h-4 mr-2 ${isReadOnly ? 'text-gray-400' : 'text-indigo-500'}`} />
                           {doc.file_name || 'Document'}
                         </div>
                         <div className="mt-1 text-xs text-gray-500">
                           {doc.doc_type ? `${doc.doc_type} • ` : ''}
                           {doc.mime_type || '—'}
                           {doc.size_bytes != null ? ` • ${Math.round(Number(doc.size_bytes) / 1024)} KB` : ''}
                         </div>
                       </td>
                       <td className="p-4 text-gray-600 align-top pt-5">
                         {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : '—'}
                       </td>
                       <td className="p-4 text-right align-top pt-5">
                         <div className="flex justify-end gap-2">
                           <button
                             onClick={() => handleDownloadDocument(doc.id)}
                             disabled={documentDownloadingId === doc.id}
                             className="text-indigo-600 hover:text-indigo-800 font-medium text-sm disabled:opacity-50"
                           >
                             {documentDownloadingId === doc.id ? 'Opening…' : 'Download'}
                           </button>
                           {!isReadOnly && canDeleteDocuments ? (
                             <button
                               onClick={() => handleDeleteDocument(doc.id)}
                               disabled={documentDeletingId === doc.id}
                               className="text-rose-600 hover:text-rose-800 font-medium text-sm disabled:opacity-50"
                             >
                               {documentDeletingId === doc.id ? 'Deleting…' : 'Delete'}
                             </button>
                           ) : null}
                         </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}

      {/* Profile photo upload (camera / gallery, managers) */}
      {familyInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-200 bg-teal-50 p-5">
              <h3 className="text-lg font-bold text-teal-950">Invite family contact</h3>
              <button
                type="button"
                onClick={() => !familyInviteSubmitting && setFamilyInviteOpen(false)}
                className="text-gray-400 transition-colors hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              className="space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                void (async () => {
                  if (!resident?.id || !familyInvite.email.trim()) return;
                  setFamilyInviteSubmitting(true);
                  try {
                    const { data } = await api.post<{
                      message?: string;
                      linkedExisting?: boolean;
                    }>(`/api/v1/residents/${resident.id}/family-invite`, {
                      email: familyInvite.email.trim(),
                      firstName: familyInvite.firstName.trim(),
                      lastName: familyInvite.lastName.trim(),
                      relationship: familyInvite.relationship.trim(),
                    });
                    alert(
                      data?.message ||
                        (data?.linkedExisting
                          ? 'They already had a family login; access to this resident was added.'
                          : 'Invitation sent.')
                    );
                    setFamilyInviteOpen(false);
                    setFamilyInvite({ email: '', firstName: '', lastName: '', relationship: '' });
                  } catch (err: unknown) {
                    console.error(err);
                    const msg =
                      typeof err === 'object' &&
                      err !== null &&
                      'response' in err &&
                      typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error ===
                        'string'
                        ? (err as { response: { data: { error: string } } }).response.data.error
                        : 'Could not send invite. Check the email and your permissions.';
                    alert(msg);
                  } finally {
                    setFamilyInviteSubmitting(false);
                  }
                })();
              }}
            >
              <p className="text-xs text-gray-600">
                For <span className="font-medium text-gray-800">{resident.first_name} {resident.last_name}</span>.
                They receive an email from your identity provider to set a password.
              </p>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Email</label>
                <input
                  type="email"
                  required
                  value={familyInvite.email}
                  onChange={(e) => setFamilyInvite({ ...familyInvite, email: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">First name</label>
                  <input
                    type="text"
                    value={familyInvite.firstName}
                    onChange={(e) => setFamilyInvite({ ...familyInvite, firstName: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Last name</label>
                  <input
                    type="text"
                    value={familyInvite.lastName}
                    onChange={(e) => setFamilyInvite({ ...familyInvite, lastName: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">Relationship (optional)</label>
                <input
                  type="text"
                  value={familyInvite.relationship}
                  onChange={(e) => setFamilyInvite({ ...familyInvite, relationship: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g. Daughter"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
                <button
                  type="button"
                  disabled={familyInviteSubmitting}
                  onClick={() => setFamilyInviteOpen(false)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={familyInviteSubmitting}
                  className="inline-flex items-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {familyInviteSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Send invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isProfilePhotoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <input
            ref={profilePhotoCameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            capture="environment"
            className="hidden"
            onChange={onProfilePhotoFileSelected}
          />
          <input
            ref={profilePhotoGalleryInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            className="hidden"
            onChange={onProfilePhotoFileSelected}
          />
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-200 bg-slate-50 p-5">
              <h3 className="text-lg font-bold text-gray-900">Profile photo</h3>
              <button
                type="button"
                onClick={closeProfilePhotoModal}
                className="text-gray-400 transition-colors hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-gray-600">
                Take a photo with the device camera or pick an image from this device. The photo appears on this chart
                and in the service user list (JPEG, PNG, or WebP, up to 5MB).
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => profilePhotoCameraInputRef.current?.click()}
                  className="inline-flex flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Camera className="h-4 w-4 shrink-0" />
                  Take photo
                </button>
                <button
                  type="button"
                  onClick={() => profilePhotoGalleryInputRef.current?.click()}
                  className="inline-flex flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  <FileUp className="h-4 w-4 shrink-0" />
                  From gallery
                </button>
              </div>
              {(profilePhotoPreviewUrl || resident.profile_image_url) && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-gray-500">
                    {profilePhotoPreviewUrl ? 'New photo preview' : 'Current photo'}
                  </p>
                  <div className="flex justify-center rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <img
                      src={profilePhotoPreviewUrl || resident.profile_image_url || ''}
                      alt="Profile preview"
                      className="max-h-40 max-w-full rounded-lg object-contain shadow-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 bg-slate-50 p-4">
              {resident.profile_image_url ? (
                <button
                  type="button"
                  onClick={handleRemoveProfilePhoto}
                  disabled={profilePhotoSaving}
                  className="mr-auto rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  Remove photo
                </button>
              ) : null}
              <button
                type="button"
                onClick={revokeProfilePhotoPreview}
                disabled={!profilePhotoFile || profilePhotoSaving}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Clear selection
              </button>
              <button
                type="button"
                onClick={closeProfilePhotoModal}
                disabled={profilePhotoSaving}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfilePhoto}
                disabled={profilePhotoSaving || !profilePhotoFile}
                className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {profilePhotoSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer & Discharge Modals retained exactly as before... */}
      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-gray-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">
                {bedModalAction === 'admit' ? 'Admit to bed' : 'Transfer service user'}
              </h3>
              <button type="button" onClick={closeBedModal} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">
                {bedModalAction === 'admit' ? (
                  <>
                    Assign <strong>{resident.first_name} {resident.last_name}</strong> to an available bed. Their status will be set to admitted.
                  </>
                ) : (
                  <>
                    Move <strong>{resident.first_name} {resident.last_name}</strong>{' '}
                    {resident.room_number ? 'from their current bed to a new available bed.' : 'to an available bed.'}
                  </>
                )}
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Select bed</label>
                <select value={transferBedId} onChange={e => setTransferBedId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Choose available bed --</option>
                  {availableBeds.map((b: any) => {
                    const unit = units.find((u: any) => u.id === b.unit_id);
                    return <option key={b.id} value={b.id}>{unit?.name || 'Unknown Unit'} - Room {b.room_number}</option>;
                  })}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-slate-50">
              <button type="button" onClick={closeBedModal} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              <button type="button" onClick={handleConfirmBedModal} disabled={!transferBedId || isSubmitting} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center">
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {bedModalAction === 'admit' ? 'Confirm admission' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discharge Modal */}
      {isDischargeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-gray-200 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">Discharge Resident</h3>
              <button onClick={() => setIsDischargeModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-600">This will discharge <strong>{resident.first_name} {resident.last_name}</strong> and free up their current bed.</p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reason</label>
                <select value={dischargeForm.reason} onChange={e => setDischargeForm({...dischargeForm, reason: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Select Reason --</option><option>Return Home</option><option>Transfer to Hospital</option><option>Transfer to other facility</option><option>Deceased</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Destination</label>
                <input type="text" value={dischargeForm.destination} onChange={e => setDischargeForm({...dischargeForm, destination: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. City General Hospital" />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-slate-50">
              <button onClick={() => setIsDischargeModalOpen(false)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleDischarge} disabled={!dischargeForm.reason || isSubmitting} className="bg-rose-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center">
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirm Discharge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 

