import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// "--mode mock": umjesto Firebasea koristi podatke u memoriji (samo za testiranje sučelja).
const mockDb = (): Plugin => ({
  name: "mock-db",
  enforce: "pre",
  resolveId(source, importer) {
    if (importer?.includes("/src/") && /(^|\/)db$/.test(source)) return fileURLToPath(new URL("./tests/mock/db.ts", import.meta.url));
  },
});

// base "./" - radi iz bilo koje mape (GitHub Pages: korisnik.github.io/kupnja/)
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), tailwindcss(), ...(mode === "mock" ? [mockDb()] : [])],
  build: { target: "es2022", chunkSizeWarningLimit: 1500, assetsDir: "" },
}));
