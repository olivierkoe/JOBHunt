"use client";

import { useState } from "react";

import { api, type RouterOutputs } from "~/trpc/react";
import { Button, Card, cvColor, inputCls } from "../_components/ui";

type Cv = RouterOutputs["cv"]["list"][number];

export default function CvsPage() {
  const cvs = api.cv.list.useQuery();
  const [creating, setCreating] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-600">
          Colle le texte de chaque CV : les compétences sont détectées et toutes les offres sont recalculées à l'enregistrement.
        </p>
        <Button variant="primary" onClick={() => setCreating((v) => !v)}>
          {creating ? "Fermer" : "Ajouter un CV"}
        </Button>
      </div>
      {creating && <CvForm onDone={() => setCreating(false)} />}
      {cvs.data?.map((cv, i) => (
        <CvForm key={cv.id} cv={cv} color={cvColor(i)} />
      ))}
    </div>
  );
}

function CvForm({ cv, color = "#4f46e5", onDone }: { cv?: Cv; color?: string; onDone?: () => void }) {
  const utils = api.useUtils();
  const [f, setF] = useState({
    slug: cv?.slug ?? "",
    label: cv?.label ?? "",
    text: cv?.text ?? "",
    yearsExperience: cv?.yearsExperience ?? 0,
  });
  const save = api.cv.upsert.useMutation({
    onSuccess: () => {
      void utils.invalidate();
      onDone?.();
    },
  });
  return (
    <Card className="border-t-4" style={{ borderTopColor: color }}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(f);
        }}
      >
        <div className="grid gap-3 md:grid-cols-[1fr_160px_160px]">
          <input className={inputCls} required placeholder="Nom (CV Fullstack Node / React)" value={f.label} onChange={(e) => setF((v) => ({ ...v, label: e.target.value }))} />
          <input
            className={inputCls}
            required
            disabled={Boolean(cv)}
            placeholder="identifiant (node)"
            value={f.slug}
            onChange={(e) => setF((v) => ({ ...v, slug: e.target.value.toLowerCase() }))}
          />
          <label className="flex items-center gap-2 text-sm">
            Années
            <input
              type="number"
              step={0.5}
              min={0}
              max={40}
              className={inputCls}
              value={f.yearsExperience}
              onChange={(e) => setF((v) => ({ ...v, yearsExperience: +e.target.value }))}
            />
          </label>
        </div>
        <textarea rows={6} className={inputCls} required placeholder="Texte du CV" value={f.text} onChange={(e) => setF((v) => ({ ...v, text: e.target.value }))} />
        {cv && (
          <div className="flex flex-wrap gap-1">
            {cv.skills.map((s) => (
              <span key={s} className="inline-block rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: `${color}1a`, color }}>
                {s}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <Button variant="primary" type="submit" disabled={save.isPending}>
            {save.isPending ? "Recalcul…" : "Enregistrer"}
          </Button>
          {save.error && <span className="text-sm text-rose-600">{save.error.message}</span>}
        </div>
      </form>
    </Card>
  );
}
