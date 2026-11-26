// Pase 2.0 · organización (26/11): los datos nuevos de "ver sin entrar" (DISENO.md § Datos). Todo calculado, con reloj fijo (HOY = sábado 14/11, 19 h).
// Cada función: con la llave apagada da error con texto; un usuario de otro gimnasio y un rol sin permiso dan error, nunca una lista vacía.
// Las carreras (dos tildes y dos "deshacer" a la vez) están en pase2-organizacion-carrera.test.mjs, con dos conexiones reales.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { abrir, HOY } from "./_comun.mjs";

let t, u = {}, momento, otro, uOtro;
async function persona(rol, gimnasio = t.g) {
  const [{ id }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`${rol}${Math.random()}@ejemplo.invalid`]);
  await t.q(`insert into public.equipo (gimnasio_id, usuario_id, nombre, rol) values ($1,$2,$3,$4)`, [gimnasio, id, `P ${rol}`, rol]);
  return id;
}
async function como(usuario, fn) {
  await t.db.query("set role authenticated");
  await t.q(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  try { return await fn(); } finally { await t.db.query("reset role"); await t.q(`select set_config('request.jwt.claims', '', false)`); }
}
const llave = (gimnasio, activa) => t.q(`insert into public.funciones_nuevas_gimnasio (gimnasio_id, clave, activa, prendida_en, cambiada_en)
  values ($1, 'pase_2_organizacion', $2, now(), now()) on conflict (gimnasio_id, clave) do update set activa = $2`, [gimnasio, activa]);
/** Un socio con entradas en los días (relativos a HOY) que se le pasan, a las 19 h. */
async function socioCon(nombre, dias) {
  const [{ id }] = await t.q(`insert into public.socios (gimnasio_id, nombre, apellido, telefono) values ($1,$2,'Prueba',$3) returning id`,
    [t.g, nombre, `+549000099${String(Math.floor(Math.random() * 1e4)).padStart(4, "0")}`]);
  for (const d of dias) {
    await t.q(`insert into public.ingresos (gimnasio_id, sede_id, socio_id, momento, via_acceso, resultado, via_habilitante, color, motivo, texto)
               values ($1,$2,$3, privado.medianoche($4::date + $5::int, $6) + interval '19 hours', 'recepcion','entro','membresia','verde','al_dia','Al día')`,
      [t.g, t.sede, id, HOY, d, t.ctx.zona]);
  }
  return id;
}

before(async () => {
  t = await abrir("prueba-pase2-org");
  momento = await t.en(HOY, "20:00:00");
  u.dueno = await persona("dueno"); u.recepcion = await persona("recepcion"); u.profe = await persona("profe");
  [{ id: otro }] = await t.q(`insert into public.gimnasios (slug, nombre) values ('prueba-pase2-otro', 'Otro') returning id`);
  uOtro = await persona("dueno", otro);
  await llave(otro, true);
});
after(async () => t && t.cerrar());

const LECTURAS = [
  ["numeros_socio", () => [`select public.numeros_socio($1, $2, $3) r`, [t.g, t.ctx.socios.al_dia, momento]]],
  ["numeros_socios", () => [`select * from public.numeros_socios($1, $2::uuid[], $3)`, [t.g, [t.ctx.socios.al_dia], momento]]],
  ["volvieron_mes", () => [`select public.volvieron_mes($1, $2) r`, [t.g, momento]]],
  ["plata_en_juego", () => [`select public.plata_en_juego($1, $2) r`, [t.g, momento]]],
  ["transferencias_a_revisar", () => [`select public.transferencias_a_revisar($1) r`, [t.g]]],
  ["hecho_hoy", () => [`select public.hecho_hoy($1, $2) r`, [t.g, momento]]],
];

test("con la llave apagada, cada lectura da error con texto (nunca vacío)", async () => {
  await llave(t.g, false);
  for (const [nombre, armar] of LECTURAS) {
    const [sql, p] = armar();
    await como(u.dueno, () => t.falla(() => t.q(sql, p), /no está prendida/), nombre);
  }
  await como(u.dueno, () => t.falla(() => t.q(`select public.si_cobras_lo_que_falta($1, $2)`, [t.g, momento]), /no está prendida/));
  await llave(t.g, true);
});

test("permisos en negativo: el dueño de otro gimnasio y el profe reciben error en cada lectura y en tildar/deshacer", async () => {
  for (const [nombre, armar] of LECTURAS) {
    const [sql, p] = armar();
    await como(uOtro, () => t.falla(() => t.q(sql, p)), `${nombre} (otro gimnasio)`);
    await como(u.profe, () => t.falla(() => t.q(sql, p)), `${nombre} (profe)`);
  }
  for (const quien of [uOtro, u.profe, u.recepcion]) {
    await como(quien, () => t.falla(() => t.q(`select public.si_cobras_lo_que_falta($1, $2)`, [t.g, momento])));   // Resultado: solo dueño/encargado
  }
  for (const quien of [uOtro, u.profe]) {
    await como(quien, () => t.falla(() => t.q(`select public.tildar_hecho($1, 'llamar', 'Llamé al técnico')`, [t.g])));
    await como(quien, () => t.falla(() => t.q(`select public.deshacer_ultimo_hecho($1)`, [t.g])));
  }
  // Un socio de este gimnasio pedido desde el otro: error, no "sin datos".
  await como(uOtro, () => t.falla(() => t.q(`select public.numeros_socio($1, $2, $3)`, [otro, t.ctx.socios.al_dia, momento]), /no es de este gimnasio/));
  await como(uOtro, () => t.falla(() => t.q(`select * from public.numeros_socios($1, $2::uuid[], $3)`, [otro, [t.ctx.socios.al_dia], momento]), /no son de este gimnasio/));
  // La ocupación es del socio con sesión: el equipo no la pide por él.
  await como(u.dueno, () => t.falla(() => t.q(`select public.ocupacion_por_hora($1, $2, $3)`, [t.g, t.ctx.socios.al_dia, momento]), /Sin permiso/));
});

test("asistencia: última vez, veces este mes, semanas seguidas, mejor racha y cuándo viene", async () => {
  // HOY es sábado 14/11. Viene esta semana (lun 9), las 3 anteriores, falta una y antes había 5 seguidas.
  const dias = [-5, -3, -12, -19, -26, -40, -47, -54, -61, -68];
  const s = await socioCon("Racha", dias);
  const [{ r }] = await como(u.recepcion, () => t.q(`select public.numeros_socio($1, $2, $3) r`, [t.g, s, momento]));
  assert.equal(r.veces_mes, 3, "noviembre: el 2, el 9 y el 11 (días distintos del mes)");
  assert.equal(r.semanas_seguidas, 4);
  assert.equal(r.mejor_racha, 5);
  assert.equal(r.hora_habitual, 19);
  assert.ok(new Date(r.ultima_vez) < momento, "la última vez es antes del momento");
  assert.ok(Array.isArray(r.cuando_viene) && r.cuando_viene.length > 0);
  // La semana en curso sin entradas todavía no corta la racha.
  const s2 = await socioCon("SinEstaSemana", [-7, -14]);
  const [{ r: r2 }] = await como(u.recepcion, () => t.q(`select public.numeros_socio($1, $2, $3) r`, [t.g, s2, momento]));
  assert.equal(r2.semanas_seguidas, 2);
  const filas = await como(u.recepcion, () => t.q(`select * from public.numeros_socios($1, $2::uuid[], $3)`, [t.g, [s, s2], momento]));
  assert.equal(filas.find((f) => f.socio_id === s).veces_mes, 3);
  assert.equal(filas.length, 2);
});

test("plata en juego: vencen hoy y deben con el precio del plan; los totales suman", async () => {
  const [{ r }] = await como(u.recepcion, () => t.q(`select public.plata_en_juego($1, $2) r`, [t.g, momento]));
  for (const k of ["vencen_hoy", "deben", "transferencias", "interesados"]) assert.ok(r[k], `falta ${k}`);
  const suma = Number(r.vencen_hoy.monto) + Number(r.deben.monto) + Number(r.transferencias.monto);
  assert.equal(Number(r.total), suma);
  const vence = r.socios.find((x) => x.socio_id === t.ctx.socios.vence_hoy);
  if (vence) assert.ok(Number(vence.monto) > 0, "el que vence hoy tiene su monto");
  for (const x of r.socios) assert.ok(x.monto !== null, `${x.nombre} sin monto`);
  const [{ r: f }] = await como(u.dueno, () => t.q(`select public.si_cobras_lo_que_falta($1, $2) r`, [t.g, momento]));
  assert.equal(Number(f.total), Number(f.vence_hasta_fin_de_mes.monto) + Number(f.se_debe.monto));
  assert.ok(Number(f.se_debe.monto) >= Number(r.deben.monto) - 0.001);
});

test("transferencias a revisar: Debe $X (plan) y si el comprobante coincide", async () => {
  const s = t.ctx.socios.al_dia;
  const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen, estado) values ($1,$2,$3,'app','pendiente') returning id`, [t.g, t.sede, s]);
  await t.q(`insert into public.venta_items (gimnasio_id, venta_id, tipo, descripcion, cantidad, precio_unitario) values ($1,$2,'otro','Plan Full',1,25000)`, [t.g, v]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, comprobante_path) values ($1,$2,'transferencia',20000,'pendiente','x/comprobante.jpg')`, [t.g, v]);
  const [{ r }] = await como(u.recepcion, () => t.q(`select public.transferencias_a_revisar($1) r`, [t.g]));
  const fila = r.find((x) => x.socio_id === s);
  assert.equal(Number(fila.debe), 25000);
  assert.equal(Number(fila.comprobante), 20000);
  assert.equal(fila.coincide, false);
  assert.equal(fila.plan, "Plan Full");
});

test("volvieron este mes: pagó este mes después de 14 días o más sin venir", async () => {
  const s = await socioCon("Volvio", [-30]);
  const [{ id: v }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen, estado, confirmada_en) values ($1,$2,$3,'recepcion','confirmada', $4) returning id`, [t.g, t.sede, s, momento]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1,$2,'transferencia',25000,'aprobado', $3::timestamptz - interval '2 hours')`, [t.g, v, momento]);
  const [{ r }] = await como(u.dueno, () => t.q(`select public.volvieron_mes($1, $2) r`, [t.g, momento]));
  assert.ok(r.socios.some((x) => x.socio_id === s), "el que volvió está");
  const s2 = await socioCon("NoSeFue", [-2]);
  const [{ id: v2 }] = await t.q(`insert into public.ventas (gimnasio_id, sede_id, socio_id, origen, estado, confirmada_en) values ($1,$2,$3,'recepcion','confirmada', $4) returning id`, [t.g, t.sede, s2, momento]);
  await t.q(`insert into public.pagos (gimnasio_id, venta_id, medio, monto, estado, aprobado_en) values ($1,$2,'transferencia',25000,'aprobado', $3::timestamptz - interval '1 hour')`, [t.g, v2, momento]);
  const [{ r: r2 }] = await como(u.dueno, () => t.q(`select public.volvieron_mes($1, $2) r`, [t.g, momento]));
  assert.equal(r2.cantidad, r2.socios.length);
  // Vino hace 2 días pero no tenía cobertura (vencido): también "volvió a pagar".
  assert.ok(r2.socios.some((x) => x.socio_id === s2), "el vencido que pagó también cuenta");
});

test("ocupación por hora: el socio con sesión ve las últimas 4 semanas del mismo día, sin nombres", async () => {
  const [{ id: usuario }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`socio${Math.random()}@ejemplo.invalid`]);
  const s = await socioCon("Ocupa", [-7, -14, -21]);
  await t.q(`update public.socios set usuario_id = $2 where id = $1`, [s, usuario]);
  const [{ r }] = await como(usuario, () => t.q(`select public.ocupacion_por_hora($1, $2, $3) r`, [t.g, s, momento]));
  assert.equal(r.dia, 6, "sábado");
  const h19 = r.horas.find((x) => x.hora === 19);
  assert.ok(h19 && Number(h19.promedio) >= 0.75, "a las 19 vino gente esos sábados");
  assert.ok(!JSON.stringify(r).includes("Ocupa"), "sin nombres");
  // Otro socio con sesión no puede pedir la de este.
  const [{ id: ajeno }] = await t.q(`insert into auth.users (email) values ($1) returning id`, [`ajeno${Math.random()}@ejemplo.invalid`]);
  await como(ajeno, () => t.falla(() => t.q(`select public.ocupacion_por_hora($1, $2, $3)`, [t.g, s, momento]), /Sin permiso/));
});

test("tildar, hecho hoy y deshacer el último (anula, no borra); lo que sale de un hecho no se tilda a mano", async () => {
  await como(u.recepcion, () => t.falla(() => t.q(`select public.tildar_hecho($1, $2, 'Cobrado')`, [t.g, `pago:${t.ctx.socios.al_dia}`]), /solo cuando pasa/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.tildar_hecho($1, 'llamar', ' ')`, [t.g]), /Falta qué se hizo/));
  const [{ id }] = await como(u.recepcion, () => t.q(`select public.tildar_hecho($1, $2, 'Llamé a Juan') id`, [t.g, `llamar:${t.ctx.socios.al_dia}`]));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.tildar_hecho($1, $2, 'Llamé a Juan')`, [t.g, `llamar:${t.ctx.socios.al_dia}`]), /Ya está tildado/));
  const [{ r }] = await como(u.recepcion, () => t.q(`select public.hecho_hoy($1, now()) r`, [t.g]));
  const fila = r.hechos.find((x) => x.referencia === `llamar:${t.ctx.socios.al_dia}`);
  assert.equal(fila.quien, "P recepcion");
  assert.equal(fila.puedo_deshacer, true);
  // El dueño no deshace lo de la recepción (deshace lo suyo).
  await como(u.dueno, () => t.falla(() => t.q(`select public.deshacer_ultimo_hecho($1)`, [t.g]), /nada tuyo/));
  const [{ c }] = await como(u.recepcion, () => t.q(`select public.deshacer_ultimo_hecho($1) c`, [t.g]));
  assert.equal(c, id);
  const [h] = await t.q(`select anulado_en, anulado_por from public.hechos_para_hacer where id = $1`, [id]);
  assert.ok(h.anulado_en && h.anulado_por, "queda anulado, con quién");
  await como(u.recepcion, () => t.falla(() => t.q(`select public.deshacer_ultimo_hecho($1)`, [t.g]), /nada tuyo/));
  // Deshecho, se puede volver a tildar.
  await como(u.recepcion, () => t.q(`select public.tildar_hecho($1, $2, 'Llamé a Juan')`, [t.g, `llamar:${t.ctx.socios.al_dia}`]));
});

test("la tabla nueva: RLS prendida y nadie escribe directo", async () => {
  const [{ rls }] = await t.q(`select relrowsecurity rls from pg_class where oid = 'public.hechos_para_hacer'::regclass`);
  assert.equal(rls, true);
  const [{ e }] = await t.q(`select id e from public.equipo where usuario_id = $1`, [u.recepcion]);
  await como(u.recepcion, () => t.falla(() => t.q(`insert into public.hechos_para_hacer (gimnasio_id, dia, referencia, texto, hecho_por) values ($1, $2, 'llamar', 'xx', $3)`, [t.g, HOY, e])));
});


test("columnas de Socios y Su historia: llave, permisos en negativo y lo que muestran", async () => {
  const s = await socioCon("Fila", [-1, -2]);
  // Con la llave apagada, error (nunca vacío).
  await llave(t.g, false);
  await como(u.recepcion, () => t.falla(() => t.q(`select public.numeros_fila_socio($1)`, [s]), /no está prendida/));
  await como(u.recepcion, () => t.falla(() => t.q(`select public.historia_socio($1, $2)`, [t.g, s]), /no está prendida/));
  await llave(t.g, true);
  // Otro gimnasio y el profe: error.
  for (const quien of [uOtro, u.profe]) {
    await como(quien, () => t.falla(() => t.q(`select public.numeros_fila_socio($1)`, [s])));
    await como(quien, () => t.falla(() => t.q(`select public.historia_socio($1, $2)`, [t.g, s])));
  }
  await como(uOtro, () => t.falla(() => t.q(`select public.historia_socio($1, $2)`, [otro, s]), /no es de este gimnasio/));
  // Lo que muestran (las entradas son inmutables: las del socio de prueba, de hace días; numeros_fila_socio mira la hora real).
  const [{ r }] = await como(u.recepcion, () => t.q(`select public.numeros_fila_socio($1) r`, [s]));
  assert.ok(r.ultima_vez, "tiene última vez");
  assert.ok(Number(r.veces_mes) >= 0);
  const [{ h }] = await como(u.recepcion, () => t.q(`select public.historia_socio($1, $2) h`, [t.g, s]));
  assert.ok(h.some((x) => x.tipo === "entrada"), "la historia trae las entradas");
  assert.ok(h.every((x, i) => i === 0 || new Date(h[i - 1].en) >= new Date(x.en)), "de la más nueva a la más vieja");
  // En el lote: una por cada fila de una lectura anterior, en el mismo viaje.
  const [{ l }] = await como(u.recepcion, () => t.q(`select public.lote_lecturas($1::jsonb) l`, [JSON.stringify([
    { f: "buscar_socios", a: { p_gimnasio_id: t.g, p_texto: "Fila", p_limite: 5 } },
    { f: "numeros_fila_socio", cada: { i: 0, campo: "socio_id", arg: "p_socio_id" }, t: true },
  ])]));
  assert.ok(l[1] && l[1][s], "el lote trae los números de cada fila");
});
