/**
 * POST /api/permits/import
 *
 * Recebe batch de permits do scraper Python (Lincoln/Concord/etc).
 * Faz upsert idempotente por (source_city, external_id) — pode rodar
 * todo dia que não duplica.
 *
 * Auth: Bearer token via PERMITS_IMPORT_SECRET no header.
 *
 * Body esperado:
 * {
 *   "permits": [
 *     {
 *       "external_id": "PB-2026-001234",
 *       "source_city": "Lincoln",
 *       "address": "123 Main St",
 *       "city": "Lincoln",
 *       "state": "MA",
 *       "zip": "01773",
 *       "service_type": "deck",
 *       "estimated_value": 25000,
 *       "owner_name": "John Smith",
 *       "owner_phone": null,
 *       "contractor_name": null,
 *       "issued_at": "2026-05-20",
 *       "permit_number": "B-2026-1234",
 *       "source_url": "https://lincoln.gov/permit/1234",
 *       "raw_data": { ... }
 *     }
 *   ]
 * }
 *
 * Response: { ok: true, inserted: 12, updated: 5, total: 17 }
 */

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase-server";
import type { PermitInsert, ServiceType } from "@/lib/types";

const VALID_SERVICES: ServiceType[] = [
  "deck",
  "siding",
  "patio",
  "multiple",
  "other",
];

type IncomingPermit = Partial<PermitInsert> & {
  external_id: string;
  source_city: string;
  address: string;
  city: string;
};

export async function POST(req: Request) {
  // Auth via Bearer token
  const authHeader = req.headers.get("authorization");
  const expectedSecret = process.env.PERMITS_IMPORT_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "PERMITS_IMPORT_SECRET não configurado no Vercel env" },
      { status: 500 },
    );
  }
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: { permits?: IncomingPermit[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 });
  }

  if (!body.permits || !Array.isArray(body.permits)) {
    return NextResponse.json(
      { error: "Campo 'permits' (array) é obrigatório" },
      { status: 400 },
    );
  }

  // Sanitiza payload — só campos válidos do schema
  const sanitized: PermitInsert[] = [];
  const errors: Array<{ idx: number; error: string }> = [];

  body.permits.forEach((p, idx) => {
    if (!p.external_id || !p.source_city || !p.address || !p.city) {
      errors.push({
        idx,
        error: "Campos obrigatórios: external_id, source_city, address, city",
      });
      return;
    }

    const serviceType: ServiceType = VALID_SERVICES.includes(
      p.service_type as ServiceType,
    )
      ? (p.service_type as ServiceType)
      : "other";

    sanitized.push({
      external_id: p.external_id,
      source_city: p.source_city,
      source_url: p.source_url ?? null,
      permit_number: p.permit_number ?? null,
      address: p.address,
      city: p.city,
      state: p.state ?? "MA",
      zip: p.zip ?? null,
      service_type: serviceType,
      service_description: p.service_description ?? null,
      estimated_value:
        typeof p.estimated_value === "number" ? p.estimated_value : null,
      owner_name: p.owner_name ?? null,
      owner_phone: p.owner_phone ?? null,
      owner_email: p.owner_email ?? null,
      contractor_name: p.contractor_name ?? null,
      contractor_phone: p.contractor_phone ?? null,
      issued_at: p.issued_at ?? null,
      expires_at: p.expires_at ?? null,
      status: p.status ?? "active",
      raw_data: p.raw_data ?? null,
    });
  });

  if (sanitized.length === 0) {
    return NextResponse.json(
      { error: "Nenhum permit válido pra importar", details: errors },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  // Upsert por (source_city, external_id)
  const { data, error } = await supabase
    .from("permits")
    .upsert(sanitized, {
      onConflict: "source_city,external_id",
      ignoreDuplicates: false,
    })
    .select("id");

  if (error) {
    return NextResponse.json(
      { error: `Erro no upsert: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    received: body.permits.length,
    validated: sanitized.length,
    upserted: data?.length ?? 0,
    errors: errors.length > 0 ? errors : undefined,
  });
}
