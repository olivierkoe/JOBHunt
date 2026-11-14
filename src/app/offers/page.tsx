"use client";

import Link from "next/link";
import { useState } from "react";

import { api } from "~/trpc/react";
import { useCvColors } from "../_components/use-cv-colors";
import { Button, Card, Chip, CvDot, OfferLink, SOURCE_LABEL, inputCls, scoreColor } from "../_components/ui";

export default function OffersPage() {
  const utils = api.useUtils();
  const { cvs, color: cvColor } = useCvColors();
  const [cvSlug, setCvSlug] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [hideSenior, setHideSenior] = useState(true);
  const [hideNonDev, setHideNonDev] = useState(true);
  const [hideApplied, setHideApplied] = useState(false);
  const [search, setSearch] = useState("");
  const offers = api.offer.list.useQuery({
    cvSlug: cvSlug || undefined,
    minScore,
    hideSenior,
    hideNonDev,
    hideApplied,
    search: search || undefined,
  });
  const track = api.application.createFromOffer.useMutation({ onSuccess: () => utils.offer.invalidate() });
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-zinc-500">CV</span>
          <select className={inputCls} value={cvSlug} onChange={(e) => setCvSlug(e.target.value)}>
            <option value="">Meilleur CV par offre</option>
            {cvs.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-zinc-500">Score minimum : {minScore} %</span>
          <input type="range" min={0} max={100} step={5} value={minScore} onChange={(e) => setMinScore(+e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-zinc-500">Recherche</span>
          <input className={inputCls} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Entreprise ou poste" />
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={hideSenior} onChange={(e) => setHideSenior(e.target.checked)} /> Masquer les postes senior
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={hideNonDev} onChange={(e) => setHideNonDev(e.target.checked)} /> Masquer les postes hors développement
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={hideApplied} onChange={(e) => setHideApplied(e.target.checked)} /> Masquer les offres suivies
        </label>
        <Button variant="primary" className="ml-auto" onClick={() => setAdding((v) => !v)}>
          {adding ? "Fermer" : "Ajouter une offre"}
        </Button>
      </div>

      {adding && <AddOffer onDone={() => setAdding(false)} />}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr className="border-b border-zinc-200 bg-indigo-50/60">
              <th className="px-3 py-2 font-medium">Offre</th>
              <th className="px-3 py-2 font-medium">Stack demandée</th>
              <th className="px-3 py-2 font-medium">Compatibilité par CV</th>
              <th className="px-3 py-2 font-medium">Manque (meilleur CV)</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {offers.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                  Aucune offre. Lance la veille depuis le tableau de bord ou ajoute une offre.
                </td>
              </tr>
            )}
            {offers.data?.map((o) => {
              const shown = cvSlug ? o.matches.find((m) => m.cv.slug === cvSlug) : o.matches[0];
              return (
                <tr key={o.id} className="border-b border-zinc-100 align-top hover:bg-indigo-50/30">
                  <td className="px-3 py-2">
                    <Link href={`/offers/${o.id}`} className="font-medium hover:underline">
                      {o.company}
                    </Link>
                    <div className="line-clamp-2 max-w-md text-xs text-zinc-500" title={o.title}>
                      {o.title}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                      <span className="max-w-60 truncate rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600" title={o.location}>
                        📍 {o.location || "lieu non précisé"}
                      </span>
                      <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700">{SOURCE_LABEL[o.source]}</span>
                      {!o.devRole && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-700">Hors dev</span>}
                    </div>
                    <OfferLink url={o.url} className="mt-1.5" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {o.skills.map((s) => (
                        <Chip key={s} tone="indigo">{s}</Chip>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="w-80 space-y-1.5">
                      {o.matches.map((m) => (
                        <div key={m.cv.id} className="grid grid-cols-[1fr_5rem_2.5rem] items-center gap-2 text-xs" title={`${m.cv.label} : ${m.globalPct} %`}>
                          <span className={`flex min-w-0 items-center gap-1.5 ${m.cv.slug === shown?.cv.slug ? "font-semibold" : "text-zinc-500"}`}>
                            <CvDot color={cvColor(m.cv.id)} />
                            <span className="truncate">{m.cv.label.replace(/^CV\s+/, "")}</span>
                          </span>
                          <span className="h-1.5 rounded-full bg-zinc-100">
                            <span className="block h-full rounded-full" style={{ width: `${m.globalPct}%`, background: scoreColor(m.globalPct) }} />
                          </span>
                          <span className="text-right font-semibold tabular-nums">{m.globalPct} %</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {shown?.missing.length ? shown.missing.map((s) => <Chip key={s} tone="rose">{s}</Chip>) : <Chip tone="emerald">rien</Chip>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {o.application ? (
                      <Link href="/board" className="text-xs text-zinc-500 hover:underline">
                        Suivie
                      </Link>
                    ) : (
                      <Button onClick={() => track.mutate({ offerId: o.id })} disabled={track.isPending}>
                        Suivre
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AddOffer({ onDone }: { onDone: () => void }) {
  const utils = api.useUtils();
  const [f, setF] = useState({ url: "", company: "", title: "", location: "", description: "" });
  const create = api.offer.create.useMutation({
    onSuccess: () => {
      void utils.offer.invalidate();
      onDone();
    },
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((v) => ({ ...v, [k]: e.target.value }));
  return (
    <Card>
      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(f);
        }}
      >
        <input className={inputCls} required placeholder="Lien de l'offre (https://…)" value={f.url} onChange={set("url")} />
        <input className={inputCls} required placeholder="Entreprise" value={f.company} onChange={set("company")} />
        <input className={inputCls} required placeholder="Intitulé du poste" value={f.title} onChange={set("title")} />
        <input className={inputCls} placeholder="Lieu / zone (Remote EU…)" value={f.location} onChange={set("location")} />
        <textarea
          className={`${inputCls} md:col-span-2`}
          rows={8}
          placeholder="Colle le texte de l'annonce : la stack, l'expérience et la zone sont détectées automatiquement."
          value={f.description}
          onChange={set("description")}
        />
        <div className="flex items-center gap-3 md:col-span-2">
          <Button variant="primary" type="submit" disabled={create.isPending}>
            Ajouter et calculer la compatibilité
          </Button>
          {create.error && <span className="text-sm text-rose-600">{create.error.message}</span>}
        </div>
      </form>
    </Card>
  );
}
