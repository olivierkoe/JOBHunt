import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { enrich } from "~/lib/watch/filter";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { recomputeMatches } from "~/server/services/matching";

const offerSelect = {
  id: true,
  source: true,
  url: true,
  company: true,
  title: true,
  location: true,
  skills: true,
  minYears: true,
  senior: true,
  devRole: true,
  eligibleFromFrance: true,
  otherLanguage: true,
  status: true,
  postedAt: true,
  createdAt: true,
  application: { select: { id: true, status: true } },
  matches: {
    select: { globalPct: true, stackPct: true, missing: true, cv: { select: { id: true, slug: true, label: true } } },
    orderBy: { globalPct: "desc" as const },
  },
};

export const offerRouter = createTRPCRouter({
  list: publicProcedure
    .input(
      z.object({
        cvSlug: z.string().optional(),
        minScore: z.number().min(0).max(100).default(0),
        hideSenior: z.boolean().default(true),
        hideNonDev: z.boolean().default(true),
        hideApplied: z.boolean().default(false),
        status: z.enum(["OPEN", "UNVERIFIED", "CLOSED"]).optional(),
        search: z.string().max(100).optional(),
        take: z.number().min(1).max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const offers = await ctx.db.offer.findMany({
        where: {
          ...(input.hideSenior ? { senior: false } : {}),
          ...(input.hideNonDev ? { devRole: true } : {}),
          ...(input.hideApplied ? { application: null } : {}),
          ...(input.status ? { status: input.status } : { status: { not: "CLOSED" } }),
          ...(input.search
            ? {
                OR: [
                  { title: { contains: input.search, mode: "insensitive" } },
                  { company: { contains: input.search, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(input.cvSlug || input.minScore
            ? {
                matches: {
                  some: {
                    globalPct: { gte: input.minScore },
                    ...(input.cvSlug ? { cv: { slug: input.cvSlug } } : {}),
                  },
                },
              }
            : {}),
        },
        select: offerSelect,
        orderBy: { createdAt: "desc" },
        take: input.take,
      });
      const score = (o: (typeof offers)[number]) =>
        (input.cvSlug ? o.matches.find((m) => m.cv.slug === input.cvSlug) : o.matches[0])?.globalPct ?? 0;
      return offers.sort((a, b) => score(b) - score(a));
    }),

  /** Chiffres du tableau de bord : meilleur CV par offre, répartition des scores, compétences manquantes. */
  stats: publicProcedure.query(async ({ ctx }) => {
    const offers = await ctx.db.offer.findMany({
      where: { status: { not: "CLOSED" }, senior: false, devRole: true },
      select: {
        matches: { select: { globalPct: true, missing: true, cvId: true }, orderBy: { globalPct: "desc" }, take: 1 },
      },
    });
    const best = offers.flatMap((o) => o.matches);
    const byCv: Record<string, number> = {};
    const missing: Record<string, number> = {};
    const bins = { low: 0, mid: 0, good: 0, top: 0 };
    for (const m of best) {
      byCv[m.cvId] = (byCv[m.cvId] ?? 0) + 1;
      for (const s of m.missing) missing[s] = (missing[s] ?? 0) + 1;
      if (m.globalPct >= 75) bins.top++;
      else if (m.globalPct >= 55) bins.good++;
      else if (m.globalPct >= 40) bins.mid++;
      else bins.low++;
    }
    return {
      total: offers.length,
      byCv,
      bins,
      topMissing: Object.entries(missing)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    };
  }),

  byId: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const offer = await ctx.db.offer.findUnique({
      where: { id: input.id },
      select: { ...offerSelect, description: true, matches: { ...offerSelect.matches, select: { ...offerSelect.matches.select, covered: true } } },
    });
    if (!offer) throw new TRPCError({ code: "NOT_FOUND" });
    return offer;
  }),

  /** Ajout manuel : on colle l'annonce, la stack et l'expérience sont détectées. */
  create: publicProcedure
    .input(
      z.object({
        url: z.string().url(),
        company: z.string().min(1).max(120),
        title: z.string().min(1).max(200),
        location: z.string().max(200).default(""),
        description: z.string().max(50_000).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const e = enrich({ ...input, source: "REMOTIVE", externalId: input.url, postedAt: null });
      const offer = await ctx.db.offer.create({
        data: {
          ...input,
          source: "MANUAL",
          externalId: input.url,
          skills: e.skills,
          minYears: e.minYears,
          senior: e.senior,
          eligibleFromFrance: e.eligibleFromFrance,
          otherLanguage: e.otherLanguage,
          devRole: e.devRole,
        },
      });
      await recomputeMatches(ctx.db, [offer]);
      return offer;
    }),

  /** Correction manuelle de ce que la détection a mal lu. */
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        skills: z.array(z.string().max(60)).max(60).optional(),
        minYears: z.number().int().min(0).max(30).nullable().optional(),
        eligibleFromFrance: z.boolean().optional(),
        otherLanguage: z.string().max(40).nullable().optional(),
        devRole: z.boolean().optional(),
        status: z.enum(["OPEN", "UNVERIFIED", "CLOSED"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const offer = await ctx.db.offer.update({
        where: { id },
        data: { ...data, ...(data.minYears !== undefined ? { senior: (data.minYears ?? 0) >= 5 } : {}) },
      });
      await recomputeMatches(ctx.db, [offer]);
      return offer;
    }),

  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) =>
    ctx.db.offer.delete({ where: { id: input.id } }),
  ),
});
