import { formatDistanceToNow } from "date-fns";
import { frCA } from "date-fns/locale";
import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";
import { env, supabaseConfigured } from "@/lib/env";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DemoBanner } from "@/components/layout/demo-banner";
import { ResyncButton } from "./resync-button";
import { TeamSection } from "./team-section";
import { DefaultsForm } from "./defaults-form";

export const metadata = { title: "Agence" };

const ERROR_MESSAGES: Record<string, string> = {
  oauth_state: "La vérification de sécurité OAuth a échoué — réessaie.",
  oauth_exchange: "L'échange du code Google a échoué — réessaie.",
  no_refresh_token:
    "Google n'a pas émis de refresh token. Révoque l'accès dans ton compte Google puis reconnecte.",
  owner_only: "Seul un admin peut gérer la connexion Google.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const params = await searchParams;

  if (!supabaseConfigured()) {
    return (
      <div className="flex max-w-4xl flex-col gap-6">
        <DemoBanner />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Agence</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connexion Google, équipe et défauts des nouveaux projets.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connexion Google</CardTitle>
            <CardDescription>
              Le compte manager qui donne accès aux fiches Google Business
              Profile des clients.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <p className="flex-1 text-sm text-muted-foreground">
              Aucun compte Google connecté. Les fiches clients apparaîtront
              automatiquement après la connexion.
            </p>
            <Button size="sm" disabled>
              Connecter Google
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Équipe</CardTitle>
            <CardDescription>
              Les membres autorisés à se connecter à l&apos;app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Courriel</TableHead>
                  <TableHead>Rôle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">
                    wrivard@kua.quebec
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">Admin</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">
                    gestion@kua.quebec
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">Membre</Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { member } = await getSessionContext();
  if (!member) return null; // Le layout gère la whitelist.
  const isOwner = member.role === "owner";

  const supabase = await getDb();
  const [
    { data: connection },
    { data: members },
    { data: agency },
  ] = await Promise.all([
    supabase
      .from("google_connections")
      .select("*")
      .eq("agency_id", member.agency_id)
      .maybeSingle(),
    supabase
      .from("agency_members")
      .select("*")
      .eq("agency_id", member.agency_id)
      .order("created_at"),
    supabase
      .from("agencies")
      .select("*")
      .eq("id", member.agency_id)
      .single(),
  ]);

  const errorMessage = params.error
    ? (ERROR_MESSAGES[params.error] ?? "Une erreur est survenue.")
    : null;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Agence</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connexion Google, équipe et défauts des nouveaux projets.
        </p>
      </div>

      {params.connected === "1" && (
        <Alert>
          <AlertDescription>
            Compte Google connecté — les fiches ont été découvertes.
          </AlertDescription>
        </Alert>
      )}
      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Connexion Google */}
      <Card>
        <CardHeader>
          <CardTitle>Connexion Google</CardTitle>
          <CardDescription>
            Le compte manager qui donne accès aux fiches Google Business
            Profile des clients.
            {env.gbpMode === "mock" && (
              <>
                {" "}
                <Badge variant="secondary">MODE DÉMO</Badge> — la connexion est
                simulée, aucune donnée Google réelle.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          {connection ? (
            <>
              <div className="flex flex-1 items-center gap-3">
                <Badge
                  variant={
                    connection.status === "active" ? "default" : "destructive"
                  }
                >
                  {connection.status === "active" ? "Connectée" : "Révoquée"}
                </Badge>
                <div className="text-sm">
                  <div className="font-medium">{connection.google_email}</div>
                  <div className="text-muted-foreground">
                    Connecté{" "}
                    {formatDistanceToNow(new Date(connection.connected_at), {
                      addSuffix: true,
                      locale: frCA,
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <ResyncButton />
                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<a href="/api/google/connect" />}
                  >
                    {connection.status === "active"
                      ? "Reconnecter"
                      : "Reconnecter maintenant"}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="flex-1 text-sm text-muted-foreground">
                Aucun compte Google connecté. Les fiches clients apparaîtront
                automatiquement après la connexion.
              </p>
              {isOwner ? (
                <Button size="sm" render={<a href="/api/google/connect" />}>
                  Connecter Google
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Demande à un admin de connecter le compte.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Équipe */}
      <Card>
        <CardHeader>
          <CardTitle>Équipe</CardTitle>
          <CardDescription>
            Whitelist des courriels autorisés à se connecter à l&apos;app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamSection
            members={members ?? []}
            currentMemberId={member.id}
            isOwner={isOwner}
          />
        </CardContent>
      </Card>

      {/* Défauts agence */}
      <Card>
        <CardHeader>
          <CardTitle>Défauts de l&apos;agence</CardTitle>
          <CardDescription>
            Appliqués aux nouvelles fiches découvertes (modifiables ensuite
            client par client).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DefaultsForm
            defaultPostsPerMonth={agency?.default_posts_per_month ?? 2}
            defaultLanguage={agency?.default_language ?? "fr-CA"}
            isOwner={isOwner}
          />
        </CardContent>
      </Card>
    </div>
  );
}
