/* Service worker da Caixa Pessoal
   - Arquivos do app: busca na rede primeiro (atualizações chegam na hora) e usa o cache se estiver offline.
   - Bibliotecas e fontes (jsDelivr, cdnjs, Google Fonts): usa o cache e atualiza por trás.
   - Supabase (dados, login e arquivos) nunca passa pelo cache.
   - Recebe os avisos de ideias paradas (push) e abre a página "Paradas" ao tocar.
   Ao mudar a lista abaixo, aumente a VERSAO. */
const VERSAO = "caixa-v2";
const ARQUIVOS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icones/icone-192.png",
  "./icones/icone-512.png",
  "./icones/icone-maskable-512.png",
  "./icones/apple-touch-icon.png",
  "./icones/favicon-32.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co") || url.hostname.endsWith("supabase.in")) return;

  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req)
        .then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSAO).then(cc => cc.put(req, c)); } return r; })
        .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  if (/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.hostname)) {
    e.respondWith(
      caches.open(VERSAO).then(c => c.match(req).then(salvo => {
        const rede = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => salvo);
        return salvo || rede;
      }))
    );
  }
});

/* Aviso de ideias paradas */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { corpo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Caixa Pessoal", {
    body: d.corpo || "Você tem ideias paradas na Caixa.",
    icon: "icones/icone-192.png",
    badge: "icones/favicon-32.png",
    tag: d.tag || "caixa-paradas",
    renotify: true,
    data: { url: d.url || "./#paradas" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.url) || "./#paradas", self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(janelas => {
    for (const w of janelas) {
      if (w.url.startsWith(self.registration.scope)) return w.navigate(alvo).then(x => (x || w).focus()).catch(() => w.focus());
    }
    return clients.openWindow(alvo);
  }));
});
