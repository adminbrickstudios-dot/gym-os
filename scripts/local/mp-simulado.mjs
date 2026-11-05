#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// SOLO PARA PROBAR EN LOCAL. NUNCA en producción.
//
// Imita lo que Gym OS usa de MercadoPago (PAY-1), para probar el pago online
// de punta a punta sin cuenta real:
//
//   POST /checkout/preferences      crea el checkout (pide Bearer)
//   GET  /checkout/<id>             la pantalla de pago: "Pagar" o "Rechazar"
//   POST /checkout/<id>/pagar       crea el pago, manda el aviso FIRMADO al
//                                   notification_url (como MercadoPago) y vuelve
//                                   a back_urls con el resultado
//   GET  /v1/payments/<id>          el pago, como lo lee el webhook
//   POST /__reenviar/<id>           vuelve a mandar el aviso (idempotencia)
//   POST /__firma-mala/<id>         manda el aviso con una firma inválida
//
// La clave del webhook es la que se le carga al gimnasio de prueba:
// MP_SIMULADO_SECRETO (por defecto la de abajo, solo para local).
//
//   node scripts/local/mp-simulado.mjs [--puerto 54331]
// ═══════════════════════════════════════════════════════════════════
import crypto from "node:crypto";
import http from "node:http";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const PUERTO = Number(arg("puerto", process.env.PUERTO_MP ?? 54331));
const SECRETO = process.env.MP_SIMULADO_SECRETO ?? "secreto-del-simulador-de-mp-solo-local";
const BASE = `http://127.0.0.1:${PUERTO}`;
const prefs = new Map(); const pagos = new Map(); let siguiente = 90000001;

const firmar = (dataId, requestId, secreto = SECRETO) => {
  const ts = String(Math.floor(Date.now() / 1000));
  return `ts=${ts},v1=${crypto.createHmac("sha256", secreto).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex")}`;
};
async function avisar(pago, secreto = SECRETO) {
  const pref = prefs.get(pago.preferencia);
  const url = new URL(pref.notification_url);
  url.searchParams.set("type", "payment"); url.searchParams.set("data.id", String(pago.id));
  const requestId = crypto.randomUUID();
  const cuerpoAviso = JSON.stringify({ action: "payment.created", type: "payment", data: { id: String(pago.id) } });
  // *.localhost no siempre resuelve desde Node: se conecta a 127.0.0.1 con el Host del gimnasio.
  const { status: estado, cuerpo } = await new Promise((ok, mal) => {
    const pedido = http.request({ hostname: url.hostname.endsWith("localhost") ? "127.0.0.1" : url.hostname, port: url.port || 80, path: url.pathname + url.search, method: "POST",
      headers: { host: url.host, "content-type": "application/json", "content-length": Buffer.byteLength(cuerpoAviso),
        "x-signature": firmar(String(pago.id), requestId, secreto), "x-request-id": requestId } }, (r) => {
      let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => ok({ status: r.statusCode, cuerpo: b }));
    });
    pedido.on("error", mal); pedido.end(cuerpoAviso);
  });
  const r = { status: estado };
  console.log(`[mp-simulado] aviso ${pago.id} → ${r.status} ${cuerpo}`);
  return { status: r.status, cuerpo };
}
const leer = (req) => new Promise((ok) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => ok(b)); });
const json = (res, status, o) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };

http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, BASE);
    const autorizado = /^Bearer (APP_USR|TEST)-/.test(req.headers.authorization ?? "");
    if (req.method === "POST" && u.pathname === "/checkout/preferences") {
      if (!autorizado) return json(res, 401, { message: "invalid access token" });
      const p = JSON.parse(await leer(req));
      const id = `pref-${crypto.randomUUID()}`;
      prefs.set(id, p);
      return json(res, 201, { id, init_point: `${BASE}/checkout/${id}`, sandbox_init_point: `${BASE}/checkout/${id}` });
    }
    let m = /^\/checkout\/(pref-[\w-]+)$/.exec(u.pathname);
    if (req.method === "GET" && m) {
      const p = prefs.get(m[1]);
      if (!p) return json(res, 404, { message: "preference not found" });
      const it = p.items[0];
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>MercadoPago (simulado)</title>
<body style="font-family:sans-serif;max-width:420px;margin:40px auto;padding:0 16px"><h1>MercadoPago (simulado)</h1><p>${it.title}</p><p style="font-size:2em">$ ${it.unit_price}</p>
<form method="post" action="/checkout/${m[1]}/pagar?estado=approved"><button style="font-size:1.2em;padding:12px 24px">Pagar</button></form><br>
<form method="post" action="/checkout/${m[1]}/pagar?estado=rejected"><button>Rechazar</button></form></body>`);
    }
    m = /^\/checkout\/(pref-[\w-]+)\/pagar$/.exec(u.pathname);
    if (req.method === "POST" && m) {
      const p = prefs.get(m[1]);
      if (!p) return json(res, 404, { message: "preference not found" });
      const pago = { id: siguiente++, status: u.searchParams.get("estado") ?? "approved", external_reference: p.external_reference,
        transaction_amount: Number(p.items[0].unit_price), currency_id: "ARS", preferencia: m[1] };
      pagos.set(String(pago.id), pago);
      await avisar(pago);
      const vuelta = new URL(pago.status === "approved" ? p.back_urls.success : p.back_urls.failure);
      vuelta.searchParams.set("collection_status", pago.status); vuelta.searchParams.set("payment_id", String(pago.id));
      res.writeHead(302, { location: vuelta.toString() });
      return res.end();
    }
    m = /^\/v1\/payments\/(\d+)$/.exec(u.pathname);
    if (req.method === "GET" && m) {
      if (!autorizado) return json(res, 401, { message: "invalid access token" });
      const pago = pagos.get(m[1]);
      if (!pago) return json(res, 404, { message: "payment not found" });
      return json(res, 200, Object.fromEntries(Object.entries(pago).filter(([k]) => k !== "preferencia")));
    }
    m = /^\/__(reenviar|firma-mala)\/(\d+)$/.exec(u.pathname);
    if (req.method === "POST" && m) {
      const pago = pagos.get(m[2]);
      if (!pago) return json(res, 404, { message: "payment not found" });
      return json(res, 200, await avisar(pago, m[1] === "firma-mala" ? "otra-clave-que-no-es" : SECRETO));
    }
    if (u.pathname === "/") return json(res, 200, { ok: true, pagos: pagos.size });
    json(res, 404, { message: "not found" });
  } catch (e) {
    console.error(e);
    json(res, 500, { message: e.message });
  }
}).listen(PUERTO, "127.0.0.1", () => console.log(`[mp-simulado] en ${BASE}`));
