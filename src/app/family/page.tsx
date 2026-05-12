"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import {
  Calendar,
  Heart,
  LogOut,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useGlobalStore } from "@/store/useGlobalStore";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseClient =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

type FamilyContextRes = {
  role: string;
  residents: Array<{
    service_user_id: string;
    first_name: string | null;
    last_name: string | null;
    home_name: string | null;
    relationship?: string | null;
  }>;
};

type FamilyFeedRes = {
  resident: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    home_name: string | null;
  };
  feed: Array<{
    id: string;
    kind: string;
    title: string;
    body: string;
    occurredAt: string;
  }>;
};

function residentPickLabel(r: FamilyContextRes["residents"][0]): string {
  const n = [r.first_name, r.last_name].filter(Boolean).join(" ").trim();
  return n || r.service_user_id;
}

export default function FamilyPortalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useGlobalStore((s) => s.user);
  const logout = useGlobalStore((s) => s.logout);

  const { data: context, isLoading: ctxLoading, error: ctxError } = useQuery({
    queryKey: ["family-context"],
    queryFn: async () => {
      const { data } = await api.get<FamilyContextRes>("/api/v1/family/context");
      return data;
    },
  });

  const residents = context?.residents ?? [];
  const paramRid = searchParams.get("resident");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!residents.length) {
      setSelectedId(null);
      return;
    }
    if (paramRid && residents.some((r) => r.service_user_id === paramRid)) {
      setSelectedId(paramRid);
      return;
    }
    setSelectedId((prev) =>
      prev && residents.some((r) => r.service_user_id === prev)
        ? prev
        : residents[0].service_user_id
    );
  }, [residents, paramRid]);

  const effectiveId = selectedId;

  const { data: feedData, isLoading: feedLoading, error: feedError } = useQuery({
    queryKey: ["family-feed", effectiveId],
    queryFn: async () => {
      const { data } = await api.get<FamilyFeedRes>(
        `/api/v1/family/residents/${effectiveId}/feed`
      );
      return data;
    },
    enabled: Boolean(effectiveId),
  });

  const displayName = useMemo(() => {
    if (!feedData?.resident) return "";
    const fn = feedData.resident.first_name || "";
    const ln = feedData.resident.last_name || "";
    return `${fn} ${ln}`.trim() || "Your loved one";
  }, [feedData]);

  const subtitle = useMemo(() => {
    if (!feedData?.resident) return "Updates from the care home";
    const home = feedData.resident.home_name;
    return home ? `${displayName} · ${home}` : displayName;
  }, [feedData, displayName]);

  const exit = async () => {
    if (user?.role === "Family") {
      if (supabaseClient) {
        await supabaseClient.auth.signOut();
      }
      logout();
      router.push("/");
      return;
    }
    router.push("/dashboard");
  };

  if (ctxLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100">
        <Loader2 className="h-10 w-10 animate-spin text-teal-600" aria-hidden />
      </div>
    );
  }

  if (ctxError) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-100 p-6 text-center">
        <p className="text-sm font-medium text-slate-700">Could not load family portal.</p>
        <p className="max-w-md text-xs text-slate-500">
          Sign in with a family or staff account. If you are family, your home must link your login to a
          service user first.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (context?.role === "Family" && residents.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-100 p-6 text-center">
        <Heart className="h-10 w-10 text-teal-500" aria-hidden />
        <p className="text-sm font-medium text-slate-800">No family portal access yet</p>
        <p className="max-w-md text-xs text-slate-600">
          Ask your home to link your account to the right service user (Settings → Family portal access).
        </p>
        <button
          type="button"
          onClick={exit}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm text-white"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-screen justify-center overflow-y-auto bg-slate-100 font-sans"
      role="region"
      aria-label="Family portal"
    >
      <div className="relative flex min-h-screen w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="relative shrink-0 overflow-hidden rounded-b-[2rem] bg-teal-600 p-6 pb-8 pt-12 text-white shadow-md">
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(255,255,255,0.08) 6px, rgba(255,255,255,0.08) 7px)",
            }}
            aria-hidden
          />
          <button
            type="button"
            onClick={exit}
            className="absolute right-4 top-4 flex items-center text-xs font-medium text-white/70 transition-colors hover:text-white"
          >
            <LogOut className="mr-1 h-3 w-3" aria-hidden />
            {user?.role === "Family" ? "Sign out" : "Exit to staff"}
          </button>
          <h1 className="relative z-10 flex items-center gap-2 text-2xl font-bold">
            <Heart className="h-6 w-6 shrink-0" aria-hidden />
            Family portal
          </h1>
          <p className="relative z-10 mt-1 text-teal-100">{subtitle}</p>

          {residents.length > 1 ? (
            <label className="relative z-10 mt-4 block text-xs font-medium text-teal-100">
              <span className="mb-1 block">Showing updates for</span>
              <select
                className="w-full rounded-lg border border-white/30 bg-teal-700/40 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-white/40"
                value={effectiveId || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedId(v);
                  router.replace(`/family${v ? `?resident=${encodeURIComponent(v)}` : ""}`);
                }}
              >
                {residents.map((r) => (
                  <option key={r.service_user_id} value={r.service_user_id}>
                    {residentPickLabel(r)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </header>

        <main id="family-portal-main" className="flex-1 space-y-6 p-6 pb-10">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <Calendar className="h-5 w-5 shrink-0 text-teal-500" aria-hidden />
            Recent updates
          </h2>

          {feedLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" aria-hidden />
            </div>
          ) : feedError ? (
            <p className="text-sm text-rose-600">Could not load updates for this person.</p>
          ) : (feedData?.feed ?? []).length === 0 ? (
            <p className="text-sm leading-relaxed text-slate-600">
              There are no family-visible updates yet. The care team can share selected daily notes on the
              service user record; activities and social daily care items also appear here when recorded.
            </p>
          ) : (
            <ul className="space-y-4">
              {(feedData?.feed ?? []).map((item) => {
                const d = new Date(item.occurredAt);
                const dateStr = Number.isNaN(d.getTime())
                  ? ""
                  : d.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    });
                const kindLabel =
                  item.kind === "shared_note"
                    ? "Shared update"
                    : item.kind === "activity"
                      ? "Activity"
                      : item.kind === "daily_life"
                        ? "Daily life"
                        : item.kind;
                return (
                  <li key={item.id}>
                    <article className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                      <div
                        className="absolute left-0 top-0 h-full w-1 bg-teal-400"
                        aria-hidden
                      />
                      <p className="mb-1 text-xs font-bold text-teal-600">{dateStr}</p>
                      <h3 className="mb-2 font-bold text-gray-900">{item.title}</h3>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-600">
                        {item.body}
                      </p>
                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        {kindLabel}
                      </p>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}

          <section
            className="rounded-2xl border border-teal-100 bg-teal-50 p-5"
            aria-labelledby="visit-heading"
          >
            <h2
              id="visit-heading"
              className="text-center text-sm font-medium text-teal-800"
            >
              Schedule a visit
            </h2>
            <p className="mt-1 text-center text-xs text-teal-700/90">
              Requests are reviewed by the care team during office hours.
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-full bg-teal-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-700"
            >
              Request visit time
            </button>
          </section>

          <section
            className="flex gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600"
            aria-labelledby="messages-heading"
          >
            <MessageCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-teal-600"
              aria-hidden
            />
            <div>
              <h2 id="messages-heading" className="font-semibold text-gray-900">
                Messages
              </h2>
              <p className="mt-1 text-xs leading-relaxed">
                Secure messaging with the home will appear here when enabled by your organisation.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
