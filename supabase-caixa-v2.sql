-- Caixa Pessoal — atualização 2 (novembro de 2026)
-- Rode uma vez no SQL Editor do projeto do Supabase da Caixa. Pode rodar de novo sem problema.
-- Cria a tabela dos aparelhos que recebem os avisos de ideias paradas.
-- Nada do que já existe é alterado: lixeira, checklist, "A fazer" etc. ficam dentro de "dados".

create table if not exists caixa_push (
  endpoint  text primary key,
  owner_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  inscricao jsonb not null,
  aparelho  text,
  criado_em timestamptz not null default now()
);

alter table caixa_push enable row level security;
grant select, insert, update, delete on caixa_push to authenticated;

drop policy if exists "caixa_push_dono" on caixa_push;
create policy "caixa_push_dono" on caixa_push
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Marca "avisadoEm" dentro do JSON do item sem mexer no resto (usada só pela função dos avisos)
create or replace function public.caixa_marcar_avisado(item_id text, quando text)
  returns void language sql security definer set search_path = '' as $$
  update public.caixa_itens set dados = jsonb_set(dados, '{avisadoEm}', to_jsonb(quando)) where id = item_id;
$$;
revoke all on function public.caixa_marcar_avisado(text, text) from public, anon, authenticated;
grant execute on function public.caixa_marcar_avisado(text, text) to service_role;
