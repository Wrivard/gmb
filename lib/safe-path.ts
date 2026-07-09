// Valide un chemin de redirection interne fourni par l'URL (?back=, ?next=).
// `startsWith("/")` seul laisse passer les URLs protocol-relative
// (`//evil.com`, `/\evil.com`) que le navigateur résout hors domaine.
export function safeInternalPath(
  path: string | null | undefined,
  fallback = "/",
): string {
  if (!path || !path.startsWith("/")) return fallback;
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
  return path;
}
