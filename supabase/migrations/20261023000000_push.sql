-- Avisos con la app cerrada: cada teléfono que los activa guarda aquí su suscripción de Web Push.
-- El proceso de madrugada (api/nightly.ts) las lee con la clave de servicio y manda los avisos del hogar.

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  household_id uuid not null references public.households (id) on delete cascade,
  keys jsonb not null, -- p256dh y auth del navegador
  created_at timestamptz not null default now()
);
create index push_subscriptions_household_idx on public.push_subscriptions (household_id);

alter table public.push_subscriptions enable row level security;

create policy "ver mis avisos" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "activar avisos" on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()) and household_id = (select public.my_household()));
create policy "renovar avisos" on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and household_id = (select public.my_household()));
create policy "apagar avisos" on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- Plataformas de cada título de Mi lista en la última pasada de la madrugada, para avisar cuando algo llega.
-- Va aparte de settings porque la app reescribe settings entero y borraría esta foto.
alter table public.households add column provider_snapshot jsonb not null default '{}'::jsonb;
