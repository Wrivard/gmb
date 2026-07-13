import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Hôte Supabase Storage (images de posts) — dérivé de l'env pour ne pas
// hardcoder le ref du projet.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...(supabaseHost
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHost,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      // Fixtures du mode démo (lib/demo.ts).
      { protocol: "https" as const, hostname: "picsum.photos" },
      { protocol: "https" as const, hostname: "fastly.picsum.photos" },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: "kua",
  project: "kua-locale",
  // L'upload des source maps ne se fait que si SENTRY_AUTH_TOKEN est
  // présent au build (Vercel) ; sinon le build passe quand même.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
