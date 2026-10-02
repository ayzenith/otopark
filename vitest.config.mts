import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const kok = import.meta.dirname;

/**
 * Iki test projesi:
 *  - unit        : saf is mantigi, veritabani gerektirmez. Hizli, her kayitta calisir.
 *  - integration : GERCEK PostgreSQL'e baglanir. Transaction butunlugu, kismi
 *                  indeksler, yaris kosullari ve izin kontrolleri burada test
 *                  edilir - cunku bunlar yalnizca gercek veritabaninda kanitlanabilir.
 */
export default defineConfig({
  resolve: {
    alias: { "@": resolve(kok, "./src") },
  },
  test: {
    projects: [
      {
        resolve: { alias: { "@": resolve(kok, "./src") } },
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        resolve: { alias: { "@": resolve(kok, "./src") } },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/integration/setup.ts"],
          // Ayni veritabanini paylasan testler sirayla calisir.
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
