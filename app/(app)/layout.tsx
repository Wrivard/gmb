import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { AccessDenied } from "@/components/layout/access-denied";
import { getSessionContext } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let userEmail: string | null = null;
  let userRole: string | null = null;

  if (supabaseConfigured()) {
    const { user, member } = await getSessionContext();
    // Le middleware garantit une session; ici on applique la whitelist.
    if (user && !member) {
      return <AccessDenied email={user.email ?? "(sans courriel)"} />;
    }
    userEmail = member?.email ?? user?.email ?? null;
    userRole = member?.role ?? null;
  }

  return (
    <div className="min-h-screen">
      <Sidebar userEmail={userEmail} userRole={userRole} />
      <div className="pl-60">
        <Topbar />
        <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
