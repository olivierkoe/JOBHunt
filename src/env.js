import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /** Mot de passe de l'appli (Basic Auth, utilisateur "admin"). Obligatoire en production. */
    APP_PASSWORD: z.string().min(12).optional(),
    /** Secret envoyé par le cron (Authorization: Bearer <CRON_SECRET>) */
    CRON_SECRET: z.string().min(24).optional(),
    /** Topic ntfy.sh pour les notifications push (nouvelles offres, relances) */
    NTFY_TOPIC: z.string().optional(),
    /** Signature des messages de relance */
    CANDIDATE_NAME: z.string().default("Olivier Koenig"),
    /** Lien vers les projets, inséré dans les messages aux startups */
    PORTFOLIO_URL: z.string().url().default("https://4thunes.ovh"),
    /** Sous-reddits et recherches surveillés, séparés par des virgules */
    WATCH_SUBREDDITS: z.string().default("forhire,remotejs,jobbit,PHPjobs,hiring,RemoteJobs"),
    /** Recherches Reddit (syntaxe de recherche Reddit), une par stack */
    WATCH_REDDIT_QUERIES: z.string().default("php OR symfony,node OR nestjs OR react OR angular"),
    WATCH_REMOTIVE_QUERIES: z.string().default("php,symfony,node,nestjs,react,angular"),
    /** Mots-clés seuls (France Travail, Jooble) */
    WATCH_KEYWORDS: z.string().default("php,symfony,node.js,nestjs,react,angular"),
    /** Une recherche par stack (Adzuna, Google Jobs) */
    WATCH_STACK_QUERIES: z.string().default("php symfony,node nestjs react angular"),
    /**
     * Zone acceptée pour les postes sur site / hybrides, termes séparés par des virgules (ex. "montpellier,herault,34").
     * Le premier terme sert de lieu de recherche. Vide : télétravail uniquement.
     */
    WATCH_ZONE: z.string().default(""),
    /** Départements France Travail de la zone (ex. "34,30") */
    WATCH_FT_DEPARTEMENTS: z.string().optional(),
    FRANCE_TRAVAIL_CLIENT_ID: z.string().optional(),
    FRANCE_TRAVAIL_CLIENT_SECRET: z.string().optional(),
    SERPAPI_API_KEY: z.string().optional(),
    ADZUNA_APP_ID: z.string().optional(),
    ADZUNA_APP_KEY: z.string().optional(),
    JOOBLE_API_KEY: z.string().optional(),
    /** Application Reddit de type "script" (https://www.reddit.com/prefs/apps) : sans elle, Reddit bloque souvent la veille */
    REDDIT_CLIENT_ID: z.string().optional(),
    REDDIT_CLIENT_SECRET: z.string().optional(),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    APP_PASSWORD: process.env.APP_PASSWORD,
    CRON_SECRET: process.env.CRON_SECRET,
    NTFY_TOPIC: process.env.NTFY_TOPIC,
    CANDIDATE_NAME: process.env.CANDIDATE_NAME,
    PORTFOLIO_URL: process.env.PORTFOLIO_URL,
    WATCH_SUBREDDITS: process.env.WATCH_SUBREDDITS,
    WATCH_REDDIT_QUERIES: process.env.WATCH_REDDIT_QUERIES,
    WATCH_REMOTIVE_QUERIES: process.env.WATCH_REMOTIVE_QUERIES,
    WATCH_KEYWORDS: process.env.WATCH_KEYWORDS,
    WATCH_STACK_QUERIES: process.env.WATCH_STACK_QUERIES,
    WATCH_ZONE: process.env.WATCH_ZONE,
    WATCH_FT_DEPARTEMENTS: process.env.WATCH_FT_DEPARTEMENTS,
    FRANCE_TRAVAIL_CLIENT_ID: process.env.FRANCE_TRAVAIL_CLIENT_ID,
    FRANCE_TRAVAIL_CLIENT_SECRET: process.env.FRANCE_TRAVAIL_CLIENT_SECRET,
    SERPAPI_API_KEY: process.env.SERPAPI_API_KEY,
    ADZUNA_APP_ID: process.env.ADZUNA_APP_ID,
    ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY,
    JOOBLE_API_KEY: process.env.JOOBLE_API_KEY,
    REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
