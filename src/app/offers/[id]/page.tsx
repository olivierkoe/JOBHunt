"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { SKILLS, companyKey } from "~/lib/skills";
import { api } from "~/trpc/react";
import { CompanyContacts } from "../../_components/contacts";
import { useCvColors } from "../../_components/use-cv-colors";
import { Button, Card, Chip, CvDot, OfferLink, ScoreRing, SOURCE_LABEL, inputCls } from "../../_components/ui";

export default function OfferPage() {
  const { id } = useParams<{ id: string }>();
  const utils = api.useUtils();
  const offer = api.offer.byId.useQuery({ id });
  const update = api.offer.update.useMutation({ onSuccess: () => utils.offer.invalidate() });
  const track = api.application.createFromOffer.useMutation({ onSuccess: () => utils.offer.invalidate() });
  const [editing, setEditing] = useState(false);
  const { color: cvColor } = useCvColors();

  if (offer.isLoading) return <p className="text-sm text-zinc-500">Chargement…</p>;
  if (!offer.data) return <p className="text-sm text-rose-600">Offre introuvable.</p>;
  const o = offer.data;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div>
          <Link href="/offers" className="text-xs text-zinc-500 hover:underline">
            ← Offres
          </Link>
          <h1 className="mt-1 text-xl font-semibold">
            <Link href={`/entreprises/${encodeURIComponent(companyKey(o.company))}`} className="hover:underline" title="Fiche de l'entreprise">
              {o.company}
            </Link>{" "}
            — {o.title}
          </h1>
          <p className="text-sm text-zinc-500">
            {o.location || "Lieu non précisé"} · {SOURCE_LABEL[o.source]}
          </p>
          <OfferLink url={o.url} label={`Voir l'annonce sur ${SOURCE_LABEL[o.source] === "Ajout manuel" ? new URL(o.url).hostname.replace(/^www\./, "") : SOURCE_LABEL[o.source]}`} className="mt-2 px-3 py-1.5 text-sm" />
        </div>
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Ce que l'annonce demande</h2>
            <Button variant="ghost" onClick={() => setEditing((v) => !v)}>
              {editing ? "Fermer" : "Corriger"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {o.skills.length ? o.skills.map((s) => <Chip key={s} tone="indigo">{s}</Chip>) : <span className="text-sm text-zinc-500">Aucune compétence détectée.</span>}
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            Expérience : {o.minYears == null ? "non précisée" : `${o.minYears} an(s) minimum`}
            {o.senior && " · poste senior"}
            {!o.devRole && " · poste hors développement (score divisé par deux)"} · Zone : {o.eligibleFromFrance ? "ouverte depuis la France" : "non couverte"}
            {o.otherLanguage && ` · ${o.otherLanguage} requis`}
          </p>
          {editing && (
            <EditOffer
              initial={o}
              onSave={(data) => update.mutate({ id: o.id, ...data }, { onSuccess: () => setEditing(false) })}
              pending={update.isPending}
            />
          )}
        </Card>
        {o.description && (
          <Card>
            <h2 className="mb-2 font-medium">Annonce</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{o.description}</p>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <h2 className="mb-3 font-medium">Compatibilité par CV</h2>
          <div className="space-y-4">
            {o.matches.map((m) => (
              <div key={m.cv.id}>
                <div className="flex items-center gap-3">
                  <ScoreRing value={m.globalPct} size={56} label={m.cv.label} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <CvDot color={cvColor(m.cv.id)} />
                      {m.cv.label}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                      stack
                      <span className="h-1.5 flex-1 rounded-full bg-zinc-100">
                        <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${m.stackPct}%` }} />
                      </span>
                      <span className="tabular-nums">{m.stackPct} %</span>
                    </div>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {m.covered.map((s) => (
                    <Chip key={s} tone="emerald">{s}</Chip>
                  ))}
                  {m.missing.map((s) => (
                    <Chip key={s} tone="rose">{s}</Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <CompanyContacts company={o.company} />
        {o.application ? (
          <Link href="/board" className="block text-center text-sm text-zinc-600 underline">
            Offre suivie dans les candidatures
          </Link>
        ) : (
          <div className="space-y-2">
            {o.matches.map((m) => (
              <Button key={m.cv.id} className="w-full" variant={m === o.matches[0] ? "primary" : "secondary"} onClick={() => track.mutate({ offerId: o.id, cvId: m.cv.id })} disabled={track.isPending}>
                Suivre avec le {m.cv.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type EditData = { skills: string[]; minYears: number | null; eligibleFromFrance: boolean; otherLanguage: string | null; devRole: boolean };

function EditOffer({ initial, onSave, pending }: { initial: EditData; onSave: (d: EditData) => void; pending: boolean }) {
  const [d, setD] = useState<EditData>({
    skills: initial.skills,
    minYears: initial.minYears,
    eligibleFromFrance: initial.eligibleFromFrance,
    otherLanguage: initial.otherLanguage,
    devRole: initial.devRole,
  });
  const toggle = (s: string) =>
    setD((v) => ({ ...v, skills: v.skills.includes(s) ? v.skills.filter((x) => x !== s) : [...v.skills, s] }));
  return (
    <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
      <div className="flex flex-wrap gap-1">
        {Object.keys(SKILLS).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            className={`rounded px-1.5 py-0.5 text-xs ${d.skills.includes(s) ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"}`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          Années demandées
          <input
            type="number"
            min={0}
            max={30}
            className={`${inputCls} w-20`}
            value={d.minYears ?? ""}
            onChange={(e) => setD((v) => ({ ...v, minYears: e.target.value === "" ? null : +e.target.value }))}
          />
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={d.eligibleFromFrance} onChange={(e) => setD((v) => ({ ...v, eligibleFromFrance: e.target.checked }))} />
          Ouverte depuis la France
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={d.devRole} onChange={(e) => setD((v) => ({ ...v, devRole: e.target.checked }))} />
          Poste de développement
        </label>
        <label className="flex items-center gap-2">
          Autre langue requise
          <input className={`${inputCls} w-32`} value={d.otherLanguage ?? ""} onChange={(e) => setD((v) => ({ ...v, otherLanguage: e.target.value || null }))} />
        </label>
      </div>
      <Button variant="primary" onClick={() => onSave(d)} disabled={pending}>
        Enregistrer et recalculer
      </Button>
    </div>
  );
}
