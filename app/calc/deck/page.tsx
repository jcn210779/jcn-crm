import { AppHeader } from "@/components/app-header";
import { DeckCalculator } from "@/components/calc/deck-calculator";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Calculadora de deck — CRM JCN",
};

export default async function CalcDeckPage() {
  const user = await requireUser();

  return (
    <main className="relative min-h-screen pb-24">
      <AppHeader
        userEmail={user.email ?? ""}
        showNewLead={false}
        title="Calculadora deck"
      />
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-6">
        <div className="mb-5">
          <h1 className="text-2xl font-black tracking-tight text-jcn-ice">
            Calculadora de material — Deck
          </h1>
          <p className="mt-1 text-xs text-jcn-ice/55">
            Estimate só de material. Coloca as quantidades, ajusta preço se
            precisar, copia o resultado.
          </p>
        </div>
        <DeckCalculator />
      </div>
    </main>
  );
}
