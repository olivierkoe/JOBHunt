import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "~/env";
import { outreachMessage } from "~/lib/outreach";
import { companyKey } from "~/lib/skills";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

const status = z.enum(["NEW", "TO_CONTACT", "CONTACTED", "IGNORED"]);

export const fundingRouter = createTRPCRouter({
  /** Levées repérées par la veille, avec le message prêt pour le CTO (en français pour une startup française). */
  list: publicProcedure
    .input(z.object({ status: status.optional(), scope: z.enum(["all", "france", "europe"]).default("all") }))
    .query(async ({ ctx, input }) => {
      const rounds = await ctx.db.fundingRound.findMany({
        where: {
          ...(input.status ? { status: input.status } : { status: { not: "IGNORED" } }),
          ...(input.scope === "france" ? { country: "France" } : input.scope === "europe" ? { NOT: { country: "France" } } : {}),
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 200,
      });
      const keys = new Set((await ctx.db.company.findMany({ select: { key: true } })).map((c) => c.key));
      return rounds.map((r) => ({
        ...r,
        companyKey: keys.has(companyKey(r.company)) ? companyKey(r.company) : null,
        message: outreachMessage({
          company: r.company,
          amountLabel: r.amountLabel,
          stage: r.stage,
          lang: r.country === "France" ? "fr" : "en",
          candidate: env.CANDIDATE_NAME,
          portfolio: env.PORTFOLIO_URL,
        }),
      }));
    }),

  counts: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.fundingRound.groupBy({ by: ["status"], _count: true });
    return Object.fromEntries(rows.map((r) => [r.status, r._count])) as Partial<Record<z.infer<typeof status>, number>>;
  }),

  setStatus: publicProcedure
    .input(z.object({ id: z.string(), status, notes: z.string().max(2000).nullable().optional() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.fundingRound.update({ where: { id }, data });
    }),

  /** Crée la fiche entreprise de la startup, pour y noter ses contacts et suivre ses offres. */
  createCompany: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const r = await ctx.db.fundingRound.findUnique({ where: { id: input.id } });
    if (!r) throw new TRPCError({ code: "NOT_FOUND" });
    const key = companyKey(r.company);
    const note = `Levée${r.stage ? ` ${r.stage}` : ""}${r.amountLabel ? ` de ${r.amountLabel}` : ""} (${r.url})`;
    await ctx.db.company.upsert({
      where: { key },
      create: { key, name: r.company, country: r.country, note, infoSource: r.url },
      update: {},
    });
    if (r.status === "NEW") await ctx.db.fundingRound.update({ where: { id: r.id }, data: { status: "TO_CONTACT" } });
    return { key };
  }),
});
