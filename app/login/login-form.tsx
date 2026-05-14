"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

const schema = z.object({
  email: z
    .string()
    .min(1, "Email é obrigatório")
    .email("Email inválido"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";

  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
    mode: "onBlur",
  });

  const onSubmit = async (values: FormValues) => {
    const supabase = createSupabaseBrowserClient();

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
        : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });

    if (error) {
      toast.error("Não consegui enviar o link", { description: error.message });
      return;
    }

    setSentTo(values.email);
    toast.success("Link enviado", {
      description: "Verifica seu email. Cai link mágico em ~30s.",
    });
  };

  if (sentTo) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold tracking-[-0.02em] text-white">
          Link enviado
        </h2>
        <p className="mt-2 text-sm leading-[1.7] text-white/60">
          Mandei o link mágico pra{" "}
          <span className="font-semibold text-white">{sentTo}</span>. Abre seu
          inbox e clica. Costuma cair em até 30 segundos.
        </p>
        <button
          type="button"
          onClick={() => {
            setSentTo(null);
            form.reset();
          }}
          className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-white/45 transition hover:text-white"
        >
          Usar outro email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.15em] text-white/60">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="jose@jcnconstructioninc.com"
          className="h-12 border-white/10 bg-white/[0.03] text-base text-white placeholder:text-white/30 focus-visible:ring-primary/60"
          {...form.register("email")}
        />
        {form.formState.errors.email && (
          <p className="text-xs font-medium text-destructive">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="h-12 w-full text-sm font-bold tracking-tight"
      >
        {form.formState.isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando…
          </>
        ) : (
          <>
            Enviar link mágico
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}
