import type { CSSProperties, ReactNode } from "react";

export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`rounded-xl border border-zinc-200 bg-surface p-4 shadow-lg shadow-black/20 ${className}`} style={style}>
      {children}
    </div>
  );
}

/** Seuils partagés par le badge, la jauge et la répartition des scores. */
export const SCORE_TONE = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export function scoreColor(value: number) {
  return value >= 75 ? SCORE_TONE.good : value >= 55 ? SCORE_TONE.warning : value >= 40 ? SCORE_TONE.serious : SCORE_TONE.critical;
}

export function ScoreBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-xs text-zinc-400">—</span>;
  const tone =
    value >= 75 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : value >= 55 ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-rose-50 text-rose-700 ring-rose-200";
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: scoreColor(value) }} />
      {value} %
    </span>
  );
}

/** Jauge circulaire d'un score sur 100. */
export function ScoreRing({ value, size = 56, label }: { value: number; size?: number; label?: string }) {
  const stroke = Math.max(4, size / 9);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? "Score"} : ${value} %`}>
      <title>{`${label ?? "Score"} : ${value} %`}</title>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-zinc-100" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={scoreColor(value)}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(c * value) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size / 4} fontWeight={600} className="fill-zinc-900">
        {value}
      </text>
    </svg>
  );
}

export type Slice = { key: string; label: string; value: number; color: string };

/** Camembert (anneau) : part de chaque catégorie, total au centre, légende avec valeurs. */
export function Donut({ data, size = 160, centerLabel, empty = "Aucune donnée" }: { data: Slice[]; size?: number; centerLabel: string; empty?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const stroke = size / 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = data.filter((d) => d.value > 0);
  // 2px d'espace entre les parts (sauf s'il n'y en a qu'une)
  const gap = shown.length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={centerLabel}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="stroke-zinc-100" strokeWidth={stroke} />
        {shown.map((d) => {
          const len = (d.value / total) * c;
          const seg = (
            <circle
              key={d.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(len - gap, 0.5)} ${c}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className="transition-opacity hover:opacity-80"
            >
              <title>{`${d.label} : ${d.value} (${Math.round((d.value / total) * 100)} %)`}</title>
            </circle>
          );
          offset += len;
          return seg;
        })}
        <text x="50%" y="46%" dominantBaseline="central" textAnchor="middle" fontSize={size / 5} fontWeight={700} className="fill-zinc-900">
          {total}
        </text>
        <text x="50%" y="62%" dominantBaseline="central" textAnchor="middle" fontSize={11} className="fill-zinc-500">
          {centerLabel}
        </text>
      </svg>
      {total === 0 ? (
        <p className="text-sm text-zinc-500">{empty}</p>
      ) : (
        <ul className="min-w-36 flex-1 space-y-1.5 text-sm">
          {data.map((d) => (
            <li key={d.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
              <span className="flex-1 text-zinc-700">{d.label}</span>
              <span className="font-semibold tabular-nums">{d.value}</span>
              <span className="w-10 text-right text-xs tabular-nums text-zinc-500">{Math.round((d.value / total) * 100)} %</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Barres verticales, une couleur par barre, valeur au-dessus. */
export function Columns({ data, height = 140 }: { data: Slice[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-3 border-b border-zinc-300" style={{ height: height + 24 }}>
      {data.map((d) => (
        <div key={d.key} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.label} : ${d.value}`}>
          <span className="text-sm font-semibold tabular-nums">{d.value}</span>
          <div className="w-full max-w-14 rounded-t" style={{ height: Math.max((d.value / max) * height, d.value ? 4 : 0), background: d.color }} />
        </div>
      ))}
    </div>
  );
}

export function ColumnLabels({ data }: { data: Slice[] }) {
  return (
    <div className="mt-1.5 flex gap-3">
      {data.map((d) => (
        <span key={d.key} className="flex-1 text-center text-xs text-zinc-500">
          {d.label}
        </span>
      ))}
    </div>
  );
}

/** Barres horizontales d'une seule série (classement). */
export function BarList({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[8rem_1fr_2rem] items-center gap-2 text-sm">
          <span className="truncate text-zinc-700" title={d.label}>
            {d.label}
          </span>
          <span className="h-2.5 rounded-full bg-zinc-100">
            <span className="block h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </span>
          <span className="text-right font-semibold tabular-nums">{d.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function StatTile({ label, value, hint, color, icon }: { label: string; value: ReactNode; hint?: string; color: string; icon: ReactNode }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
          <div className="mt-1 text-3xl font-bold">{value}</div>
          {hint && <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>}
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-lg text-lg" style={{ background: `${color}1f`, color }}>
          {icon}
        </span>
      </div>
    </Card>
  );
}

export function Chip({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "rose" | "emerald" | "indigo" }) {
  const c = {
    zinc: "bg-zinc-100 text-zinc-700",
    rose: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    indigo: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${c}`}>{children}</span>;
}

export function Button({
  children,
  variant = "secondary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  const v = {
    primary: "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm hover:from-indigo-500 hover:to-violet-500",
    secondary: "border border-zinc-300 bg-surface hover:bg-zinc-100",
    ghost: "hover:bg-zinc-100",
  }[variant];
  return (
    <button
      {...props}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${v} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-zinc-50 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400";

export const STATUS_LABEL = {
  TO_APPLY: "À postuler",
  APPLIED: "Postulé",
  INTERVIEW: "Entretien",
  OFFER: "Offre reçue",
  REJECTED: "Refus",
  ARCHIVED: "Archivé",
} as const;

/**
 * Une couleur fixe par statut, pour fond sombre. L'ordre évite de mettre côte à côte
 * deux teintes confondues par les daltoniens (jaune/orange, jaune/rouge) ; « Archivé » reste neutre.
 */
export const STATUS_COLOR = {
  TO_APPLY: "#c98500",
  APPLIED: "#3987e5",
  INTERVIEW: "#d95926",
  OFFER: "#199e70",
  REJECTED: "#e66767",
  ARCHIVED: "#55555f",
} as const;

/** Couleurs des CV, dans l'ordre de création ; au-delà de 3 CV, gris. */
const CV_COLORS = ["#9085e9", "#008300", "#d55181"];
export const cvColor = (index: number) => CV_COLORS[index] ?? "#70707e";

export function CvDot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />;
}

/** Lien vers la publication d'origine de l'offre (nouvel onglet). */
export function OfferLink({ url, label = "Voir l'annonce", className = "" }: { url: string; label?: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-200/40 ${className}`}
    >
      {label} ↗
    </a>
  );
}

export const SOURCE_LABEL = {
  MANUAL: "Ajout manuel",
  REDDIT: "Reddit",
  HACKER_NEWS: "Hacker News",
  REMOTEOK: "RemoteOK",
  REMOTIVE: "Remotive",
} as const;

export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(d)) : "—";
