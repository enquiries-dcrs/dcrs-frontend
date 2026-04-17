import Link from "next/link";

type NavItem = {
  label: string;
  href: string;
};

const nav: NavItem[] = [
  { label: "Residents", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "eMAR", href: "/emar" },
  { label: "Sync", href: "/#sync" },
];

export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-zinc-200 bg-white p-4 md:block">
      <div className="text-sm font-semibold tracking-tight text-zinc-900">
        DCRS
      </div>
      <div className="mt-6 space-y-1">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
          >
            {item.label}
          </Link>
        ))}
      </div>
      <div className="mt-6 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 ring-1 ring-zinc-200">
        Backend: <span className="font-medium">localhost:4000</span>
      </div>
    </aside>
  );
}

