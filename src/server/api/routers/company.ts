import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { companyKey } from "~/lib/skills";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

/** Les offres ne sont pas liées à Company par une clé étrangère : on les rapproche par le nom normalisé. */
const offerSelect = {
  id: true,
  company: true,
  title: true,
  url: true,
  status: true,
  senior: true,
  devRole: true,
  createdAt: true,
  application: { select: { status: true } },
  matches: { select: { globalPct: true, cv: { select: { id: true, label: true } } }, orderBy: { globalPct: "desc" as const }, take: 1 },
};

export const companyRouter = createTRPCRouter({
  /** Toutes les entreprises qui ont une fiche, avec leur nombre d'offres et leur meilleur score. */
  list: publicProcedure.query(async ({ ctx }) => {
    const [companies, offers] = await Promise.all([
      ctx.db.company.findMany({ include: { _count: { select: { contacts: true } } }, orderBy: { name: "asc" } }),
      ctx.db.offer.findMany({ where: { status: { not: "CLOSED" } }, select: { company: true, matches: { select: { globalPct: true }, orderBy: { globalPct: "desc" }, take: 1 } } }),
    ]);
    const stats = new Map<string, { offers: number; best: number }>();
    for (const o of offers) {
      const s = stats.get(companyKey(o.company)) ?? { offers: 0, best: 0 };
      stats.set(companyKey(o.company), { offers: s.offers + 1, best: Math.max(s.best, o.matches[0]?.globalPct ?? 0) });
    }
    return companies.map(({ _count, ...c }) => ({ ...c, contacts: _count.contacts, offers: stats.get(c.key)?.offers ?? 0, best: stats.get(c.key)?.best ?? null }));
  }),

  /** Fiche complète : coordonnées, contacts et offres de l'entreprise. */
  byKey: publicProcedure.input(z.object({ key: z.string().max(200) })).query(async ({ ctx, input }) => {
    const company = await ctx.db.company.findUnique({
      where: { key: input.key },
      include: { contacts: { orderBy: [{ verified: "desc" }, { role: "asc" }] } },
    });
    if (!company) throw new TRPCError({ code: "NOT_FOUND" });
    const offers = (await ctx.db.offer.findMany({ select: offerSelect, orderBy: { createdAt: "desc" } })).filter(
      (o) => companyKey(o.company) === company.key,
    );
    return { ...company, offers };
  }),

  /** Fiche et contacts d'une entreprise, rapprochée par son nom. */
  byName: publicProcedure.input(z.object({ name: z.string().max(200) })).query(({ ctx, input }) =>
    ctx.db.company.findUnique({
      where: { key: companyKey(input.name) },
      include: { contacts: { orderBy: [{ verified: "desc" }, { role: "asc" }] } },
    }),
  ),
});
