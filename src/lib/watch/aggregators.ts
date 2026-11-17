/**
 * Agrégateurs d'offres (France Travail, Google Jobs via SerpAPI, Adzuna, Jooble).
 * Ils reprennent les offres de LinkedIn, Indeed, Welcome to the Jungle, HelloWork… sans scraper ces sites.
 * Comme pour les autres sources : parsing pur (testable), fetch injecté.
 */
import { stripHtml, type Fetcher, type RawOffer } from "./sources";

const toDate = (s?: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

async function get(f: Fetcher, url: string, init?: RequestInit) {
  const res = await f(url, init);
  if (!res.ok) throw new Error(`${res.status} ${url.replace(/(api_key|app_key|app_id)=[^&]+/g, "$1=***")}`);
  return res;
}

// ---------- France Travail (API Offres d'emploi v2) ----------
type FtOffer = {
  id: string;
  intitule?: string;
  description?: string;
  dateCreation?: string;
  lieuTravail?: { libelle?: string };
  entreprise?: { nom?: string };
  origineOffre?: { urlOrigine?: string };
};

export function parseFranceTravail(data: { resultats?: FtOffer[] }): RawOffer[] {
  return (data.resultats ?? []).map((o) => ({
    source: "FRANCE_TRAVAIL" as const,
    externalId: o.id,
    url: o.origineOffre?.urlOrigine ?? `https://candidat.francetravail.fr/offres/recherche/detail/${o.id}`,
    company: o.entreprise?.nom ?? "Entreprise non communiquée",
    title: o.intitule ?? "",
    location: o.lieuTravail?.libelle ?? "",
    description: (o.description ?? "").slice(0, 4000),
    postedAt: toDate(o.dateCreation),
  }));
}

// ---------- Google Jobs (SerpAPI) ----------
type GoogleJob = {
  job_id?: string;
  title?: string;
  company_name?: string;
  location?: string;
  via?: string;
  description?: string;
  share_link?: string;
  apply_options?: { title?: string; link?: string }[];
  detected_extensions?: { posted_at?: string; work_from_home?: boolean };
};

/** "il y a 3 jours", "3 days ago", "il y a 5 heures"… -> date approximative. */
export function parseRelativeDate(text: string | undefined, now = new Date()): Date | null {
  if (!text) return null;
  const m = /(\d+)\s*(minute|min|heure|hour|h\b|jour|day|semaine|week|mois|month)/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2]!.toLowerCase();
  const day = 86_400_000;
  const ms = /^min/.test(unit) ? 60_000 : /^(heure|hour|h)/.test(unit) ? 3_600_000 : /^(jour|day)/.test(unit) ? day : /^(semaine|week)/.test(unit) ? 7 * day : 30 * day;
  return new Date(now.getTime() - n * ms);
}

export function parseGoogleJobs(data: { jobs_results?: GoogleJob[] }, now = new Date()): RawOffer[] {
  return (data.jobs_results ?? []).flatMap((j) => {
    const url = j.apply_options?.[0]?.link ?? j.share_link;
    if (!j.job_id || !j.title || !url) return [];
    const remote = j.detected_extensions?.work_from_home ? " (télétravail)" : "";
    return [
      {
        source: "GOOGLE_JOBS" as const,
        // job_id est un long jeton base64 : on garde une clé courte et stable.
        externalId: j.job_id.slice(0, 190),
        url,
        company: j.company_name ?? "",
        title: j.title,
        location: `${j.location ?? ""}${remote}`.trim(),
        description: `${j.via ? `${j.via}. ` : ""}${j.description ?? ""}`.slice(0, 4000),
        postedAt: parseRelativeDate(j.detected_extensions?.posted_at, now),
      },
    ];
  });
}

// ---------- Adzuna ----------
type AdzunaJob = {
  id: string | number;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
};

export function parseAdzuna(data: { results?: AdzunaJob[] }): RawOffer[] {
  return (data.results ?? []).flatMap((j) =>
    j.redirect_url
      ? [
          {
            source: "ADZUNA" as const,
            externalId: String(j.id),
            url: j.redirect_url,
            company: j.company?.display_name ?? "",
            title: stripHtml(j.title),
            location: j.location?.display_name ?? "",
            description: stripHtml(j.description),
            postedAt: toDate(j.created),
          },
        ]
      : [],
  );
}

// ---------- Jooble ----------
type JoobleJob = { id: string | number; title?: string; location?: string; snippet?: string; link?: string; company?: string; source?: string; updated?: string };

export function parseJooble(data: { jobs?: JoobleJob[] }): RawOffer[] {
  return (data.jobs ?? []).flatMap((j) =>
    j.link
      ? [
          {
            source: "JOOBLE" as const,
            externalId: String(j.id),
            url: j.link,
            company: j.company ?? "",
            title: stripHtml(j.title),
            location: j.location ?? "",
            description: `${j.source ? `${j.source}. ` : ""}${stripHtml(j.snippet)}`,
            postedAt: toDate(j.updated),
          },
        ]
      : [],
  );
}

// ---------- Fetch ----------
export type AggregatorConfig = {
  /** Mots-clés seuls (France Travail, Jooble) : "php", "symfony"… */
  keywords: string[];
  /** Une recherche par stack (Adzuna, Google Jobs) : "php symfony"… */
  stackQueries: string[];
  /** Ville / région pour les postes sur site ou hybrides (premier terme de WATCH_ZONE) */
  zone?: string;
  /** Départements France Travail ("34,30") */
  departements?: string;
};

export const AGGREGATORS = {
  franceTravail: async (f: Fetcher, cfg: AggregatorConfig, creds: { clientId: string; clientSecret: string }) => {
    const tokenRes = await get(f, "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        scope: "api_offresdemploiv2 o2dsoffre",
      }).toString(),
    });
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) throw new Error("jeton France Travail absent de la réponse");
    // Toute la France (pour le télétravail), puis la zone si des départements sont donnés.
    const scopes = ["", ...(cfg.departements ? [`&departement=${encodeURIComponent(cfg.departements)}`] : [])];
    const out: RawOffer[] = [];
    for (const kw of cfg.keywords) {
      for (const scope of scopes) {
        const res = await get(
          f,
          `https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search?motsCles=${encodeURIComponent(kw)}&publieeDepuis=7&range=0-149${scope}`,
          { headers: { Authorization: `Bearer ${access_token}`, Accept: "application/json" } },
        );
        // 204 : aucune offre, corps vide
        if (res.status === 204) continue;
        out.push(...parseFranceTravail((await res.json()) as { resultats?: FtOffer[] }));
      }
    }
    return out;
  },

  googleJobs: async (f: Fetcher, cfg: AggregatorConfig, apiKey: string) => {
    const out: RawOffer[] = [];
    // Une recherche par stack et par jour : reste dans le quota gratuit de SerpAPI.
    for (const q of cfg.stackQueries) {
      const params = new URLSearchParams({ engine: "google_jobs", q: `développeur ${q}`, location: "France", gl: "fr", hl: "fr", api_key: apiKey });
      const res = await get(f, `https://serpapi.com/search.json?${params}`);
      out.push(...parseGoogleJobs((await res.json()) as { jobs_results?: GoogleJob[] }));
    }
    return out;
  },

  adzuna: async (f: Fetcher, cfg: AggregatorConfig, creds: { appId: string; appKey: string }) => {
    const out: RawOffer[] = [];
    const wheres = ["", ...(cfg.zone ? [cfg.zone] : [])];
    for (const q of cfg.stackQueries) {
      for (const where of wheres) {
        const params = new URLSearchParams({
          app_id: creds.appId,
          app_key: creds.appKey,
          what_or: q,
          max_days_old: "7",
          results_per_page: "50",
          sort_by: "date",
          ...(where ? { where } : {}),
        });
        const res = await get(f, `https://api.adzuna.com/v1/api/jobs/fr/search/1?${params}`, { headers: { Accept: "application/json" } });
        out.push(...parseAdzuna((await res.json()) as { results?: AdzunaJob[] }));
      }
    }
    return out;
  },

  jooble: async (f: Fetcher, cfg: AggregatorConfig, apiKey: string) => {
    const out: RawOffer[] = [];
    const locations = ["France", ...(cfg.zone ? [cfg.zone] : [])];
    for (const keywords of cfg.keywords) {
      for (const location of locations) {
        const res = await get(f, `https://jooble.org/api/${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords, location, page: "1" }),
        });
        out.push(...parseJooble((await res.json()) as { jobs?: JoobleJob[] }));
      }
    }
    return out;
  },
};
