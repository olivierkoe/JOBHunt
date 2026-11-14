"use client";

import Link from "next/link";
import { useState } from "react";

import { api } from "~/trpc/react";
import { host } from "../_components/contacts";
import { Card, ScoreBadge, inputCls } from "../_components/ui";

export default function CompaniesPage() {
  const companies = api.company.list.useQuery();
  const [search, setSearch] = useState("");
  const [withOffers, setWithOffers] = useState(true);
  const q = search.trim().toLowerCase();
  const shown = (companies.data ?? [])
    .filter((c) => !withOffers || c.offers > 0)
    .filter((c) => !q || [c.name, c.sector, c.country].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => (b.best ?? -1) - (a.best ?? -1));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entreprises</h1>
          <p className="text-sm text-zinc-500">Coordonnées publiques, contacts et offres de chaque entreprise qui recrute.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input className={`${inputCls} w-64`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, secteur ou pays" />
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={withOffers} onChange={(e) => setWithOffers(e.target.checked)} /> Avec offres ouvertes
          </label>
        </div>
      </div>

      {companies.data && shown.length === 0 && <p className="text-sm text-zinc-500">Aucune entreprise ne correspond.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((c) => (
          <Link key={c.key} href={`/entreprises/${encodeURIComponent(c.key)}`} className="group">
            <Card className="h-full transition-colors group-hover:border-indigo-400">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{c.name}</div>
                  <div className="truncate text-xs text-zinc-500">{c.sector ?? "Secteur non renseigné"}</div>
                </div>
                {c.best != null && <ScoreBadge value={c.best} />}
              </div>
              <div className="mt-3 space-y-1 text-xs text-zinc-600">
                {(c.address ?? c.country) && <div className="truncate">📍 {[c.address, c.country].filter(Boolean).join(" · ")}</div>}
                {c.phone && <div>☎ {c.phone}</div>}
                {c.email && <div className="truncate">✉ {c.email}</div>}
                {c.website && <div className="truncate">🌐 {host(c.website)}</div>}
              </div>
              <div className="mt-3 flex gap-2 text-[11px]">
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 ring-1 ring-indigo-200">
                  {c.offers} offre{c.offers > 1 ? "s" : ""}
                </span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                  {c.contacts} contact{c.contacts > 1 ? "s" : ""}
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
