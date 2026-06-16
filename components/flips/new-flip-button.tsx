"use client";

import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

export function NewFlipButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("MA");
  const [zip, setZip] = useState("");

  async function handleCreate() {
    if (!address.trim() || !city.trim()) {
      toast.error("Endereço e cidade são obrigatórios");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();

    // 1) Lead sintético com source='flip' (req: leads obriga lead_id em jobs)
    const leadName = `Flip — ${address.trim()}`;
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        name: leadName,
        source: "flip",
        service_interest: "other",
        city: city.trim(),
        state: state.trim() || "MA",
        address: address.trim(),
        zip: zip.trim() || null,
        stage: "ganho",
        notes: "Lead sintético — criado pelo módulo de Flip.",
      })
      .select("id")
      .single();

    if (leadError || !lead) {
      setSaving(false);
      toast.error(`Erro ao criar lead: ${leadError?.message ?? "?"}`);
      return;
    }

    // 2) Job com is_flip=true (trigger auto-cria pelo stage=ganho? sim, então vou pegar)
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("lead_id", lead.id);

    let jobId = jobs?.[0]?.id;

    if (!jobId) {
      // Trigger não criou — cria manual
      const { data: job, error: jobError } = await supabase
        .from("jobs")
        .insert({
          lead_id: lead.id,
          value: 0,
          current_phase: "planning",
          is_flip: true,
        })
        .select("id")
        .single();

      if (jobError || !job) {
        setSaving(false);
        toast.error(`Erro ao criar job: ${jobError?.message ?? "?"}`);
        return;
      }
      jobId = job.id;
    } else {
      // Trigger criou — só marca is_flip=true
      await supabase
        .from("jobs")
        .update({ is_flip: true })
        .eq("id", jobId);
    }

    // 3) flip_details
    const { error: flipError } = await supabase.from("flip_details").insert({
      job_id: jobId,
      property_address: address.trim(),
      property_city: city.trim(),
      property_state: state.trim() || "MA",
      property_zip: zip.trim() || null,
    });

    setSaving(false);

    if (flipError) {
      toast.error(`Erro ao criar detalhes do flip: ${flipError.message}`);
      return;
    }

    toast.success("Flip criado!");
    setOpen(false);
    router.push(`/job/${jobId}`);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Novo Flip
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Flip</DialogTitle>
            <DialogDescription>
              Endereço do imóvel. Resto preenche depois no detalhe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="flip-address">Endereço *</Label>
              <Input
                id="flip-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="66-68 Farragut Ave"
                disabled={saving}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="flip-city">Cidade *</Label>
                <Input
                  id="flip-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Somerville"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="flip-state">Estado</Label>
                <Input
                  id="flip-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  maxLength={2}
                  disabled={saving}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="flip-zip">ZIP</Label>
              <Input
                id="flip-zip"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="02143"
                disabled={saving}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Criar Flip
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
