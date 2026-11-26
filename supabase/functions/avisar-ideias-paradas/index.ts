// Caixa Pessoal — avisos de ideias paradas
// Publicar no Supabase: Edge Functions › Deploy a new function › Via Editor › nome "avisar-ideias-paradas".
// Nos detalhes da função, deixe "Verify JWT" desligado: a função confere o acesso sozinha.
//
// Segredos (Edge Functions › Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CAIXA_CRON_SEGREDO.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem em toda função.
//
// Dois jeitos de chamar:
//  - Agendador diário (pg_cron), com o cabeçalho x-caixa-segredo: avisa todo mundo que tem ideias paradas.
//  - Botão "Mandar um aviso de teste" no app, com o login do usuário: avisa só ele, na hora.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-caixa-segredo",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:caixa@exemplo.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const DIA = 86_400_000;
const t = (x?: string | null) => (x ? Date.parse(x) || 0 : 0);
// deno-lint-ignore no-explicit-any
type Dados = Record<string, any>;

function nome(i: Dados): string {
  const linha = String(i.texto || "").trim().split("\n")[0];
  return String(i.titulo || linha || i.checklist?.[0]?.t || i.arquivo?.nome || i.url || "Sem título").slice(0, 60);
}

async function todas(tabela: string, dono: string) {
  const out: { id: string; dados: Dados }[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from(tabela).select("id,dados").eq("owner_id", dono).range(de, de + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

async function paradasDe(dono: string, ignorarAviso: boolean) {
  const cols = await todas("caixa_colunas", dono);
  const meta = cols.find((c) => c.dados?.tipo === "meta")?.dados ?? {};
  const dias = Math.max(1, Number(meta.diasParada) || 7);
  const alvo = new Set(cols.filter((c) => c.dados?.tipo === "coluna" && c.dados.avisarParada).map((c) => c.id));
  if (!alvo.size) return { dias, parados: [] as { id: string; dados: Dados }[] };
  const limite = Date.now() - dias * DIA;
  const itens = await todas("caixa_itens", dono);
  const parados = itens.filter(({ dados: i }) =>
    alvo.has(i.colId) && !i.arquivado && !i.excluidoEm && !i.feito &&
    Math.max(t(i.atualizadoEm), t(i.vistoEm), t(i.criadoEm)) < limite &&
    (ignorarAviso || t(i.avisadoEm) < limite) // depois de avisar, só avisa de novo após outro prazo
  ).sort((a, b) => Math.max(t(a.dados.atualizadoEm), t(a.dados.vistoEm)) - Math.max(t(b.dados.atualizadoEm), t(b.dados.vistoEm)));
  return { dias, parados };
}

async function enviar(dono: string, payload: string) {
  const { data: subs } = await sb.from("caixa_push").select("endpoint,inscricao").eq("owner_id", dono);
  let enviados = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(s.inscricao, payload, { TTL: 60 * 60 * 12 });
      enviados++;
    } catch (e) {
      const st = (e as { statusCode?: number }).statusCode;
      if (st === 404 || st === 410) await sb.from("caixa_push").delete().eq("endpoint", s.endpoint); // aparelho saiu
      else console.error("push falhou", st, e);
    }
  }
  return enviados;
}

function mensagem(dias: number, parados: { dados: Dados }[]) {
  const n = parados.length;
  const nomes = parados.slice(0, 3).map((p) => `• ${nome(p.dados)}`).join("\n");
  return JSON.stringify({
    titulo: n === 1 ? "Uma ideia está parada" : `${n} ideias estão paradas`,
    corpo: `Sem mexer há mais de ${dias} dias:\n${nomes}${n > 3 ? `\n+${n - 3}` : ""}`,
    url: "./#paradas",
    tag: "caixa-paradas",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // 1) Teste pelo app: só o usuário logado
    const segredo = req.headers.get("x-caixa-segredo");
    if (!segredo) {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: { user } } = await sb.auth.getUser(token);
      if (!user) return json({ erro: "não autorizado" }, 401);
      const { dias, parados } = await paradasDe(user.id, true);
      const payload = parados.length
        ? mensagem(dias, parados)
        : JSON.stringify({ titulo: "Avisos da Caixa funcionando ✓", corpo: `Nenhuma ideia parada há mais de ${dias} dias agora.`, url: "./#paradas", tag: "caixa-teste" });
      return json({ ok: true, enviados: await enviar(user.id, payload), paradas: parados.length });
    }

    // 2) Agendador diário: todos os usuários com aparelho inscrito
    if (segredo !== Deno.env.get("CAIXA_CRON_SEGREDO")) return json({ erro: "não autorizado" }, 401);
    const { data: subs, error } = await sb.from("caixa_push").select("owner_id");
    if (error) throw error;
    const donos = [...new Set((subs ?? []).map((s) => s.owner_id))];
    let total = 0;
    for (const dono of donos) {
      const { dias, parados } = await paradasDe(dono, false);
      if (!parados.length) continue;
      const enviados = await enviar(dono, mensagem(dias, parados));
      total += enviados;
      if (!enviados) continue;
      const agora = new Date().toISOString();
      for (const p of parados) {
        // Marca o aviso direto no JSON, sem sobrescrever o resto do item
        await sb.rpc("caixa_marcar_avisado", { item_id: p.id, quando: agora });
      }
    }
    return json({ ok: true, usuarios: donos.length, enviados: total });
  } catch (e) {
    console.error(e);
    return json({ erro: String((e as Error).message || e) }, 500);
  }
});
