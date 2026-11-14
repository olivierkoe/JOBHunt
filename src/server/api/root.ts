import { applicationRouter } from "~/server/api/routers/application";
import { companyRouter } from "~/server/api/routers/company";
import { cvRouter } from "~/server/api/routers/cv";
import { fundingRouter } from "~/server/api/routers/funding";
import { offerRouter } from "~/server/api/routers/offer";
import { watchRouter } from "~/server/api/routers/watch";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  cv: cvRouter,
  offer: offerRouter,
  application: applicationRouter,
  company: companyRouter,
  funding: fundingRouter,
  watch: watchRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
