"use client";

import Link from "next/link";
import { useState } from "react";

import { api } from "~/trpc/react";
import { useCvColors } from "./_components/use-cv-colors";
import {
  BarList,
  Button,
  Card,
  ColumnLabels,
  Columns,
  CvDot,
  Donut,
  SCORE_TONE,
  ScoreRing,
  STATUS_COLOR,
  STATUS_LABEL,
  StatTile,
  fmtDate,
} from "./_components/ui";

type Status = keyof typeof STATUS_LABEL;

export default function Dashboard() {
  const utils = api.useUtils();
  const due = api.application.dueFollowUps.useQuery();
  const board = api.application.board.useQuery();
  const stats = api.offer.stats.useQuery();
  const offers = api.offer.list.useQuery({ hideApplied: true, minScore: 75, take: 8 });
  const runs = api.watch.runs.useQuery();
  const runNow = api.watch.runNow.useMutation({ onSuccess: () => utils.invalidate() });
  const sent = api.application.markFollowUpSent.useMutation({ onSuccess: () => utils.application.invalidate() });
  const { cvs, color } = useCvColors();
  const [copied, setCopied] = useState<string | null>(null);

  const count = (s: Status) => board.data?.filter((a) => a.status === s).length ?? 0;
  const sentApps = count("APPLIED") + count("INTERVIEW") + count("OFFER") + count("REJECTED");
  const interviewRate = sentApps ? Math.round(((count("INTERVIEW") + count("OFFER")) / sentApps) * 100) : null;
  const lastRun = runs.data?.[0];
  const bins = stats.data?.bins;
  const scoreData = [
    { key: "low", label: "< 40 %", value: bins?.low ?? 0, color: SCORE_TONE.critical },
    { key: "mid", label: "40–54 %", value: bins?.mid ?? 0, color: SCORE_TONE.serious },
    { key: "good", label: "55–74 %", value: bins?.good ?? 0, color: SCORE_TONE.warning },
    { key: "top", label: "≥ 75 %", value: bins?.top ?? 0, color: SCORE_TONE.good },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-zinc-500">
            {lastRun
              ? `Dernière veille le ${fmtDate(lastRun.startedAt)} : ${lastRun.inserted} nouvelle(s) offre(s) sur ${lastRun.scanned} scannée(s), ${lastRun.fundingInserted} levée(s) de fonds${lastRun.errors.length ? ` · ${lastRun.errors.length} source(s) en erreur` : ""}`
              : "Aucune veille lancée pour l'instant."}
          </p>
        </div>
        <Button variant="primary" onClick={() => runNow.mutate()} disabled={runNow.isPending}>
          {runNow.isPending ? "Veille en cours…" : "🔎 Lancer la veille"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Offres suivies" value={stats.data?.total ?? "…"} hint={`${bins?.top ?? 0} à 75 % ou plus`} color="#4f46e5" icon="📋" />
        <StatTile label="Candidatures envoyées" value={sentApps} hint={`${count("TO_APPLY")} en préparation`} color={STATUS_COLOR.APPLIED} icon="📨" />
        <StatTile
          label="Taux d'entretien"
          value={interviewRate == null ? "—" : `${interviewRate} %`}
          hint={`${count("INTERVIEW") + count("OFFER")} entretien(s) ou offre(s)`}
          color={STATUS_COLOR.INTERVIEW}
          icon="🤝"
        />
        <StatTile label="Relances à faire" value={due.data?.length ?? "…"} hint="sans réponse depuis le délai" color={SCORE_TONE.critical} icon="⏰" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="mb-4 font-semibold">Candidatures par statut</h2>
          <Donut
            centerLabel="candidatures"
            empty="Aucune candidature : clique sur « Suivre » sur une offre."
            data={(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ key: s, label: STATUS_LABEL[s], value: count(s), color: STATUS_COLOR[s] }))}
          />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Offres par CV le mieux placé</h2>
          <Donut
            centerLabel="offres"
            data={cvs.map((c) => ({ key: c.id, label: c.label.replace(/^CV\s+/, ""), value: stats.data?.byCv[c.id] ?? 0, color: color(c.id) }))}
          />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Répartition des scores</h2>
          <Columns data={scoreData} />
          <ColumnLabels data={scoreData} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card>
          <h2 className="mb-1 font-semibold">Compétences qui manquent le plus</h2>
          <p className="mb-4 text-xs text-zinc-500">Nombre d'offres où ton meilleur CV ne les couvre pas</p>
          {stats.data?.topMissing.length ? (
            <BarList data={stats.data.topMissing} color="#4f46e5" />
          ) : (
            <p className="text-sm text-zinc-500">Rien ne manque, bravo.</p>
          )}
        </Card>

        <Card className="p-0">
          <h2 className="px-4 pt-4 font-semibold">Meilleures offres non traitées</h2>
          <p className="px-4 pb-2 text-xs text-zinc-500">Les plus récentes à 75 % ou plus</p>
          {offers.data?.length === 0 && <p className="p-4 text-sm text-zinc-500">Rien pour l'instant.</p>}
          <div className="divide-y divide-zinc-100">
            {offers.data?.map((o) => (
              <Link key={o.id} href={`/offers/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50/50">
                {o.matches[0] && <ScoreRing value={o.matches[0].globalPct} size={40} label={o.matches[0].cv.label} />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{o.company}</span>
                  <span className="block truncate text-xs text-zinc-500">{o.title}</span>
                </span>
                {o.matches[0] && (
                  <span className="flex items-center gap-1.5 text-xs text-zinc-600">
                    <CvDot color={color(o.matches[0].cv.id)} />
                    {o.matches[0].cv.label.replace(/^CV\s+/, "")}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">Relances à faire</h2>
        {due.data?.length === 0 && <p className="text-sm text-zinc-500">Aucune relance due. 🎉</p>}
        <div className="space-y-3">
          {due.data?.map((a) => (
            <Card key={a.id} className="border-l-4" style={{ borderLeftColor: STATUS_COLOR[a.status] }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{a.offer.company}</span> — {a.offer.title}
                  <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">sans réponse depuis {a.days} jours</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      void navigator.clipboard.writeText(`${a.message.subject}\n\n${a.message.body}`);
                      setCopied(a.id);
                    }}
                  >
                    {copied === a.id ? "Copié ✓" : "Copier le message"}
                  </Button>
                  <Button variant="primary" onClick={() => sent.mutate({ id: a.id })} disabled={sent.isPending}>
                    Relance envoyée
                  </Button>
                </div>
              </div>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-zinc-50 p-2 text-xs text-zinc-700">{a.message.body}</pre>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
