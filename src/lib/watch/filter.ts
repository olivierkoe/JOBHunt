import { detectMinYears, detectSkills, isDevRole, isSenior, normalize } from "../skills";
import type { RawOffer } from "./sources";

/** Stacks recherchées par la veille : une offre doit mentionner au moins une de ces compétences. */
export const STACKS = {
  "PHP/Symfony": ["PHP", "Symfony"],
  "Node/NestJS/React/Angular": ["Node.js", "NestJS", "React", "Angular"],
} as const satisfies Record<string, readonly string[]>;
export type Stack = keyof typeof STACKS;

export const STACK_SKILLS: string[] = Object.values(STACKS).flat();

/** Stacks dont l'offre mentionne au moins une compétence. */
export function stacksOf(skills: string[]): Stack[] {
  return (Object.keys(STACKS) as Stack[]).filter((s) => STACKS[s].some((k) => skills.includes(k)));
}

export type WatchConfig = {
  /** Au moins une de ces compétences doit être détectée */
  wantedSkills: string[];
  excludeSenior: boolean;
};

const GEO_OK = /\b(eu|europe|emea|cet|cest|france|worldwide|anywhere|global|gmt\+[0-2])\b|remote \(eu/;
const GEO_KO = /us only|usa only|remote \(us\)|us[- ]based only|must be (located|based) in the (us|united states)|uk only/;
/** Lieu limité à une région hors Europe ("USA", "Americas", "LATAM"…), sans mention EU / worldwide. */
const REGION_KO = /\b(us|usa|united states|americas?|north america|latam|latin america|canada|apac|asia|australia|india|brazil|mexico)\b/;
const OTHER_LANG = /(german|deutsch|allemand|dutch|polish|spanish|portuguese|hungarian)\s*(is\s*)?(required|mandatory|fluent|native|c1)/;

export type EnrichedOffer = RawOffer & {
  skills: string[];
  minYears: number | null;
  senior: boolean;
  eligibleFromFrance: boolean;
  otherLanguage: string | null;
  devRole: boolean;
};

/** Agrégateurs d'offres françaises : beaucoup de postes sur site, contrairement aux boards remote. */
const FR_SOURCES = new Set<RawOffer["source"]>(["FRANCE_TRAVAIL", "GOOGLE_JOBS", "ADZUNA", "JOOBLE"]);
/** Télétravail complet (texte normalisé, sans accents). "Télétravail partiel" ou "2 jours de remote" ne comptent pas. */
const FULL_REMOTE =
  /full[- ]?remote|fully remote|remote[- ]first|100\s*%\s*(en\s*)?(remote|teletravail|a distance)|teletravail\s*(total|complet|integral|a 100)|\(teletravail\)|^\s*(remote|teletravail)\s*$/;

export function isFullRemote(text: string): boolean {
  return FULL_REMOTE.test(normalize(text));
}

/**
 * @param zone termes de lieu acceptés pour les postes sur site / hybrides ("montpellier", "34"…),
 *             utilisés seulement pour les agrégateurs français. Vide : télétravail complet uniquement.
 */
export function enrich(o: RawOffer, zone: string[] = []): EnrichedOffer {
  const text = `${o.title} ${o.location} ${o.description}`;
  const t = normalize(text);
  const loc = normalize(o.location);
  const inZone = zone.some((z) => new RegExp(`\\b${normalize(z).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(loc));
  const minYears = detectMinYears(text, o.title);
  const lang = OTHER_LANG.exec(t)?.[1] ?? null;
  return {
    ...o,
    skills: detectSkills(text),
    minYears,
    senior: isSenior(o.title, minYears),
    // HN mélange sur site et remote : on exige une mention remote/Europe. Les autres sources sont des boards remote.
    // Agrégateurs français : télétravail complet, ou poste dans la zone choisie.
    eligibleFromFrance: FR_SOURCES.has(o.source)
      ? FULL_REMOTE.test(t) || FULL_REMOTE.test(loc) || inZone
      : !GEO_KO.test(t) &&
        !(REGION_KO.test(loc) && !GEO_OK.test(loc)) &&
        (o.source !== "HACKER_NEWS" || GEO_OK.test(t) || /\bremote\b/.test(t)),
    otherLanguage: lang,
    // Les intitulés HN sont souvent "Société | Ville | REMOTE" : le métier est dans le début de l'annonce.
    devRole: isDevRole(o.title, o.source === "HACKER_NEWS" ? o.description.slice(0, 300) : ""),
  };
}

/** Garde les offres compatibles : poste de dev, stack voulue, zone ouverte depuis la France, non senior si demandé. */
export function keep(o: EnrichedOffer, cfg: WatchConfig): boolean {
  if (!o.devRole) return false;
  if (!o.eligibleFromFrance) return false;
  if (cfg.excludeSenior && o.senior) return false;
  return o.skills.some((s) => cfg.wantedSkills.includes(s));
}
