// Pase 2.0 · organización (26/11): carreras de "tildar hecho" y "deshacer el último", con dos conexiones reales.
// Dos toques a la vez sobre lo mismo dejan UN solo hecho; dos "deshacer" a la vez anulan UNO solo (el otro da error).
// Crea un gimnasio "prueba-carrera-org-*" que queda en la base local (como concurrencia-caja-clases). Se niega a correr contra Supabase.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";

const URL = process.env.DB_PRUEBAS_URL;
const conectar = async () => { const c = new pg.Client({ connectionString: URL }); await c.connect(); return c; };
const q = async (c, s, p) => (await c.query(s, p)).rows;
const comoUsuario = async (c, u) => {
  await c.query("set role authenticated");
  await q(c, `select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
};

let adm, g, u;
before(async () => {
  if (!URL || /supabase\.(co|com)/.test(URL)) throw new Error("Falta DB_PRUEBAS_URL local");
  adm = await conectar();
  [{ id: g }] = await q(adm, `insert into public.gimnasios (slug, nombre) values ($1,'Carreras organización') returning id`, [`prueba-carrera-org-${Date.now()}`]);
  [{ id: u }] = await q(adm, `insert into auth.users (email) values ($1) returning id`, [`carrera-org${Date.now()}@ejemplo.invalid`]);
  await q(adm, `insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Recepción','recepcion')`, [g, u]);
  await q(adm, `insert into public.funciones_nuevas_gimnasio (gimnasio_id, clave, activa, prendida_en, cambiada_en) values ($1,'pase_2_organizacion',true,now(),now())`, [g]);
});
after(async () => adm && adm.end());

test("dos tildes a la vez sobre lo mismo: queda uno solo y el otro avisa que ya estaba", async () => {
  const A = await conectar(), B = await conectar();
  try {
    await comoUsuario(A, u); await comoUsuario(B, u);
    const ref = `llamar:${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}`;
    const r = await Promise.all([A, B].map((c) => q(c, `select public.tildar_hecho($1, $2, 'Llamé al técnico') id`, [g, ref]).then(() => "ok", (e) => e.message)));
    assert.equal(r.filter((x) => x === "ok").length, 1, `resultados: ${r.join(" · ")}`);
    assert.match(r.find((x) => x !== "ok"), /Ya está tildado/);
    const [{ n }] = await q(adm, `select count(*)::int n from public.hechos_para_hacer where gimnasio_id = $1 and referencia = $2 and anulado_en is null`, [g, ref]);
    assert.equal(n, 1);
  } finally { await A.end(); await B.end(); }
});

test("dos 'deshacer el último' a la vez: se anula uno solo", async () => {
  const A = await conectar(), B = await conectar();
  try {
    await comoUsuario(A, u); await comoUsuario(B, u);
    await q(A, `select public.tildar_hecho($1, 'revisar_cinta', 'Revisé la cinta 2')`, [g]);
    const [{ antes }] = await q(adm, `select count(*)::int antes from public.hechos_para_hacer where gimnasio_id = $1 and anulado_en is not null`, [g]);
    const r = await Promise.all([A, B].map((c) => q(c, `select public.deshacer_ultimo_hecho($1) id`, [g]).then((x) => x[0].id, (e) => e.message)));
    const [{ despues }] = await q(adm, `select count(*)::int despues from public.hechos_para_hacer where gimnasio_id = $1 and anulado_en is not null`, [g]);
    // Cada "deshacer" anula a lo sumo uno; los dos juntos anulan los dos que había (el de la prueba anterior y este) o uno y el otro dice que no hay nada.
    assert.ok(despues - antes <= 2 && despues - antes >= 1, `anulados: ${despues - antes}`);
    const ids = r.filter((x) => /^[0-9a-f-]{36}$/.test(x));
    assert.equal(new Set(ids).size, ids.length, "nunca los dos anulan el mismo");
  } finally { await A.end(); await B.end(); }
});
