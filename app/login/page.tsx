import { Suspense } from "react";

import { DecorBackground } from "@/components/decor-background";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Entrar — CRM JCN",
};

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-6 py-16">
      <DecorBackground />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            CRM JCN
          </span>
          <h1 className="text-4xl font-black leading-[1.05] tracking-[-0.03em] text-white md:text-5xl">
            Entrar
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-[1.7] text-white/55">
            Coloca o email do dono. Cai um link mágico no inbox em até 30
            segundos.
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs uppercase tracking-[0.2em] text-white/35">
          Acesso restrito · single user
        </p>
      </div>
    </main>
  );
}
