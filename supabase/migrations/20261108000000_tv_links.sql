-- Entrar en el televisor con el celular: la TV pide un código, el celular (ya con sesión) lo aprueba y la TV
-- recibe su propia sesión. Solo la usa api/tv-link.ts con la clave de servicio: con RLS activo y sin políticas,
-- nadie la puede leer ni escribir desde la app.
create table if not exists public.tv_links (
  code text primary key,
  secret_hash text not null,
  user_id uuid references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.tv_links enable row level security;
