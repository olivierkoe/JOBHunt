/**
 * Dictionnaire de compétences : nom canonique -> regex appliquée au texte normalisé
 * (minuscules, sans accents). Sert à la fois pour les CV et pour les offres.
 */
export const SKILLS: Record<string, RegExp> = {
  TypeScript: /typescript|\bts\b/,
  JavaScript: /javascript|\bjs\b/,
  React: /\breact(?!\s*native)\b|\breact\.?js\b/,
  "React Native": /react\s*native/,
  "Next.js": /next\.?js/,
  "Node.js": /node\.?js|\bnode\b/,
  NestJS: /nest\.?js/,
  Angular: /angular/,
  Vue: /vue\.?js|\bvue\s?3\b|\bnuxt/,
  tRPC: /\btrpc\b/,
  Prisma: /\bprisma\b/,
  GraphQL: /graphql/,
  Python: /python|fastapi|django|pytest/,
  Go: /\bgolang\b|\bgo\s*\(|\bin go\b/,
  PHP: /\bphp/,
  Symfony: /symfony/,
  "API Platform": /api\s*platform/,
  Laravel: /laravel/,
  PostgreSQL: /postgres/,
  MySQL: /mysql|mariadb/,
  MongoDB: /mongo/,
  Redis: /\bredis\b/,
  RabbitMQ: /rabbitmq/,
  Kafka: /\bkafka\b/,
  Docker: /docker/,
  Kubernetes: /kubernetes|\bk8s\b/,
  "GitLab CI": /gitlab\s*ci/,
  "GitHub Actions": /github\s*actions/,
  Jenkins: /jenkins/,
  Terraform: /terraform/,
  AWS: /\baws\b|amazon web services/,
  GCP: /\bgcp\b|google cloud/,
  Azure: /\bazure\b/,
  Microservices: /micro-?services?/,
  DDD: /\bddd\b|domain[- ]driven/,
  Playwright: /playwright/,
  Jest: /\bjest\b|vitest/,
  "OWASP Top 10": /owasp/,
  "Sécurité des API": /api security|securite des api|api rest securisee/,
  Pentest: /pentest|penetration test|test d.intrusion/,
  "Burp Suite": /\bburp/,
  "SAST / DAST": /\bsast\b|\bdast\b|sonarqube|snyk|semgrep/,
  "Threat modeling": /threat model|ebios/,
  "Gestion des vulnérabilités": /vulnerability management|gestion des vulnerabilites|\bcve\b/,
  "OAuth2 / OIDC": /oauth|openid|\boidc\b|keycloak/,
  "Bug bounty / CTF": /bug bounty|\bctf\b/,
  "LLM / IA": /\bllm\b|\bopenai\b|\bgenai\b|machine learning/,
};

export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Clé d'une entreprise : rapproche "Bjak " et "bjak", ou une offre et sa fiche Company. */
export function companyKey(name: string): string {
  return normalize(name).trim();
}

/** Compétences détectées dans un texte, dans l'ordre du dictionnaire. */
export function detectSkills(text: string): string[] {
  const t = normalize(text);
  return Object.entries(SKILLS)
    .filter(([, rx]) => rx.test(t))
    .map(([name]) => name);
}

const SENIOR_RX = /\b(senior|sr\.?|lead|principal|staff|head of|architect|director|vp|chief)\b/i;

/** Métiers du développement, de la data et de la sécurité. */
const DEV_ROLE_RX =
  /develop|d[ée]veloppeu|engineer|ing[ée]nieu|programm|architect|devops|\bsre\b|full[- ]?stack|front[- ]?end|back[- ]?end|software|logiciel|\bdev\b|security|s[ée]curit[ée]|pentest|appsec|cyber|data scien|machine learning|\bml\b|tech lead|\bcto\b/i;
/** Intitulés hors développement, même quand l'annonce cite un langage (« Operations Expert with Python »). */
const NON_DEV_ROLE_RX =
  /assistant|\bsales\b|business develop|marketing|recruit|account (exec|manag)|customer|support specialist|operations|\boffice\b|community|content|copywrit|writer|tutor|teacher|product manager|partner manager|designer\b/i;

/** « Engineer » ou « Developer » dans l'intitulé suffit, même à côté de « Product Manager » ou « Designer ». */
const STRONG_DEV_TITLE_RX = /engineer|developer|d[ée]veloppeu|ing[ée]nieu|programmer|devops/i;

/**
 * Poste de développement ? Le métier se lit dans l'intitulé ; `context` (début de l'annonce) sert quand
 * l'intitulé est mal découpé, comme sur Hacker News. Hors intitulé clairement technique, un mot hors métier l'emporte.
 */
export function isDevRole(title: string, context = ""): boolean {
  if (STRONG_DEV_TITLE_RX.test(title)) return true;
  return DEV_ROLE_RX.test(`${title} ${context}`) && !NON_DEV_ROLE_RX.test(title);
}
const JUNIOR_RX = /\b(junior|jr\.?|intern|stagiaire|alternan\w*|graduate|entry[- ]level)\b/i;

/**
 * Années minimales demandées, déduites du texte ("3+ years", "≥ 2 ans", "5 years of experience").
 * À défaut, le niveau se lit dans le titre seul : "lead" ou "junior" dans une description
 * ("you will lead features", "mentor junior devs") ne dit rien du poste.
 */
export function detectMinYears(text: string, title = text): number | null {
  const t = normalize(text);
  const m =
    t.match(/(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years?|yrs?|ans|annees)\b/) ??
    t.match(/(?:>=|≥|at least|minimum|au moins)\s*(\d{1,2})/);
  if (m?.[1]) return Number(m[1]);
  if (JUNIOR_RX.test(title)) return 0;
  if (SENIOR_RX.test(title)) return 5;
  return null;
}

export function isSenior(title: string, minYears: number | null): boolean {
  return (minYears ?? 0) >= 5 || SENIOR_RX.test(title);
}
