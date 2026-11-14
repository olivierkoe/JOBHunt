import { detectMinYears, detectSkills, isDevRole, isSenior, normalize } from "../skills";
import type { RawOffer } from "./sources";

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

export function enrich(o: RawOffer): EnrichedOffer {
  const text = `${o.title} ${o.location} ${o.description}`;
  const t = normalize(text);
  const loc = normalize(o.location);
  const minYears = detectMinYears(text, o.title);
  const lang = OTHER_LANG.exec(t)?.[1] ?? null;
  return {
    ...o,
    skills: detectSkills(text),
    minYears,
    senior: isSenior(o.title, minYears),
    // HN mélange sur site et remote : on exige une mention remote/Europe. Les autres sources sont des boards remote.
    eligibleFromFrance:
      !GEO_KO.test(t) &&
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
