# Caixa Pessoal

Caixa de entrada pessoal para links, documentos, ideias, prints e tarefas, organizados em colunas. Um arquivo só (`index.html`), publicado no GitHub Pages, com os dados no Supabase.

## O que tem

- Captura rápida: cole um link, um texto, um print (Ctrl+V) ou solte arquivos, e o app escolhe a coluna
- Vários links colados de uma vez viram um item cada; link repetido é avisado (e pulado na colagem em lote)
- Colunas personalizáveis: nome, ícone, cor, o que recebem automaticamente, ordenação (manual, recentes, antigos, A–Z) e visualização (cartões, lista compacta, grade)
- Coluna **A fazer** (coluna de tarefas): cada item tem um ✓ de feito, e o botão **Encaixar na agenda** manda o item para a fila "Para encaixar" da Agenda de estudos
- Checklist dentro dos itens (linhas `[ ]` na captura viram itens marcáveis)
- Texto dos prints e PDFs lido no próprio aparelho (Tesseract.js e PDF.js) e incluído na busca
- **Ideias paradas**: itens sem editar, mover ou abrir há mais de N dias aparecem numa faixa, no menu e, se configurado, num aviso no celular
- Lixeira de 30 dias, seleção múltipla (segure um card no celular, ou tecla S / Ctrl+clique no computador)
- Itens sensíveis (borrados até tocar), modo escuro "café torrado", atalhos de teclado (`?` mostra a lista)
- App instalável (PWA) e backup em JSON

## Atualização de novembro de 2026 (v2)

Quem já usa a Caixa faz, uma vez:

1. **SQL Editor** do Supabase da Caixa: rode `supabase-caixa-v2.sql`. Ele cria a tabela dos aparelhos que recebem avisos e uma função auxiliar. Pode rodar de novo sem problema.
2. Publique os arquivos novos no GitHub (`index.html`, `sw.js`, `README.md`, `supabase-caixa-v2.sql` e a pasta `supabase/`).
3. Na primeira abertura, o app cria sozinho a coluna **A fazer** e liga o aviso de parada na coluna **Ideias**.

### Agenda de estudos

A URL e a publishable key da agenda já estão na seção 3 do `index.html` (`agendaUrl`, `agendaKey`). Em **Configurações → Agenda de estudos → Conectar agenda**, entre com o e-mail e a senha da agenda. Para a fila funcionar, a agenda precisa ter uma lista marcada como **Em andamento**.

### Avisos no celular (ideias paradas)

Configuração única, guiada pelo app em **Configurações → Ideias paradas → Configurar avisos**. O assistente gera as chaves e mostra cada valor com botão de copiar:

1. Rodar `supabase-caixa-v2.sql` (se ainda não rodou).
2. **Edge Functions → Secrets**: criar `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` e `CAIXA_CRON_SEGREDO`.
3. **Edge Functions → Deploy a new function → Via Editor**: nome `avisar-ideias-paradas`, conteúdo de `supabase/functions/avisar-ideias-paradas/index.ts`. Nos detalhes da função, desligar **Verify JWT**.
4. **SQL Editor**: rodar o SQL do agendador que o assistente mostra (todo dia às 9h de Brasília).
5. Colar a chave pública em `vapidPublica`, na seção 3 do `index.html`, e publicar.
6. No celular, com o app **instalado**: **Configurações → Ligar avisos neste aparelho → Mandar um aviso de teste**.

No iPhone, os avisos só funcionam com o app instalado pela tela de início (iOS 16.4 ou mais novo). A chave privada e o segredo ficam só no Supabase; nunca vão para o GitHub.

## Primeira instalação

1. Projeto novo no Supabase → **SQL Editor** → rode `supabase-caixa.sql` e depois `supabase-caixa-v2.sql`.
2. **Authentication → Users → Add user** (marque Auto Confirm) e desligue **Allow new users to sign up**.
3. Na seção 3 do `index.html`, preencha `supabaseUrl` (só `https://xxxx.supabase.co`) e `supabaseKey` (publishable key).
4. Publique no GitHub Pages (branch `main`, pasta raiz).

## Mapa do `index.html`

1 Estilos · 2 Estrutura · 3 Configuração · 4 Armazenamento (Claude, Supabase, navegador) · 5 Modelo e regras · 6 Telas · 7 Instalação · 8 Tema e atalhos · 9 Leitura de texto · 10 Agenda · 11 Avisos · 12 Inicialização

Os dados de cada item e coluna ficam em JSON (coluna `dados`) nas tabelas `caixa_itens` e `caixa_colunas`. Os ajustes que valem em todos os aparelhos (como os dias para "parada") ficam num documento `tipo: "meta"` em `caixa_colunas`.
