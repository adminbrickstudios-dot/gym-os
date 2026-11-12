// H7 · exportar_socios con filtros (estado, plan, origen) no cambia ningún veredicto.
// (1) Sin filtros nuevos: el archivo de ahora (privado.exportar_socios_calc) devuelve, con momentos FIJOS, las mismas filas con
//     las mismas columnas (incluido "Estado" y "Cubierto hasta") que una COPIA de la función de antes (la de 6400, con el momento
//     como parámetro, creada en pg_temp).
// (2) Con filtros: cada estado/plan/origen/bajas/nuevos da exactamente el conjunto que dice la cuenta de la puerta, y la pública
//     da lo mismo que buscar_socios (la lista) sin su tope de filas, también por páginas.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";
import { sumarDias } from "../../scripts/datos/casos-testigo.mjs";

let t, uDueno, uRec, etiqueta, plan1;
const VIEJA = `
create function pg_temp.exportar_viejo(p_gimnasio_id uuid, p_momento timestamptz, p_texto text, p_etiqueta uuid)
returns table (numero int, nombre text, apellido text, dni text, telefono text, email text, nacimiento date, plan text,
               estado text, cubierto_hasta date, alta date, dado_de_baja date, etiquetas text)
language plpgsql stable set search_path = '' as $f$
declare t text := privado.sin_acentos(lower(trim(coalesce(p_texto, '')))); d text; zona text;
begin
  d := regexp_replace(t, '\\D', '', 'g');
  select g.zona_horaria into zona from public.gimnasios g where g.id = p_gimnasio_id;
  return query
  select s.numero, s.nombre, s.apellido, s.dni, s.telefono, s.email, s.fecha_nacimiento,
         (select pl.nombre from public.suscripciones su join public.planes pl on pl.id = su.plan_id
           where su.socio_id = s.id and su.baja_en is null order by su.inicio desc limit 1),
         v.texto,
         case when v.vence_en is not null then ((v.vence_en - interval '1 second') at time zone zona)::date end,
         (s.creado_en at time zone zona)::date,
         (s.dado_de_baja_en at time zone zona)::date,
         (select string_agg(e.nombre, ', ' order by lower(e.nombre)) from public.socio_etiquetas se join public.etiquetas e on e.id = se.etiqueta_id
           where se.socio_id = s.id)
    from public.socios s
    cross join lateral privado.calcular_acceso(s.id, p_momento, null) v
   where s.gimnasio_id = p_gimnasio_id
     and (p_etiqueta is null or exists (select 1 from public.socio_etiquetas se where se.gimnasio_id = p_gimnasio_id and se.socio_id = s.id and se.etiqueta_id = p_etiqueta))
     and (t = '' or privado.sin_acentos(lower(s.nombre || ' ' || s.apellido)) like '%' || t || '%'
          or (length(d) >= 3 and (s.dni like d || '%' or regexp_replace(coalesce(s.telefono, ''), '\\D', '', 'g') like '%' || d || '%')))
   order by s.apellido, s.nombre;
end $f$`;

const MOMENTOS = [-40, -10, -1, 0, 3, 20];   // días respecto de HOY, a las 19:00

async function crear(rol, nombre) {
  const [{ id: u }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [t.g, u, nombre, rol]);
  return u;
}
async function como(u, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: u, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const porNumero = (filas) => [...filas].sort((a, b) => a.numero - b.numero);
const numeros = (filas) => filas.map((f) => Number(f.numero)).sort((a, b) => a - b);
const calc = (m, { texto = null, et = null, estado = null, plan = null, origen = null, desde = 0, cant = 1000 } = {}) =>
  t.q(`select * from privado.exportar_socios_calc($1, $2, null, $3, $4, $5, $6, $7, $8, $9)`, [t.g, m, texto, et, estado, plan, origen, desde, cant]);

before(async () => {
  t = await abrir("prueba-exportar-filtros");
  await t.q(VIEJA);
  uDueno = await crear("dueno", "Dueña Export");
  uRec = await crear("recepcion", "Rece Export");
  const planes = await t.q(`select id from public.planes where gimnasio_id = $1 and tipo = 'membresia' order by nombre limit 2`, [t.g]);
  [plan1] = planes.map((p) => p.id);
  [{ id: etiqueta }] = await t.q(`insert into public.etiquetas (gimnasio_id, nombre) values ($1, 'Competencia') returning id`, [t.g]);
  const soc = await t.q(`select id, numero from public.socios where gimnasio_id = $1 order by numero`, [t.g]);
  // Etiqueta a unos pocos, un socio de alta web, un socio nuevo de baja, y 120 socios más (más que el tope de 100 de buscar_socios) sin plan.
  for (const s of soc.slice(0, 4)) await t.q(`insert into public.socio_etiquetas (gimnasio_id, socio_id, etiqueta_id) values ($1,$2,$3)`, [t.g, s.id, etiqueta]);
  await t.q(`update public.socios set origen = 'alta_web' where id = any($1)`, [soc.slice(2, 5).map((s) => s.id)]);
  await t.q(`update public.socios set dado_de_baja_en = $2, motivo_baja = 'otro' where id = $1`, [soc[soc.length - 1].id, await t.en(sumarDias(HOY, -3))]);
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono, email)
             select $1, 'Masivo ' || n, 'Export', '+5490000700' || lpad(n::text, 3, '0'), 'masivo.' || n || '@ejemplo.invalid' from generate_series(1, 120) n`, [t.g]);
});
after(async () => t && t.cerrar());

test("sin filtros nuevos, el archivo da lo mismo que el de antes (filas y columnas) en cada momento fijo", async () => {
  const [{ n }] = await t.q(`select count(*)::int n from public.socios where gimnasio_id = $1`, [t.g]);
  assert.ok(n > 130, "hacen falta más de 100 socios para probar el tope");
  for (const dia of MOMENTOS) {
    const m = await t.en(sumarDias(HOY, dia));
    for (const [texto, et] of [[null, null], ["", null], ["masivo", null], ["testigo", null], [null, etiqueta], ["testigo", etiqueta]]) {
      const viejo = await t.q(`select * from pg_temp.exportar_viejo($1, $2, $3, $4)`, [t.g, m, texto, et]);
      const nuevo = await calc(m, { texto, et });
      assert.deepEqual(porNumero(nuevo), porNumero(viejo), `día ${dia}, texto ${texto}, etiqueta ${!!et}`);
    }
  }
});

test("sin filtros, trae a todos (más de 100) y las páginas juntas dan lo mismo", async () => {
  const m = await t.en(HOY);
  const todos = await calc(m);
  assert.ok(todos.length > 130);
  const p1 = await calc(m, { desde: 0, cant: 50 }), p2 = await calc(m, { desde: 50, cant: 50 }), p3 = await calc(m, { desde: 100, cant: 1000 });
  assert.deepEqual([...p1, ...p2, ...p3].map((f) => f.numero), todos.map((f) => f.numero));
  assert.equal(p1.length, 50);
});

test("cada filtro da el conjunto que dice la cuenta de la puerta, en cada momento fijo", async () => {
  for (const dia of MOMENTOS) {
    const m = await t.en(sumarDias(HOY, dia));
    const grupos = await t.q(`select s.numero, s.dado_de_baja_en is not null baja, s.creado_en, s.origen,
        privado.grupo_estado(v.color, v.motivo) as grupo,
        exists (select 1 from public.suscripciones su where su.socio_id = s.id and su.baja_en is null and su.plan_id = $2) as en_plan
      from public.socios s cross join lateral privado.calcular_acceso(s.id, $3, null) v where s.gimnasio_id = $1`, [t.g, plan1, m]);
    for (const g of ["al_dia", "por_vencer", "vencidos", "en_pausa", "sin_plan"]) {
      const esperado = grupos.filter((x) => !x.baja && x.grupo === g).map((x) => Number(x.numero)).sort((a, b) => a - b);
      assert.deepEqual(numeros(await calc(m, { estado: g })), esperado, `día ${dia}, estado ${g}`);
    }
    assert.deepEqual(numeros(await calc(m, { estado: "bajas" })), grupos.filter((x) => x.baja).map((x) => Number(x.numero)).sort((a, b) => a - b), `día ${dia}, bajas`);
    const limite = new Date(m.getTime() - 30 * 86400000);
    assert.deepEqual(numeros(await calc(m, { estado: "nuevos" })), grupos.filter((x) => !x.baja && x.creado_en > limite).map((x) => Number(x.numero)).sort((a, b) => a - b), `día ${dia}, nuevos`);
    assert.deepEqual(numeros(await calc(m, { plan: plan1 })), grupos.filter((x) => x.en_plan).map((x) => Number(x.numero)).sort((a, b) => a - b), `día ${dia}, plan`);
    assert.deepEqual(numeros(await calc(m, { origen: "web" })), grupos.filter((x) => x.origen === "alta_web").map((x) => Number(x.numero)).sort((a, b) => a - b), `día ${dia}, origen`);
    // Combinado: estado + plan.
    assert.deepEqual(numeros(await calc(m, { estado: "al_dia", plan: plan1 })),
      grupos.filter((x) => !x.baja && x.grupo === "al_dia" && x.en_plan).map((x) => Number(x.numero)).sort((a, b) => a - b), `día ${dia}, estado y plan`);
  }
  const m = await t.en(HOY);
  assert.ok((await calc(m, { plan: plan1 })).length > 0, "el plan de prueba tiene socios");
  assert.ok((await calc(m, { origen: "web" })).length === 3);
});

test("la pública: lo mismo que la lista (buscar_socios), sin su tope de 100, y solo dueño y encargado", async () => {
  await como(uDueno, async () => {
    for (const [estado, plan, origen, texto] of [[null, null, null, ""], ["al_dia", null, null, ""], ["vencidos", null, null, ""], ["sin_plan", null, null, ""],
      ["bajas", null, null, ""], [null, plan1, null, ""], [null, null, "web", ""], ["al_dia", plan1, null, ""], [null, null, null, "garcia"]]) {
      const lista = await t.q(`select numero from public.buscar_socios($1, $2, 100, null, $3, $4, $5)`, [t.g, texto, estado, plan, origen]);
      const arch = await t.q(`select numero from public.exportar_socios($1, $2, null, $3, $4, $5)`, [t.g, texto, estado, plan, origen]);
      if (lista.length < 100) assert.deepEqual(numeros(arch), numeros(lista), `lista y archivo: ${estado} ${plan} ${origen} ${texto}`);
      else assert.ok(arch.length >= lista.length);
    }
    // Sin filtro la lista corta en 100; el archivo trae a todos.
    const [{ n }] = await t.q(`select count(*)::int n from public.exportar_socios($1)`, [t.g]);
    const [{ total }] = await t.q(`select count(*)::int total from public.socios where gimnasio_id = $1`, [t.g]);
    assert.equal(n, total);
    await t.falla(() => t.q(`select * from public.exportar_socios($1, null, null, 'inventado')`, [t.g]), /Filtro desconocido/);
    await t.falla(() => t.q(`select * from public.exportar_socios($1, null, null, null, null, 'otro')`, [t.g]), /Filtro desconocido/);
    await t.falla(() => t.q(`select * from public.exportar_socios($1, null, null, null, null, null, 0, 5000)`, [t.g]), /1 a 1000/);
  });
  await como(uRec, () => t.falla(() => t.q(`select * from public.exportar_socios($1)`, [t.g]), /permiso|no puede|equipo/i));
  const llamable = (await t.q(`select has_function_privilege('anon', 'public.exportar_socios(uuid, text, uuid, text, uuid, text, integer, integer)', 'execute') as a,
                                  has_function_privilege('authenticated', 'privado.exportar_socios_calc(uuid, timestamptz, uuid, text, uuid, text, uuid, text, integer, integer)', 'execute') as b`))[0];
  assert.equal(llamable.a, false);
  assert.equal(llamable.b, false);
});
