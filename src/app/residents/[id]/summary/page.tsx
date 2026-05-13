"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useResident } from "@/hooks/useResident";
import { useGlobalStore } from "@/store/useGlobalStore";
import { resolveResidentRouteId } from "@/lib/resident-route";
import { formatApiError } from "@/lib/format-api-error";
import { ArrowLeft, Loader2, Printer } from "lucide-react";

function formatDob(raw: string | undefined): string {
  const s = raw?.trim();
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB");
}

function formatRecorded(obs: { recordedAt?: string; date?: string; time?: string }): string {
  if (obs.recordedAt) {
    const d = new Date(obs.recordedAt);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString("en-GB");
  }
  if (obs.date || obs.time) return [obs.date, obs.time].filter(Boolean).join(" ");
  return "—";
}

function taskIsDone(status: string | undefined): boolean {
  const s = String(status || "").toLowerCase();
  return s === "completed" || s === "done";
}

export default function ResidentPrintSummaryPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const residentId = useMemo(() => resolveResidentRouteId(params, pathname), [params, pathname]);
  const user = useGlobalStore((s) => s.user);

  const { data: resident, isLoading, isError, error } = useResident(residentId);

  useEffect(() => {
    document.documentElement.setAttribute("data-print-summary", "1");
    return () => document.documentElement.removeAttribute("data-print-summary");
  }, []);

  const openTasks = useMemo(() => {
    if (!resident?.tasks?.length) return [];
    return resident.tasks.filter((t) => !taskIsDone(t.status));
  }, [resident?.tasks]);

  const recentNotes = useMemo(() => (resident?.dailyNotes ?? []).slice(0, 10), [resident?.dailyNotes]);

  const recentObs = useMemo(() => (resident?.observations ?? []).slice(0, 15), [resident?.observations]);

  const generatedLabel = useMemo(() => new Date().toLocaleString("en-GB"), []);

  if (!residentId) {
    return (
      <div className="p-6 text-sm text-gray-600">
        Invalid link.{" "}
        <button type="button" className="text-blue-600 underline" onClick={() => router.push("/residents")}>
          Back to service users
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 pb-16 print:max-w-none print:px-0 print:py-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/residents/${residentId}`}
          className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
          Back to clinical record
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
        >
          <Printer className="h-4 w-4" aria-hidden />
          Print
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          Loading summary…
        </div>
      ) : isError ? (
        <p className="text-sm text-rose-700">{formatApiError(error).detail}</p>
      ) : resident ? (
        <article className="rounded-xl border border-gray-200 bg-white shadow-sm print:border-0 print:shadow-none">
          <header className="border-b border-gray-100 px-6 py-5 print:border-b print:border-gray-300">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Service user summary</p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 print:text-3xl">
              {resident.first_name} {resident.last_name}
            </h1>
            <dl className="mt-4 grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2 print:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">Date of birth</dt>
                <dd className="font-medium">{formatDob(resident.date_of_birth)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">NHS number</dt>
                <dd className="font-medium">{resident.nhs_number?.trim() || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">Status</dt>
                <dd className="font-medium">{resident.status}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">Location</dt>
                <dd className="font-medium">
                  {resident.room_number
                    ? `${resident.home_name ?? "—"} · ${resident.unit_name ?? "—"} · Room ${resident.room_number}`
                    : "No active bed"}
                </dd>
              </div>
            </dl>
            {resident.legal_hold ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 print:border-amber-400">
                Legal hold is recorded for this service user.
              </p>
            ) : null}
          </header>

          <div className="space-y-8 px-6 py-6 print:space-y-6">
            <section>
              <h2 className="border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900 print:text-xl">
                Emergency &amp; transfer essentials
              </h2>
              <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 print:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-gray-500">Known allergies</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-gray-900">
                    {resident.known_allergies?.trim() || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-gray-500">GP practice</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{resident.gp_practice_name?.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-gray-500">GP phone</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{resident.gp_practice_phone?.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-gray-500">Next of kin</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{resident.next_of_kin_name?.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-gray-500">NOK relationship</dt>
                  <dd className="mt-0.5 text-gray-900">{resident.next_of_kin_relationship?.trim() || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-gray-500">NOK phone</dt>
                  <dd className="mt-0.5 font-medium text-gray-900">{resident.next_of_kin_phone?.trim() || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-gray-500">Advance care / transfer notes</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-gray-900">
                    {resident.advance_care_notes?.trim() || "—"}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h2 className="border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900 print:text-xl">
                Medications (chart)
              </h2>
              {resident.medications?.length ? (
                <table className="mt-3 w-full border-collapse text-sm print:text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                      <th className="py-2 pr-3 font-medium">Medicine</th>
                      <th className="py-2 pr-3 font-medium">Dose</th>
                      <th className="py-2 pr-3 font-medium">Route</th>
                      <th className="py-2 pr-3 font-medium">Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resident.medications.map((m) => (
                      <tr key={m.id} className="border-b border-gray-100">
                        <td className="py-2 pr-3 font-medium text-gray-900">{m.name}</td>
                        <td className="py-2 pr-3 text-gray-800">{m.dose}</td>
                        <td className="py-2 pr-3 text-gray-700">{m.route ?? "—"}</td>
                        <td className="py-2 pr-3 text-gray-700">{m.frequency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-3 text-sm text-gray-600">No medications on the chart.</p>
              )}
            </section>

            <section>
              <h2 className="border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900 print:text-xl">
                Open tasks
              </h2>
              {openTasks.length ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-800">
                  {openTasks.map((t) => (
                    <li key={t.id}>
                      <span className="font-medium">{t.title}</span>
                      {t.dueDateIso ? (
                        <span className="text-gray-600">
                          {" "}
                          — due {t.dueDateIso} ({t.priority})
                        </span>
                      ) : (
                        <span className="text-gray-600"> — {t.priority}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-gray-600">No open tasks (or none returned).</p>
              )}
            </section>

            <section>
              <h2 className="border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900 print:text-xl">
                Recent daily notes (latest {recentNotes.length})
              </h2>
              {recentNotes.length ? (
                <ul className="mt-3 space-y-3 text-sm">
                  {recentNotes.map((n) => (
                    <li key={n.id} className="border-l-2 border-slate-200 pl-3">
                      <p className="text-xs text-gray-500">
                        {n.time} · {n.author}
                        {n.shareWithFamily ? " · Shared with family" : ""}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-gray-900">{n.text}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-gray-600">No daily notes on file.</p>
              )}
            </section>

            <section>
              <h2 className="border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900 print:text-xl">
                Recent observations (latest {recentObs.length})
              </h2>
              {recentObs.length ? (
                <table className="mt-3 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                      <th className="py-2 pr-2 font-medium">When</th>
                      <th className="py-2 pr-2 font-medium">Type</th>
                      <th className="py-2 pr-2 font-medium">Value</th>
                      <th className="py-2 pr-2 font-medium">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentObs.map((o) => (
                      <tr key={o.id ?? `${o.type}-${formatRecorded(o)}`} className="border-b border-gray-100 align-top">
                        <td className="py-2 pr-2 text-gray-700">{formatRecorded(o)}</td>
                        <td className="py-2 pr-2 text-gray-900">{o.typeLabel ?? o.type}</td>
                        <td className="py-2 pr-2 text-gray-900">
                          {o.value}
                          {o.unit ? ` ${o.unit}` : ""}
                          {o.notes ? (
                            <span className="mt-0.5 block text-xs text-gray-600">{o.notes}</span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-2 text-gray-700">{o.author}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-3 text-sm text-gray-600">No observations on file.</p>
              )}
            </section>

            <footer className="border-t border-gray-100 pt-4 text-xs text-gray-500 print:border-gray-300 print:pt-3">
              <p>
                Generated {generatedLabel}
                {user?.name ? ` · Viewed as ${user.name}` : ""}
              </p>
              <p className="mt-2 max-w-3xl">
                This page is a point-in-time snapshot from the live chart. Always confirm critical information in
                DCRS before clinical or medication decisions. For full history use the clinical record tabs.
              </p>
            </footer>
          </div>
        </article>
      ) : null}
    </div>
  );
}
