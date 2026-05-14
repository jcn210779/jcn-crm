import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Helper canonico do shadcn/ui pra mesclar classes Tailwind sem conflito.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
