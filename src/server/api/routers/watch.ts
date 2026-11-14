import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { runWatch } from "~/server/services/watch";

export const watchRouter = createTRPCRouter({
  runs: publicProcedure.query(({ ctx }) => ctx.db.watchRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 })),
  runNow: publicProcedure.mutation(({ ctx }) => runWatch(ctx.db)),
});
