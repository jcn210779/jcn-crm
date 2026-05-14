import { AppHeader } from "@/components/app-header";
import { DecorBackground } from "@/components/decor-background";
import { NewLeadForm } from "@/components/lead/new-lead-form";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Novo lead — CRM JCN",
};

export default async function NewLeadPage() {
  const user = await requireUser();
  return (
    <main className="relative min-h-screen pb-24">
      <DecorBackground />
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Novo lead"
      />
      <div className="mx-auto mt-6 max-w-2xl px-4 md:px-6">
        <NewLeadForm />
      </div>
    </main>
  );
}
