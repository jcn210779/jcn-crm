/**
 * Modo de visualização — JCN (operação de jobs cliente) ou Flip (investimento).
 *
 * O modo é armazenado em cookie ('view-mode') pra server components lerem
 * durante o render. Client sincroniza cookie + localStorage no toggle.
 *
 * Regra: default = 'jcn' (o modo original do CRM).
 */

import { cookies } from "next/headers";

export type ViewMode = "jcn" | "flip";

export const VIEW_MODE_COOKIE = "view-mode";

export function getViewMode(): ViewMode {
  const store = cookies();
  const val = store.get(VIEW_MODE_COOKIE)?.value;
  return val === "flip" ? "flip" : "jcn";
}

export function isFlipMode(): boolean {
  return getViewMode() === "flip";
}
