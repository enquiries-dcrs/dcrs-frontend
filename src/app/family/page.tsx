"use client";

import { useRouter } from "next/navigation";
import { Calendar, Heart, LogOut, MessageCircle } from "lucide-react";

type FeedItem = {
  id: string;
  title: string;
  content: string;
  date: string;
};

/** Demo feed; replace with API keyed to the signed-in family contact + resident. */
const MOCK_FEED: FeedItem[] = [
  {
    id: "1",
    title: "Good morning",
    content:
      "Arthur enjoyed breakfast in the dining room today and joined the morning music session.",
    date: "14 April 2026",
  },
];

export default function FamilyPortalPage() {
  const router = useRouter();

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
            onClick={() => router.push("/dashboard")}
            className="absolute right-4 top-4 flex items-center text-xs font-medium text-white/70 transition-colors hover:text-white"
          >
            <LogOut className="mr-1 h-3 w-3" aria-hidden />
            Exit to staff
          </button>
          <h1 className="relative z-10 flex items-center gap-2 text-2xl font-bold">
            <Heart className="h-6 w-6 shrink-0" aria-hidden />
            Family portal
          </h1>
          <p className="relative z-10 mt-1 text-teal-100">
            Daily updates for Arthur Smith
          </p>
        </header>

        <main
          id="family-portal-main"
          className="flex-1 space-y-6 p-6 pb-10"
        >
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <Calendar className="h-5 w-5 shrink-0 text-teal-500" aria-hidden />
            Recent updates
          </h2>

          <ul className="space-y-4">
            {MOCK_FEED.map((feed) => (
              <li key={feed.id}>
                <article className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div
                    className="absolute left-0 top-0 h-full w-1 bg-teal-400"
                    aria-hidden
                  />
                  <p className="mb-1 text-xs font-bold text-teal-600">{feed.date}</p>
                  <h3 className="mb-2 font-bold text-gray-900">{feed.title}</h3>
                  <p className="text-sm leading-relaxed text-gray-600">
                    {feed.content}
                  </p>
                </article>
              </li>
            ))}
          </ul>

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
                Secure messaging with the home will appear here when enabled by
                your organisation.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
