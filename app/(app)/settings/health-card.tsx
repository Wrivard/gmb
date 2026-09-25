import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { worstStatus, type HealthCheck } from "@/lib/health/checks";
import { HealthTests } from "./health-tests";

// Présentation seule — la collecte vit dans page.tsx (serveur) et la
// logique dans lib/health/checks.ts (pure, testée).

const ICONS = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  critical: XCircle,
} as const;

const TONES = {
  ok: "text-success",
  warn: "text-warning",
  critical: "text-destructive",
} as const;

const SUMMARY = {
  ok: { label: "Prêt", variant: "default" as const },
  warn: { label: "À regarder", variant: "secondary" as const },
  critical: { label: "Bloquant", variant: "destructive" as const },
};

function CheckList({ checks }: { checks: HealthCheck[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {checks.map((check) => {
        const Icon = ICONS[check.status];
        return (
          <li key={check.key} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <Icon
              className={`mt-0.5 size-4 shrink-0 ${TONES[check.status]}`}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">{check.label}</p>
              <p className="text-sm text-muted-foreground">{check.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function HealthCard({ checks }: { checks: HealthCheck[] }) {
  const overall = worstStatus(checks);
  const summary = SUMMARY[overall];
  const attention = checks.filter((check) => check.status !== "ok");
  const healthy = checks.filter((check) => check.status === "ok");

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Diagnostic de production</CardTitle>
          <Badge variant={summary.variant}>{summary.label}</Badge>
        </div>
        <CardDescription>
          Aucune valeur secrète n&apos;est affichée — seulement leur présence.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Ce qui demande une action d'abord, en clair ; le reste replié.
            Onze lignes dont neuf vertes enterraient les deux qui comptent. */}
        {attention.length > 0 && <CheckList checks={attention} />}
        {healthy.length > 0 && (
          <details className="group mt-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <CheckCircle2 className="size-4 text-success" aria-hidden />
              {healthy.length} vérification{healthy.length > 1 ? "s" : ""} au
              vert
              <span className="text-xs group-open:hidden">— afficher</span>
            </summary>
            <div className="mt-3">
              <CheckList checks={healthy} />
            </div>
          </details>
        )}
        <HealthTests />
      </CardContent>
    </Card>
  );
}
