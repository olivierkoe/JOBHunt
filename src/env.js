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
    WATCH_SUBREDDITS: z.string().default("remotejs,forhire,jobbit"),
    WATCH_REMOTIVE_QUERIES: z.string().default("typescript,react,symfony,security"),
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
    WATCH_REMOTIVE_QUERIES: process.env.WATCH_REMOTIVE_QUERIES,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
