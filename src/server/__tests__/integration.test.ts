/**
 * Tests d'intégration sur une vraie base (DATABASE_URL, avec le seed appliqué).
 * Lancer : npm run test:integration
 */
import { afterAll, describe, expect, it } from "vitest";

import { createCaller } from "~/server/api/root";
import { db } from "~/server/db";
import { runWatch } from "~/server/services/watch";

const run = process.env.INTEGRATION === "1";

describe.skipIf(!run)("intégration tRPC + Prisma", () => {
  const api = createCaller({ db, headers: new Headers() });
  const created: string[] = [];
  const startedAt = new Date();

  afterAll(async () => {
    await db.offer.deleteMany({ where: { id: { in: created } } });
    await db.offer.deleteMany({ where: { source: "REMOTIVE", externalId: { startsWith: "it-" } } });
    await db.watchRun.deleteMany({ where: { startedAt: { gte: startedAt } } });
    await db.$disconnect();
  });

  it("liste les offres non senior triées par score, avec les 3 CV", async () => {
    const offers = await api.offer.list({});
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o.matches.length === 3)).toBe(true);
    const best = offers.map((o) => o.matches[0]!.globalPct);
    expect(best).toEqual([...best].sort((a, b) => b - a));
  });

  it("filtre par CV et score minimum", async () => {
    const php = await api.offer.list({ cvSlug: "php", minScore: 90 });
    expect(php.every((o) => o.matches.find((m) => m.cv.slug === "php")!.globalPct >= 90)).toBe(true);
  });

  it("ajout manuel : détecte stack, expérience et langue, puis calcule les scores", async () => {
    const o = await api.offer.create({
      url: "https://example.com/job/it-1",
      company: "IT Test",
      title: "Fullstack Developer",
      location: "Remote (EU)",
      description: "We use TypeScript, React, tRPC and Prisma. 2+ years of experience.",
    });
    created.push(o.id);
    const full = await api.offer.byId({ id: o.id });
    expect(full.skills).toEqual(expect.arrayContaining(["TypeScript", "React", "tRPC", "Prisma"]));
    expect(full.minYears).toBe(2);
    const node = full.matches.find((m) => m.cv.slug === "node")!;
    expect(node).toMatchObject({ stackPct: 100, globalPct: 100, missing: [] });
  });

  it("candidature : suivi, passage à Postulé, relance due après le délai", async () => {
    const offerId = created[0]!;
    const app = await api.application.createFromOffer({ offerId });
    expect(app.cvId).toBeTruthy();
    await api.application.move({ id: app.id, status: "APPLIED" });
    const moved = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    expect(moved.appliedAt).not.toBeNull();

    // On antidate la candidature de 10 jours : la relance (7 j) devient due.
    await db.application.update({ where: { id: app.id }, data: { appliedAt: new Date(Date.now() - 10 * 86_400_000) } });
    const due = await api.application.dueFollowUps();
    const mine = due.find((d) => d.id === app.id);
    expect(mine?.days).toBe(10);
    expect(mine?.message.body).toContain("IT Test");

    await api.application.markFollowUpSent({ id: app.id });
    expect((await api.application.dueFollowUps()).some((d) => d.id === app.id)).toBe(false);
    const events = await api.application.events({ id: app.id });
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(["CREATED", "STATUS_CHANGE", "FOLLOW_UP_SENT"]));
  });

  it("veille : insère les offres filtrées, ignore doublons, US only et senior", async () => {
    const remotive = {
      jobs: [
        { id: "it-ok", url: "https://remotive.com/it-ok", company_name: "OkCo", title: "Fullstack Developer", candidate_required_location: "Europe", tags: ["typescript", "react"], description: "React + Node, 2 years" },
        { id: "it-us", url: "https://remotive.com/it-us", company_name: "UsCo", title: "React Developer", candidate_required_location: "USA only", tags: ["react"], description: "US only" },
        { id: "it-sr", url: "https://remotive.com/it-sr", company_name: "SrCo", title: "Senior React Engineer", candidate_required_location: "Europe", tags: ["react"], description: "" },
      ],
    };
    const fetcher = async (url: string) =>
      url.includes("remotive.com")
        ? new Response(JSON.stringify(remotive), { status: 200 })
        : new Response("blocked", { status: 503 });

    const first = await runWatch(db, fetcher);
    expect(first.inserted).toBe(1);
    // reddit, HN, RemoteOK, Maddyness et EU-Startups indisponibles : la veille continue
    expect(first.errors.length).toBe(5);
    expect(first.fundingInserted).toBe(0);
    const second = await runWatch(db, fetcher);
    expect(second.inserted).toBe(0);
    const ok = await db.offer.findFirstOrThrow({ where: { externalId: "it-ok" }, include: { matches: true } });
    expect(ok.matches).toHaveLength(3);
  });
});
