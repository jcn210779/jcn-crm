"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { maskPhoneInput } from "@/lib/format";
import {
  SERVICE_LABEL,
  SOURCE_LABEL,
  TARGET_CITIES,
} from "@/lib/labels";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  LEAD_SOURCES,
  SERVICE_TYPES,
  type LeadInsert,
  type LeadSource,
  type ServiceType,
} from "@/lib/types";

const schema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  phone: z
    .string()
    .optional()
    .refine(
      (v) => !v || v.replace(/\D/g, "").length >= 10,
      "Telefone precisa ter 10 dígitos",
    ),
  city: z.string().min(2, "Cidade é obrigatória"),
  service_interest: z.enum(
    SERVICE_TYPES as readonly [ServiceType, ...ServiceType[]],
  ),
  source: z.enum(LEAD_SOURCES as readonly [LeadSource, ...LeadSource[]]),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional(),
  zip: z.string().optional(),
  estimated_value: z
    .string()
    .optional()
    .refine(
      (v) => !v || !Number.isNaN(Number(v.replace(/[^0-9.]/g, ""))),
      "Valor inválido",
    ),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function NewLeadForm() {
  const router = useRouter();
  const datalistId = useId();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      phone: "",
      city: "",
      service_interest: "deck",
      source: "direct",
      email: "",
      address: "",
      zip: "",
      estimated_value: "",
      notes: "",
    },
    mode: "onBlur",
  });

  const onSubmit = async (values: FormValues) => {
    const supabase = createSupabaseBrowserClient();

    const payload: LeadInsert = {
      name: values.name.trim(),
      city: values.city.trim(),
      service_interest: values.service_interest,
      source: values.source,
      phone: values.phone?.trim() || null,
      email: values.email?.trim() || null,
      address: values.address?.trim() || null,
      zip: values.zip?.trim() || null,
      estimated_value: values.estimated_value
        ? Number(values.estimated_value.replace(/[^0-9.]/g, ""))
        : null,
      notes: values.notes?.trim() || null,
    };

    const { error } = await supabase.from("leads").insert(payload);

    if (error) {
      toast.error("Não consegui criar o lead", { description: error.message });
      return;
    }

    toast.success("Lead criado", { description: values.name });
    router.push("/");
    router.refresh();
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-6 backdrop-blur-xl md:p-8"
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white/45 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Pipeline
        </Link>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
          Cadastro rápido · 5 campos obrigatórios
        </span>
      </div>

      <h2 className="text-2xl font-black tracking-[-0.02em] text-white">
        Novo lead
      </h2>
      <p className="mt-1 text-sm text-white/55">
        Adicione em menos de 30 segundos. Detalhes podem entrar depois.
      </p>

      {/* Bloco obrigatorios */}
      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <Field
          label="Nome completo *"
          error={form.formState.errors.name?.message}
        >
          <Input
            autoFocus
            autoComplete="name"
            placeholder="Ex: Mike Johnson"
            className="h-12 border-white/10 bg-white/[0.03] text-base"
            {...form.register("name")}
          />
        </Field>

        <Field
          label="Telefone *"
          error={form.formState.errors.phone?.message}
        >
          <Input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(617) 555-0199"
            className="h-12 border-white/10 bg-white/[0.03] text-base"
            value={form.watch("phone") ?? ""}
            onChange={(e) => {
              form.setValue("phone", maskPhoneInput(e.target.value), {
                shouldValidate: true,
              });
            }}
          />
        </Field>

        <Field
          label="Cidade *"
          error={form.formState.errors.city?.message}
        >
          <Input
            list={datalistId}
            autoComplete="address-level2"
            placeholder="Lexington"
            className="h-12 border-white/10 bg-white/[0.03] text-base"
            {...form.register("city")}
          />
          <datalist id={datalistId}>
            {TARGET_CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field
          label="Serviço *"
          error={form.formState.errors.service_interest?.message}
        >
          <Select
            value={form.watch("service_interest")}
            onValueChange={(v) =>
              form.setValue("service_interest", v as ServiceType, {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="h-12 border-white/10 bg-white/[0.03] text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SERVICE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Fonte *"
          error={form.formState.errors.source?.message}
          className="md:col-span-2"
        >
          <Select
            value={form.watch("source")}
            onValueChange={(v) =>
              form.setValue("source", v as LeadSource, {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="h-12 border-white/10 bg-white/[0.03] text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </section>

      {/* Bloco opcional */}
      <div className="mt-8 mb-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/[0.06]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/35">
          Opcionais
        </span>
        <div className="h-px flex-1 bg-white/[0.06]" />
      </div>

      <section className="grid gap-5 md:grid-cols-2">
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="mike@example.com"
            className="h-11 border-white/10 bg-white/[0.03]"
            {...form.register("email")}
          />
        </Field>

        <Field label="Endereço">
          <Input
            placeholder="42 Maple St"
            className="h-11 border-white/10 bg-white/[0.03]"
            {...form.register("address")}
          />
        </Field>

        <Field label="ZIP">
          <Input
            inputMode="numeric"
            placeholder="02421"
            className="h-11 border-white/10 bg-white/[0.03]"
            {...form.register("zip")}
          />
        </Field>

        <Field
          label="Valor estimado"
          error={form.formState.errors.estimated_value?.message}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-white/45">
              $
            </span>
            <Input
              inputMode="decimal"
              placeholder="25000"
              className="h-11 border-white/10 bg-white/[0.03] pl-8"
              {...form.register("estimated_value")}
            />
          </div>
        </Field>

        <Field label="Notas" className="md:col-span-2">
          <Textarea
            rows={3}
            placeholder="Ex: deck 16x20 com escadaria, quer começar em agosto"
            className="resize-none border-white/10 bg-white/[0.03]"
            {...form.register("notes")}
          />
        </Field>
      </section>

      <div className="mt-8 flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-end">
        <Button
          asChild
          type="button"
          variant="ghost"
          className="h-11 text-white/65"
        >
          <Link href="/">Cancelar</Link>
        </Button>
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="h-12 px-6 text-sm font-bold tracking-tight"
        >
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Criar lead
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="text-xs font-bold uppercase tracking-[0.15em] text-white/55">
        {label}
      </Label>
      <div className="mt-2">{children}</div>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>
      )}
    </div>
  );
}
