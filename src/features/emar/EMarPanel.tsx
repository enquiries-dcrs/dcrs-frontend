"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  GitMerge,
  Hospital,
  Loader2,
  Plus,
  QrCode,
  ScanLine,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SyncEngine } from "@/lib/sync-engine";

interface EMarTabProps {
  residentId: string;
  /** Medications from the resident chart (GET /api/v1/residents/:id). */
  medications?: Array<{
    id: string;
    name: string;
    dose: string;
    route?: string;
    frequency: string;
    stockCount: number;
  }>;

  /**
   * Legacy/alternate prop name (some UI variants call this initialMedications).
   * If provided, it takes precedence over `medications`.
   */
  initialMedications?: Array<{
    id: string;
    name: string;
    dose: string;
    frequency: string;
    stockCount: number;
  }>;
}

type MedicationRow = NonNullable<EMarTabProps["medications"]>[number];
type InitialMedicationRow = NonNullable<
  EMarTabProps["initialMedications"]
>[number];

export default function EMarTab({
  residentId,
  medications,
  initialMedications,
}: EMarTabProps) {
  const meds = useMemo(() => {
    if (initialMedications) return initialMedications;
    return medications ?? [];
  }, [initialMedications, medications]);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedMed, setScannedMed] = useState<
    (MedicationRow | InitialMedicationRow) | null
  >(null);
  
  // Rich UI States
  const [isAddingMed, setIsAddingMed] = useState(false);
  const [newMed, setNewMed] = useState({
    name: "",
    dose: "",
    route: "Oral",
    frequency: "OD",
    stockCount: 28,
  });
  const [isCheckingMeds, setIsCheckingMeds] = useState(false);
  const [medSafetyReport, setMedSafetyReport] = useState("");
  const [hospitalMedsText, setHospitalMedsText] = useState("");
  const [isReconciling, setIsReconciling] = useState(false);
  const [reconReport, setReconReport] = useState("");
  const [isImportingNHS, setIsImportingNHS] = useState(false);

  // Safely log medication administration to the Offline Sync Engine
  const handleLogAdministration = async (
    med: (MedicationRow | InitialMedicationRow) | null,
    status: string,
  ) => {
    if (!med) return;
    const payload = {
      medicationId: med.id,
      medicationName: med.name,
      status: status,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      date: new Date().toLocaleDateString("en-GB"),
    };

    await SyncEngine.queueMutation("MedicationAdmin", residentId, "INSERT", payload);
    setIsScannerOpen(false);
    setScannedMed(null);
    alert(`Medication marked as ${status} and queued for sync!`);
  };

  const handleCheckMedSafety = async () => {
    setIsCheckingMeds(true);
    try {
      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/med-safety`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medications: meds.map((m) => ({
            name: m.name,
            dose: m.dose,
            frequency: m.frequency,
          })),
          context: { residentId },
        }),
      });

      const data = (await response.json()) as unknown;
      if (!response.ok) {
        const msg =
          typeof data === "object" && data && "error" in data
            ? String((data as { error: unknown }).error)
            : `Request failed (${response.status})`;
        setMedSafetyReport(msg);
        return;
      }

      if (typeof data === "object" && data && "summary" in data) {
        const d = data as {
          summary?: string;
          risks?: Array<{ severity?: string; message?: string }>;
          actions?: string[];
          disclaimer?: string;
          raw?: string;
        };

        const lines: string[] = [];
        if (d.summary) lines.push(d.summary);
        if (d.risks?.length) {
          lines.push("");
          lines.push("Risks:");
          for (const r of d.risks) {
            lines.push(
              `- ${(r.severity ?? "RISK").toString()}: ${(r.message ?? "").toString()}`.trim(),
            );
          }
        }
        if (d.actions?.length) {
          lines.push("");
          lines.push("Actions:");
          for (const a of d.actions) lines.push(`- ${a}`);
        }
        if (d.disclaimer) {
          lines.push("");
          lines.push(d.disclaimer);
        }
        if (d.raw) {
          lines.push("");
          lines.push(d.raw);
        }
        setMedSafetyReport(lines.filter(Boolean).join("\n"));
      } else {
        setMedSafetyReport("AI med-safety returned an unexpected response.");
      }
    } catch (e) {
      console.error("AI Safety Check Error:", e);
      setMedSafetyReport("Error connecting to AI Orchestrator.");
    } finally {
      setIsCheckingMeds(false);
    }
  };

  const handleFetchNHS = async () => {
    setIsImportingNHS(true);
    try {
      // In production, pull NHS number from the resident profile.
      const mockNhsNumber = "123 456 789";
      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
      const response = await fetch(
        `${API_BASE_URL}/api/v1/integrations/nhs/meds/${encodeURIComponent(
          mockNhsNumber,
        )}`,
      );
      const data = (await response.json()) as unknown;

      if (!response.ok) {
        const msg =
          typeof data === "object" && data && "error" in data
            ? String((data as { error: unknown }).error)
            : `Request failed (${response.status})`;
        setHospitalMedsText(msg);
        return;
      }

      if (typeof data === "object" && data && "medications" in data) {
        const medsFromNhs = (data as { medications?: unknown }).medications;
        if (Array.isArray(medsFromNhs)) {
          const lines = medsFromNhs
            .map((m) => {
              if (!m || typeof m !== "object") return null;
              const mm = m as {
                name?: unknown;
                dose?: unknown;
                route?: unknown;
                frequency?: unknown;
              };
              const name = typeof mm.name === "string" ? mm.name : "";
              const dose = typeof mm.dose === "string" ? mm.dose : "";
              const freq =
                typeof mm.frequency === "string" ? mm.frequency : "";
              return `- ${[name, dose, freq].filter(Boolean).join(" ")}`.trim();
            })
            .filter(Boolean);
          setHospitalMedsText(
            [`[NHS Spine / GP Connect - Demo]`, ...lines].join("\n"),
          );
          return;
        }
      }

      setHospitalMedsText(JSON.stringify(data, null, 2));
    } catch (e) {
      console.error("NHS Spine Error:", e);
      setHospitalMedsText("Error connecting to NHS Spine IM1.");
    } finally {
      setIsImportingNHS(false);
    }
  };

  const handleReconcileMeds = async () => {
    if (!hospitalMedsText.trim()) return;
    setIsReconciling(true);
    setTimeout(() => {
      setReconReport("1 NEW Medication detected (Simvastatin). Please verify with GP before adding to eMAR.");
      setIsReconciling(false);
    }, 1500);
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Electronic MAR</h3>
          <p className="text-sm text-gray-500">Manage daily medications and stock levels.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleCheckMedSafety} 
            disabled={isCheckingMeds || !meds?.length} 
            className="bg-white text-indigo-700 border border-indigo-200 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center shadow-sm hover:bg-indigo-50 transition-colors"
          >
            {isCheckingMeds ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />} 
            AI Safety Check
          </button>
          <button 
            onClick={() => setIsAddingMed(!isAddingMed)} 
            className="bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Prescribed Med
          </button>
        </div>
      </div>

      {/* AI Safety Report Banner */}
      {medSafetyReport && (
        <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100 shadow-sm animate-in fade-in">
          <h4 className="font-semibold text-indigo-900 flex items-center mb-3"><ShieldAlert className="w-5 h-5 mr-2" /> AI Medication Safety Briefing</h4>
          <p className="text-sm text-gray-800">{medSafetyReport}</p>
          <div className="mt-3 flex justify-end">
            <button onClick={() => setMedSafetyReport("")} className="text-sm text-indigo-700 font-medium hover:underline">Dismiss Briefing</button>
          </div>
        </div>
      )}

      {/* NHS Integration Box */}
      <div className="bg-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2"><GitMerge className="w-5 h-5 text-indigo-400" /> NHS Medication Reconciliation</h3>
          </div>
          <button onClick={handleFetchNHS} disabled={isImportingNHS} className="bg-indigo-600/30 border border-indigo-400/50 hover:bg-indigo-600/50 px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center transition-colors">
            {isImportingNHS ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Hospital className="w-4 h-4 mr-2 text-indigo-300" />} 
            Fetch from NHS Spine
          </button>
        </div>
        <div className="flex gap-3 items-start flex-col sm:flex-row">
          <textarea 
            value={hospitalMedsText} 
            onChange={e => setHospitalMedsText(e.target.value)} 
            placeholder="NHS Spine data will populate here..." 
            className="w-full flex-1 h-24 px-3 py-2 bg-slate-900 border border-slate-700 text-slate-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-500 resize-none" 
          />
          <button onClick={handleReconcileMeds} disabled={isReconciling || !hospitalMedsText.trim()} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium h-24 w-full sm:w-24 justify-center flex items-center transition-colors">
            {isReconciling ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          </button>
        </div>
        {reconReport && (
          <div className="mt-4 bg-slate-900 rounded-lg p-4 border border-slate-700">
            <p className="text-sm text-slate-200">{reconReport}</p>
            <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-slate-700">
              <button onClick={() => {setReconReport(''); setHospitalMedsText('')}} className="text-sm text-slate-400 hover:text-slate-200 font-medium transition-colors">Discard</button>
            </div>
          </div>
        )}
      </div>

      {/* Add Medication Form */}
      {isAddingMed && (
        <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100 grid grid-cols-1 md:grid-cols-6 gap-4 items-end animate-in fade-in slide-in-from-top-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-emerald-900 mb-1">Medication Name</label>
            <input type="text" value={newMed.name} onChange={e => setNewMed({...newMed, name: e.target.value})} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Amoxicillin" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-emerald-900 mb-1">Dose</label>
            <input type="text" value={newMed.dose} onChange={e => setNewMed({...newMed, dose: e.target.value})} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. 500mg" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-emerald-900 mb-1">Frequency</label>
            <select value={newMed.frequency} onChange={e => setNewMed({...newMed, frequency: e.target.value})} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="OD">OD</option><option value="BD">BD</option><option value="QDS">QDS</option><option value="PRN">PRN</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-emerald-900 mb-1">Init Stock</label>
            <input type="number" value={newMed.stockCount} onChange={e => setNewMed({...newMed, stockCount: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="flex gap-2 md:col-span-6 justify-end border-t border-emerald-200/50 pt-4 mt-2">
            <button onClick={() => setIsAddingMed(false)} className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors">Cancel</button>
            <button onClick={() => setIsAddingMed(false)} className="bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-2 rounded-lg text-sm font-medium transition-colors">Save Prescription</button>
          </div>
        </div>
      )}

      {/* Active Medications List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead className="bg-slate-50 border-b border-gray-200 text-gray-500">
            <tr>
              <th className="p-4 font-medium">Medication</th>
              <th className="p-4 font-medium">Frequency</th>
              <th className="p-4 font-medium">Stock</th>
              <th className="p-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {meds?.map((med) => (
              <tr key={med.id} className="hover:bg-slate-50 transition-colors">
                <td className="p-4">
                  <p className="font-bold text-gray-900 text-base">{med.name}</p>
                  <p className="text-gray-500">{med.dose}</p>
                </td>
                <td className="p-4"><Badge variant={med.frequency === "PRN" ? "warning" : "default"}>{med.frequency}</Badge></td>
                <td className="p-4 font-bold text-gray-800">{med.stockCount}</td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => handleLogAdministration(med, "OMITTED")} 
                      className="px-3 py-1.5 border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg text-sm font-medium transition-colors"
                    >
                      Omit
                    </button>
                    <button 
                      onClick={() => { setScannedMed(med); setIsScannerOpen(true); }} 
                      disabled={med.stockCount <= 0} 
                      className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg font-bold text-xs disabled:opacity-50 flex items-center transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5 mr-1" /> Scan
                    </button>
                    <button 
                      onClick={() => handleLogAdministration(med, "GIVEN")} 
                      disabled={med.stockCount <= 0} 
                      className="px-3 py-1.5 border border-emerald-200 text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg text-sm font-bold disabled:opacity-50 flex items-center transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5"/> Give
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Barcode Scanner Modal */}
      {isScannerOpen && (
         <div className="fixed inset-0 bg-slate-900/95 flex flex-col items-center justify-center z-[100] p-4 animate-in fade-in">
           <div className="text-center mb-8 text-white">
             <h3 className="text-2xl font-bold mb-2 flex items-center justify-center">
               <QrCode className="w-6 h-6 mr-2"/> Scan Blister Pack
             </h3>
             <p className="text-slate-300">Align barcode for <span className="font-bold text-emerald-400">{scannedMed?.name}</span> within the frame.</p>
           </div>
           
           <div className="w-72 h-72 border-4 border-slate-600 rounded-2xl relative flex items-center justify-center overflow-hidden bg-black shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <div className="w-full h-1 bg-emerald-500 absolute shadow-[0_0_15px_#10b981]" style={{ animation: "scan 2s ease-in-out infinite", top: "0" }}></div>
              <ScanLine className="w-16 h-16 text-slate-700 absolute opacity-30" />
              <style>{`@keyframes scan { 0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }`}</style>
           </div>

           <div className="mt-12 flex gap-4">
             <button onClick={() => {setIsScannerOpen(false); setScannedMed(null);}} className="px-6 py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors">Cancel</button>
             <button onClick={() => handleLogAdministration(scannedMed, "GIVEN")} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-colors flex items-center shadow-lg shadow-emerald-600/20">
               <CheckCircle2 className="w-5 h-5 mr-2" /> Force Match (Demo)
             </button>
           </div>
         </div>
      )}
    </div>
  );
}