"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResident } from '@/hooks/useResident';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { 
  ArrowLeft, MapPin, UserCircle, Loader2, X, FileUp, File, Sparkles, 
  FileText, Mail, Globe, AlertCircle, Plus, CheckCircle2, AlertTriangle, 
  Mic, Activity, TrendingUp, ShieldAlert, GitMerge, Hospital, QrCode, Clock, Package, Camera
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { useGlobalStore } from '@/store/useGlobalStore';

function todayIsoDate(): string {
  // Use local date; chart_date is stored as a DATE.
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

export default function ResidentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: resident, isLoading } = useResident(resolvedParams.id);
  const user = useGlobalStore((s) => s.user);
  const [activeTab, setActiveTab] = useState('Overview');

  const canEditProfilePhoto =
    Boolean(user?.role) &&
    ['Regional Manager', 'Home Manager', 'Admin'].includes(user.role as string);

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

  // --- Modal & Global States ---
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [bedModalAction, setBedModalAction] = useState<'transfer' | 'admit'>('transfer');
  const [transferBedId, setTransferBedId] = useState('');
  const [isDischargeModalOpen, setIsDischargeModalOpen] = useState(false);
  const [dischargeForm, setDischargeForm] = useState({ reason: '', destination: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Documents Tab State ---
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [documentForm, setDocumentForm] = useState({ fileName: '', text: '' });
  const [isSummarizingDoc, setIsSummarizingDoc] = useState(false);

  // --- Tasks Tab State ---
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);

  // --- Notes & Incidents Tab State ---
  const [draftNote, setDraftNote] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [handoverSummary, setHandoverSummary] = useState('');
  const [isDraftingIncident, setIsDraftingIncident] = useState(false);
  const [incidentDraft, setIncidentDraft] = useState('');

  // --- Observations Tab State ---
  const [isAddingObservation, setIsAddingObservation] = useState(false);
  const [observationForm, setObservationForm] = useState({ type: 'Blood Pressure', value: '', unit: 'mmHg' });
  
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

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center flex-col space-y-4 animate-in fade-in">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <p className="text-slate-500 font-medium">Loading clinical record...</p>
      </div>
    );
  }

  if (!resident) {
    return <div className="p-8 text-center text-rose-500">Resident not found.</div>;
  }

  const isReadOnly = resident.status === 'ARCHIVED';
  const tabs = ['Overview', 'Tasks', 'Food & Drink', 'Activities', 'Notes & Incidents', 'Observations', 'eMAR', 'Documents'];

  const availableBeds = layoutData?.beds?.filter((b: any) => b.status === 'AVAILABLE') || [];
  const units = layoutData?.units || [];

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
      router.push('/residents');
    } catch (error) {
      console.error(error);
      alert('Failed to discharge resident. Make sure the backend endpoint exists.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!documentForm.fileName) return;
    setIsSummarizingDoc(true);
    try {
      let aiSummary = '';
      if (documentForm.text) {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const response = await fetch(`${API_BASE_URL}/api/v1/ai/handover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: `[HOSPITAL DOCUMENT EXTRACT]: ${documentForm.text}\n\nPlease extract any key clinical risks or medication changes.` })
        });
        const data = await response.json();
        if (response.ok) aiSummary = data.summary;
      }
      void aiSummary;
      alert('Document uploaded & analyzed successfully! (Requires DB Endpoint)');
      setIsUploadingDoc(false);
      setDocumentForm({ fileName: '', text: '' });
    } catch (error) {
      console.error(error);
      alert('Failed to process and upload the document.');
    } finally {
      setIsSummarizingDoc(false);
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

  // --- General UI Submission Handlers (Mocked for UI purposes) ---
  const handleGenericSubmit = (type: string, resetFn: () => void) => {
    alert(`${type} feature submitted! Ensure a backend endpoint is added to persist to the database.`);
    resetFn();
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
                {new Date(resident.date_of_birth).toLocaleDateString('en-GB')}
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
                <li className="text-sm bg-amber-50 text-amber-800 border-amber-100 p-3 rounded-lg border">
                  <span className="font-semibold block mb-1">Allergy: Penicillin</span>Severe reaction noted on file.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: TASKS --- */}
      {activeTab === 'Tasks' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {!isReadOnly && (
              <div className="p-4 border-b border-gray-200 bg-slate-50 flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  value={newTaskTitle} 
                  onChange={e => setNewTaskTitle(e.target.value)} 
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="E.g. Prepare for hospital discharge..." 
                />
                <div className="flex gap-2">
                  <button 
                    onClick={async () => {
                      const title = newTaskTitle.trim();
                      if (!title) return;
                      try {
                        await api.post(`/api/v1/residents/${resident.id}/tasks`, { title });
                        setNewTaskTitle('');
                        await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
                      } catch (e) {
                        console.error(e);
                        alert('Could not add task. Please try again.');
                      }
                    }} 
                    disabled={!newTaskTitle.trim()} 
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Task
                  </button>
                  <button 
                    onClick={() => { setIsGeneratingTasks(true); setTimeout(() => setIsGeneratingTasks(false), 1500); }} 
                    disabled={isGeneratingTasks || !newTaskTitle.trim()} 
                    className="bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center"
                  >
                    {isGeneratingTasks ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />} ✨ AI Breakdown
                  </button>
                </div>
              </div>
            )}
            <div className="divide-y divide-gray-100">
              {(resident.tasks || []).length === 0 ? (
                <div className="p-8 text-center text-gray-500">No active tasks.</div>
              ) : (resident.tasks || []).map((task: any) => (
                <div key={task.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const nextStatus = task.status === 'Completed' ? 'Open' : 'Completed';
                        await api.patch(`/api/v1/residents/${resident.id}/tasks/${task.id}`, { status: nextStatus });
                        await queryClient.invalidateQueries({ queryKey: ['resident', resident.id] });
                      } catch (e) {
                        console.error(e);
                        alert('Could not update task. Please try again.');
                      }
                    }}
                    className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 ${task.status === 'Completed' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 bg-white'}`}
                    title={task.status === 'Completed' ? 'Mark as open' : 'Mark as completed'}
                  >
                    {task.status === 'Completed' && <CheckCircle2 className="w-4 h-4" />}
                  </button>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${task.status === 'Completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{task.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Due: {task.dueDate || '—'} •{' '}
                      <span className={task.priority === 'High' ? 'text-rose-600 font-semibold' : ''}>
                        {task.priority} Priority
                      </span>
                    </p>
                  </div>
                </div>
              ))}
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
                      <button onClick={() => handleGenericSubmit('Handover Note', () => setHandoverSummary(''))} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium">Save Note</button>
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
                      <button onClick={() => handleGenericSubmit('Incident Report', () => setIncidentDraft(''))} className="text-sm bg-rose-600 text-white px-4 py-2 rounded-lg font-medium">Save to Record</button>
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
                    onClick={() => handleGenericSubmit('Care Note', () => setDraftNote(''))} 
                    disabled={!draftNote.trim()} 
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1 rounded-lg font-medium text-xs flex-1 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-4">
              {(resident.dailyNotes || []).length === 0 ? (
                <p className="text-sm text-gray-500 italic">No historical notes recorded.</p>
              ) : (resident.dailyNotes || []).map((note: any, i: number) => (
                <div key={i} className="p-4 bg-slate-50 rounded-lg border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-sm text-gray-900">{note.author}</span>
                    <span className="text-xs text-gray-500">{note.time}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.text}</p>
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
            <h3 className="text-lg font-semibold text-gray-900">Clinical Observations</h3>
            <div className="flex gap-2">
              {!isReadOnly && (
                <>
                  <button className="bg-cyan-50 text-cyan-700 border border-cyan-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center shadow-sm">
                    <Sparkles className="w-4 h-4 mr-2" /> ✨ Analyze Trends
                  </button>
                  <button onClick={() => setIsAddingObservation(!isAddingObservation)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center shadow-sm">
                    <Plus className="w-4 h-4 mr-2" /> Record Vitals
                  </button>
                </>
              )}
            </div>
          </div>

          {isAddingObservation && !isReadOnly && (
            <div className="bg-blue-50 rounded-xl p-5 border border-blue-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-in fade-in slide-in-from-top-4">
              <div>
                <label className="block text-xs font-semibold text-blue-900 mb-1">Observation Type</label>
                <select 
                  value={observationForm.type} 
                  onChange={e => {
                    const type = e.target.value;
                    let unit = 'mmHg';
                    if (type === 'Temperature') unit = '°C';
                    if (type === 'Heart Rate') unit = 'bpm';
                    if (type === 'Weight') unit = 'kg';
                    setObservationForm({ ...observationForm, type, unit });
                  }} 
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option>Blood Pressure</option><option>Heart Rate</option><option>Temperature</option><option>Weight</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-900 mb-1">Value</label>
                <input type="text" value={observationForm.value} onChange={e => setObservationForm({...observationForm, value: e.target.value})} className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="E.g. 120/80" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-blue-900 mb-1">Unit</label>
                <input type="text" disabled value={observationForm.unit} className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm bg-gray-50 text-gray-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setIsAddingObservation(false)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium">Cancel</button>
                <button onClick={() => handleGenericSubmit('Vitals', () => { setIsAddingObservation(false); setObservationForm({...observationForm, value: ''}); })} disabled={!observationForm.value} className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">Save</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-slate-50 text-gray-500 text-xs uppercase border-b border-gray-200">
                   <th className="p-4 font-medium">Date & Time</th>
                   <th className="p-4 font-medium">Type</th>
                   <th className="p-4 font-medium">Value</th>
                   <th className="p-4 font-medium">Recorded By</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 text-sm">
                 {(resident.observations || []).length === 0 ? (
                   <tr><td colSpan={4} className="p-8 text-center text-gray-500">No observations recorded.</td></tr>
                 ) : (resident.observations || []).map((obs: any, i: number) => (
                   <tr key={i} className="hover:bg-slate-50">
                     <td className="p-4 text-gray-600">{obs.date} {obs.time}</td>
                     <td className="p-4"><div className="font-medium text-gray-900 flex items-center"><Activity className="w-4 h-4 mr-2 text-blue-500" />{obs.type}</div></td>
                     <td className="p-4"><span className="font-bold text-gray-900 text-base">{obs.value}</span><span className="text-gray-500 ml-1 text-xs">{obs.unit}</span></td>
                     <td className="p-4 text-gray-600">{obs.author}</td>
                   </tr>
                 ))}
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
            {!isReadOnly && (
              <button onClick={() => setIsUploadingDoc(!isUploadingDoc)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm transition-colors">
                <FileUp className="w-4 h-4 mr-2" /> Upload Document
              </button>
            )}
          </div>

          {isUploadingDoc && !isReadOnly && (
            <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-semibold text-indigo-900 mb-1">Document Name / Description</label>
                  <input type="text" value={documentForm.fileName} onChange={e => setDocumentForm({...documentForm, fileName: e.target.value})} className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="E.g. Hospital Discharge Plan" />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button onClick={() => setIsUploadingDoc(false)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 flex-1 sm:flex-none transition-colors">Cancel</button>
                  <button onClick={handleUploadDocument} disabled={isSummarizingDoc || !documentForm.fileName} className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center flex-1 sm:flex-none transition-colors">
                    {isSummarizingDoc ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />} Analyze & Save
                  </button>
                </div>
              </div>
              <div className="w-full mt-2">
                <label className="block text-xs font-semibold text-indigo-900 mb-1 flex items-center"><Sparkles className="w-3.5 h-3.5 mr-1" /> Paste Raw Document Text for AI Extraction (Optional)</label>
                <textarea value={documentForm.text} onChange={e => setDocumentForm({...documentForm, text: e.target.value})} className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none" placeholder="Paste the contents of the scanned paper assessment here to auto-extract risks and medication changes..." />
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
                   {!(resident as any).documents || (resident as any).documents.length === 0 ? (
                     <tr><td colSpan={3} className="p-8 text-center text-gray-500">No documents uploaded yet.</td></tr>
                   ) : (resident as any).documents.map((doc: any) => (
                     <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                       <td className="p-4">
                         <div className="font-medium text-gray-900 flex items-center"><File className={`w-4 h-4 mr-2 ${isReadOnly ? 'text-gray-400' : 'text-indigo-500'}`} />{doc.fileName}</div>
                         {doc.summary && (
                           <div className="mt-2 text-xs text-indigo-700 bg-indigo-50/50 p-2.5 rounded border border-indigo-100/50 leading-relaxed max-w-lg">
                             <span className="font-bold flex items-center mb-1"><Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-500"/> AI Extracted Insights:</span>{doc.summary}
                           </div>
                         )}
                       </td>
                       <td className="p-4 text-gray-600 align-top pt-5">{doc.uploadDate || 'N/A'}</td>
                       <td className="p-4 text-right align-top pt-5"><button className="text-indigo-600 hover:text-indigo-800 font-medium text-sm">View PDF</button></td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          </div>
        </div>
      )}

      {/* Profile photo upload (camera / gallery, managers) */}
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

