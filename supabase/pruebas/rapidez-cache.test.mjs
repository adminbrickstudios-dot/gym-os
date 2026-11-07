// VD-47X · Lo que se acelera no puede mezclar a nadie. Dos gimnasios, tres roles:
// las funciones de pantalla (Socios, Vencen hoy, Retención, Inicio) devuelven a cada uno lo suyo,
// y la recepción no ve la plata. Es la garantía de por qué esas pantallas NO pasan por un caché
// compartido: lo decide la base con la sesión de quien pregunta (ver src/lib/rapidez/cache-prohibido.test.ts).
// Además: los índices nuevos (4701) existen y empiezan por gimnasio_id.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, g2, uDuenoA, uRecA, uDuenoB;
before(async () => {
  t = await abrir("prueba-rapidez");
  const usuario = async (g, rol, nombre) => {
    const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
    await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [g, id, nombre, rol]);
    return id;
  };
  uDuenoA = await usuario(t.g, "dueno", "Dueña A");
  uRecA = await usuario(t.g, "recepcion", "Recep A");
  [{ id: g2 }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-rapidez-b', 'Gimnasio B') returning id`);
  uDuenoB = await usuario(g2, "dueno", "Dueño B");
  await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1, 'Unico', 'DeB', '+5490000000099')`, [g2]);
});
after(async () => t && t.cerrar());

const nombres = (filas) => filas.map((f) => f.nombre);

test("buscar_socios: cada dueño ve a sus socios y a nadie del otro gimnasio", async () => {
  const a = await t.comoUsuario(uDuenoA, async () => (await t.db.query(`select * from public.buscar_socios($1, '', 100)`, [t.g])).rows);
  const b = await t.comoUsuario(uDuenoB, async () => (await t.db.query(`select * from public.buscar_socios($1, '', 100)`, [g2])).rows);
  assert.ok(a.length > 1, "el gimnasio A tiene sus socios de prueba");
  assert.ok(!nombres(a).some((n) => /DeB/.test(n)), "A no ve al socio de B");
  assert.deepEqual(nombres(b), ["Unico DeB"]);
});

test("pedir los datos de otro gimnasio es un error, no una lista vacía", async () => {
  for (const fn of ["buscar_socios($1, '', 10)", "filtros_socios($1)", "retencion($1)", "retencion_resumen($1)", "vencen_hoy($1)", "numeros_inicio($1)"]) {
    await t.falla(() => t.comoUsuario(uDuenoB, () => t.db.query(`select * from public.${fn}`, [t.g])), /permiso|iniciar sesi/i);
  }
});

test("la misma pantalla con otra sesión da otra respuesta (no hay nada compartido entre roles)", async () => {
  const dueno = await t.comoUsuario(uDuenoA, async () => (await t.db.query(`select public.retencion_resumen($1) r`, [t.g])).rows[0].r);
  const recep = await t.comoUsuario(uRecA, async () => (await t.db.query(`select public.retencion_resumen($1) r`, [t.g])).rows[0].r);
  // Los conteos por grupo son los mismos; la plata en riesgo es del dueño y la recepción no la ve.
  assert.deepEqual(recep.listas, dueno.listas);
  assert.ok("plata_en_riesgo" in recep && recep.plata_en_riesgo === null, "la recepción no ve la plata en riesgo");
});

test("los índices de 4701 existen y empiezan por gimnasio_id", async () => {
  const filas = await t.q(`
    select c.relname, a.attname
      from pg_index i join pg_class c on c.oid = i.indexrelid
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
     where c.relnamespace = 'public'::regnamespace
       and c.relname in ('socios_orden_lista', 'socios_por_alta', 'socios_dados_de_baja', 'suscripciones_vigentes_por_plan',
                         'suscripciones_gimnasio_socio_inicio', 'ventas_por_fecha', 'ingresos_por_momento')`);
  assert.equal(filas.length, 7);
  for (const f of filas) assert.equal(f.attname, "gimnasio_id", `${f.relname} empieza por gimnasio_id`);
});
