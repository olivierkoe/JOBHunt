/** Relances : quelles candidatures relancer, et avec quel message. */
export type ReminderInput = {
  status: "TO_APPLY" | "APPLIED" | "INTERVIEW" | "OFFER" | "REJECTED" | "ARCHIVED";
  appliedAt: Date | null;
  lastContactAt: Date | null;
  followUpAfterDays: number;
};

const DAY = 86_400_000;
const ACTIVE = new Set<ReminderInput["status"]>(["APPLIED", "INTERVIEW"]);

/** Date de la prochaine relance, ou null si la candidature n'est pas à suivre. */
export function nextFollowUp(a: ReminderInput): Date | null {
  if (!ACTIVE.has(a.status)) return null;
  const base = a.lastContactAt ?? a.appliedAt;
  if (!base) return null;
  return new Date(base.getTime() + a.followUpAfterDays * DAY);
}

export function isDue(a: ReminderInput, now = new Date()): boolean {
  const next = nextFollowUp(a);
  return next !== null && next.getTime() <= now.getTime();
}

export function daysSince(date: Date | null, now = new Date()): number | null {
  return date ? Math.floor((now.getTime() - date.getTime()) / DAY) : null;
}

/** Message de relance en anglais (offres remote internationales) ou en français. */
export function followUpMessage(p: {
  company: string;
  title: string;
  contactName?: string | null;
  lang: "en" | "fr";
  days: number;
  candidate: string;
}): { subject: string; body: string } {
  if (p.lang === "fr") {
    return {
      subject: `Candidature ${p.title} — suivi`,
      body: `Bonjour${p.contactName ? ` ${p.contactName}` : ""},\n\nJe me permets de revenir vers vous au sujet de ma candidature au poste de ${p.title} chez ${p.company}, envoyée il y a ${p.days} jours. Le poste m'intéresse toujours beaucoup et je reste disponible pour un échange.\n\nBien cordialement,\n${p.candidate}`,
    };
  }
  return {
    subject: `Following up — ${p.title} application`,
    body: `Hi${p.contactName ? ` ${p.contactName}` : ""},\n\nI applied for the ${p.title} role at ${p.company} ${p.days} days ago and wanted to follow up. I'm still very interested and happy to share more about my work or jump on a quick call.\n\nBest regards,\n${p.candidate}`,
  };
}
