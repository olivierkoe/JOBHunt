import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // `prisma generate` (postinstall) n'a pas besoin de base : l'URL de repli évite d'exiger un .env
  // pour `npm install`. Les commandes qui se connectent échoueront clairement sans DATABASE_URL.
  datasource: { url: process.env.DATABASE_URL ?? "postgresql://localhost:5432/missing-database-url" },
});
