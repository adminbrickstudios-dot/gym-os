#!/usr/bin/env node
// SOLO PARA PROBAR EN LOCAL. Imita el endpoint de RPC de Supabase
// (POST /rest/v1/rpc/<funcion>) contra la base local, como rol anon,
// para probar el middleware sin un proyecto de Supabase.
// Solo expone funciones de una lista: no es un PostgREST de verdad.
//   node scripts/db/postgrest-minimo.mjs --url postgres://... --puerto 54399

import http from "node:http";
import pg from "pg";

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const pool = new pg.Pool({ connectionString: arg("url", process.env.DB_PRUEBAS_URL) });
// args: parámetros con nombre · escalar: la función devuelve un valor (PostgREST lo devuelve sin envolver)
const PERMITIDAS = {
  gimnasio_por_host: { args: ["p_host"], escalar: false },
  landing_publica: { args: ["p_host"], escalar: true },
};

http.createServer(async (req, res) => {
  const m = req.url?.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
  if (req.method !== "POST" || !m || !PERMITIDAS[m[1]]) { res.writeHead(404).end("[]"); return; }
  let cuerpo = "";
  for await (const parte of req) cuerpo += parte;
  const params = JSON.parse(cuerpo || "{}");
  const { args: nombres, escalar } = PERMITIDAS[m[1]];
  const cliente = await pool.connect();
  try {
    await cliente.query("begin; set local role anon");
    const { rows } = await cliente.query(
      `select * from public.${m[1]}(${nombres.map((n, i) => `${n} => $${i + 1}`).join(", ")})`,
      nombres.map((n) => params[n]));
    await cliente.query("commit");
    const cuerpoRespuesta = escalar ? rows[0]?.[m[1]] ?? null : rows;
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(cuerpoRespuesta));
  } catch (e) {
    await cliente.query("rollback");
    res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ message: e.message }));
  } finally { cliente.release(); }
}).listen(Number(arg("puerto", "54399")), "127.0.0.1", () => console.log("postgrest-minimo escuchando"));
