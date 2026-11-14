/**
 * Données de départ : les 3 CV (prisma/cvs.json, exporté par le générateur de CV PDF) et les offres relevées le 14/11/2026.
 * Le texte des CV reste modifiable depuis la page /cvs ; relancer le seed le remplace par celui de cvs.json.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { scoreMatch } from "../src/lib/matching";
import { detectSkills } from "../src/lib/skills";
import { enrich } from "../src/lib/watch/filter";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

type SeedCv = { slug: string; label: string; yearsExperience: number; text: string };
const CVS = JSON.parse(readFileSync(new URL("./cvs.json", import.meta.url), "utf8")) as SeedCv[];

type SeedOffer = { url: string; company: string; title: string; location: string; description: string };

async function main() {
  const cvs = [];
  for (const c of CVS) {
    const data = { ...c, skills: detectSkills(c.text) };
    cvs.push(await db.cv.upsert({ where: { slug: c.slug }, create: data, update: data }));
  }
  const offers = JSON.parse(readFileSync(new URL("./seed-offers.json", import.meta.url), "utf8")) as SeedOffer[];
  for (const o of offers) {
    const e = enrich({ ...o, source: "REMOTIVE", externalId: o.url, postedAt: null });
    const offer = await db.offer.upsert({
      where: { source_externalId: { source: "MANUAL", externalId: o.url } },
      update: {},
      create: {
        ...o,
        source: "MANUAL",
        externalId: o.url,
        // Chaque offre de seed-offers.json a été vérifiée sur son site de publication
        status: "OPEN",
        skills: e.skills,
        minYears: e.minYears,
        senior: e.senior,
        eligibleFromFrance: e.eligibleFromFrance,
        otherLanguage: e.otherLanguage,
        devRole: e.devRole,
        language: /France|français|100 % remote/.test(o.location) && /Développeur/.test(o.title) ? "fr" : "en",
      },
    });
    for (const cv of cvs) {
      const r = scoreMatch(cv, offer);
      const m = { stackPct: r.stackPct, globalPct: r.globalPct, covered: r.covered, missing: r.missing };
      await db.match.upsert({
        where: { offerId_cvId: { offerId: offer.id, cvId: cv.id } },
        create: { offerId: offer.id, cvId: cv.id, ...m },
        update: m,
      });
    }
  }
  console.log(`Seed : ${cvs.length} CV, ${offers.length} offres`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void db.$disconnect());
