import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Deux environnements, séparés par l'extension du fichier de test :
//   *.test.ts   → node, pour la logique pure (rapide, sans DOM) ;
//   *.test.tsx  → jsdom, pour le rendu de composants.
// La palette de commandes plantait en production alors que 110 tests
// passaient : il n'existait aucun test capable de rendre un composant.

const shared = {
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
};

const exclude = ["node_modules", ".next"];

export default defineConfig({
  test: {
    projects: [
      {
        ...shared,
        test: {
          name: "unit",
          environment: "node",
          include: ["**/*.test.ts"],
          exclude,
        },
      },
      {
        ...shared,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
          exclude,
        },
      },
    ],
  },
});
