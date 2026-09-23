# WolfSocial

Plataforma de agendamento e publicacao de conteudo no Instagram, criada para
divulgar os SaaS da Wolfsistemas. Comeca como uso pessoal, mas ja nasce
preparada para multi-tenant.

## Arquitetura

- **Frontend:** Vite + React + TypeScript + Tailwind, publicado no GitHub Pages.
- **Backend:** Supabase (Postgres + Row Level Security + Storage + Edge Functions).
- **Publicacao:** API oficial do Instagram (Content Publishing) via Edge Functions.
- **Midia:** Supabase Storage (bucket publico `media`), pois a Meta exige URL
  publica HTTPS.

O GitHub Pages e estatico, por isso o Next.js nao serviria (sem API routes).
Todo o backend vive no Supabase.

## Estrutura

```
src/                     Frontend (paginas, componentes, acesso a dados)
supabase/migrations/     Schema do banco (multi-tenant + RLS + storage + ads)
supabase/functions/      Edge Functions (OAuth, publicacao, refresh de token)
.github/workflows/       Deploy automatico para o GitHub Pages
SETUP.md                 Passo a passo de configuracao e etapas de teste
docs/FACEBOOK.md         Configuracao do Facebook Login for Business e anuncios
docs/WHATSAPP.md         WhatsApp Cloud API (conexao, webhook, envio, templates)
```

## Pre-requisitos

- Node.js 22+
- Conta no Supabase
- App no Meta for Developers com Instagram + Facebook Login

## Desenvolvimento

```bash
npm install
cp .env.example .env
npm run dev
```

## Build

```bash
npm run typecheck
npm run build
```

## Licenca

Projeto privado da Wolfsistemas.
