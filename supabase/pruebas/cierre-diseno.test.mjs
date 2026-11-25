// Cierre para vender (25/11, migración 20261125100000): los datos que le faltaban a Pista Semáforo para quedar igual al diseño.
// Caracterización: buscar_socios y ficha_socio siguen devolviendo lo de antes (y suman lo nuevo). Permisos en negativo: otro gimnasio
// y un rol sin permiso dan error, nunca un vacío. Ninguna de estas lecturas mueve plata.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir } from "./_comun.mjs";

let t, u = {}, g2, caja, admin;
const uno = async (sql, p) => (await t.q(sql, p))[0];
const usuario = async () => (await uno(`insert into auth.users (email) values ($1) returning id`, [`u${Math.random()}@ejemplo.invalid`])).id;

before(async () => {
  t = await abrir("prueba-cierre-diseno");
  for (const k of ["dueno", "recepcion", "profe", "ajeno"]) u[k] = await usuario();
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Dueno','dueno'), ($1,$3,'Recep','recepcion'), ($1,$4,'Profe','profe')`,
    [t.g, u.dueno, u.recepcion, u.profe]);
  g2 = (await uno(`insert into public.gimnasios (slug, nombre) values ('prueba-cierre-otro', 'Otro') returning id`)).id;
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,'Ajeno','dueno')`, [g2, u.ajeno]);
  caja = (await uno(`insert into public.cajas (gimnasio_id, sede_id, nombre) values ($1,$2,'Recepción') returning id`, [t.g, t.sede])).id;
  admin = await usuario();
  await t.q(`insert into public.administradores_plataforma (usuario_id) values ($1)`, [admin]);
});
after(async () => t && t.cerrar());

test("buscar_socios: las columnas de siempre siguen, y suma Vence (cubierto_hasta) y Última vez", async () => {
  const filas = await t.comoUsuario(u.recepcion, () => t.q(`select * from public.buscar_socios($1, '', 100)`, [t.g]));
  assert.ok(filas.length > 0);
  for (const k of ["socio_id", "numero", "nombre", "telefono", "dni", "plan", "color", "texto", "puede", "dado_de_baja", "autoalta", "vence", "ultima_vez", "dejo_de_venir"]) {
    assert.ok(k in filas[0], `falta la columna ${k}`);
  }
  const s = filas[0];
  const [{ cubierto_hasta }] = await t.q(`select cubierto_hasta from public.socios where id = $1`, [s.socio_id]);
  assert.equal(String(s.vence), String(cubierto_hasta));
  const [{ m }] = await t.q(`select max(momento) m from public.ingresos where socio_id = $1 and anulado_en is null and resultado <> 'rechazado'`, [s.socio_id]);
  assert.equal(String(s.ultima_vez), String(m));
});

test("buscar_socios: otro gimnasio y el profe reciben error", async () => {
  await t.comoUsuario(u.ajeno, () => t.falla(() => t.q(`select * from public.buscar_socios($1, '', 10)`, [t.g])));
  await t.comoUsuario(u.profe, () => t.falla(() => t.q(`select * from public.buscar_socios($1, '', 10)`, [t.g])));
});

test("ficha_socio trae la racha (veces este mes y semanas seguidas) y lo de siempre", async () => {
  const [{ id }] = await t.q(`select id from public.socios where gimnasio_id = $1 limit 1`, [t.g]);
  const f = (await t.comoUsuario(u.recepcion, () => t.q(`select public.ficha_socio($1) f`, [id])))[0].f;
  for (const k of ["socio", "acceso", "membresia", "ingresos", "packs", "racha"]) assert.ok(k in f, `falta ${k}`);
  assert.equal(typeof f.racha.semanas_seguidas, "number");
  assert.equal(typeof f.racha.entradas_mes, "number");
  await t.comoUsuario(u.ajeno, () => t.falla(() => t.q(`select public.ficha_socio($1)`, [id])));
});

test("inicio_semaforo: el mostrador lo ve; otro gimnasio y el profe, error", async () => {
  const r = (await t.comoUsuario(u.recepcion, () => t.q(`select public.inicio_semaforo($1) r`, [t.g])))[0].r;
  assert.equal(typeof r.adentro, "number");
  assert.equal(r.caja_desde, null);
  assert.ok(Number.isInteger(r.dias_ausencia) && r.dias_ausencia >= 3);
  await t.comoUsuario(u.ajeno, () => t.falla(() => t.q(`select public.inicio_semaforo($1)`, [t.g])));
  await t.comoUsuario(u.profe, () => t.falla(() => t.q(`select public.inicio_semaforo($1)`, [t.g])));
});

test("inicio_semaforo: con la caja abierta dice desde cuándo", async () => {
  await t.comoUsuario(u.recepcion, async () => {
    await t.q(`select public.abrir_caja($1, 1000)`, [caja]);
    const r = (await t.q(`select public.inicio_semaforo($1) r`, [t.g]))[0].r;
    assert.ok(r.caja_desde);
  });
});

test("numeros_inicio: 'Dejaron de venir' se elige y se calcula", async () => {
  const [{ c }] = await t.q(`select count(*)::int c from privado.retencion($1, now()) where lista = 'no_viene'`, [t.g]);
  await t.comoUsuario(u.dueno, async () => {
    await t.q(`select public.guardar_numeros_inicio($1, array['no_vienen','entraron'])`, [t.g]);
    const r = (await t.q(`select public.numeros_inicio($1) r`, [t.g]))[0].r;
    const n = r.numeros.find((x) => x.clave === "no_vienen");
    assert.ok(n, "falta no_vienen");
    assert.equal(n.etiqueta, "Dejaron de venir");
    assert.equal(Number(n.valor), c);
  });
});

test("config_clases_panel: 85 por defecto; otro gimnasio, error", async () => {
  const r = (await t.comoUsuario(u.profe, () => t.q(`select public.config_clases_panel($1) r`, [t.g])))[0].r;
  assert.equal(r.casi_lleno_pct, 85);
  await t.comoUsuario(u.ajeno, () => t.falla(() => t.q(`select public.config_clases_panel($1)`, [t.g])));
  await t.falla(() => t.q(`update public.configuracion_gimnasio set casi_lleno_pct = 20 where gimnasio_id = $1`, [t.g]));
});

test("movimientos_turno: el dueño ve cobros e ingresos/retiros; la recepción con la caja abierta y otro gimnasio, error", async () => {
  // El turno y el retiro se cargan como hechos (sin pasar por abrir_caja: cada comoUsuario revierte lo suyo al terminar).
  const [{ eid }] = await t.q(`select id eid from public.equipo where gimnasio_id = $1 and rol = 'recepcion'`, [t.g]);
  const [{ id }] = await t.q(`insert into public.turnos_caja (gimnasio_id, caja_id, abierto_por, monto_inicial) values ($1,$2,$3,500) returning id`, [t.g, caja, eid]);
  await t.q(`insert into public.movimientos_caja (gimnasio_id, turno_caja_id, tipo, monto, motivo, creado_por) values ($1,$2,'retiro',100,'Artículos de limpieza',$3)`, [t.g, id, eid]);
  await t.comoUsuario(u.dueno, async () => {
    const r = (await t.q(`select public.movimientos_turno($1) r`, [id]))[0].r;
    assert.ok(Array.isArray(r.cobros) && Array.isArray(r.movimientos) && Array.isArray(r.detalle));
    assert.equal(r.movimientos.at(-1).motivo, "Artículos de limpieza");
    assert.equal(r.movimientos.at(-1).tipo, "retiro");
    assert.equal(Number(r.movimientos.at(-1).monto), 100);
  });
  await t.comoUsuario(u.recepcion, () => t.falla(() => t.q(`select public.movimientos_turno($1)`, [id])));
  await t.comoUsuario(u.ajeno, () => t.falla(() => t.q(`select public.movimientos_turno($1)`, [id])));
});

test("el lote acepta las lecturas nuevas (un viaje) y sigue rechazando lo que no está en la lista", async () => {
  await t.comoUsuario(u.dueno, async () => {
    const r = (await t.q(`select public.lote_lecturas($1::jsonb) r`, [JSON.stringify([
      { f: "inicio_semaforo", a: { p_gimnasio_id: t.g } }, { f: "config_clases_panel", a: { p_gimnasio_id: t.g } },
    ])]))[0].r;
    assert.equal(r.length, 2);
    assert.equal(r[1].casi_lleno_pct, 85);
    await t.falla(() => t.q(`select public.lote_lecturas($1::jsonb)`, [JSON.stringify([{ f: "admin_gimnasios" }])]), /no se puede pedir en lote/);
  });
});

test("todo gimnasio nuevo de /super nace en Pista con Semáforo; un gimnasio real que ya existía no cambia", async () => {
  const [{ antes }] = await t.q(`select estilo antes from public.configuracion_gimnasio where gimnasio_id = $1`, [g2]);
  // Lo que crea el super admin se mira antes de que comoUsuario revierta (con el rol de la base, que lee sin RLS).
  await t.comoUsuario(admin, async () => {
    const [{ r }] = await t.q(`select public.admin_crear_gimnasio($1, 'Nuevo', 'ejemplo.invalid', 'Dueño') r`, [`nuevo-${Date.now()}`]);
    await t.db.query("reset role");
    const [c] = await t.q(`select estilo from public.configuracion_gimnasio where gimnasio_id = $1`, [r.gimnasio_id]);
    assert.equal(c.estilo, "pista");
    const [f] = await t.q(`select activa from public.funciones_nuevas_gimnasio where gimnasio_id = $1 and clave = 'pista_semaforo'`, [r.gimnasio_id]);
    assert.equal(f.activa, true);
  });
  const [{ despues }] = await t.q(`select estilo despues from public.configuracion_gimnasio where gimnasio_id = $1`, [g2]);
  assert.equal(despues, antes);
  await t.comoUsuario(u.dueno, () => t.falla(() => t.q(`select public.admin_crear_gimnasio('otro-intento', 'X', 'ejemplo.invalid', 'Y')`)));
});

test("buscar_socios acepta hasta 600 (Ver 60 más de Socios pide 120) y rechaza más", async () => {
  await t.comoUsuario(u.recepcion, async () => {
    const filas = await t.q(`select * from public.buscar_socios($1, '', 120)`, [t.g]);
    assert.ok(filas.length > 0);
    await t.falla(() => t.q(`select * from public.buscar_socios($1, '', 601)`, [t.g]), /de 1 a 600/);
  });
});
