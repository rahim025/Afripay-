-- Schéma AfriPay pour Supabase (Postgres)
-- À exécuter dans Supabase → SQL Editor (une seule fois).

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────
-- Table users
-- ─────────────────────────────────────────────────────────
create table if not exists public.users (
  id                        uuid primary key default gen_random_uuid(),
  nom                       text not null,
  email                     text not null unique,
  mot_de_passe              text not null,
  pays                      text not null,
  devise                    text not null default 'XOF',
  solde                     numeric(14, 2) not null default 0,
  verifie                   boolean not null default false,
  code_verification         text,
  code_verification_expire  timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (email);

-- ─────────────────────────────────────────────────────────
-- Table transactions
-- ─────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id               uuid primary key default gen_random_uuid(),
  expediteur_id    uuid not null references public.users (id),
  destinataire_id  uuid not null references public.users (id),
  montant_envoye   numeric(14, 2) not null,
  devise_envoyee   text not null,
  montant_recu     numeric(14, 2) not null,
  devise_recue     text not null,
  taux_applique    numeric(14, 6) not null,
  statut           text not null default 'en_attente'
                     check (statut in ('en_attente', 'complete', 'echoue')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists transactions_expediteur_idx on public.transactions (expediteur_id);
create index if not exists transactions_destinataire_idx on public.transactions (destinataire_id);

-- ─────────────────────────────────────────────────────────
-- updated_at automatique
-- ─────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.users;
create trigger set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.transactions;
create trigger set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────
-- L'API backend accède à ces tables avec la clé "service_role", qui
-- contourne le RLS. On active quand même le RLS et on ne crée AUCUNE
-- policy publique : ça empêche toute lecture/écriture directe via la
-- clé "anon" (par ex. si elle fuitait dans le frontend un jour).
alter table public.users enable row level security;
alter table public.transactions enable row level security;
