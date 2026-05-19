/**
 * Templates dos e-mails de follow-up automático.
 *
 * Tom: profissional + acolhedor. Assinatura: José Neto, JCN Construction Inc.
 * Variáveis: {name}, {service}, {city}, {job_phase}, {days_since}.
 */

import type { FollowUpKind } from "./types";

const SIGNATURE = `

Best regards,
José Neto
JCN Construction Inc.
Licensed General Contractor
857-237-9554
info@jcnconstructioninc.com
jcnconstructioninc.com`;

export type TemplateInput = {
  name: string;
  service?: string; // "deck", "siding", "patio", "remodel", etc
  city?: string;
  jobPhase?: string; // "materials ordered", "in progress", etc
  daysSince?: number;
};

export type GeneratedTemplate = {
  subject: string;
  body: string;
};

const T: Record<FollowUpKind, (input: TemplateInput) => GeneratedTemplate> = {
  new_lead_4h: ({ name, service, city }) => ({
    subject: `Following up on your ${service ?? "project"} inquiry`,
    body: `Hi ${name},

Thanks for reaching out to JCN Construction about your ${service ?? "project"}${city ? ` in ${city}` : ""}.

I wanted to make sure your message got to the right place. I'll be giving you a call within the next hour to learn more about what you're looking for and schedule a free on-site visit.

In the meantime, if you have any questions or want to share photos of the area you'd like to work on, just reply to this email — I'm here to help.${SIGNATURE}`,
  }),

  estimate_sent_3d: ({ name, service, daysSince }) => ({
    subject: `Quick question about your ${service ?? "project"} estimate`,
    body: `Hi ${name},

I hope you're doing well. I'm following up on the estimate I sent ${daysSince ?? 3} days ago for your ${service ?? "project"}.

I know decisions like this take time, and I want to make sure you have everything you need. A few common questions homeowners ask at this stage:

- Want to walk through any line item again?
- Curious about timeline or scheduling options?
- Need more references from similar projects we've completed?

Just hit reply and let me know — I'm happy to clarify anything or hop on a quick call.${SIGNATURE}`,
  }),

  estimate_sent_7d: ({ name, service }) => ({
    subject: `Still here whenever you're ready, ${name}`,
    body: `Hi ${name},

Just a friendly check-in on the ${service ?? "project"} estimate. I know life gets busy, so no rush.

A couple things worth mentioning:
- Material prices can shift seasonally, so locking in soon usually means a better deal
- We typically book 2-3 weeks out, which can affect your project start date

If you've decided to go a different direction, no hard feelings — just let me know so I can close out the file on my end. Otherwise, I'm happy to revisit anything.${SIGNATURE}`,
  }),

  estimate_sent_14d: ({ name, service }) => ({
    subject: `Closing out your ${service ?? "project"} file?`,
    body: `Hi ${name},

It's been a couple weeks since I sent over the estimate for your ${service ?? "project"} and I haven't heard back, so I wanted to reach out one last time.

If you're still interested, I'd love to hear what's on your mind — happy to adjust the proposal, answer questions, or set up a quick call.

If the timing isn't right or you decided to go with someone else, that's completely fine. Just reply with a quick "not now" so I can update my records. No need for a long explanation.

Either way, thanks for considering JCN Construction.${SIGNATURE}`,
  }),

  job_phase_changed: ({ name, jobPhase }) => ({
    subject: `Update on your project — ${jobPhase ?? "progress update"}`,
    body: `Hi ${name},

Quick update on your project: we've moved into the "${jobPhase ?? "next phase"}" stage.

Here's what this means and what to expect next:
${phaseExplanation(jobPhase)}

If anything looks off or you have questions, just let me know. I'll keep you posted as we hit the next milestone.${SIGNATURE}`,
  }),
};

function phaseExplanation(phase?: string): string {
  switch ((phase ?? "").toLowerCase()) {
    case "permit released":
    case "permit_released":
      return "- The town has approved the permit and we're cleared to proceed\n- We'll order materials in the next few days\n- I'll let you know once delivery is scheduled";
    case "materials ordered":
    case "materials_ordered":
      return "- Materials are ordered and on their way\n- Typical lead time is 5-10 business days\n- Once they arrive, we'll schedule the start date with you";
    case "materials delivered":
    case "materials_delivered":
      return "- All materials have arrived at your property\n- We're ready to start work as scheduled\n- The crew will arrive on the agreed start date";
    case "work in progress":
    case "work_in_progress":
      return "- The crew is actively working on your project\n- Expect updates as we hit major milestones\n- Feel free to drop by anytime to see progress";
    case "completed":
      return "- All work is done and the site has been cleaned up\n- I'll be in touch shortly to schedule a final walkthrough\n- Thank you for trusting JCN with your project!";
    default:
      return "- We've moved to a new phase of your project\n- I'll share more details as we progress";
  }
}

export function generateTemplate(
  kind: FollowUpKind,
  input: TemplateInput,
): GeneratedTemplate {
  return T[kind](input);
}

export const FOLLOW_UP_KIND_LABEL: Record<FollowUpKind, string> = {
  new_lead_4h: "Lead novo (4h sem ação)",
  estimate_sent_3d: "Estimate enviado (3 dias)",
  estimate_sent_7d: "Estimate enviado (7 dias)",
  estimate_sent_14d: "Estimate enviado (14 dias — última)",
  job_phase_changed: "Mudança de fase do job",
};

export const FOLLOW_UP_STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando revisão",
  sent: "Enviado",
  skipped: "Pulado",
  failed: "Falhou",
};
