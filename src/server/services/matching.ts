import { scoreMatch } from "~/lib/matching";
import type { Db } from "~/server/db";

type OfferRow = {
  id: string;
  skills: string[];
  minYears: number | null;
  eligibleFromFrance: boolean;
  otherLanguage: string | null;
  devRole: boolean;
};

/** Recalcule les scores d'une liste d'offres contre tous les CV (upsert). */
export async function recomputeMatches(db: Db, offers?: OfferRow[]) {
  const cvs = await db.cv.findMany();
  const list =
    offers ??
    (await db.offer.findMany({
      select: { id: true, skills: true, minYears: true, eligibleFromFrance: true, otherLanguage: true, devRole: true },
    }));
  for (const offer of list) {
    for (const cv of cvs) {
      const r = scoreMatch(cv, offer);
      const data = {
        stackPct: r.stackPct,
        globalPct: r.globalPct,
        covered: r.covered,
        missing: r.missing,
      };
      await db.match.upsert({
        where: { offerId_cvId: { offerId: offer.id, cvId: cv.id } },
        create: { offerId: offer.id, cvId: cv.id, ...data },
        update: data,
      });
    }
  }
  return { offers: list.length, cvs: cvs.length };
}
