"use client";

import Link from "next/link";
import { useState } from "react";

import { api, type RouterOutputs } from "~/trpc/react";
import { CompanyContacts } from "../_components/contacts";
import { useCvColors } from "../_components/use-cv-colors";
import { Button, Card, CvDot, OfferLink, ScoreBadge, STATUS_COLOR, STATUS_LABEL, fmtDate, inputCls } from "../_components/ui";

type App = RouterOutputs["application"]["board"][number];
type Status = keyof typeof STATUS_LABEL;
const COLUMNS = Object.keys(STATUS_LABEL) as Status[];

export default function BoardPage() {
  const utils = api.useUtils();
  const board = api.application.board.useQuery();
  const move = api.application.move.useMutation({
    onMutate: async ({ id, status }) => {
      await utils.application.board.cancel();
      const prev = utils.application.board.getData();
      utils.application.board.setData(undefined, (d) => d?.map((a) => (a.id === id ? { ...a, status } : a)));
      return { prev };
    },
    onError: (_e, _v, ctx) => utils.application.board.setData(undefined, ctx?.prev),
    onSettled: () => utils.application.invalidate(),
  });
  const { color: cvColor } = useCvColors();
  const [dragId, setDragId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = board.data?.find((a) => a.id === openId);

  return (
    <div className="flex gap-4">
      <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {COLUMNS.map((col) => {
          const items = board.data?.filter((a) => a.status === col) ?? [];
          return (
            <div
              key={col}
              className="min-h-40 rounded-xl border-t-4 p-2"
              style={{ borderTopColor: STATUS_COLOR[col], background: `${STATUS_COLOR[col]}14` }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) move.mutate({ id: dragId, status: col, position: items.length });
                setDragId(null);
              }}
            >
              <div className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-zinc-800">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOR[col] }} />
                  {STATUS_LABEL[col]}
                </span>
                <span className="rounded-full px-2 text-xs tabular-nums text-white" style={{ background: STATUS_COLOR[col] }}>
                  {items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((a) => (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={() => setDragId(a.id)}
                    onClick={() => setOpenId(a.id)}
                    className={`cursor-grab rounded-lg border border-l-4 bg-surface p-2.5 text-sm shadow-sm transition-shadow hover:shadow-md ${
                      a.id === openId ? "ring-2 ring-indigo-400" : ""
                    } ${a.due ? "border-amber-400" : "border-zinc-200"}`}
                    style={{ borderLeftColor: STATUS_COLOR[a.status] }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-medium">{a.offer.company}</span>
                      <a
                        href={a.offer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Voir l'annonce"
                        aria-label="Voir l'annonce"
                        className="text-indigo-700 hover:text-indigo-500"
                      >
                        ↗
                      </a>
                    </div>
                    <div className="text-xs text-zinc-500">{a.offer.title}</div>
                    <div className="mt-1.5 flex items-center justify-between gap-1 text-xs">
                      <span className="flex min-w-0 items-center gap-1 text-zinc-600">
                        <CvDot color={cvColor(a.cv?.id)} />
                        <span className="truncate">{a.cv?.label.replace(/^CV\s+/, "") ?? "Pas de CV"}</span>
                      </span>
                      <ScoreBadge value={a.score} />
                    </div>
                    {a.due && <div className="mt-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">⏰ Relance à faire</div>}
                    {/* Alternative au glisser-déposer (mobile, clavier) */}
                    <select
                      aria-label="Changer le statut"
                      className="mt-2 w-full rounded border border-zinc-200 text-xs"
                      value={a.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => move.mutate({ id: a.id, status: e.target.value as Status })}
                    >
                      {COLUMNS.map((c) => (
                        <option key={c} value={c}>
                          {STATUS_LABEL[c]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {open && (
        <div className="w-80 shrink-0 space-y-4 self-start">
          <Detail key={open.id} app={open} onClose={() => setOpenId(null)} />
          <CompanyContacts company={open.offer.company} />
        </div>
      )}
    </div>
  );
}

function Detail({ app, onClose }: { app: App; onClose: () => void }) {
  const utils = api.useUtils();
  const cvs = api.cv.list.useQuery();
  const events = api.application.events.useQuery({ id: app.id });
  const update = api.application.update.useMutation({ onSuccess: () => utils.application.invalidate() });
  const del = api.application.delete.useMutation({
    onSuccess: () => {
      void utils.invalidate();
      onClose();
    },
  });
  const [f, setF] = useState({
    notes: app.notes ?? "",
    contactName: app.contactName ?? "",
    followUpAfterDays: app.followUpAfterDays,
    cvId: app.cv?.id ?? "",
  });

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/offers/${app.offer.id}`} className="font-medium hover:underline">
            {app.offer.company}
          </Link>
          <div className="text-xs text-zinc-500">{app.offer.title}</div>
          <OfferLink url={app.offer.url} className="mt-1.5" />
        </div>
        <button onClick={onClose} aria-label="Fermer" className="text-zinc-400 hover:text-zinc-700">
          ✕
        </button>
      </div>
      <div className="text-xs text-zinc-500">
        Postulé : {fmtDate(app.appliedAt)} · Dernier contact : {fmtDate(app.lastContactAt)} · Prochaine relance :{" "}
        {fmtDate(app.nextFollowUp)}
      </div>
      <label className="block text-xs text-zinc-500">
        CV envoyé
        <select className={inputCls} value={f.cvId} onChange={(e) => setF((v) => ({ ...v, cvId: e.target.value }))}>
          <option value="">—</option>
          {cvs.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-zinc-500">
        Contact
        <input className={inputCls} value={f.contactName} onChange={(e) => setF((v) => ({ ...v, contactName: e.target.value }))} />
      </label>
      <label className="block text-xs text-zinc-500">
        Relancer après (jours)
        <input
          type="number"
          min={1}
          max={60}
          className={inputCls}
          value={f.followUpAfterDays}
          onChange={(e) => setF((v) => ({ ...v, followUpAfterDays: +e.target.value }))}
        />
      </label>
      <label className="block text-xs text-zinc-500">
        Notes
        <textarea rows={5} className={inputCls} value={f.notes} onChange={(e) => setF((v) => ({ ...v, notes: e.target.value }))} />
      </label>
      <div className="flex gap-2">
        <Button
          variant="primary"
          disabled={update.isPending}
          onClick={() =>
            update.mutate({
              id: app.id,
              notes: f.notes || null,
              contactName: f.contactName || null,
              followUpAfterDays: f.followUpAfterDays,
              cvId: f.cvId || null,
            })
          }
        >
          Enregistrer
        </Button>
        <Button variant="ghost" onClick={() => confirm("Retirer cette candidature du suivi ?") && del.mutate({ id: app.id })}>
          Retirer
        </Button>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-zinc-600">Historique</div>
        <ul className="space-y-1 text-xs text-zinc-500">
          {events.data?.map((e) => (
            <li key={e.id}>
              {fmtDate(e.at)} ·{" "}
              {e.type === "STATUS_CHANGE"
                ? `${e.fromStatus ? STATUS_LABEL[e.fromStatus] : ""} → ${e.toStatus ? STATUS_LABEL[e.toStatus] : ""}`
                : { CREATED: "Ajoutée au suivi", NOTE: e.note ?? "Note", FOLLOW_UP_SENT: "Relance envoyée" }[e.type]}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
