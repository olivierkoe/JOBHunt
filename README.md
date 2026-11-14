# JobHunt

Appli perso de recherche d'emploi : veille d'offres remote, compatibilité de chaque offre avec plusieurs CV, suivi des candidatures en kanban et relances.

Stack : Next.js 15 (App Router) · tRPC 11 · Prisma 7 (adapter `pg`) · PostgreSQL · Tailwind 4 · Vitest.

## Fonctionnalités

| Page | Ce qu'elle fait |
| --- | --- |
| Tableau de bord `/` | Compteurs par statut, relances dues avec message prêt à copier, meilleures offres non traitées, bouton « Lancer la veille » |
| Offres `/offers` | Filtres (CV, score minimum, senior, recherche), stack demandée, score par CV, compétences manquantes, ajout manuel d'une offre (la stack, l'expérience et la zone sont détectées dans le texte collé) |
| Offre `/offers/[id]` | Détail, scores par CV, compétences couvertes / manquantes, correction de la détection, « Suivre avec tel CV » |
| Entreprises `/entreprises` | Fiche de chaque entreprise : adresse, téléphone et email publics, site, contacts (dirigeants, RH, tech) et toutes ses offres |
| Levées `/levees` | Startups tech qui viennent de lever en pre-seed, seed ou série A (France et Europe) : statut à contacter / contactée / ignorée, fiche entreprise, message au CTO prêt à copier |
| Candidatures `/board` | Kanban glisser-déposer (+ menu pour mobile et clavier), CV envoyé, contact, délai de relance, notes, historique |
| CV `/cvs` | Texte de chaque CV et années d'expérience ; toutes les offres sont recalculées à l'enregistrement |

**Score** : `globale = 60 % stack couverte + 20 % expérience + 20 % zone / langue`. Expérience : 100 si atteinte, 50 si l'écart est de 2 ans ou moins, 0 au-delà. Si l'annonce laisse détecter moins de 3 compétences, les manquantes comptent à 50 % (une annonce « Python » seule ne donne pas 100 % de stack). Un poste hors développement (assistant, commercial, support…) voit son score divisé par deux et n'est pas importé par la veille ; la détection est corrigeable sur chaque offre. Code : `src/lib/matching.ts`, `isDevRole` dans `src/lib/skills.ts`.

**Veille** (`src/lib/watch`) : flux RSS Reddit, fil « Who is hiring? » de Hacker News (API Algolia), RemoteOK, Remotive. Garde les offres ouvertes depuis la France, non senior, avec au moins une compétence de tes CV, et ignore les doublons. Une source en panne n'arrête pas les autres.

**Levées de fonds** (`src/lib/watch/funding.ts`) : la même veille lit Maddyness (France) et EU-Startups (Europe), et garde les startups tech en pre-seed, seed ou série A (ou jusqu'à 25 M€ si le stade n'est pas précisé). Une startup qui vient de lever recrute souvent avant de publier ses offres : le message proposé (`src/lib/outreach.ts`) tient en 4 lignes, en français pour une startup française, signé `CANDIDATE_NAME` avec le lien `PORTFOLIO_URL`.

**Relances** (`src/lib/reminders.ts`) : une candidature « Postulé » ou « Entretien » sans contact depuis N jours (7 par défaut, réglable par candidature) apparaît dans les relances, avec un message en anglais ou en français.

## Démarrage

```bash
cp .env.example .env          # puis remplis les valeurs
./start-database.sh           # Postgres local dans Docker (ou ta propre URL)
npm install                   # génère aussi le client Prisma
npm run db:generate -- --name init   # crée la première migration (à commiter)
npm run db:seed               # 3 CV résumés + les offres relevées le 14/11/2026
npm run db:contacts           # fiches entreprises et contacts (prisma/contacts.json, sinon l'exemple)
npm run dev
```

Ouvre http://localhost:3000. Sans `APP_PASSWORD`, l'appli est ouverte en dev. Avec, le navigateur demande l'utilisateur `admin` et ce mot de passe.

Remplace ensuite le texte des CV du seed par le tien sur `/cvs`. Le seed ne contient volontairement aucune coordonnée.

## Tests

```bash
npm test                    # 29 tests unitaires (détection, score, relances, parsing des sources, filtre)
npm run test:integration    # + 5 tests sur une vraie base seedée (routers tRPC, veille avec fetch simulé)
npm run typecheck
```

La CI GitHub (`.github/workflows/ci.yml`) lance typecheck, migrations, seed, tests d'intégration et build sur un Postgres de service. Elle a besoin du dossier `prisma/migrations` : crée la migration `init` en local et commite-la avant le premier push.

## Déploiement (Vercel + Postgres hébergé)

1. Une base Postgres (Neon, Supabase, Prisma Postgres…), puis `npx prisma migrate deploy` avec son URL.
2. Variables d'environnement sur Vercel : `DATABASE_URL`, `APP_PASSWORD`, `CRON_SECRET`, et `NTFY_TOPIC` si tu veux les notifications.
3. `vercel.json` déclare le cron : `/api/cron/watch` tous les jours à 6 h 40 UTC (7 h 40 à Paris en hiver). Vercel envoie `Authorization: Bearer $CRON_SECRET`.

Autre planificateur (GitHub Actions, cron système…) :

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://ton-app.vercel.app/api/cron/watch
```

## Sécurité

- Appli mono-utilisateur : Basic Auth sur tout le site via `src/middleware.ts` (comparaison en temps constant). En production, l'absence de `APP_PASSWORD` verrouille l'appli (503) au lieu de l'exposer.
- `/api/cron/*` est exclu de la Basic Auth et protégé par `CRON_SECRET` (`timingSafeEqual`), qui doit faire 24 caractères minimum.
- Toutes les entrées tRPC sont validées par Zod. Le HTML des annonces est réduit à du texte avant stockage, et React échappe tout à l'affichage.
- Pour passer en multi-utilisateur : remplace la Basic Auth par Auth.js et ajoute un `userId` aux modèles.

## Structure

```
prisma/schema.prisma        Cv, Offer, Match, Application, ApplicationEvent, WatchRun
prisma/seed.ts              données de départ
src/lib/                    logique pure et testée (skills, matching, reminders, watch/*)
src/server/services/        recalcul des scores, veille, notifications ntfy
src/server/api/routers/     cv, offer, application, watch
src/app/                    pages (dashboard, offers, board, cvs) + route cron
```
