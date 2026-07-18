-- One-time OAuth state store (CSRF + replay protection). Service-role only.
create table if not exists public.oauth_sessions (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  shop_domain text not null,
  created_at timestamptz not null default now()
);
alter table public.oauth_sessions enable row level security;
create index if not exists oauth_sessions_user_id_idx on public.oauth_sessions (user_id);

-- Non-destructive metadata columns for OAuth installations (existing rows unaffected).
alter table public.stores add column if not exists shop_id text;
alter table public.stores add column if not exists installed_at timestamptz;
alter table public.stores add column if not exists timezone text;
alter table public.stores add column if not exists auth_method text not null default 'custom_app_token';
