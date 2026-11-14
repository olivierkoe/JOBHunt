"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";

import { api } from "~/trpc/react";
import { ContactList, host } from "../../_components/contacts";
import { Card, OfferLink, ScoreRing, STATUS_COLOR, STATUS_LABEL } from "../../_components/ui";

function InfoRow({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2">
      <span className="w-6 shrink-0 text-center text-lg">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs text-zinc-500">{label}</div>
        <div className="break-words text-sm">{children}</div>
      </div>
    </div>
  );
}

const missing = <span className="text-zinc-400">non publié</span>;

export default function CompanyPage() {
  const { key } = useParams<{ key: string }>();
  const company = api.company.byKey.useQuery({ key: decodeURIComponent(key) }, { retry: false });

  if (company.isLoading) return <p className="text-sm text-zinc-500">Chargement…</p>;
  if (!company.data) return <p className="text-sm text-rose-600">Entreprise introuvable.</p>;
  const c = company.data;
  const mapQuery = [c.address, c.country].filter(Boolean).join(", ");

  return (
    <div className="space-y-4">
      <div>
        <Link href="/entreprises" className="text-xs text-zinc-500 hover:underline">
          ← Entreprises
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{c.name}</h1>
            {c.sector && <p className="text-sm text-zinc-500">{c.sector}</p>}
          </div>
          {c.website && <OfferLink url={c.website} label={`Site ${host(c.website)}`} className="px-3 py-1.5 text-sm" />}
        </div>
        {c.note && <p className="mt-3 rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700">{c.note}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          <Card>
            <h2 className="mb-1 font-semibold">Coordonnées</h2>
            <div className="divide-y divide-zinc-100">
              <InfoRow icon="📍" label="Adresse">
                {mapQuery ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-700 hover:underline"
                  >
                    {c.address ?? c.country}
                    {c.address && c.country ? ` · ${c.country}` : ""} ↗
                  </a>
                ) : (
                  missing
                )}
              </InfoRow>
              <InfoRow icon="☎" label="Téléphone">
                {c.phone ? (
                  <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="text-indigo-700 hover:underline">
                    {c.phone}
                  </a>
                ) : (
                  missing
                )}
              </InfoRow>
              <InfoRow icon="✉" label="Email">
                {c.email ? (
                  <a href={`mailto:${c.email}`} className="text-indigo-700 hover:underline">
                    {c.email}
                  </a>
                ) : (
                  missing
                )}
              </InfoRow>
              <InfoRow icon="🌐" label="Site web">
                {c.website ? (
                  <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline">
                    {host(c.website)} ↗
                  </a>
                ) : (
                  missing
                )}
              </InfoRow>
              <InfoRow icon="in" label="LinkedIn">
                <a
                  href={`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(c.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-700 hover:underline"
                >
                  Rechercher la page de l'entreprise ↗
                </a>
              </InfoRow>
            </div>
            {c.infoSource && (
              <p className="mt-2 text-[11px] text-zinc-500">
                Source des coordonnées :{" "}
                {c.infoSource.startsWith("http") ? (
                  <a href={c.infoSource} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {host(c.infoSource)}
                  </a>
                ) : (
                  c.infoSource
                )}
              </p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-semibold">Contacts</h2>
            <ContactList contacts={c.contacts} companyName={c.name} />
          </Card>
        </div>

        <Card className="self-start p-0">
          <h2 className="px-4 pt-4 font-semibold">
            Offres <span className="text-sm font-normal text-zinc-500">({c.offers.length})</span>
          </h2>
          {c.offers.length === 0 && <p className="p-4 text-sm text-zinc-500">Aucune offre de cette entreprise.</p>}
          <ul className="divide-y divide-zinc-100">
            {c.offers.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                {o.matches[0] ? <ScoreRing value={o.matches[0].globalPct} size={44} label={o.matches[0].cv.label} /> : <span className="w-11" />}
                <div className="min-w-0 flex-1">
                  <Link href={`/offers/${o.id}`} className="line-clamp-2 font-medium hover:underline">
                    {o.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {o.status === "CLOSED" && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-500">Fermée</span>}
                    {o.senior && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-500">Senior</span>}
                    {!o.devRole && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-700">Hors dev</span>}
                    {o.application && (
                      <span className="rounded px-1.5 py-0.5 text-white" style={{ background: STATUS_COLOR[o.application.status] }}>
                        {STATUS_LABEL[o.application.status]}
                      </span>
                    )}
                    {o.matches[0] && <span className="text-zinc-500">meilleur CV : {o.matches[0].cv.label.replace(/^CV\s+/, "")}</span>}
                  </div>
                </div>
                <OfferLink url={o.url} label="Annonce" />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
