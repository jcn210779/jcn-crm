# JCN Construction — CRM

Customer Relationship Management customizado pra JCN Construction Inc. — General Contractor licenciado em Massachusetts (deck, siding, pátio de pedra).

**Stack:** Next.js 14 (App Router) + TypeScript estrito + Tailwind + shadcn/ui + Supabase (Postgres + Auth + RLS + Realtime) + Vercel + PWA.

---

## Funcionalidades (Fase 1)

- Pipeline de leads com 7 etapas em Kanban drag-and-drop (desktop + mobile)
- Login via magic link no email (sem senha)
- Cadastro de novo lead com form mobile-first (máscara telefone US + autocomplete cidades-alvo)
- Detalhe do lead com timeline de atividade + histórico de etapas + edição inline
- Realtime entre dispositivos (atualiza no celular → reflete no desktop instantâneo)
- Instalável como PWA no iPhone/Android (manifest + service worker)
- Tema dark premium amber/dourado

## Roadmap (futuras fases)

- **Fase 2:** integração com agente de chat (linguagem natural cria/atualiza leads)
- **Fase 3:** follow-up automático + lembretes + Google Calendar
- **Fase 4:** Kanban de jobs em execução (obra em andamento)
- **Fase 5:** Dashboard com ROAS por fonte (Meta, Google, LSA, Permit, Zillow)

---

## Rodar local

Pré-requisitos: Node 18+ (testado em v24) e npm 10+.

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. Magic link cai no email cadastrado em ~30 segundos.

### Validação

```bash
npm run typecheck   # TS estrito
npm run lint        # next lint
npm run build       # build de produção
```

---

## Schema do banco

Migration completa em `supabase/migrations/0001_initial_schema.sql`.

Aplicação:
1. Dashboard Supabase do projeto → SQL Editor → New query
2. Cola o SQL → Run
3. Verifica em Database → Tables: `leads`, `stage_history`, `activity_log`

3 tabelas principais + enums + triggers + RLS policies + views auxiliares.

---

## Segurança

- **Publishable key Supabase é pública por design** — fica hardcoded em `lib/supabase-config.ts`. RLS no Postgres é o que blinda os dados (sem login = sem acesso).
- **Secret key NUNCA entra neste repo.** Fica em cofre offline (Apple Notes com Touch ID).
- **Todas as tabelas** têm RLS ativa com policy `auth.uid() IS NOT NULL`.

---

## Estrutura

```
.
├── app/                     ← Next.js App Router (login, lead, auth callback)
├── components/
│   ├── ui/                  ← shadcn/ui
│   ├── kanban/              ← Kanban board + colunas + cards
│   └── lead/                ← form novo lead + detalhe
├── lib/                     ← supabase clients, auth, types, labels, format
├── public/                  ← manifest PWA + ícones + service worker
├── scripts/                 ← gerador de ícones PWA (Python)
├── supabase/migrations/     ← SQL versionado
├── middleware.ts            ← auth middleware
└── package.json
```

---

## Licença

Proprietário — JCN Construction Inc.
