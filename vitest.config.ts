import "dotenv/config";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// `vitest run --mode integration` active les tests sur une vraie base (marche sous Windows comme en CI).
export default defineConfig(({ mode }) => ({
  resolve: { alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    fileParallelism: false,
    // Sans base (tests unitaires seuls), on ne valide pas les variables d'environnement.
    env: mode === "integration" ? { INTEGRATION: "1" } : { SKIP_ENV_VALIDATION: "1" },
  },
}));
