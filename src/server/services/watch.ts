import { env } from "~/env";
import { enrichRound, FUNDING_SOURCES, keepRound, type RawRound } from "~/lib/watch/funding";
import { enrich, keep, STACK_SKILLS, STACKS, stacksOf, type Stack, type WatchConfig } from "~/lib/watch/filter";
import { companyKey, normalize } from "~/lib/skills";
import { AGGREGATORS, type AggregatorConfig } from "~/lib/watch/aggregators";
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

/** Au-delà, une offre de la veille sans candidature est supprimée (et n'est plus collectée). */
export const OFFER_MAX_AGE_DAYS = 7;

const cutoffDate = (now: Date) => new Date(now.getTime() - OFFER_MAX_AGE_DAYS * 86_400_000);

/**
 * Supprime les offres de la veille de plus d'une semaine (date de publication, sinon date d'ajout)
 * sans candidature. Les offres ajoutées à la main sont conservées.
 */
export async function purgeStaleOffers(db: Db, now = new Date()) {
  const cutoff = cutoffDate(now);
  const { count } = await db.offer.deleteMany({
    where: {
      source: { not: "MANUAL" },
      application: { is: null },
      OR: [{ postedAt: { lt: cutoff } }, { postedAt: null, createdAt: { lt: cutoff } }],
    },
  });
  return count;
}

/** Lance la veille : purge les offres périmées, collecte, filtre, insère les nouvelles offres, calcule leurs scores. */
export async function runWatch(db: Db, fetcher: Fetcher = defaultFetcher) {
  const run = await db.watchRun.create({ data: {} });
  const now = new Date();
  const purged = await purgeStaleOffers(db, now);
  const cutoff = cutoffDate(now);
  const cfg: WatchConfig = { wantedSkills: STACK_SKILLS, excludeSenior: true };
  const redditCreds =
    env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET
      ? { clientId: env.REDDIT_CLIENT_ID, clientSecret: env.REDDIT_CLIENT_SECRET }
      : undefined;

  const jobs: [string, () => Promise<RawOffer[]>][] = [
    ["reddit", () => SOURCES.reddit(fetcher, list(env.WATCH_SUBREDDITS), list(env.WATCH_REDDIT_QUERIES), redditCreds)],
    ["hackerNews", () => SOURCES.hackerNews(fetcher)],
    ["remoteOk", () => SOURCES.remoteOk(fetcher)],
    ["remotive", () => SOURCES.remotive(fetcher, list(env.WATCH_REMOTIVE_QUERIES))],
  ];
  // Agrégateurs (LinkedIn, Indeed, WTTJ… repris par Google Jobs, France Travail, Adzuna, Jooble) :
  // seulement ceux dont la clé est configurée.
  const zone = list(env.WATCH_ZONE);
  const agg: AggregatorConfig = {
    keywords: list(env.WATCH_KEYWORDS),
    stackQueries: list(env.WATCH_STACK_QUERIES),
    zone: zone[0],
    departements: env.WATCH_FT_DEPARTEMENTS,
  };
  if (env.FRANCE_TRAVAIL_CLIENT_ID && env.FRANCE_TRAVAIL_CLIENT_SECRET) {
    const creds = { clientId: env.FRANCE_TRAVAIL_CLIENT_ID, clientSecret: env.FRANCE_TRAVAIL_CLIENT_SECRET };
    jobs.push(["franceTravail", () => AGGREGATORS.franceTravail(fetcher, agg, creds)]);
  }
  if (env.SERPAPI_API_KEY) {
    const key = env.SERPAPI_API_KEY;
    jobs.push(["googleJobs", () => AGGREGATORS.googleJobs(fetcher, agg, key)]);
  }
  if (env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY) {
    const creds = { appId: env.ADZUNA_APP_ID, appKey: env.ADZUNA_APP_KEY };
    jobs.push(["adzuna", () => AGGREGATORS.adzuna(fetcher, agg, creds)]);
  }
  if (env.JOOBLE_API_KEY) {
    const key = env.JOOBLE_API_KEY;
    jobs.push(["jooble", () => AGGREGATORS.jooble(fetcher, agg, key)]);
  }
  const funding = runFunding(db, fetcher);
  const settled = await Promise.allSettled(jobs.map(([, fn]) => fn()));
  const errors: string[] = [];
  const raw: RawOffer[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") raw.push(...r.value);
    else errors.push(`${jobs[i]?.[0]}: ${message(r.reason)}`);
  });

  // Une offre déjà périmée serait supprimée à la prochaine veille : on ne l'insère pas.
  const kept = raw.map((o) => enrich(o, zone)).filter((o) => keep(o, cfg) && !(o.postedAt && o.postedAt < cutoff));
  const known = await db.offer.findMany({
    where: { OR: [{ externalId: { in: kept.map((o) => o.externalId) } }, { createdAt: { gte: cutoff } }] },
    select: { source: true, externalId: true, company: true, title: true },
  });
  const existing = new Set(known.map((o) => `${o.source}:${o.externalId}`));
  // Une même offre arrive souvent par plusieurs agrégateurs : on rapproche aussi par entreprise + intitulé.
  const sameJob = (o: { company: string; title: string }) => `${companyKey(o.company)}|${normalize(o.title).trim()}`;
  const seenJobs = new Set(known.map(sameJob));
  const fresh = [...new Map(kept.map((o) => [`${o.source}:${o.externalId}`, o])).values()].filter((o) => {
    if (existing.has(`${o.source}:${o.externalId}`)) return false;
    // Les posts Reddit ont tous "r/<sub>" pour entreprise : pas de rapprochement par intitulé pour eux.
    if (o.source === "REDDIT") return true;
    const key = sameJob(o);
    if (seenJobs.has(key)) return false;
    seenJobs.add(key);
    return true;
  });

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
    const perStack = (Object.keys(STACKS) as Stack[])
      .map((s) => [s, created.filter((o) => stacksOf(o.skills).includes(s)).length] as const)
      .filter(([, n]) => n > 0)
      .map(([s, n]) => `${s} : ${n}`)
      .join(", ");
    await notify(
      `${created.length} nouvelle(s) offre(s) (${perStack})`,
      created
        .slice(0, 10)
        .map((o) => `[${stacksOf(o.skills).join(" + ")}] ${o.company} — ${o.title}\n${o.url}`)
        .join("\n\n"),
    );
  }
  if (rounds.inserted.length) {
    await notify(
      `${rounds.inserted.length} startup(s) qui vien(nen)t de lever`,
      rounds.inserted.slice(0, 10).map((r) => `${r.company}${r.amountLabel ? ` — ${r.amountLabel}` : ""}\n${r.url}`).join("\n\n"),
    );
  }
  return { scanned: raw.length, kept: kept.length, inserted: created.length, purged, fundingInserted: rounds.inserted.length, errors };
}
