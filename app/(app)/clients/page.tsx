import Link from "next/link";
import { getSessionContext } from "@/lib/auth";
import { getDb } from "@/lib/supabase/db";
import { supabaseConfigured } from "@/lib/env";
import { DemoBanner } from "@/components/layout/demo-banner";
import { demoClientRows, type DemoClientRow } from "@/lib/demo";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const demo = !supabaseConfigured();
  let clients: DemoClientRow[] = [];

  if (demo) {
    clients = demoClientRows();
  } else {
    const { member } = await getSessionContext();
    if (!member) return null; // Le layout gère la whitelist.

    const supabase = await getDb();
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("agency_id", member.agency_id)
      .order("name");
    clients = data ?? [];
  }

  return (
    <div className="flex flex-col gap-4">
      {demo && <DemoBanner />}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Les fiches découvertes via la connexion Google de l&apos;agence.
        </p>
      </div>

      {clients?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Cadence</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell>
                  <Link
                    href={`/clients/${client.id}`}
                    className="font-medium hover:underline"
                  >
                    {client.name}
                  </Link>
                  {client.address && (
                    <div className="text-xs text-muted-foreground">
                      {client.address}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {client.primary_category ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {client.posts_per_month} post
                  {client.posts_per_month > 1 ? "s" : ""}/mois
                </TableCell>
                <TableCell>
                  {client.status === "active" ? (
                    <Badge variant="default">Actif</Badge>
                  ) : client.status === "paused" ? (
                    <Badge variant="secondary">En pause</Badge>
                  ) : (
                    <Badge variant="destructive">Déconnecté</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Aucune fiche — connecte le compte Google dans{" "}
          <Link href="/settings" className="underline">
            Réglages
          </Link>
          .
        </p>
      )}
    </div>
  );
}
