import { describe, expect, it } from "vitest";
import { detectMinYears, detectSkills, isDevRole, isSenior } from "../skills";
import { experienceFit, scoreMatch } from "../matching";
import { followUpMessage, isDue, nextFollowUp } from "../reminders";
import { enrich, keep } from "../watch/filter";
import { parseHnThread, parseRedditAtom, parseRemotive } from "../watch/sources";
import { cleanCompany, enrichRound, keepRound, parseAmount, parseEuStartups, parseMaddyness } from "../watch/funding";
import { outreachMessage } from "../outreach";

describe("levées de fonds", () => {
  const eu = (title: string, cats: string[], desc = "") =>
    `<rss><channel><item><title>${title}</title><link>https://www.eu-startups.com/x/${encodeURIComponent(title)}</link><pubDate>Fri, 13 Nov 2026 15:47:36 +0000</pubDate>${cats.map((c) => `<category><![CDATA[${c}]]></category>`).join("")}<description><![CDATA[<p>${desc}</p>The post X appeared first on EU-Startups.]]></description></item></channel></rss>`;

  it("extrait le nom de la startup des titres en question ou avec deux-points", () => {
    expect(cleanCompany("Can AI predict which cancer drugs will actually work? Orakl Oncology")).toBe("Orakl Oncology");
    expect(cleanCompany("Agile Robots : le géant allemand de la robotique")).toBe("Agile Robots");
  });
  it("lit les montants en français et en anglais", () => {
    expect(parseAmount("Slite lève 3,7 millions d'euros")?.amount).toBe(3.7);
    expect(parseAmount("NeuralSat raises €2.9 million")?.amount).toBe(2.9);
    expect(parseAmount("Foo lève 500 000 euros")?.amount).toBe(0.5);
    expect(parseAmount("Bar raises $1.2 billion")?.amount).toBe(1200);
  });
  it("parse EU-Startups : nom, pays, stade, montant", () => {
    const [r] = parseEuStartups(eu("Germany&#8217;s NeuralSat raises €2.9 million to build a data network", ["Funding", "Germany-Startups", "pre-seed"], "Würzburg-based SpaceTech startup NeuralSat has secured €2.9 million in pre-Seed funding to develop a satellite platform"));
    expect(r).toMatchObject({ company: "NeuralSat", country: "Germany", stage: "pre-seed", amount: 2.9 });
    expect(keepRound(enrichRound(r!))).toBe(true);
  });
  it("ignore les récapitulatifs et les levées hors tech ou trop avancées", () => {
    expect(parseEuStartups(eu("Weekly funding round-up! All of the European startup funding rounds", ["Funding"]))).toHaveLength(0);
    const [sport] = parseEuStartups(eu("Pro Climbing League secures €3.8 million to professionalise climbing", ["Funding", "France-Startups"]));
    expect(keepRound(enrichRound(sport!))).toBe(false);
    const [late] = parseEuStartups(eu("Paris-based Acme raises €40 million Series C for its SaaS", ["Funding", "France-Startups", "Series C"]));
    expect(keepRound(enrichRound(late!))).toBe(false);
  });
  it("parse Maddyness et ne garde que les articles de levée", () => {
    const xml = `<rss><channel>
      <item><title>Slite lève 3,7 millions d&#039;euros pour faciliter le travail d&#039;équipe</title><link>https://www.maddyness.com/a</link><pubDate>Mon, 23 Apr 2018 05:45:04 +0000</pubDate></item>
      <item><title>IA : Arthur Mensch appelle les dirigeants européens à agir</title><link>https://www.maddyness.com/b</link></item>
    </channel></rss>`;
    const rounds = parseMaddyness(xml);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({ company: "Slite", amount: 3.7, country: "France" });
  });
  it("rédige le message au CTO en 4 lignes", () => {
    const fr = outreachMessage({ company: "Slite", amountLabel: "3,7 millions d'euros", stage: "seed", lang: "fr", candidate: "Olivier", portfolio: "https://4thunes.ovh" });
    expect(fr.body).toContain("Slite vient de boucler votre seed de 3,7 millions d'euros");
    expect(fr.body).toContain("https://4thunes.ovh");
    expect(fr.body).toContain("15 minutes");
    const en = outreachMessage({ company: "NeuralSat", amountLabel: "€2.9 million", stage: "pre-seed", lang: "en", candidate: "Olivier", portfolio: "https://4thunes.ovh" });
    expect(en.body).toContain("NeuralSat just closed its €2.9 million pre-seed round");
  });
});

describe("skills", () => {
  it("détecte la stack d'un CV en français", () => {
    const s = detectSkills("API REST (Node.js, NestJS, tRPC, Prisma, PostgreSQL) et plus de 30 écrans React, PHP 8, Symfony 7");
    expect(s).toEqual(expect.arrayContaining(["Node.js", "NestJS", "tRPC", "Prisma", "PostgreSQL", "React", "PHP", "Symfony"]));
  });
  it("distingue React et React Native", () => {
    expect(detectSkills("React Native app")).toEqual(["React Native"]);
    expect(detectSkills("React and React Native")).toEqual(expect.arrayContaining(["React", "React Native"]));
  });
  it("ne confond pas 'vues Twig' avec Vue.js", () => {
    expect(detectSkills("contrôleurs, services et vues Twig")).not.toContain("Vue");
  });
  it("lit l'expérience demandée", () => {
    expect(detectMinYears("3+ years of experience with React")).toBe(3);
    expect(detectMinYears("au moins 2 ans d'expérience")).toBe(2);
    expect(detectMinYears("Junior Full-Stack Engineer")).toBe(0);
    expect(detectMinYears("Senior Backend Engineer")).toBe(5);
    expect(detectMinYears("Backend Engineer")).toBeNull();
    expect(detectMinYears("Développeur en alternance")).toBe(0);
  });
  it("ne lit pas d'expérience dans un mot qui commence par 'ans' ni dans la description", () => {
    expect(detectMinYears("We got 5 answers per ticket")).toBeNull();
    expect(detectMinYears("You will lead features end to end", "Fullstack Developer")).toBeNull();
    expect(detectMinYears("You will mentor junior developers", "Senior Engineer")).toBe(5);
  });
  it("distingue les postes de développement des autres métiers", () => {
    for (const t of ["UI Developer", "Développeur web full-stack", "Blockchain Security Engineer", "Solutions Engineer", "DevOps Engineer", "AI Product Engineer | AI Product Manager", "ML Inference Engineer – Task Designer"]) {
      expect(isDevRole(t), t).toBe(true);
    }
    for (const t of ["Remote Office Assistant", "Web3 Business Development", "Operations Expert with Python for AI", "HIL Support Specialist", "APAC Python"]) {
      expect(isDevRole(t), t).toBe(false);
    }
    // Intitulé HN mal découpé : le métier se lit dans le début de l'annonce
    expect(isDevRole("Paris, Berlin | REMOTE (EU)", "Scento | Staff Full Stack Engineer")).toBe(true);
  });
  it("repère les postes senior", () => {
    expect(isSenior("Staff Engineer", null)).toBe(true);
    expect(isSenior("Full Stack Developer", 5)).toBe(true);
    expect(isSenior("Full Stack Developer", 3)).toBe(false);
  });
});

describe("matching", () => {
  const nodeCv = { skills: ["TypeScript", "React", "Node.js", "PostgreSQL"], yearsExperience: 2 };
  it("score 100 quand tout est couvert", () => {
    const r = scoreMatch(nodeCv, { skills: ["TypeScript", "React", "Node.js"], minYears: 0, eligibleFromFrance: true, otherLanguage: null });
    expect(r).toMatchObject({ stackPct: 100, globalPct: 100, missing: [] });
  });
  it("une annonce avec une seule compétence détectée ne donne pas 100 %", () => {
    const one = scoreMatch(nodeCv, { skills: ["React"], minYears: null, eligibleFromFrance: true, otherLanguage: null });
    expect(one.stackPct).toBe(67);
    expect(one.globalPct).toBe(80);
    const none = scoreMatch(nodeCv, { skills: [], minYears: null, eligibleFromFrance: true, otherLanguage: null });
    expect(none.stackPct).toBe(50);
  });
  it("divise par deux le score d'un poste hors développement", () => {
    const offer = { skills: ["TypeScript", "React", "Node.js"], minYears: null, eligibleFromFrance: true, otherLanguage: null };
    expect(scoreMatch(nodeCv, offer).globalPct).toBe(100);
    expect(scoreMatch(nodeCv, { ...offer, devRole: false }).globalPct).toBe(50);
  });
  it("liste les compétences manquantes et pénalise l'expérience", () => {
    const r = scoreMatch(nodeCv, { skills: ["TypeScript", "React", "Vue"], minYears: 3, eligibleFromFrance: true, otherLanguage: null });
    expect(r.missing).toEqual(["Vue"]);
    expect(r.stackPct).toBe(67);
    expect(r.globalPct).toBe(Math.round(100 * (0.6 * (2 / 3) + 0.2 * 0.5 + 0.2)));
  });
  it("zone ou langue non couverte = 0 sur ce critère", () => {
    const r = scoreMatch(nodeCv, { skills: ["React", "TypeScript", "Node.js"], minYears: null, eligibleFromFrance: true, otherLanguage: "german" });
    expect(r.globalPct).toBe(80);
  });
  it("expérience : 1 si atteinte, 0,5 si écart ≤ 2 ans, 0 au-delà", () => {
    expect(experienceFit(null, 0)).toBe(1);
    expect(experienceFit(4, 2)).toBe(0.5);
    expect(experienceFit(5, 2)).toBe(0);
  });
});

describe("relances", () => {
  const d = (s: string) => new Date(s);
  it("relance 7 jours après la candidature", () => {
    const a = { status: "APPLIED" as const, appliedAt: d("2026-11-01"), lastContactAt: null, followUpAfterDays: 7 };
    expect(nextFollowUp(a)?.toISOString()).toBe("2026-11-08T00:00:00.000Z");
    expect(isDue(a, d("2026-11-07"))).toBe(false);
    expect(isDue(a, d("2026-11-08"))).toBe(true);
  });
  it("le dernier contact repousse la relance", () => {
    const a = { status: "INTERVIEW" as const, appliedAt: d("2026-11-01"), lastContactAt: d("2026-11-10"), followUpAfterDays: 5 };
    expect(isDue(a, d("2026-11-12"))).toBe(false);
  });
  it("pas de relance pour une candidature refusée ou à envoyer", () => {
    expect(nextFollowUp({ status: "REJECTED", appliedAt: d("2026-01-01"), lastContactAt: null, followUpAfterDays: 7 })).toBeNull();
    expect(nextFollowUp({ status: "TO_APPLY", appliedAt: null, lastContactAt: null, followUpAfterDays: 7 })).toBeNull();
  });
  it("génère un message de relance", () => {
    const m = followUpMessage({ company: "Acme", title: "Fullstack Engineer", lang: "en", days: 8, candidate: "Olivier" });
    expect(m.subject).toContain("Fullstack Engineer");
    expect(m.body).toContain("8 days ago");
  });
});

describe("veille", () => {
  it("parse le flux Reddit et ignore les [For Hire]", () => {
    const xml = `<feed><entry><id>t3_a</id><title>[Hiring] TypeScript dev, Remote EU</title><link href="https://reddit.com/a"/><updated>2026-11-10T10:00:00+00:00</updated><content type="html">&lt;p&gt;React + Node, Europe&lt;/p&gt;</content></entry><entry><id>t3_b</id><title>[For Hire] React dev</title><link href="https://reddit.com/b"/></entry></feed>`;
    const r = parseRedditAtom(xml, "remotejs");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ externalId: "t3_a", title: "TypeScript dev, Remote EU", description: "React + Node, Europe" });
  });
  it("parse un commentaire HN au format Company | Role | Location", () => {
    const r = parseHnThread({ id: 1, children: [{ id: 42, text: "Acme | Fullstack Engineer (TypeScript) | REMOTE (EU) | Full-time" }, { id: 43, text: null }] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ company: "Acme", externalId: "42", location: "REMOTE (EU)" });
  });
  it("ignore les candidats qui postent leur profil dans le fil HN", () => {
    const r = parseHnThread({
      id: 1,
      children: [
        { id: 1, text: "Location: Bangalore, India Remote: Yes Willing to relocate: Yes Technologies: TypeScript Résumé/CV: https://x" },
        { id: 2, text: "Jane Doe | Backend Engineer | India (REMOTE) I'm a software engineer focused on backend development" },
        { id: 3, text: "Acme | Backend Engineer | REMOTE (EU) | We are looking for a backend engineer to join our team" },
      ],
    });
    expect(r.map((o) => o.externalId)).toEqual(["3"]);
  });
  it("filtre : garde EU + stack, rejette US only, senior et autre langue", () => {
    const cfg = { wantedSkills: ["TypeScript", "React", "PHP", "Symfony"], excludeSenior: true };
    const base = { source: "REMOTIVE" as const, externalId: "1", url: "u", company: "c", location: "Europe", postedAt: null };
    expect(keep(enrich({ ...base, title: "Fullstack Developer", description: "TypeScript React, 2 years" }), cfg)).toBe(true);
    expect(keep(enrich({ ...base, title: "Fullstack Developer", description: "TypeScript, US only" }), cfg)).toBe(false);
    expect(keep(enrich({ ...base, title: "Senior Fullstack Developer", description: "TypeScript" }), cfg)).toBe(false);
    expect(keep(enrich({ ...base, title: "Rust engineer", description: "Rust" }), cfg)).toBe(false);
    expect(keep(enrich({ ...base, title: "Remote Office Assistant", description: "PHP, Symfony" }), cfg)).toBe(false);
    expect(enrich({ ...base, title: "PHP dev", description: "Symfony, German is required" }).otherLanguage).toBe("german");
  });
  it("filtre : un lieu limité aux US / Amériques n'est pas ouvert depuis la France", () => {
    const base = { source: "REMOTIVE" as const, externalId: "1", url: "u", company: "c", postedAt: null, title: "React dev", description: "React" };
    expect(enrich({ ...base, location: "USA" }).eligibleFromFrance).toBe(false);
    expect(enrich({ ...base, location: "Americas, Canada" }).eligibleFromFrance).toBe(false);
    expect(enrich({ ...base, location: "USA, Europe" }).eligibleFromFrance).toBe(true);
    expect(enrich({ ...base, location: "Worldwide" }).eligibleFromFrance).toBe(true);
    expect(enrich({ ...base, location: "" }).eligibleFromFrance).toBe(true);
  });
  it("parse Remotive", () => {
    const r = parseRemotive({ jobs: [{ id: 7, url: "https://remotive.com/7", company_name: "X", title: "Dev", candidate_required_location: "Europe", tags: ["react"], description: "<p>Hi</p>" }] });
    expect(r[0]).toMatchObject({ externalId: "7", location: "Europe" });
    expect(r[0]?.description).toContain("react");
  });
});
