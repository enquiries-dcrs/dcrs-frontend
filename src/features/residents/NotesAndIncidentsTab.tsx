"use client";

import { useState } from "react";
import {
  AlertTriangle,
  FileText,
  Loader2,
  Map as MapIcon,
  Mic,
  Sparkles,
} from "lucide-react";
import { SyncEngine } from "@/lib/sync-engine";

interface NotesTabProps {
  residentId: string;
  initialNotes: Array<{ id?: string; text: string; time: string; author: string }>;
}

export default function NotesAndIncidentsTab({
  residentId,
  initialNotes = [],
}: NotesTabProps) {
  const [draftNote, setDraftNote] = useState("");
  const [isDictating, setIsDictating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Advanced AI Feature States
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [handoverSummary, setHandoverSummary] = useState("");
  const [isDraftingIncident, setIsDraftingIncident] = useState(false);
  const [incidentDraft, setIncidentDraft] = useState("");

  const handleDictate = () => {
    type SpeechResultEvent = { results: Array<Array<{ transcript: string }>> };
    type SpeechRecognitionLike = {
      continuous: boolean;
      start(): void;
      onresult: ((ev: SpeechResultEvent) => void) | null;
      onerror: ((ev: Event) => void) | null;
    };
    type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

    const win = window as Window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const SpeechRecognitionCtor =
      win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      alert("Dictation not supported in this browser.");
      return;
    }

    setIsDictating(true);
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;

    recognition.onresult = async (event: SpeechResultEvent) => {
      const transcript = event.results[0][0].transcript;
      setIsDictating(false);

      try {
        // Hit the real Node.js AI Orchestrator endpoint!
        const API_BASE_URL =
          process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
        const response = await fetch(`${API_BASE_URL}/api/v1/ai/dictation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript }),
        });

        const data = (await response.json()) as {
          formattedText?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "AI Formatting Failed");
        }

        setDraftNote(data.formattedText ?? transcript);
      } catch (e: unknown) {
        console.error("AI Dictation Error", e);
        const message = e instanceof Error ? e.message : "Unknown error";
        setDraftNote(`${transcript}\n\n[⚠️ AI Error: ${message}]`);
      }
    };

    recognition.onerror = () => setIsDictating(false);
    recognition.start();
  };

  const handleSummarizeNotes = async () => {
    setIsSummarizing(true);
    setHandoverSummary("");
    try {
      const notesText = initialNotes
        .map((n) => `[${n.time} by ${n.author}]: ${n.text}`)
        .join("\n");

      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesText }),
      });

      const data = (await response.json()) as {
        summary?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch from backend");
      }

      setHandoverSummary(data.summary ?? "");
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : "Unknown error";
      setHandoverSummary(`⚠️ AI Generation Failed: ${message}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDraftIncidentReport = async () => {
    setIsDraftingIncident(true);
    setIncidentDraft("");
    try {
      const notesText = initialNotes
        .slice(0, 5)
        .map((n) => `[${n.time} by ${n.author}]: ${n.text}`)
        .join("\n");

      const API_BASE_URL =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/draft-incident`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesText }),
      });

      const data = (await response.json()) as {
        report?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch from backend");
      }

      setIncidentDraft(data.report ?? "");
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : "Unknown error";
      setIncidentDraft(`⚠️ AI Generation Failed: ${message}`);
    } finally {
      setIsDraftingIncident(false);
    }
  };

  const handleSaveNote = async (textToSave: string, prefix = "") => {
    if (!textToSave.trim()) return;
    setIsSaving(true);

    try {
      const finalContent = prefix ? `${prefix}\n\n${textToSave}` : textToSave;
      const payload = {
        text: finalContent,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        date: new Date().toLocaleDateString("en-GB"),
      };

      await SyncEngine.queueMutation("Note", residentId, "INSERT", payload);

      if (textToSave === draftNote) setDraftNote("");
      if (prefix.includes("Handover")) setHandoverSummary("");
      if (prefix.includes("Incident")) setIncidentDraft("");

      alert("Note saved and queued for offline sync!");
    } catch (e) {
      console.error(e);
      alert("Failed to queue note.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Intelligence Modules */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* AI Handover Panel */}
        <div className="flex h-full flex-col rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
          <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-blue-900">
                <Sparkles className="h-5 w-5 text-blue-600" aria-hidden /> AI
                Shift Handover
              </h3>
              <p className="mt-1 text-sm text-blue-700">
                Synthesize today&apos;s notes into a concise handover summary.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSummarizeNotes}
              disabled={isSummarizing}
              className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isSummarizing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              ✨ Generate
            </button>
          </div>
          {handoverSummary && (
            <div className="mt-4 flex flex-1 flex-col animate-in fade-in rounded-lg border border-blue-200 bg-white p-4 shadow-sm">
              <div className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                {handoverSummary}
              </div>
              <div className="mt-4 flex justify-end gap-3 border-t border-blue-50 pt-4">
                <button
                  type="button"
                  onClick={() => setHandoverSummary("")}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSaveNote(handoverSummary, "[AI Handover Summary]")
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Save Note
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI Incident Drafter Panel */}
        <div className="flex h-full flex-col rounded-xl border border-rose-100 bg-gradient-to-r from-rose-50 to-orange-50 p-6">
          <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-rose-900">
                <AlertTriangle className="h-5 w-5 text-rose-600" aria-hidden />{" "}
                Incident Report Drafter
              </h3>
              <p className="mt-1 text-sm text-rose-700">
                Auto-draft clinical incident reports from recent observations.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDraftIncidentReport}
            disabled={isDraftingIncident}
            className="flex w-max items-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-50"
          >
            {isDraftingIncident ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            ✨ Draft Incident Report
          </button>
          {incidentDraft && (
            <div className="mt-4 flex flex-1 flex-col animate-in fade-in rounded-lg border border-rose-200 bg-white p-4 shadow-sm">
              <div className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                {incidentDraft}
              </div>
              <div className="mt-4 flex justify-end gap-3 border-t border-rose-50 pt-4">
                <button
                  type="button"
                  onClick={() => setIncidentDraft("")}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveNote(incidentDraft, "[AI Incident Draft]")}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700"
                >
                  Save to Record
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Entry & Historical Notes */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Historical Notes & Capture
        </h3>

        <div className="mb-6 flex gap-2 rounded-lg border border-gray-100 bg-slate-50 p-4">
          <textarea
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            placeholder="Type or dictate care note..."
            className="h-16 flex-1 resize-none rounded-lg border border-gray-300 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleDictate}
              disabled={isDictating}
              className="flex items-center justify-center rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-sm font-medium text-blue-600 shadow-sm transition-colors hover:bg-blue-50"
            >
              {isDictating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="mr-1 h-4 w-4" />
              )}
              Dictate
            </button>
            <div className="flex h-full gap-2">
              <button
                type="button"
                className="flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
              >
                <MapIcon className="mr-1 h-3 w-3" /> Map
              </button>
              <button
                type="button"
                onClick={() => handleSaveNote(draftNote)}
                disabled={!draftNote.trim() || isSaving}
                className="flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {initialNotes?.map((note, i) => (
            <div
              key={note.id || i}
              className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <FileText className="h-5 w-5 text-slate-500" />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {note.author || "System User"}
                  </span>
                  <span className="text-xs text-gray-500">{note.time}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {note.text}
                </p>
              </div>
            </div>
          ))}

          {initialNotes?.length === 0 && (
            <div className="py-8 text-center text-gray-500">
              No notes recorded for this resident yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}