import { z } from "zod";

import { detectSkills } from "~/lib/skills";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { recomputeMatches } from "~/server/services/matching";

export const cvRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) => ctx.db.cv.findMany({ orderBy: { createdAt: "asc" } })),

  upsert: publicProcedure
    .input(
      z.object({
        slug: z.string().regex(/^[a-z0-9-]{2,32}$/),
        label: z.string().min(2).max(80),
        text: z.string().min(50).max(50_000),
        yearsExperience: z.number().min(0).max(40),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const data = { ...input, skills: detectSkills(input.text) };
      const cv = await ctx.db.cv.upsert({ where: { slug: input.slug }, create: data, update: data });
      await recomputeMatches(ctx.db);
      return cv;
    }),

  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) =>
    ctx.db.cv.delete({ where: { id: input.id } }),
  ),
});
