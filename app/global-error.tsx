"use client";

// Filet de sécurité ultime (erreur dans le layout racine) : rend son
// propre <html> car le layout n'est plus disponible.

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#ededed",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>
            L&apos;application a rencontré une erreur
          </h1>
          <p style={{ fontSize: 14, color: "#a1a1a1", marginTop: 4 }}>
            Réessaie — si le problème persiste, préviens l&apos;équipe.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid #262626",
              background: "#3ecf8e",
              color: "#0a0a0a",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
