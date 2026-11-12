-- Avisos con la app cerrada: cada teléfono que los activa guarda aquí su suscripción de Web Push.
-- El proceso de madrugada (api/nightly.ts) las lee con la clave de servicio y manda los avisos del hogar.

create table public.push_subscriptions (
  -- solo servicios de avisos conocidos: el proceso de madrugada hace pedidos a esta dirección
  endpoint text primary key check (endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com)/'),
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

-- Al unirse al hogar de la pareja, sus avisos se mudan con ella (igual que sus votos)
create or replace function public.join_household(code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  old uuid;
begin
  select id into target from public.households where invite_code = upper(trim(code));
  if target is null then raise exception 'Código no válido'; end if;
  if (select count(*) from public.profiles where household_id = target and id <> auth.uid()) >= 2 then
    raise exception 'Ese hogar ya está completo';
  end if;
  select household_id into old from public.profiles where id = auth.uid();
  if old = target then return target; end if;
  update public.profiles set household_id = target where id = auth.uid();
  update public.votes set household_id = target where user_id = auth.uid();
  update public.push_subscriptions set household_id = target where user_id = auth.uid();
  if old is not null and not exists (select 1 from public.profiles where household_id = old) then
    delete from public.households where id = old;
  end if;
  return target;
end $$;
