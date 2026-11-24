-- Caixa Pessoal — tabelas, segurança e bucket no Supabase
-- Rode no SQL Editor do projeto do Supabase dedicado à Caixa Pessoal.
-- Depois preencha supabaseUrl e supabaseKey na seção 3 do index.html.

create table if not exists caixa_colunas (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);

create table if not exists caixa_itens (
  id text primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);

alter table caixa_colunas enable row level security;
alter table caixa_itens   enable row level security;

-- Permite que usuários logados usem as tabelas pela API (o RLS abaixo limita a cada um o que é seu)
grant usage on schema public to authenticated;
grant select, insert, update, delete on caixa_colunas, caixa_itens to authenticated;

-- Cada pessoa só vê e mexe no que é dela
drop policy if exists "caixa_colunas_dono" on caixa_colunas;
create policy "caixa_colunas_dono" on caixa_colunas
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "caixa_itens_dono" on caixa_itens;
create policy "caixa_itens_dono" on caixa_itens
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Bucket privado para arquivos e prints (cada usuário numa pasta com o próprio id)
insert into storage.buckets (id, name, public) values ('caixa', 'caixa', false)
  on conflict (id) do nothing;

drop policy if exists "caixa_arquivos_dono" on storage.objects;
create policy "caixa_arquivos_dono" on storage.objects
  for all to authenticated
  using (bucket_id = 'caixa' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'caixa' and (storage.foldername(name))[1] = auth.uid()::text);
