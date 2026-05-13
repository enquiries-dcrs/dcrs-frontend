export default function Header() {
  return (
    <header id="app-shell-header" className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900">
            DCRS App
          </div>
          <div className="truncate text-xs text-zinc-600">
            Residents • Clinical chart • Offline sync
          </div>
        </div>

        <div className="text-xs text-zinc-600">
          <span className="rounded-full bg-zinc-50 px-2 py-1 ring-1 ring-zinc-200">
            Dev
          </span>
        </div>
      </div>
    </header>
  );
}

