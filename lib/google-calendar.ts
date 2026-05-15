/**
 * Util pra gerar URL pré-preenchida do Google Calendar (sem OAuth).
 *
 * Estratégia: o CRM é fonte de verdade. O Calendar é só visualização
 * externa opcional. Usuário clica → abre janela do Google → confirma
 * → evento cai na agenda dele. Sem token, sem refresh, sem permissão.
 *
 * Formato do endpoint:
 *   https://www.google.com/calendar/render?action=TEMPLATE
 *     &text=<titulo>
 *     &details=<descricao>
 *     &dates=YYYYMMDDTHHmmssZ/YYYYMMDDTHHmmssZ   (UTC, sem traços/dois-pontos)
 */

type BuildArgs = {
  title: string;
  description?: string;
  /** Endereço físico — vira campo "Onde" no evento Google Calendar. */
  location?: string;
  /** Início — Date object ou string ISO. */
  startDate: Date | string;
  /** Duração em minutos. Default 30. */
  durationMinutes?: number;
};

const GCAL_BASE = "https://www.google.com/calendar/render";

/**
 * Formata Date em string UTC compacta no padrão exigido pelo Google Calendar:
 * `YYYYMMDDTHHmmssZ` (sem traços, sem dois-pontos, sufixo Z).
 */
function formatGcalDate(d: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

export function buildGoogleCalendarUrl({
  title,
  description,
  location,
  startDate,
  durationMinutes = 30,
}: BuildArgs): string {
  const start =
    typeof startDate === "string" ? new Date(startDate) : startDate;

  if (Number.isNaN(start.getTime())) {
    throw new Error("buildGoogleCalendarUrl: startDate inválida");
  }

  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatGcalDate(start)}/${formatGcalDate(end)}`,
  });

  if (description) {
    params.set("details", description);
  }

  if (location) {
    params.set("location", location);
  }

  return `${GCAL_BASE}?${params.toString()}`;
}
