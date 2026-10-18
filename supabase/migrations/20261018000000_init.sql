-- Hoy Vemos: hogares (la pareja), perfiles, votos, lista compartida y listas diarias.
-- Cada persona tiene su cuenta; dos cuentas comparten un hogar unido con un código de invitación.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  settings jsonb not null default '{"minImdb": 7, "platforms": []}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  household_id uuid references public.households (id) on delete set null,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);
create index profiles_household_idx on public.profiles (household_id);

create table public.votes (
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  title_id text not null,
  kind text not null check (kind in ('liked', 'disliked', 'seen', 'passed')),
  created_at timestamptz not null default now(),
  primary key (user_id, title_id, kind)
);
create index votes_household_idx on public.votes (household_id);

create table public.list_items (
  household_id uuid not null references public.households (id) on delete cascade,
  title_id text not null,
  added_by uuid references auth.users (id) on delete set null default auth.uid(),
  watched_at timestamptz, -- la vieron juntos: deja de recomendarse a los dos
  created_at timestamptz not null default now(),
  primary key (household_id, title_id)
);

create table public.daily_lists (
  household_id uuid not null references public.households (id) on delete cascade,
  date date not null,
  together text[] not null,
  reasons jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (household_id, date)
);

-- Hogar de quien hace la consulta (security definer para no recursar en las políticas de profiles)
create function public.my_household() returns uuid
language sql stable security definer set search_path = '' as $$
  select household_id from public.profiles where id = auth.uid()
$$;

-- Al registrarse: perfil y hogar propio (luego puede unirse al de su pareja)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare h uuid;
begin
  insert into public.households default values returning id into h;
  insert into public.profiles (id, name, household_id)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), h);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Unirse al hogar de la pareja con su código. Se lleva sus votos; el hogar anterior se borra si queda vacío.
create function public.join_household(code text) returns uuid
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
  if old is not null and not exists (select 1 from public.profiles where household_id = old) then
    delete from public.households where id = old;
  end if;
  return target;
end $$;

revoke execute on function public.join_household(text) from public, anon;
grant execute on function public.join_household(text) to authenticated;
revoke execute on function public.my_household() from public, anon;
grant execute on function public.my_household() to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.votes enable row level security;
alter table public.list_items enable row level security;
alter table public.daily_lists enable row level security;

create policy "ver mi hogar" on public.households for select to authenticated using (id = (select public.my_household()));
create policy "editar mi hogar" on public.households for update to authenticated using (id = (select public.my_household())) with check (id = (select public.my_household()));

create policy "ver perfiles de mi hogar" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or household_id = (select public.my_household()));
create policy "editar mi perfil" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and household_id is not distinct from (select public.my_household()));

create policy "ver votos de mi hogar" on public.votes for select to authenticated using (household_id = (select public.my_household()));
create policy "votar" on public.votes for insert to authenticated with check (user_id = (select auth.uid()) and household_id = (select public.my_household()));
create policy "borrar mis votos" on public.votes for delete to authenticated using (user_id = (select auth.uid()));

create policy "ver lista" on public.list_items for select to authenticated using (household_id = (select public.my_household()));
create policy "agregar a la lista" on public.list_items for insert to authenticated with check (household_id = (select public.my_household()));
create policy "marcar como vista" on public.list_items for update to authenticated using (household_id = (select public.my_household())) with check (household_id = (select public.my_household()));
create policy "quitar de la lista" on public.list_items for delete to authenticated using (household_id = (select public.my_household()));

create policy "ver listas diarias" on public.daily_lists for select to authenticated using (household_id = (select public.my_household()));
create policy "crear lista diaria" on public.daily_lists for insert to authenticated with check (household_id = (select public.my_household()));
create policy "rehacer lista diaria" on public.daily_lists for update to authenticated using (household_id = (select public.my_household())) with check (household_id = (select public.my_household()));

-- Realtime: los cambios de la pareja llegan al instante (votos, coincidencias, lista, ajustes)
alter publication supabase_realtime add table public.votes, public.list_items, public.daily_lists, public.households, public.profiles;
