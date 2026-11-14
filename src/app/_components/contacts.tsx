"use client";

import Link from "next/link";

import { api, type RouterOutputs } from "~/trpc/react";
import { Card } from "./ui";

type Contact = NonNullable<RouterOutputs["company"]["byName"]>["contacts"][number];

/** Couleur d'un rôle : direction, technique, RH / recrutement, canal de candidature. */
function roleTone(role: string) {
  const r = role.toLowerCase();
  if (/candidature/.test(r)) return "bg-indigo-50 text-indigo-700 ring-indigo-200";
  if (/rh|recrut/.test(r)) return "bg-rose-50 text-rose-700 ring-rose-200";
  if (/cto|tech/.test(r)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

export const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** Liste des contacts publics d'une entreprise (dirigeants, RH, tech, canaux de candidature). */
export function ContactList({ contacts, companyName }: { contacts: Contact[]; companyName: string }) {
  if (contacts.length === 0) return <p className="text-sm text-zinc-500">Aucun contact public trouvé.</p>;
  return (
    <ul className="space-y-2.5">
      {contacts.map((p) => (
        <li key={p.id} className="text-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${roleTone(p.role)}`}>{p.role}</span>
            {p.name && <span className="font-medium">{p.name}</span>}
            {!p.verified && (
              <span className="text-[11px] text-zinc-500" title="Une seule source, ou source tierce : à confirmer">
                · à vérifier
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {p.email && (
              <a href={`mailto:${p.email}`} className="text-indigo-700 hover:underline">
                ✉ {p.email}
              </a>
            )}
            {p.url && (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline">
                {host(p.url)} ↗
              </a>
            )}
            {p.name && (
              <a
                href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${p.name} ${companyName}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-700 hover:underline"
              >
                LinkedIn ↗
              </a>
            )}
            {p.source?.startsWith("http") ? (
              <a href={p.source} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:underline">
                source : {host(p.source)}
              </a>
            ) : (
              p.source && <span className="text-zinc-500">source : {p.source}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Carte « Contacts » affichée à côté d'une offre, avec un lien vers la fiche complète de l'entreprise. */
export function CompanyContacts({ company }: { company: string }) {
  const info = api.company.byName.useQuery({ name: company });
  if (info.isLoading) return null;
  const c = info.data;

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Contacts</h2>
        {c && (
          <Link href={`/entreprises/${encodeURIComponent(c.key)}`} className="text-xs font-medium text-indigo-700 hover:underline">
            Fiche entreprise →
          </Link>
        )}
      </div>
      {!c && <p className="text-sm text-zinc-500">Pas encore de recherche pour cette entreprise.</p>}
      {c?.note && <p className="mb-3 rounded-lg bg-zinc-100 p-2 text-xs text-zinc-700">{c.note}</p>}
      {c && <ContactList contacts={c.contacts} companyName={c.name} />}
    </Card>
  );
}
