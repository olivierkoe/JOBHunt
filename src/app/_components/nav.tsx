"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Tableau de bord" },
  { href: "/offers", label: "Offres" },
  { href: "/entreprises", label: "Entreprises" },
  { href: "/levees", label: "Levées" },
  { href: "/board", label: "Candidatures" },
  { href: "/cvs", label: "CV" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3">
      <Link href="/" className="mr-4 flex items-center gap-2 text-lg font-bold tracking-tight text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">🎯</span>
        JobHunt
      </Link>
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-white/25 text-white shadow-sm ring-1 ring-white/40" : "text-white/80 hover:bg-white/15 hover:text-white"
            }`}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
