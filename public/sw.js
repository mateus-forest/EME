self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  const request = event.request

  if (request.mode !== "navigate") return

  event.respondWith(
    fetch(request).catch(() =>
      new Response(
        `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="theme-color" content="#00C853" />
    <title>EME offline</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0B0B;color:white;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px}
      main{max-width:420px;border:1px solid rgba(255,255,255,.08);background:linear-gradient(180deg,rgba(17,17,17,.98),rgba(10,10,10,.96));border-radius:24px;padding:28px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.35)}
      div{width:48px;height:48px;margin:0 auto 18px;border-radius:18px;border:1px solid rgba(0,200,83,.22);background:rgba(0,200,83,.1);display:grid;place-items:center;color:#69F0AE;font-weight:800}
      h1{margin:0;font-size:22px;line-height:1.2}
      p{margin:12px 0 0;color:rgba(255,255,255,.62);font-size:15px;line-height:1.55}
      button{margin-top:22px;height:42px;border:0;border-radius:14px;background:#00C853;color:#000;font-weight:700;padding:0 18px}
    </style>
  </head>
  <body>
    <main>
      <div>EME</div>
      <h1>Você está offline</h1>
      <p>Conecte-se à internet para acessar seus imóveis, leads e o Assessor EME.</p>
      <button onclick="location.reload()">Tentar novamente</button>
    </main>
  </body>
</html>`,
        {
          headers: { "Content-Type": "text/html; charset=utf-8" },
          status: 200,
        },
      ),
    ),
  )
})
