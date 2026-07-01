import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="pl-60">
        <Topbar />
        <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
