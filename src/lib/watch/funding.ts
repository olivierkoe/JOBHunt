/**
 * Veille des levées de fonds (Maddyness pour la France, EU-Startups pour l'Europe).
 * Une startup qui vient de lever recrute, souvent avant de publier ses offres : on la repère tôt.
 * Le parsing et le filtre sont purs (testables sans réseau), le fetch est injecté.
 */
import { detectSkills, normalize } from "../skills";
import { stripHtml, type Fetcher } from "./sources";

export type RawRound = {
  source: "MADDYNESS" | "EU_STARTUPS";
  url: string;
  title: string;
  company: string;
  amount: number | null;
  amountLabel: string | null;
  stage: string | null;
  country: string | null;
  summary: string;
  publishedAt: Date | null;
};

export type Round = RawRound & { tags: string[] };

/** « Can AI predict…? Orakl Oncology » → « Orakl Oncology » ; « Agile Robots : le géant… » → « Agile Robots ». */
export function cleanCompany(s: string): string {
  return (s.split("?").pop() ?? s).split(/\s:\s/)[0]!.trim().slice(0, 80);
}

const tag = (item: string, name: string) => new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(item)?.[1];
const categories = (item: string) => [...item.matchAll(/<category>([\s\S]*?)<\/category>/g)].map((m) => stripHtml(m[1]));
const items = (xml: string) => xml.split("<item>").slice(1);

/** Montant en millions : « 3,7 millions d'euros », « €2.9 million », « 500 000 euros », « $12M ». */
export function parseAmount(text: string): { amount: number; label: string } | null {
  const m =
    /([€$£])\s?(\d+(?:[.,]\d+)?)\s*(million|billion|m\b|bn\b)/i.exec(text) ??
    /(\d+(?:[.,]\d+)?)\s*(millions?|milliards?|m)\s*(?:d['’]\s*euros|d['’]\s*dollars|de dollars|€|\$|euros)/i.exec(text) ??
    /(\d{1,3}(?:[\s ]\d{3})+)\s*(?:euros|€)/i.exec(text);
  if (!m) return null;
  if (m[1] === "€" || m[1] === "$" || m[1] === "£") {
    const n = Number(m[2]!.replace(",", "."));
    return { amount: /b/i.test(m[3]!) ? n * 1000 : n, label: m[0].trim() };
  }
  if (m[2] === undefined) return { amount: Number(m[1]!.replace(/[\s ]/g, "")) / 1e6, label: m[0].trim() };
  const n = Number(m[1]!.replace(",", "."));
  return { amount: /milliard/i.test(m[2]) ? n * 1000 : n, label: m[0].trim() };
}

export function parseStage(text: string): string | null {
  const t = normalize(text);
  if (/pre-?\s?seed|pre-amorcage/.test(t)) return "pre-seed";
  if (/\bseed\b|amorcage/.test(t)) return "seed";
  const s = /(?:series|serie)\s+([a-d])\b/.exec(t);
  return s ? `série ${s[1]!.toUpperCase()}` : null;
}

// ---------- Maddyness (flux général, filtré sur les levées) ----------
const FR_ROUND = /\b(l[eè]ve|l[eè]vent|boucle|bouclent|r[ée]alise|s[ée]curise|annonce)\b[^.]{0,80}?(millions?|milliards?|tour de table|lev[ée]e)/i;

export function parseMaddyness(xml: string): RawRound[] {
  return items(xml).flatMap((item) => {
    const title = stripHtml(tag(item, "title"));
    const url = stripHtml(tag(item, "link"));
    if (!url || !FR_ROUND.test(title)) return [];
    const verb = /\s+(l[eè]ve|l[eè]vent|boucle|bouclent|r[ée]alise|s[ée]curise|annonce)\b/i.exec(title);
    const amount = parseAmount(title);
    const date = tag(item, "pubDate");
    return [
      {
        source: "MADDYNESS" as const,
        url,
        title,
        company: cleanCompany(verb ? title.slice(0, verb.index) : title),
        amount: amount?.amount ?? null,
        amountLabel: amount?.label ?? null,
        stage: parseStage(title),
        country: "France",
        summary: "",
        publishedAt: date ? new Date(date) : null,
      },
    ];
  });
}

// ---------- EU-Startups (catégorie Funding) ----------
const EN_VERB = /\s+(raises|secures|lands|closes|bags|nabs|extends|snaps up|grabs|picks up|gets)\b/i;

export function parseEuStartups(xml: string): RawRound[] {
  return items(xml).flatMap((item) => {
    const title = stripHtml(tag(item, "title"));
    const url = stripHtml(tag(item, "link"));
    const verb = EN_VERB.exec(title);
    if (!url || !verb || /round-?up/i.test(title)) return [];
    const cats = categories(item);
    const summary = stripHtml(tag(item, "description")).replace(/The post .* appeared first on .*$/i, "").slice(0, 600);
    // « Germany's NeuralSat », « Czech startup ValkaAI », « Paris-based Foo » → nom de la startup
    const company = cleanCompany(title.slice(0, verb.index))
      .replace(/^.*['’]s\s+/, "")
      .replace(/^.*\bstartup\s+/i, "")
      .replace(/^[\w-]+-based\s+/i, "")
      .trim();
    const country = cats.find((c) => /-Startups$/.test(c))?.replace(/-Startups$/, "") ?? null;
    const amount = parseAmount(title) ?? parseAmount(summary);
    const date = tag(item, "pubDate");
    return [
      {
        source: "EU_STARTUPS" as const,
        url,
        title,
        company: company.slice(0, 80),
        amount: amount?.amount ?? null,
        amountLabel: amount?.label ?? null,
        stage: parseStage(`${title} ${summary} ${cats.join(" ")}`),
        country,
        summary,
        publishedAt: date ? new Date(date) : null,
      },
    ];
  });
}

// ---------- Filtre ----------
const TECH = /saas|software|logiciel|plateforme|platform|\bapp\b|application|\bapi\b|\bia\b|\bai\b|intelligence artificielle|\bdata\b|donnees|cyber|securit|fintech|insurtech|legaltech|healthtech|edtech|proptech|cloud|developer|developpeu|b2b|automation|automatis|marketplace|\bllm\b|agent/i;
/** Stades et montants où une startup recrute ses premiers développeurs, et où une candidature directe a sa chance. */
const EARLY = new Set(["pre-seed", "seed", "série A"]);
export const MAX_AMOUNT = 25;

export function enrichRound(r: RawRound): Round {
  const text = normalize(`${r.title} ${r.summary}`);
  const tags = [
    ...(TECH.exec(text)?.[0] ? [TECH.exec(text)![0].toUpperCase()] : []),
    ...detectSkills(`${r.title} ${r.summary}`),
  ];
  return { ...r, tags: [...new Set(tags)] };
}

/** Garde les startups tech, au stade où elles recrutent leurs premiers devs. */
export function keepRound(r: Round): boolean {
  if (r.tags.length === 0) return false;
  if (r.stage) return EARLY.has(r.stage);
  return r.amount == null || r.amount <= MAX_AMOUNT;
}

// ---------- Fetch ----------
export const FUNDING_SOURCES = {
  maddyness: async (f: Fetcher) => {
    const res = await f("https://www.maddyness.com/feed/");
    if (!res.ok) throw new Error(`${res.status} maddyness`);
    return parseMaddyness(await res.text());
  },
  euStartups: async (f: Fetcher) => {
    const res = await f("https://www.eu-startups.com/category/fundin/feed/");
    if (!res.ok) throw new Error(`${res.status} eu-startups`);
    return parseEuStartups(await res.text());
  },
};
