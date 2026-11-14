import { type NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { env } from "~/env";
import { isDue } from "~/lib/reminders";
import { db } from "~/server/db";
import { notify } from "~/server/services/notify";
import { runWatch } from "~/server/services/watch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  if (!env.CRON_SECRET) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** Appelé par le cron (Vercel Cron, GitHub Actions…) : veille + rappel des relances dues. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const watch = await runWatch(db);

  const active = await db.application.findMany({
    where: { status: { in: ["APPLIED", "INTERVIEW"] } },
    select: { status: true, appliedAt: true, lastContactAt: true, followUpAfterDays: true, offer: { select: { company: true, title: true } } },
  });
  const due = active.filter((a) => isDue(a));
  if (due.length) {
    await notify(`${due.length} relance(s) à faire`, due.map((a) => `${a.offer.company} — ${a.offer.title}`).join("\n"));
  }
  return NextResponse.json({ watch, followUpsDue: due.length });
}
