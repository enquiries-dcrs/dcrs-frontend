export default function ResidentProfileLoading() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4 animate-in fade-in">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
        aria-hidden
      />
      <p className="text-sm font-medium text-slate-600">Loading service user profile…</p>
    </div>
  );
}
