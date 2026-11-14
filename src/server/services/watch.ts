import { env } from "~/env";
import { enrichRound, FUNDING_SOURCES, keepRound, type RawRound } from "~/lib/watch/funding";
import { enrich, keep, type WatchConfig } from "~/lib/watch/filter";
import { defaultFetcher, SOURCES, type Fetcher, type RawOffer } from "~/lib/watch/sources";
import type { Db } from "~/server/db";
import { recomputeMatches } from "./matching";
import { notify } from "./notify";

const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Levées de fonds : startups tech en pre-seed, seed ou série A, ajoutées si elles sont nouvelles. */
async function runFunding(db: Db, fetcher: Fetcher) {
  const jobs: [string, () => Promise<RawRound[]>][] = [
    ["maddyness", () => FUNDING_SOURCES.maddyness(fetcher)],
    ["euStartups", () => FUNDING_SOURCES.euStartups(fetcher)],
  ];
  const settled = await Promise.allSettled(jobs.map(([, fn]) => fn()));
  const errors: string[] = [];
  const raw: RawRound[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") raw.push(...r.value);
    else errors.push(`${jobs[i]?.[0]}: ${message(r.reason)}`);
  });
  const kept = raw.map(enrichRound).filter(keepRound);
  const known = new Set((await db.fundingRound.findMany({ where: { url: { in: kept.map((r) => r.url) } }, select: { url: true } })).map((r) => r.url));
  const fresh = kept.filter((r) => !known.has(r.url));
  if (fresh.length) await db.fundingRound.createMany({ data: fresh, skipDuplicates: true });
  return { scanned: raw.length, inserted: fresh, errors };
}

/** Lance la veille : collecte, filtre, insère les nouvelles offres, calcule leurs scores. */
export async function runWatch(db: Db, fetcher: Fetcher = defaultFetcher) {
  const run = await db.watchRun.create({ data: {} });
  const cvs = await db.cv.findMany({ select: { skills: true } });
  const cfg: WatchConfig = {
    wantedSkills: [...new Set(cvs.flatMap((c) => c.skills))],
    excludeSenior: true,
  };

  const jobs: [string, () => Promise<RawOffer[]>][] = [
    ["reddit", () => SOURCES.reddit(fetcher, list(env.WATCH_SUBREDDITS))],
    ["hackerNews", () => SOURCES.hackerNews(fetcher)],
    ["remoteOk", () => SOURCES.remoteOk(fetcher)],
    ["remotive", () => SOURCES.remotive(fetcher, list(env.WATCH_REMOTIVE_QUERIES))],
  ];
  const funding = runFunding(db, fetcher);
  const settled = await Promise.allSettled(jobs.map(([, fn]) => fn()));
  const errors: string[] = [];
  const raw: RawOffer[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") raw.push(...r.value);
    else errors.push(`${jobs[i]?.[0]}: ${message(r.reason)}`);
  });

  const kept = raw.map(enrich).filter((o) => keep(o, cfg));
  const existing = new Set(
    (
      await db.offer.findMany({
        where: { externalId: { in: kept.map((o) => o.externalId) } },
        select: { source: true, externalId: true },
      })
    ).map((o) => `${o.source}:${o.externalId}`),
  );
  const fresh = [...new Map(kept.map((o) => [`${o.source}:${o.externalId}`, o])).values()].filter(
    (o) => !existing.has(`${o.source}:${o.externalId}`),
  );

  const created = await db.$transaction(
    fresh.map((o) =>
      db.offer.create({
        data: {
          source: o.source,
          externalId: o.externalId,
          url: o.url,
          company: o.company,
          title: o.title,
          location: o.location,
          description: o.description,
          skills: o.skills,
          minYears: o.minYears,
          senior: o.senior,
          eligibleFromFrance: o.eligibleFromFrance,
          otherLanguage: o.otherLanguage,
          devRole: o.devRole,
          postedAt: o.postedAt,
        },
        select: { id: true, skills: true, minYears: true, eligibleFromFrance: true, otherLanguage: true, devRole: true, title: true, company: true, url: true },
      }),
    ),
  );
  await recomputeMatches(db, created);
  const rounds = await funding;
  errors.push(...rounds.errors);

  await db.watchRun.update({
    where: { id: run.id },
    data: { finishedAt: new Date(), scanned: raw.length, inserted: created.length, fundingInserted: rounds.inserted.length, errors },
  });
  if (created.length) {
    await notify(
      `${created.length} nouvelle(s) offre(s)`,
      created.slice(0, 10).map((o) => `${o.company} — ${o.title}\n${o.url}`).join("\n\n"),
    );
  }
  if (rounds.inserted.length) {
    await notify(
      `${rounds.inserted.length} startup(s) qui vien(nen)t de lever`,
      rounds.inserted.slice(0, 10).map((r) => `${r.company}${r.amountLabel ? ` — ${r.amountLabel}` : ""}\n${r.url}`).join("\n\n"),
    );
  }
  return { scanned: raw.length, kept: kept.length, inserted: created.length, fundingInserted: rounds.inserted.length, errors };
}
