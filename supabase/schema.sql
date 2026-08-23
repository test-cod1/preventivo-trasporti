-- ============================================================
--  PREVENTIVI TRASPORTI SANITARI — schema Supabase
--  Esegui questo file nell'editor SQL di Supabase (SQL Editor > New query).
--  Progetto dedicato (CRIGenova's Org). Crea tutto da zero.
--  GIA' ESEGUITO il 2026-08-07 sul progetto qgqjczswthmfxltztmgi.
-- ============================================================

-- ---------- PROFILI ----------
create table if not exists public.profili (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text,
  ruolo text not null default 'lettore' check (ruolo in ('admin','operatore','lettore')),
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profili (id, email, nome)
  values (new.id, new.email, split_part(new.email,'@',1))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.puo_scrivere()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profili
    where id = auth.uid() and ruolo in ('admin','operatore')
  );
$$;

-- ---------- PREVENTIVI ----------
create table if not exists public.preventivi (
  id uuid primary key default gen_random_uuid(),
  titolo text,
  cliente text,
  data_servizio date,
  stato text not null default 'bozza' check (stato in ('bozza','inviato','confermato','annullato')),
  note text,
  tappe jsonb default '[]'::jsonb,        -- destinazioni [{label,lon,lat,iso2,iso3,paese}]
  andata_ritorno boolean default true,
  km_auto boolean default true,
  km_totali numeric(10,1),
  paese_dest text,                        -- ISO alpha-2 destinazione
  paese_dest_nome text,
  input jsonb,                            -- tutti i parametri di calcolo
  risultato jsonb,                        -- spesaReale, addebito, margine, ...
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_prev_created on public.preventivi(created_at desc);
create index if not exists idx_prev_stato on public.preventivi(stato);

-- ---------- IMPOSTAZIONI (singleton) ----------
create table if not exists public.impostazioni_trasferte (
  id text primary key default 'default',
  dati jsonb not null,
  updated_at timestamptz default now()
);

-- ============================================================
--  ROW LEVEL SECURITY
--  Utenti autenticati: LEGGONO. Admin/operatore: SCRIVONO.
-- ============================================================
alter table public.profili                enable row level security;
alter table public.preventivi             enable row level security;
alter table public.impostazioni_trasferte enable row level security;

drop policy if exists prof_self on public.profili;
create policy prof_self on public.profili for select using (id = auth.uid());
drop policy if exists prof_update_self on public.profili;
-- WITH CHECK esplicito: senza, la USING viene riusata anche dopo l'update e
-- non impedisce a un utente di cambiare il proprio "ruolo" (es. auto-promozione
-- ad admin). Il ruolo può essere cambiato solo restando invariato da qui;
-- va gestito da un admin con una query diretta o un'RPC dedicata.
create policy prof_update_self on public.profili for update
  using (id = auth.uid())
  with check (id = auth.uid() and ruolo = (select p.ruolo from public.profili p where p.id = auth.uid()));

drop policy if exists prev_read on public.preventivi;
create policy prev_read on public.preventivi for select using (auth.role() = 'authenticated');
drop policy if exists prev_write on public.preventivi;
create policy prev_write on public.preventivi for all
  using (public.puo_scrivere()) with check (public.puo_scrivere());

drop policy if exists imp_read on public.impostazioni_trasferte;
create policy imp_read on public.impostazioni_trasferte for select using (auth.role() = 'authenticated');
drop policy if exists imp_write on public.impostazioni_trasferte;
create policy imp_write on public.impostazioni_trasferte for all
  using (public.puo_scrivere()) with check (public.puo_scrivere());

-- ============================================================
--  NOTA: dopo aver eseguito lo schema, promuovi il tuo utente ad admin:
--    update public.profili set ruolo='admin' where email='tua@email';
--  (se riusi il progetto mezzi-cri e sei già admin, sei a posto)
-- ============================================================
