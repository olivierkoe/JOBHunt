/**
 * Sources de veille. Chaque source renvoie des offres brutes ; le parsing est pur
 * (testable sans réseau), le fetch est injecté.
 */
export type RawOffer = {
  source: "REDDIT" | "HACKER_NEWS" | "REMOTEOK" | "REMOTIVE" | "FRANCE_TRAVAIL" | "GOOGLE_JOBS" | "ADZUNA" | "JOOBLE";
  externalId: string;
  url: string;
  company: string;
  title: string;
  location: string;
  description: string;
  postedAt: Date | null;
};

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const decode = (s = "") =>
  s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    // Entités numériques des flux RSS : &#8217; (’), &#039; ('), &#x2019;…
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

export const stripHtml = (html = "") =>
  decode(decode(html)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// ---------- Reddit ----------
/** Les profils "For Hire" sont des candidats, pas des offres. */
const isForHire = (title: string, flair = "") => /\[\s*for\s*hire\s*\]|^\s*for\s*hire\b/i.test(title) || /for\s*hire/i.test(flair);
const cleanTitle = (title: string) => title.replace(/^\s*\[\s*hiring\s*\]\s*[-:]?\s*/i, "");

/** Flux Atom (recherche ou /new). Le sous-reddit de chaque post est lu dans <category>, `sub` sert de repli. */
export function parseRedditAtom(xml: string, sub: string): RawOffer[] {
  return xml
    .split("<entry>")
    .slice(1)
    .flatMap((entry) => {
      const url = /<link href="([^"]+)"/.exec(entry)?.[1];
      const id = /<id>([^<]+)<\/id>/.exec(entry)?.[1] ?? url;
      if (!url || !id) return [];
      const title = stripHtml(/<title>([\s\S]*?)<\/title>/.exec(entry)?.[1]);
      if (isForHire(title)) return [];
      const updated = /<updated>([^<]+)<\/updated>/.exec(entry)?.[1];
      const entrySub = /<category term="([^"]+)"/.exec(entry)?.[1] ?? sub;
      return [
        {
          source: "REDDIT" as const,
          externalId: id,
          url: decode(url),
          company: `r/${entrySub}`,
          title: cleanTitle(title),
          location: "",
          description: stripHtml(/<content[^>]*>([\s\S]*?)<\/content>/.exec(entry)?.[1]),
          postedAt: updated ? new Date(updated) : null,
        },
      ];
    });
}

type RedditPost = {
  name?: string;
  title?: string;
  selftext?: string;
  permalink?: string;
  subreddit?: string;
  created_utc?: number;
  link_flair_text?: string | null;
};

/** Réponse JSON de l'API OAuth (`/search`). Mêmes identifiants (t3_…) que le flux Atom. */
export function parseRedditListing(data: { data?: { children?: { data: RedditPost }[] } }): RawOffer[] {
  return (data.data?.children ?? []).flatMap(({ data: p }) => {
    if (!p.name || !p.permalink || !p.title) return [];
    if (isForHire(p.title, p.link_flair_text ?? "")) return [];
    return [
      {
        source: "REDDIT" as const,
        externalId: p.name,
        url: `https://www.reddit.com${p.permalink}`,
        company: `r/${p.subreddit ?? "reddit"}`,
        title: cleanTitle(p.title),
        location: "",
        description: (p.selftext ?? "").slice(0, 4000),
        postedAt: p.created_utc ? new Date(p.created_utc * 1000) : null,
      },
    ];
  });
}

export type RedditCredentials = { clientId: string; clientSecret: string };

// ---------- Hacker News "Who is hiring?" (API Algolia) ----------
type HnItem = { id: number; text?: string | null; created_at?: string; children?: HnItem[] };

/** Des candidats postent aussi leur profil dans le fil « Who is hiring? » : ce ne sont pas des offres. */
const JOB_SEEKER =
  /^\s*location\s*:|willing to relocate|r[ée]sum[ée]\s*(\/\s*cv)?\s*:|\bseeking work\b|\bi'?m an? [\w\s/-]{0,40}(engineer|developer)\b|\blooking for (a |my next )?(new )?(role|position|job|opportunit)/i;

export function isJobSeekerPost(body: string): boolean {
  return JOB_SEEKER.test(body);
}

export function parseHnThread(thread: HnItem): RawOffer[] {
  return (thread.children ?? [])
    .filter((c): c is HnItem & { text: string } => Boolean(c.text) && !isJobSeekerPost(stripHtml(c.text ?? "")))
    .map((c) => {
      const body = stripHtml(c.text);
      // Format d'usage : "Company | Role | Location | REMOTE | ..."
      const parts = body.split("|").map((p) => p.trim());
      return {
        source: "HACKER_NEWS" as const,
        externalId: String(c.id),
        url: `https://news.ycombinator.com/item?id=${c.id}`,
        company: (parts[0] ?? "HN").slice(0, 80),
        title: (parts.length > 1 ? parts.slice(1, 3).join(" | ") : body).slice(0, 160),
        location: parts.find((p) => /remote|onsite|hybrid|europe|\beu\b/i.test(p)) ?? "",
        description: body,
        postedAt: c.created_at ? new Date(c.created_at) : null,
      };
    });
}

// ---------- RemoteOK (API JSON) ----------
type RemoteOkJob = {
  id?: string | number;
  url?: string;
  company?: string;
  position?: string;
  location?: string;
  tags?: string[];
  description?: string;
  date?: string;
};

export function parseRemoteOk(data: RemoteOkJob[]): RawOffer[] {
  return data
    .filter((j) => j.id && j.position)
    .map((j) => ({
      source: "REMOTEOK" as const,
      externalId: String(j.id),
      url: j.url ?? `https://remoteok.com/remote-jobs/${j.id}`,
      company: j.company ?? "",
      title: j.position ?? "",
      location: j.location ?? "",
      description: `${(j.tags ?? []).join(" ")} ${stripHtml(j.description).slice(0, 4000)}`,
      postedAt: j.date ? new Date(j.date) : null,
    }));
}

// ---------- Remotive (API JSON) ----------
type RemotiveJob = {
  id: number;
  url: string;
  company_name: string;
  title: string;
  candidate_required_location?: string;
  tags?: string[];
  description?: string;
  publication_date?: string;
};

export function parseRemotive(data: { jobs: RemotiveJob[] }): RawOffer[] {
  return data.jobs.map((j) => ({
    source: "REMOTIVE" as const,
    externalId: String(j.id),
    url: j.url,
    company: j.company_name,
    title: j.title,
    location: j.candidate_required_location ?? "",
    description: `${(j.tags ?? []).join(" ")} ${stripHtml(j.description).slice(0, 4000)}`,
    postedAt: j.publication_date ? new Date(j.publication_date) : null,
  }));
}

// ---------- Fetch ----------
const UA = { "User-Agent": "jobhunt/1.0 (personal job search)" };

async function get(fetcher: Fetcher, url: string, init?: RequestInit) {
  const res = await fetcher(url, init);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

export const defaultFetcher: Fetcher = (url, init) =>
  fetch(url, {
    signal: AbortSignal.timeout(20_000),
    ...init,
    headers: { ...UA, ...(init?.headers as Record<string, string> | undefined) },
  });

/** Jeton d'application (OAuth "client credentials") : lecture seule, sans compte utilisateur. */
async function redditToken(f: Fetcher, { clientId, clientSecret }: RedditCredentials) {
  const res = await get(f, "https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const { access_token } = (await res.json()) as { access_token?: string };
  if (!access_token) throw new Error("jeton OAuth Reddit absent de la réponse");
  return access_token;
}

/** Paramètres de recherche : posts de la semaine, du plus récent au plus ancien (les doublons sont ignorés à l'insertion). */
const redditSearch = (q: string) => `q=${encodeURIComponent(q)}&restrict_sr=1&sort=new&t=week&limit=100`;

export const SOURCES = {
  /**
   * Recherche chaque requête dans les sous-reddits d'offres. Avec des identifiants, passe par l'API OAuth.
   * Sinon, repli sur le flux RSS public, que Reddit bloque souvent (403 / 429).
   */
  reddit: async (f: Fetcher, subs: string[], queries: string[], creds?: RedditCredentials) => {
    const multi = subs.join("+");
    const out: RawOffer[] = [];
    if (creds) {
      const token = await redditToken(f, creds);
      for (const q of queries) {
        const res = await get(f, `https://oauth.reddit.com/r/${multi}/search?${redditSearch(q)}&raw_json=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        out.push(...parseRedditListing((await res.json()) as Parameters<typeof parseRedditListing>[0]));
      }
      return out;
    }
    for (const q of queries) {
      const res = await f(`https://www.reddit.com/r/${multi}/search.rss?${redditSearch(q)}`);
      if (!res.ok) throw new Error(`${res.status} flux RSS Reddit (configure REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET)`);
      out.push(...parseRedditAtom(await res.text(), subs[0] ?? "reddit"));
    }
    return out;
  },
  hackerNews: async (f: Fetcher) => {
    const search = (await (
      await get(
        f,
        "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=who%20is%20hiring&hitsPerPage=5",
      )
    ).json()) as { hits: { objectID: string; title: string }[] };
    const story = search.hits.find((h) => /who is hiring/i.test(h.title));
    if (!story) return [];
    const thread = (await (await get(f, `https://hn.algolia.com/api/v1/items/${story.objectID}`)).json()) as HnItem;
    return parseHnThread(thread);
  },
  remoteOk: async (f: Fetcher) =>
    parseRemoteOk((await (await get(f, "https://remoteok.com/api")).json()) as RemoteOkJob[]),
  remotive: async (f: Fetcher, queries: string[]) => {
    const out: RawOffer[] = [];
    for (const q of queries) {
      const data = (await (
        await get(f, `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}&limit=100`)
      ).json()) as { jobs: RemotiveJob[] };
      out.push(...parseRemotive(data));
    }
    return out;
  },
};
