/**
 * Score de compatibilité CV × offre.
 * Globale = 60 % stack couverte + 20 % expérience + 20 % zone / langue, divisée par deux hors développement.
 */
export type CvInput = { skills: string[]; yearsExperience: number };
export type OfferInput = {
  skills: string[];
  minYears: number | null;
  eligibleFromFrance: boolean;
  otherLanguage: string | null;
  /** false pour un poste hors développement (assistant, commercial…) ; absent = poste de dev */
  devRole?: boolean;
};
export type MatchResult = {
  stackPct: number;
  globalPct: number;
  covered: string[];
  missing: string[];
  experienceFit: number;
  zoneFit: number;
};

export const WEIGHTS = { stack: 0.6, experience: 0.2, zone: 0.2 } as const;

/**
 * En dessous de ce nombre de compétences détectées, l'annonce en dit trop peu pour juger la stack :
 * chaque compétence manquante jusqu'à ce seuil compte comme inconnue (50 %).
 * Sans ça, une annonce où seul « Python » est détecté donnerait 100 % à n'importe quel CV Python.
 */
export const MIN_SKILLS_FOR_FULL_CONFIDENCE = 3;

/** Un poste hors développement qui cite un langage (« Office Assistant… PHP ») ne doit pas remonter en tête. */
export const NON_DEV_ROLE_FACTOR = 0.5;

export function stackFit(covered: number, total: number): number {
  const unknown = Math.max(0, MIN_SKILLS_FOR_FULL_CONFIDENCE - total);
  return (covered + 0.5 * unknown) / (total + unknown);
}

export function experienceFit(minYears: number | null, years: number): number {
  if (minYears == null || years >= minYears) return 1;
  return minYears - years <= 2 ? 0.5 : 0;
}

export function zoneFit(offer: Pick<OfferInput, "eligibleFromFrance" | "otherLanguage">): number {
  return offer.eligibleFromFrance && !offer.otherLanguage ? 1 : 0;
}

export function scoreMatch(cv: CvInput, offer: OfferInput): MatchResult {
  const have = new Set(cv.skills);
  const covered = offer.skills.filter((s) => have.has(s));
  const missing = offer.skills.filter((s) => !have.has(s));
  // Offre sans compétence détectée : stack neutre (50 %) ; peu de compétences : score tiré vers 50 %.
  const stack = stackFit(covered.length, offer.skills.length);
  const exp = experienceFit(offer.minYears, cv.yearsExperience);
  const zone = zoneFit(offer);
  const global =
    (WEIGHTS.stack * stack + WEIGHTS.experience * exp + WEIGHTS.zone * zone) * (offer.devRole === false ? NON_DEV_ROLE_FACTOR : 1);
  return {
    stackPct: Math.round(stack * 100),
    globalPct: Math.round(global * 100),
    covered,
    missing,
    experienceFit: exp,
    zoneFit: zone,
  };
}

/** Le CV le mieux placé pour une offre (meilleur score global, puis meilleure stack). */
export function bestCv<T extends CvInput & { id: string }>(cvs: T[], offer: OfferInput) {
  return cvs
    .map((cv) => ({ cv, result: scoreMatch(cv, offer) }))
    .sort((a, b) => b.result.globalPct - a.result.globalPct || b.result.stackPct - a.result.stackPct)[0];
}
