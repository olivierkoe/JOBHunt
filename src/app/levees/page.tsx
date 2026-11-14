"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button, Card, Chip, OfferLink, fmtDate } from "../_components/ui";

type Round = RouterOutputs["funding"]["list"][number];
type Status = Round["status"];

const STATUS: Record<Status, { label: string; tone: string }> = {
  NEW: { label: "Nouvelle", tone: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  TO_CONTACT: { label: "À contacter", tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  CONTACTED: { label: "Contactée", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  IGNORED: { label: "Ignorée", tone: "bg-zinc-100 text-zinc-600 ring-zinc-300" },
};
const FILTERS: { value: Status | undefined; label: string }[] = [
  { value: undefined, label: "À traiter" },
  { value: "NEW", label: "Nouvelles" },
  { value: "TO_CONTACT", label: "À contacter" },
  { value: "CONTACTED", label: "Contactées" },
  { value: "IGNORED", label: "Ignorées" },
];
const SCOPES = [
  { value: "all", label: "France + Europe" },
  { value: "france", label: "France" },
  { value: "europe", label: "Europe (hors France)" },
] as const;

export default function FundingPage() {
  const [status, setStatus] = useState<Status | undefined>(undefined);
  const [scope, setScope] = useState<(typeof SCOPES)[number]["value"]>("all");
  const rounds = api.funding.list.useQuery({ status, scope });
  const counts = api.funding.counts.useQuery();
  const utils = api.useUtils();
  const runNow = api.watch.runNow.useMutation({ onSuccess: () => utils.invalidate() });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Levées de fonds</h1>
          <p className="max-w-2xl text-sm text-zinc-500">
            Startups tech qui viennent de lever en pre-seed, seed ou série A (Maddyness, EU-Startups). Elles recrutent souvent avant de publier
            leurs offres : écris directement au CTO ou à un fondateur.
          </p>
        </div>
        <Button variant="primary" onClick={() => runNow.mutate()} disabled={runNow.isPending}>
          {runNow.isPending ? "Veille en cours…" : "🔎 Lancer la veille"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setStatus(f.value)}
            className={`rounded-full px-3 py-1 text-sm ${status === f.value ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
          >
            {f.label}
            {f.value && counts.data?.[f.value] ? <span className="ml-1.5 tabular-nums opacity-80">{counts.data[f.value]}</span> : null}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-zinc-300" />
        {SCOPES.map((s) => (
          <button
            key={s.value}
            onClick={() => setScope(s.value)}
            className={`rounded-full px-3 py-1 text-sm ${scope === s.value ? "bg-violet-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {rounds.data?.length === 0 && (
        <Card>
          <p className="text-sm text-zinc-500">Aucune levée ici. Lance la veille pour récupérer les dernières levées de fonds.</p>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {rounds.data?.map((r) => (
          <RoundCard key={r.id} round={r} />
        ))}
      </div>
    </div>
  );
}

function RoundCard({ round: r }: { round: Round }) {
  const utils = api.useUtils();
  const router = useRouter();
  const [showMessage, setShowMessage] = useState(false);
  const [copied, setCopied] = useState(false);
  const refresh = () => void utils.funding.invalidate();
  const setStatus = api.funding.setStatus.useMutation({ onSuccess: refresh });
  const createCompany = api.funding.createCompany.useMutation({
    onSuccess: ({ key }) => {
      refresh();
      router.push(`/entreprises/${encodeURIComponent(key)}`);
    },
  });
  const linkedin = (q: string) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{r.company}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${STATUS[r.status].tone}`}>{STATUS[r.status].label}</span>
          </div>
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 line-clamp-2 text-sm text-zinc-600 hover:underline">
            {r.title}
          </a>
        </div>
        {r.amountLabel && (
          <span className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">{r.amountLabel}</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {r.stage && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-violet-700">{r.stage}</span>}
        {r.country && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">📍 {r.country}</span>}
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">{r.source === "MADDYNESS" ? "Maddyness" : "EU-Startups"}</span>
        <span className="text-zinc-500">{fmtDate(r.publishedAt)}</span>
        {r.tags.map((t) => (
          <Chip key={t} tone="indigo">
            {t}
          </Chip>
        ))}
      </div>
      {r.summary && <p className="line-clamp-3 text-sm text-zinc-600">{r.summary}</p>}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <a href={linkedin(`CTO ${r.company}`)} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline">
          Trouver le CTO ↗
        </a>
        <a href={linkedin(`founder ${r.company}`)} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline">
          Fondateurs ↗
        </a>
        <OfferLink url={r.url} label="Article" />
        {r.companyKey ? (
          <Link href={`/entreprises/${encodeURIComponent(r.companyKey)}`} className="font-medium text-indigo-700 hover:underline">
            Fiche entreprise →
          </Link>
        ) : (
          <button onClick={() => createCompany.mutate({ id: r.id })} disabled={createCompany.isPending} className="font-medium text-indigo-700 hover:underline">
            + Créer la fiche entreprise
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
        <Button variant={showMessage ? "primary" : "secondary"} onClick={() => setShowMessage((v) => !v)}>
          ✉ Message au CTO
        </Button>
        {r.status !== "TO_CONTACT" && <Button onClick={() => setStatus.mutate({ id: r.id, status: "TO_CONTACT" })}>À contacter</Button>}
        {r.status !== "CONTACTED" && <Button onClick={() => setStatus.mutate({ id: r.id, status: "CONTACTED" })}>Contactée ✓</Button>}
        {r.status !== "IGNORED" ? (
          <Button variant="ghost" onClick={() => setStatus.mutate({ id: r.id, status: "IGNORED" })}>
            Ignorer
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => setStatus.mutate({ id: r.id, status: "NEW" })}>
            Restaurer
          </Button>
        )}
      </div>

      {showMessage && (
        <div className="space-y-2 rounded-lg bg-zinc-50 p-3">
          <div className="text-xs text-zinc-500">
            Objet : <span className="text-zinc-800">{r.message.subject}</span>
          </div>
          <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-800">{r.message.body}</pre>
          <Button
            onClick={() => {
              void navigator.clipboard.writeText(`${r.message.subject}\n\n${r.message.body}`);
              setCopied(true);
            }}
          >
            {copied ? "Copié ✓" : "Copier le message"}
          </Button>
        </div>
      )}
    </Card>
  );
}
