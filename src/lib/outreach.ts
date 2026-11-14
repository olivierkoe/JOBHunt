/**
 * Message de prise de contact après une levée de fonds, à envoyer au CTO ou à un fondateur.
 * Quatre lignes : la levée, ce que je sais faire, un lien concret, une proposition d'échange de 15 minutes.
 */
export type OutreachInput = {
  company: string;
  amountLabel?: string | null;
  stage?: string | null;
  lang: "fr" | "en";
  candidate: string;
  portfolio: string;
};

export function outreachMessage(p: OutreachInput): { subject: string; body: string } {
  if (p.lang === "fr") {
    const round = [p.stage ? `votre ${p.stage}` : "votre levée", p.amountLabel ? `de ${p.amountLabel}` : ""].filter(Boolean).join(" ");
    return {
      subject: `Félicitations pour ${round} — développeur full stack NestJS / React`,
      body: [
        "Bonjour,",
        "",
        `J’ai vu que ${p.company} vient de boucler ${round}, félicitations !`,
        "Je suis développeur full stack TypeScript (NestJS, React, Angular) : chez Drone-Geofencing, j’ai développé plus de 100 endpoints et 30 écrans d’un logiciel de supervision de drones, jusqu’à la mise en production.",
        `Mes projets : ${p.portfolio}`,
        "Auriez-vous 15 minutes la semaine prochaine pour échanger sur vos recrutements tech ?",
        "",
        p.candidate,
      ].join("\n"),
    };
  }
  const round = [p.amountLabel, p.stage ? `${p.stage.replace("série", "Series")} round` : "round"].filter(Boolean).join(" ");
  return {
    subject: `Congrats on your ${round} — full-stack NestJS / React developer`,
    body: [
      "Hi,",
      "",
      `I saw that ${p.company} just closed its ${round}, congratulations!`,
      "I'm a full-stack TypeScript developer (NestJS, React, Angular): at Drone-Geofencing I built 100+ API endpoints and 30 screens of a drone fleet supervision product, all the way to production.",
      `My work: ${p.portfolio}`,
      "Would you have 15 minutes next week to talk about your engineering hiring?",
      "",
      p.candidate,
    ].join("\n"),
  };
}
