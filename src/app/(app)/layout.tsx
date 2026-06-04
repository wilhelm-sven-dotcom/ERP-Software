import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";
import { getCompanySettings } from "@/lib/data/settings";
import { isAiConfigured } from "@/lib/ai/openai";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const company = await getCompanySettings();
  const logoUrl = company.logo_url ?? null;
  const aiEnabled = isAiConfigured();
  return (
    <div className="flex min-h-svh">
      <Sidebar logoUrl={logoUrl} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar logoUrl={logoUrl} aiEnabled={aiEnabled} />
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-5 sm:p-7 lg:p-8">{children}</main>
      </div>
      <WelcomeTour />
    </div>
  );
}
