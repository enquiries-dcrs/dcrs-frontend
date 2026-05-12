"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DCRS] App route error:", error);
  }, [error]);

  const message = (error?.message && String(error.message).trim()) || "No error message was provided.";

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
      <p className="max-w-md text-sm text-slate-600">
        This is the in-app error screen (Next.js <code className="rounded bg-slate-100 px-1 text-xs">error.tsx</code>
        ). API failures on the service user chart are shown on the chart page itself with a clearer title. If you only
        see the system line about reloading or going back, the browser never ran this app — check that the dev server is
        up and scripts are not blocked.
      </p>
      <div className="w-full max-w-2xl rounded-lg border border-amber-200 bg-amber-50/80 p-4 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">Technical detail</p>
        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-amber-950">{message}</pre>
        {error.digest ? (
          <p className="mt-2 text-xs text-amber-900/70">
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
        <button
          type="button"
          onClick={() => {
            window.location.href = "/";
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
        >
          Go home
        </button>
        <Link
          href="/residents"
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Service users
        </Link>
      </div>
    </div>
  );
}
