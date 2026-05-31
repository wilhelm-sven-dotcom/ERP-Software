import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserEmail } from "@/lib/supabase/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabaseConfigured = isSupabaseConfigured();
  const userEmail = await getCurrentUserEmail();

  return (
    <div className="flex min-h-svh">
      <Sidebar supabaseConfigured={supabaseConfigured} userEmail={userEmail} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
