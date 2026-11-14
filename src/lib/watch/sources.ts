/**
 * Sources de veille. Chaque source renvoie des offres brutes ; le parsing est pur
 * (testable sans réseau), le fetch est injecté.
 */
export type RawOffer = {
  source: "REDDIT" | "HACKER_NEWS" | "REMOTEOK" | "REMOTIVE";
  externalId: string;
  url: string;
  company: string;
  title: string;
  location: string;
  description: string;
  postedAt: Date | null;
};

export type Fetcher = (url: string) => Promise<Response>;

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

// ---------- Reddit (flux Atom) ----------
export function parseRedditAtom(xml: string, sub: string): RawOffer[] {
  return xml
    .split("<entry>")
    .slice(1)
    .flatMap((entry) => {
      const url = /<link href="([^"]+)"/.exec(entry)?.[1];
      const id = /<id>([^<]+)<\/id>/.exec(entry)?.[1] ?? url;
      if (!url || !id) return [];
      const title = stripHtml(/<title>([\s\S]*?)<\/title>/.exec(entry)?.[1]);
      // On ignore les profils "For Hire" : ce sont des candidats, pas des offres.
      if (/\[for hire\]/i.test(title)) return [];
      const updated = /<updated>([^<]+)<\/updated>/.exec(entry)?.[1];
      return [
        {
          source: "REDDIT" as const,
          externalId: id,
          url: decode(url),
          company: `r/${sub}`,
          title: title.replace(/^\[hiring\]\s*/i, ""),
          location: "",
          description: stripHtml(/<content[^>]*>([\s\S]*?)<\/content>/.exec(entry)?.[1]),
          postedAt: updated ? new Date(updated) : null,
        },
      ];
    });
}

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

async function get(fetcher: Fetcher, url: string) {
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

export const defaultFetcher: Fetcher = (url) => fetch(url, { headers: UA });

export const SOURCES = {
  reddit: async (f: Fetcher, subs: string[]) => {
    const out: RawOffer[] = [];
    for (const sub of subs) {
      const xml = await (await get(f, `https://www.reddit.com/r/${sub}/new/.rss?limit=50`)).text();
      out.push(...parseRedditAtom(xml, sub));
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
