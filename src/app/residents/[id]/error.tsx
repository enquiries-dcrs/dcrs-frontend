"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Next.js route error boundary for /residents/[id] only.
 * Catches render/runtime errors in this segment (not failed fetches — those use React Query + formatApiError on the page).
 */
export default function ResidentProfileRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DCRS] Resident profile route error:", error);
  }, [error]);

  const message = (error?.message && String(error.message).trim()) || "No error message was provided.";

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-lg font-semibold text-rose-800">Service user profile (runtime error)</h1>
      <p className="max-w-lg text-sm text-slate-600">
        The chart page crashed while rendering. If you instead see the system message{" "}
        <span className="font-medium text-slate-800">&quot;Reload to try again, or go back&quot;</span>, that comes from
        Safari or an in-app browser when the tab never finished loading JavaScript — open{" "}
        <span className="font-mono text-xs">http://127.0.0.1:3000</span> in a normal browser window and check the
        Network tab for failed (red) requests.
      </p>
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Error message</p>
        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-slate-900">{message}</pre>
        {error.digest ? (
          <p className="mt-3 text-xs text-slate-500">
            Digest: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Try again
        </button>
        <Link
          href="/residents"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Back to service users
        </Link>
        <Link href="/" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          Home
        </Link>
      </div>
    </div>
  );
}
