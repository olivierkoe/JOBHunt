import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { env } from "~/env";
import { daysSince, followUpMessage, isDue, nextFollowUp } from "~/lib/reminders";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const STATUSES = ["TO_APPLY", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "ARCHIVED"] as const;
const status = z.enum(STATUSES);

const boardSelect = {
  id: true,
  status: true,
  position: true,
  appliedAt: true,
  lastContactAt: true,
  followUpAfterDays: true,
  contactName: true,
  notes: true,
  cv: { select: { id: true, label: true, slug: true } },
  offer: {
    select: {
      id: true,
      company: true,
      title: true,
      url: true,
      language: true,
      matches: { select: { globalPct: true, cvId: true } },
    },
  },
};

export const applicationRouter = createTRPCRouter({
  board: publicProcedure.query(async ({ ctx }) => {
    const apps = await ctx.db.application.findMany({
      select: boardSelect,
      orderBy: [{ status: "asc" }, { position: "asc" }, { updatedAt: "desc" }],
    });
    const now = new Date();
    return apps.map((a) => ({
      ...a,
      score: a.offer.matches.find((m) => m.cvId === a.cv?.id)?.globalPct ?? null,
      nextFollowUp: nextFollowUp(a),
      due: isDue(a, now),
    }));
  }),

  /** Ajoute une offre au tableau ; par défaut avec le CV le mieux noté pour cette offre. */
  createFromOffer: publicProcedure
    .input(z.object({ offerId: z.string(), cvId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const best = await ctx.db.match.findFirst({
        where: { offerId: input.offerId },
        orderBy: { globalPct: "desc" },
        select: { cvId: true },
      });
      const app = await ctx.db.application.create({
        data: {
          offerId: input.offerId,
          cvId: input.cvId ?? best?.cvId ?? null,
          events: { create: { type: "CREATED", toStatus: "TO_APPLY" } },
        },
      });
      return app;
    }),

  /** Déplacement dans le kanban : change le statut, journalise, date la candidature. */
  move: publicProcedure
    .input(z.object({ id: z.string(), status, position: z.number().int().min(0).default(0) }))
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.db.application.findUnique({ where: { id: input.id } });
      if (!current) throw new TRPCError({ code: "NOT_FOUND" });
      const changed = current.status !== input.status;
      return ctx.db.application.update({
        where: { id: input.id },
        data: {
          status: input.status,
          position: input.position,
          ...(input.status === "APPLIED" && !current.appliedAt ? { appliedAt: new Date() } : {}),
          ...(changed && input.status === "INTERVIEW" ? { lastContactAt: new Date() } : {}),
          ...(changed
            ? { events: { create: { type: "STATUS_CHANGE", fromStatus: current.status, toStatus: input.status } } }
            : {}),
        },
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        cvId: z.string().nullable().optional(),
        notes: z.string().max(10_000).nullable().optional(),
        contactName: z.string().max(120).nullable().optional(),
        contactEmail: z.string().email().nullable().optional(),
        followUpAfterDays: z.number().int().min(1).max(60).optional(),
        appliedAt: z.date().nullable().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.application.update({ where: { id }, data });
    }),

  events: publicProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) =>
    ctx.db.applicationEvent.findMany({ where: { applicationId: input.id }, orderBy: { at: "desc" } }),
  ),

  /** Relances dues, avec le message prêt à copier. */
  dueFollowUps: publicProcedure.query(async ({ ctx }) => {
    const apps = await ctx.db.application.findMany({
      where: { status: { in: ["APPLIED", "INTERVIEW"] } },
      select: { ...boardSelect, contactEmail: true },
    });
    const now = new Date();
    return apps
      .filter((a) => isDue(a, now))
      .map((a) => {
        const days = daysSince(a.lastContactAt ?? a.appliedAt, now) ?? 0;
        return {
          ...a,
          days,
          message: followUpMessage({
            company: a.offer.company,
            title: a.offer.title,
            contactName: a.contactName,
            lang: a.offer.language === "fr" ? "fr" : "en",
            days,
            candidate: env.CANDIDATE_NAME,
          }),
        };
      })
      .sort((a, b) => b.days - a.days);
  }),

  markFollowUpSent: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) =>
    ctx.db.application.update({
      where: { id: input.id },
      data: { lastContactAt: new Date(), events: { create: { type: "FOLLOW_UP_SENT" } } },
    }),
  ),

  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) =>
    ctx.db.application.delete({ where: { id: input.id } }),
  ),
});
